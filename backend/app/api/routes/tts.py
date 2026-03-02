"""
Route: POST /api/tts  — Polly text-to-speech
Returns a pre-signed S3 URL to an MP3.
"""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.polly import synthesize_speech

router = APIRouter()


class TTSRequest(BaseModel):
    text:     str
    language: str = "hindi"


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="text cannot be empty.")
    try:
        url = synthesize_speech(req.text, req.language)
        return {"success": True, "audio_url": url}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
