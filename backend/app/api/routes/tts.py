"""
Route: POST /api/tts — Amazon Polly Text-to-Speech
Returns a pre-signed S3 URL to an MP3 synthesized with Polly Neural voices.
"""

from __future__ import annotations
import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.polly import synthesize_speech
from app.utils.dynamo import log_event

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    language: str = "hindi"


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="text cannot be empty.")
    try:
        url = await asyncio.to_thread(synthesize_speech, req.text, req.language)
        log_event("tts_requested", {"language": req.language, "text_length": len(req.text)})
        return {"success": True, "audio_url": url}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
