"""
Route: POST /api/parse-voice
Parses a raw transcript into structured farm data using Bedrock Claude.

Route: POST /api/transcribe  (optional — for when frontend sends raw audio)
Sends audio to Amazon Transcribe then pipes the transcript to /parse-voice logic.
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.schemas import ParseVoiceRequest, TranscribeRequest, TranscribeResponse
from app.services import bedrock, transcribe as transcribe_svc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/parse-voice")
async def parse_voice(req: ParseVoiceRequest):
    """
    Accepts a plain-text transcript (from browser STT or Transcribe)
    and returns structured farm data JSON.
    """
    if not req.transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript cannot be empty.")

    try:
        parsed = bedrock.parse_voice(req.transcript, req.language)
    except Exception as e:
        logger.error("Voice parse error: %s", e)
        raise HTTPException(status_code=502, detail=f"Parse failed: {e}")

    return {"success": True, "data": parsed}


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(req: TranscribeRequest):
    """
    Accepts base64-encoded audio and returns the transcript via Amazon Transcribe.
    Use this endpoint to replace browser webkitSpeechRecognition.
    """
    if not req.audio_base64.strip():
        raise HTTPException(status_code=422, detail="audio_base64 cannot be empty.")

    try:
        transcript = transcribe_svc.transcribe_audio(req.audio_base64, req.language)
        return TranscribeResponse(success=True, transcript=transcript, language=req.language)
    except RuntimeError as e:
        logger.error("Transcribe error: %s", e)
        return TranscribeResponse(success=False, error=str(e))
    except Exception as e:
        logger.error("Unexpected transcribe error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
