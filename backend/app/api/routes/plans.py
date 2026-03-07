"""
Route: POST /api/generate-plan
Streams the agritourism plan from Bedrock using SSE.

Frontend sends flat FarmDataIn body.
Frontend reads SSE:
  data: {"type":"delta","text":"..."}      ← live typing chunks
  data: {"type":"complete","data":{...}}   ← final parsed JSON
  data: {"type":"error","message":"..."}   ← on failure
"""

from __future__ import annotations
import asyncio
import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.schemas import FarmDataIn
from app.services import bedrock
from app.middleware.auth import AuthUser, require_auth
from app.utils.dynamo import log_event, save_plan, get_plans_for_user, delete_plan

logger = logging.getLogger(__name__)
router = APIRouter()


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _strip_fences(text: str) -> str:
    """Remove markdown code fences like ```json ... ``` from LLM output."""
    text = text.strip()
    text = re.sub(r'^```[a-z]*\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return text.strip()


def _parse_plan(raw: str) -> dict:
    """
    Robustly parse the accumulated stream text into a plan dict.
    Tries multiple strategies before giving up.
    """
    attempts: list[str] = []

    # Strategy 1: strip fences, parse directly
    clean = _strip_fences(raw)
    attempts.append(clean)

    # Strategy 2: find the outermost { ... } block (handles leading/trailing prose)
    brace_match = re.search(r'(\{[\s\S]*\})', clean)
    if brace_match:
        attempts.append(brace_match.group(1))

    # Strategy 3: also try on the original raw text (sometimes fences inside brace block)
    brace_match_raw = re.search(r'(\{[\s\S]*\})', raw)
    if brace_match_raw:
        attempts.append(brace_match_raw.group(1))

    # Strategy 4: greedily find last closing brace (handles truncated trailing text)
    last_close = raw.rfind('}')
    first_open = raw.find('{')
    if first_open != -1 and last_close != -1 and last_close > first_open:
        attempts.append(raw[first_open:last_close + 1])

    last_error: Exception = ValueError("Empty input")
    seen: set[str] = set()
    for candidate in attempts:
        candidate = candidate.strip()
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        try:
            result = json.loads(candidate)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError as exc:
            last_error = exc

    raise last_error


@router.post("/generate-plan")
async def generate_plan(req: FarmDataIn, user: AuthUser = Depends(require_auth)):
    """
    Accepts flat farm data. Streams plan JSON chunks as SSE with live typing.
    """
    farm_dict = req.model_dump()
    language = farm_dict.get("language", "hindi")

    if not farm_dict.get("landSize") or not farm_dict.get("location"):
        raise HTTPException(
            status_code=422,
            detail="landSize and location are required to generate a plan.",
        )

    async def event_stream():
        raw_text = ""
        try:
            # Run synchronous Bedrock streaming generator in a thread pool
            # and yield each chunk immediately for live typing effect
            loop = asyncio.get_event_loop()
            queue: asyncio.Queue[str | None] = asyncio.Queue()

            def producer():
                """Runs in thread — pushes chunks into the async queue."""
                try:
                    for chunk in bedrock.stream_plan(farm_dict, language):
                        loop.call_soon_threadsafe(queue.put_nowait, chunk)
                except Exception as exc:
                    loop.call_soon_threadsafe(queue.put_nowait, exc)
                finally:
                    loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

            # Start producer in background thread
            loop.run_in_executor(None, producer)

            # Consume chunks as they arrive and send delta SSE events
            while True:
                item = await queue.get()

                if item is None:
                    # Stream finished
                    break

                if isinstance(item, Exception):
                    logger.error("Stream producer error: %s", item)
                    yield _sse({"type": "error", "message": str(item)})
                    return

                # Accumulate and send delta immediately for live typing
                raw_text += item
                yield _sse({"type": "delta", "text": item})

            # Stream done — parse the full accumulated text
            if not raw_text.strip():
                yield _sse({"type": "error", "message": "Model returned an empty response."})
                return

            try:
                plan_data = _parse_plan(raw_text)
            except (json.JSONDecodeError, ValueError) as exc:
                logger.error("JSON parse failed. Raw text (first 800): %s", raw_text[:800])
                # Send raw text so frontend can render it gracefully
                yield _sse({"type": "raw", "text": raw_text})
                return

            log_event("plan_generated", {
                "language": language,
                "location": farm_dict.get("location"),
                "service":  plan_data.get("recommendedService"),
                "score":    plan_data.get("suitabilityScore"),
                "user":     user.phone,
            })

            # Persist plan to DynamoDB for the user's "Saved Plans" history
            plan_id = save_plan(
                user_id=user.sub,
                farm_data=farm_dict,
                plan_data=plan_data,
                language=language,
            )
            if plan_id:
                plan_data["_planId"] = plan_id   # surface planId to frontend

            yield _sse({"type": "complete", "data": plan_data})

        except Exception as exc:
            logger.error("Plan generation error: %s", exc, exc_info=True)
            yield _sse({"type": "error", "message": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/plans")
async def list_plans(user: AuthUser = Depends(require_auth)):
    """
    Return all saved plans for the authenticated user, newest first.
    GET /api/plans
    """
    plans = get_plans_for_user(user.sub)
    return {"success": True, "plans": plans}


@router.delete("/plans/{plan_id}")
async def remove_plan(plan_id: str, user: AuthUser = Depends(require_auth)):
    """
    Delete a specific saved plan for the authenticated user.
    DELETE /api/plans/{plan_id}
    """
    ok = delete_plan(user_id=user.sub, plan_id=plan_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete plan.")
    log_event("plan_deleted", {"user": user.phone, "planId": plan_id})
    return {"success": True}
