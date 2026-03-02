"""
Route: POST /api/generate-plan
Streams the agritourism plan from Bedrock Claude 3.5 Sonnet using SSE.
"""

from __future__ import annotations
import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.schemas import GeneratePlanRequest
from app.services import bedrock

logger = logging.getLogger(__name__)
router = APIRouter()


def _sse(payload: dict) -> str:
    """Format a server-sent event line."""
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/generate-plan")
async def generate_plan(req: GeneratePlanRequest):
    """
    Streams plan JSON chunks as SSE.
    Frontend reads: data: {"type":"delta","text":"..."}
                    data: {"type":"complete","data":{...}}
                    data: {"type":"error","message":"..."}
    """
    farm_dict = req.farmData.model_dump(by_alias=True)
    language  = req.language or farm_dict.get("language", "hindi")

    # Validate minimum required fields
    if not farm_dict.get("landSize") or not farm_dict.get("location"):
        raise HTTPException(
            status_code=422,
            detail="landSize and location are required to generate a plan.",
        )

    def event_stream():
        raw_text = ""
        try:
            for chunk in bedrock.stream_plan(farm_dict, language):
                raw_text += chunk
                yield _sse({"type": "delta", "text": chunk})

            # Attempt to parse the accumulated JSON
            try:
                # Strip any accidental markdown fences
                clean = raw_text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
                plan_data = json.loads(clean)
            except json.JSONDecodeError:
                # Return raw text as fallback — frontend handles it
                plan_data = {"raw": raw_text}

            # Guardrail check (non-blocking)
            bedrock.apply_guardrail(raw_text[:500])

            yield _sse({"type": "complete", "data": plan_data})

        except Exception as e:
            logger.error("Plan generation error: %s", e)
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
