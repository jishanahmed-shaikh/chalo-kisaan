"""
Amazon Transcribe service — audio → text for Hindi, Marathi, English etc.
Audio bytes are uploaded to S3 first (Transcribe requires S3 URI).
"""

from __future__ import annotations
import base64
import json
import logging
import time
import uuid
import urllib.request

import boto3
from botocore.exceptions import ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Language code mapping
LANG_CODE_MAP = {
    "hindi":   "hi-IN",
    "marathi": "mr-IN",
    "english": "en-IN",
    "punjabi": "pa-IN",
    "gujarati":"gu-IN",
}


def _transcribe_client():
    return boto3.client(
        "transcribe",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


def transcribe_audio(audio_base64: str, language: str = "hindi") -> str:
    """
    Decode base64 audio, upload to S3, start a Transcribe job,
    poll until complete, and return the transcript text.

    Raises RuntimeError on failure.
    """
    lang_code = LANG_CODE_MAP.get(language, "hi-IN")
    audio_bytes = base64.b64decode(audio_base64)

    job_name = f"ck-{uuid.uuid4().hex}"
    s3_key   = f"audio-temp/{job_name}.webm"

    s3 = _s3_client()
    transcribe = _transcribe_client()

    # 1. Upload audio to S3
    logger.info("Uploading audio to s3://%s/%s", settings.S3_AUDIO_TEMP_BUCKET, s3_key)
    s3.put_object(
        Bucket=settings.S3_AUDIO_TEMP_BUCKET,
        Key=s3_key,
        Body=audio_bytes,
        ContentType="audio/webm",
    )

    # 2. Start transcription job
    logger.info("Starting Transcribe job %s (lang=%s)", job_name, lang_code)
    start_params: dict = {
        "TranscriptionJobName": job_name,
        "Media": {"MediaFileUri": f"s3://{settings.S3_AUDIO_TEMP_BUCKET}/{s3_key}"},
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

    # 3. Poll for result (max 60s)
    for _ in range(60):
        result = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        status = result["TranscriptionJob"]["TranscriptionJobStatus"]

        if status == "COMPLETED":
            uri = result["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
            with urllib.request.urlopen(uri) as resp:
                data = json.loads(resp.read())
                transcript = data["results"]["transcripts"][0]["transcript"]
                logger.info("Transcribe job %s completed: %s…", job_name, transcript[:50])
                return transcript

        elif status == "FAILED":
            reason = result["TranscriptionJob"].get("FailureReason", "Unknown")
            raise RuntimeError(f"Transcribe job failed: {reason}")

        time.sleep(1)

    raise RuntimeError("Transcribe job timed out after 60 seconds")


def register_custom_vocabulary() -> None:
    """
    One-time setup: register agriculture-specific Hindi vocabulary.
    Run this once after AWS credentials are configured.
    """
    transcribe = _transcribe_client()
    phrases = [
        "एकड़", "हेक्टेयर", "बाजरा", "गेहूं", "धान",
        "ड्रिप इरिगेशन", "ऑर्गेनिक फार्मिंग", "एग्रीटूरिज्म",
        "होमस्टे", "किसान", "खेती", "फसल", "मिट्टी",
        "सिंचाई", "ट्यूबवेल", "बोरवेल",
    ]
    try:
        transcribe.create_vocabulary(
            VocabularyName=settings.TRANSCRIBE_CUSTOM_VOCAB,
            LanguageCode="hi-IN",
            Phrases=phrases,
        )
        logger.info("Custom vocabulary '%s' created.", settings.TRANSCRIBE_CUSTOM_VOCAB)
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConflictException":
            logger.info("Custom vocabulary already exists.")
        else:
            raise
