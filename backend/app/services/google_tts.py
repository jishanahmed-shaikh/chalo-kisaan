"""
Google Cloud Text-to-Speech service — natural Indian voices with S3 caching.
Generated MP3s are cached in S3 to avoid re-synthesizing identical narrations.
"""

from __future__ import annotations
import hashlib
import logging
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from google.cloud import texttospeech

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Google Cloud TTS Voice mapping: language -> (voice_name, ssml_gender)
# Using premium neural voices for natural Indian accent
VOICE_MAP = {
    "hindi": {
        "language_code": "hi-IN",
        "name": "hi-IN-Neural2-A",  # Female, premium neural voice
        "ssml_gender": texttospeech.SsmlVoiceGender.FEMALE,
    },
    "english": {
        "language_code": "en-IN",
        "name": "en-IN-Neural2-A",  # Female, Indian English, premium neural
        "ssml_gender": texttospeech.SsmlVoiceGender.FEMALE,
    },
    "marathi": {
        "language_code": "hi-IN",
        "name": "hi-IN-Neural2-A",  # Fallback to Hindi
        "ssml_gender": texttospeech.SsmlVoiceGender.FEMALE,
    },
    "punjabi": {
        "language_code": "en-IN",
        "name": "en-IN-Neural2-A",  # Fallback to English
        "ssml_gender": texttospeech.SsmlVoiceGender.FEMALE,
    },
    "gujarati": {
        "language_code": "en-IN",
        "name": "en-IN-Neural2-A",  # Fallback to English
        "ssml_gender": texttospeech.SsmlVoiceGender.FEMALE,
    },
}


@lru_cache()
def _gcloud_tts_client():
    """Create Google Cloud TTS client (uses GOOGLE_APPLICATION_CREDENTIALS env var)."""
    return texttospeech.TextToSpeechClient()


@lru_cache()
def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        config=BotoConfig(retries={"mode": "standard", "max_attempts": 3}),
    )


def synthesize_speech(text: str, language: str = "hindi") -> str:
    """
    Synthesize text to MP3 using Google Cloud Text-to-Speech.
    Returns a pre-signed S3 URL to the audio file.
    Uses content-hash based caching — same text + voice = instant return.
    
    Args:
        text: Text to synthesize
        language: Language code (hindi, english, marathi, punjabi, gujarati)
    
    Returns:
        Pre-signed S3 URL to the MP3 file
    """
    voice_config = VOICE_MAP.get(language, VOICE_MAP["hindi"])
    voice_id = voice_config["name"]
    lang_code = voice_config["language_code"]

    # Build cache key from text + voice fingerprint
    fingerprint = hashlib.md5(f"{text}{voice_id}{lang_code}".encode()).hexdigest()
    cache_key = f"tts-cache/{fingerprint}.mp3"
    bucket = settings.S3_ASSETS_BUCKET

    s3 = _s3_client()

    # Check cache
    try:
        s3.head_object(Bucket=bucket, Key=cache_key)
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": cache_key},
            ExpiresIn=3600,
        )
        logger.debug("Google TTS cache hit for key: %s", cache_key)
        return url
    except ClientError:
        pass  # Cache miss — synthesize

    logger.info("Synthesizing speech via Google Cloud TTS (%s, lang=%s, %d chars)", 
                voice_id, lang_code, len(text))

    # Prepare synthesis input
    synthesis_input = texttospeech.SynthesisInput(text=text)

    # Configure voice (using premium neural voices)
    voice = texttospeech.VoiceSelectionParams(
        language_code=lang_code,
        name=voice_id,
        ssml_gender=voice_config["ssml_gender"],
    )

    # Configure audio output
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=0.95,  # Slightly slower for clarity
        pitch=0.0,  # Natural pitch
    )

    # Synthesize speech
    client = _gcloud_tts_client()
    try:
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
    except Exception as e:
        logger.error("Google Cloud TTS synthesis failed: %s", e)
        raise RuntimeError(f"TTS synthesis failed: {str(e)}") from e

    # Save to S3
    try:
        s3.put_object(
            Bucket=bucket,
            Key=cache_key,
            Body=response.audio_content,
            ContentType="audio/mpeg",
            CacheControl="max-age=86400",
        )
        logger.info("Saved audio to s3://%s/%s", bucket, cache_key)
    except ClientError as e:
        logger.error("Failed to save audio to S3: %s", e)
        raise RuntimeError(f"S3 upload failed: {str(e)}") from e

    # Generate pre-signed URL
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": cache_key},
        ExpiresIn=3600,
    )
    return url
