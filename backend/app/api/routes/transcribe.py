"""
Route: POST /api/transcribe — Amazon Transcribe speech-to-text

Two call modes:
  1. multipart/form-data  — audio=<file> & language=<str>   (from useAwsTranscribe hook)
  2. application/json     — { audio_base64: str, language: str }   (legacy via /transcribe/base64)

Returns:
  { "success": true, "transcript": str, "is_final": bool }
"""

from __future__ import annotations
import asyncio
import base64
import logging

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from app.services.transcribe import transcribe_audio
from app.utils.dynamo import log_event

router = APIRouter()
logger = logging.getLogger(__name__)


class TranscribeRequest(BaseModel):
    audio_base64: str          # base64-encoded audio bytes from the browser
    language: str = "hindi"   # hindi | marathi | punjabi | gujarati | english


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str     = Form(default="hindi"),
):
    """Accept audio as a multipart file upload (from the browser MediaRecorder hook)."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    audio_b64 = base64.b64encode(audio_bytes).decode()

    try:
        transcript = await asyncio.to_thread(
            transcribe_audio, audio_b64, language
        )
        log_event("transcribe_requested", {
            "language": language,
            "audio_size_bytes": len(audio_bytes),
        })
        return {"success": True, "transcript": transcript, "is_final": True}
    except Exception as e:
        logger.error("Transcribe error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/transcribe/base64")
async def transcribe_base64(req: TranscribeRequest):
    """Legacy JSON endpoint — accepts audio_base64."""
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
        return {"success": True, "transcript": transcript, "is_final": True}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
