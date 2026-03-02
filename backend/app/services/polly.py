"""
Amazon Polly service — text-to-speech with S3 caching.
Generated MP3s are cached in S3 to avoid re-synthesising identical narrations.
"""

from __future__ import annotations
import hashlib
import logging

import boto3
from botocore.exceptions import ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Voice mapping: language → (VoiceId, Engine, LanguageCode)
VOICE_MAP = {
    "hindi":   ("Kajal",  "neural",   "hi-IN"),
    "english": ("Aditi",  "standard", "en-IN"),
    "marathi": ("Kajal",  "neural",   "hi-IN"),   # Polly has no Marathi neural — use Hindi
    "punjabi": ("Aditi",  "standard", "en-IN"),   # fallback
    "gujarati":("Aditi",  "standard", "en-IN"),   # fallback
}


def _polly_client():
    return boto3.client(
        "polly",
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


def synthesize_speech(text: str, language: str = "hindi") -> str:
    """
    Synthesize text to MP3.
    Returns a public S3 URL (or pre-signed URL) to the audio file.
    Uses content-hash based caching — same text + voice = instant return.
    """
    voice_id, engine, lang_code = VOICE_MAP.get(language, VOICE_MAP["hindi"])

    # Build cache key from text + voice fingerprint
    fingerprint = hashlib.md5(f"{text}{voice_id}{lang_code}".encode()).hexdigest()
    cache_key   = f"{settings.POLLY_S3_CACHE_PREFIX}/{fingerprint}.mp3"
    bucket      = settings.S3_ASSETS_BUCKET

    s3     = _s3_client()
    polly  = _polly_client()

    # Check cache
    try:
        s3.head_object(Bucket=bucket, Key=cache_key)
        # Cache hit — generate pre-signed URL (valid 1 hour)
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": cache_key},
            ExpiresIn=3600,
        )
        logger.debug("Polly cache hit for key: %s", cache_key)
        return url
    except ClientError:
        pass  # Cache miss — synthesize

    logger.info("Synthesizing speech (%s, %s, %s chars)", voice_id, lang_code, len(text))
    response = polly.synthesize_speech(
        Text=text,
        OutputFormat="mp3",
        VoiceId=voice_id,
        Engine=engine,
        LanguageCode=lang_code,
    )

    # Save to S3
    s3.put_object(
        Bucket=bucket,
        Key=cache_key,
        Body=response["AudioStream"].read(),
        ContentType="audio/mpeg",
        CacheControl="max-age=86400",
    )

    # Return pre-signed URL
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": cache_key},
        ExpiresIn=3600,
    )
    return url
