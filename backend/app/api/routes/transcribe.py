"""
Route: POST /api/transcribe — Amazon Transcribe speech-to-text
Accepts base64-encoded audio (webm/ogg from browser MediaRecorder).
Returns the transcript text.
"""

from __future__ import annotations
import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.transcribe import transcribe_audio
from app.utils.dynamo import log_event

router = APIRouter()


class TranscribeRequest(BaseModel):
    audio_base64: str          # base64-encoded audio bytes from the browser
    language: str = "hindi"   # hindi | marathi | punjabi | gujarati | english


@router.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    if not req.audio_base64.strip():
        raise HTTPException(status_code=422, detail="audio_base64 cannot be empty.")
    try:
        transcript = await asyncio.to_thread(
            transcribe_audio, req.audio_base64, req.language
        )
        log_event("transcribe_requested", {
            "language": req.language,
            "audio_size_b64": len(req.audio_base64),
        })
        return {"success": True, "transcript": transcript}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))