"""
Amazon Transcribe service — audio -> text for Hindi, Marathi, English etc.
Audio bytes are uploaded to S3 first (Transcribe requires S3 URI).
Uses cached boto3 clients.
"""

from __future__ import annotations
import base64
import json
import logging
import time
import uuid
import urllib.request
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Language code mapping
LANG_CODE_MAP = {
    "hindi":    "hi-IN",
    "marathi":  "mr-IN",
    "english":  "en-IN",
    "punjabi":  "pa-IN",
    "gujarati": "gu-IN",
}


@lru_cache()
def _transcribe_client():
    return boto3.client(
        "transcribe",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        config=BotoConfig(retries={"mode": "standard", "max_attempts": 3}),
    )


@lru_cache()
def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        config=BotoConfig(retries={"mode": "standard", "max_attempts": 3}),
    )


def transcribe_audio(audio_base64: str, language: str = "hindi") -> str:
    """
    Decode base64 audio, upload to S3, start a Transcribe job,
    poll until complete, and return the transcript text.

    Raises RuntimeError on failure.
    """
    # Dev/test mode: if AWS_ACCESS_KEY_ID is not set, return a demo response
    if not settings.AWS_ACCESS_KEY_ID:
        logger.warning("AWS credentials not configured. Returning demo transcript.")
        demo_responses = {
            "hindi": "नमस्ते, यह एक परीक्षण है।",
            "english": "Hello, this is a test.",
            "marathi": "नमस्कार, हे एक चाचणी आहे.",
            "punjabi": "ਨਮਸਤੇ, ਇਹ ਇਕ ਪ ਰੀਖਤ ਹੈ।",
            "gujarati": "નમસ્તે, આ એક પરીક્ષણ છે।",
        }
        return demo_responses.get(language, "Demo transcript")

    lang_code = LANG_CODE_MAP.get(language, "hi-IN")
    audio_bytes = base64.b64decode(audio_base64)

    job_name = f"ck-{uuid.uuid4().hex}"
    s3_key = f"audio-temp/{job_name}.webm"

    s3 = _s3_client()
    transcribe = _transcribe_client()

    # 1. Upload audio to S3
    bucket = settings.S3_AUDIO_TEMP_BUCKET
    logger.info("Uploading audio to s3://%s/%s", bucket, s3_key)
    s3.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=audio_bytes,
        ContentType="audio/webm",
    )

    # 2. Start transcription job
    logger.info("Starting Transcribe job %s (lang=%s)", job_name, lang_code)
    start_params: dict = {
        "TranscriptionJobName": job_name,
        "Media": {"MediaFileUri": f"s3://{bucket}/{s3_key}"},
        "MediaFormat": "webm",
        "LanguageCode": lang_code,
    }
    # Add custom vocabulary if configured
    if settings.TRANSCRIBE_CUSTOM_VOCAB:
        start_params["Settings"] = {
            "ShowSpeakerLabels": False,
            "VocabularyName": settings.TRANSCRIBE_CUSTOM_VOCAB,
        }

    transcribe.start_transcription_job(**start_params)

    # 3. Poll with exponential backoff (max ~90s)
    delay = 0.5
    elapsed = 0.0
    max_wait = 90.0

    while elapsed < max_wait:
        result = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        status = result["TranscriptionJob"]["TranscriptionJobStatus"]

        if status == "COMPLETED":
            uri = result["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
            with urllib.request.urlopen(uri) as resp:
                data = json.loads(resp.read())
                transcript = data["results"]["transcripts"][0]["transcript"]
                logger.info("Transcribe job %s completed: %s...", job_name, transcript[:50])

            # Clean up temp audio
            try:
                s3.delete_object(Bucket=bucket, Key=s3_key)
            except ClientError:
                pass

            return transcript

        elif status == "FAILED":
            reason = result["TranscriptionJob"].get("FailureReason", "Unknown")
            raise RuntimeError(f"Transcribe job failed: {reason}")

        time.sleep(delay)
        elapsed += delay
        delay = min(delay * 2, 5.0)  # exponential backoff, cap at 5s

    raise RuntimeError("Transcribe job timed out after 90 seconds")
