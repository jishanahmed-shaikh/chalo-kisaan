"""
Route: POST /api/assistant/chat
Context-aware AI farming assistant powered by Bedrock.

Features:
  - Receives user's message + conversation history
  - Injects the user's farm context (latest saved plan from DynamoDB)
  - FAQ knowledge base for common agritourism questions
  - Agrotourism expert persona
  - Nearby marketplace / mandi info (location-aware)
  - Strict language enforcement — reply entirely in the user's chosen language
  - RAG with the user's generated reports

Response is streamed as SSE for live typing in the chat UI.
"""

from __future__ import annotations
import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.middleware.auth import AuthUser, require_auth
from app.services.bedrock import chat_with_assistant
from app.services.cognito import get_user_profile
from app.utils.dynamo import get_plans_for_user, log_event

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessage(BaseModel):
    role: str        # "user" or "ai"
    text: str


class AssistantChatRequest(BaseModel):
    message: str
    language: str = "hindi"
    history: list[ChatMessage] = []
    location: dict | None = None  # Optional: {latitude, longitude, address} from frontend


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _build_farm_context(user: AuthUser) -> dict:
    """
    Gather the user's farm context from DynamoDB saved plans.
    Returns a dict with farm details and plan summary for injection into the prompt.
    """
    plans = get_plans_for_user(user.sub)
    if not plans:
        return {"hasPlan": False}

    # Use the most recent plan
    latest = plans[0]
    farm = latest.get("farmData", {})
    plan = latest.get("planData", {})

    return {
        "hasPlan": True,
        "location": farm.get("location", ""),
        "landSize": farm.get("landSize", ""),
        "soilType": farm.get("soilType", ""),
        "waterSource": farm.get("waterSource", ""),
        "budget": farm.get("budget", ""),
        "biodiversity": farm.get("biodiversity", ""),
        "existingInfrastructure": farm.get("existingInfrastructure", ""),
        "recommendedService": plan.get("recommendedService", ""),
        "suitabilityScore": plan.get("suitabilityScore", 0),
        "monthlyRevenueEstimate": plan.get("monthlyRevenueEstimate", 0),
        "totalSetupCost": plan.get("totalSetupCost", 0),
        "setupPhases": plan.get("setupPhases", []),
        "revenueStreams": plan.get("revenueStreams", []),
        "govtSchemes": plan.get("govtSchemes", []),
        "riskFactors": plan.get("riskFactors", []),
        "uniqueExperiences": plan.get("uniqueExperiences", []),
        "seasonalCalendar": plan.get("seasonalCalendar", {}),
        "targetTourists": plan.get("targetTourists", ""),
        "breakEvenMonths": plan.get("breakEvenMonths", 0),
    }


def _build_user_context(user: AuthUser) -> dict:
    """Fetch user profile from Cognito for personalization."""
    try:
        profile = get_user_profile(user.phone)
        return {
            "name": profile.get("given_name", ""),
            "address": profile.get("address", ""),
        }
    except Exception:
        return {"name": "", "address": ""}


@router.post("/assistant/chat")
async def assistant_chat(req: AssistantChatRequest, user: AuthUser = Depends(require_auth)):
    """
    Context-aware AI chat — streams response as SSE.
    Injects farm context, FAQ knowledge, marketplace info.
    """
    farm_ctx = _build_farm_context(user)
    user_ctx = _build_user_context(user)

    # Merge frontend-supplied geolocation into user context
    if req.location:
        # Frontend may send {latitude, longitude, address}
        geo_address = req.location.get("address", "")
        geo_lat = req.location.get("latitude")
        geo_lng = req.location.get("longitude")
        # Prefer the Cognito profile address; fall back to frontend geolocation address
        if not user_ctx.get("address") and geo_address:
            user_ctx["address"] = geo_address
        if geo_lat and geo_lng:
            user_ctx["coordinates"] = f"{geo_lat:.4f},{geo_lng:.4f}"

    # Build conversation history for Bedrock
    conv_history = []
    for msg in req.history[-10:]:  # Keep last 10 messages for context window
        conv_history.append({
            "role": "user" if msg.role == "user" else "assistant",
            "content": msg.text,
        })

    async def event_stream():
        full_text = ""
        try:
            loop = asyncio.get_event_loop()
            queue: asyncio.Queue[str | None] = asyncio.Queue()

            def producer():
                try:
                    for chunk in chat_with_assistant(
                        message=req.message,
                        language=req.language,
                        farm_context=farm_ctx,
                        user_context=user_ctx,
                        history=conv_history,
                    ):
                        loop.call_soon_threadsafe(queue.put_nowait, chunk)
                except Exception as exc:
                    loop.call_soon_threadsafe(queue.put_nowait, exc)
                finally:
                    loop.call_soon_threadsafe(queue.put_nowait, None)

            loop.run_in_executor(None, producer)

            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, Exception):
                    logger.error("Assistant stream error: %s", item)
                    yield _sse({"type": "error", "message": str(item)})
                    return

                full_text += item
                yield _sse({"type": "delta", "text": item})

            if not full_text.strip():
                yield _sse({"type": "error", "message": "Empty response from AI."})
                return

            yield _sse({"type": "complete", "text": full_text})

            log_event("assistant_chat", {
                "user": user.phone,
                "language": req.language,
                "query_preview": req.message[:100],
            })

        except Exception as exc:
            logger.error("Assistant chat error: %s", exc, exc_info=True)
            yield _sse({"type": "error", "message": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
