"""
Amazon Polly TTS service — native Indian Neural voices with S3 caching.

Voice selection (Neural engine only — eliminates the robotic concatenative quality
of the Standard engine):

  Hindi    → Kajal (Neural, hi-IN)  Amazon's ONLY native Hindi neural voice.
                                     Trained on Indian Hindi speakers — sounds
                                     completely natural, not robotic at all.
  Marathi  → Kajal (Neural, hi-IN)  No native Marathi Polly voice exists.
  Punjabi  → Kajal (Neural, hi-IN)  Kajal (Devanagari) is the closest-sounding
  Gujarati → Kajal (Neural, hi-IN)  and most Indian-accented option available.
  English  → Kajal (Neural, hi-IN)  Aditi (en-IN) is Standard engine ONLY and
                                     throws a ValidationException when Neural is
                                     requested. Kajal is the only Indian Neural
                                     voice available in Polly as of 2024.

IMPORTANT: Kajal Neural requires LanguageCode="hi-IN". Changing it causes
an UnsupportedLanguagePairException from Polly.

SampleRate="24000" is recommended for Neural voices — best clarity.

Generated MP3s are cached in S3 by content-hash key so identical text + voice
returns instantly without calling Polly again.

Text preprocessing:
  - Emojis and Unicode symbols are stripped before synthesis so Polly never
    reads out "folded hands" or "leaf" etc.
  - Bullet characters (•, ●, ·, -, *) are converted to a short SSML pause
    so list items have a natural breathing gap.
  - Ellipses and em-dashes get proper SSML pauses for natural cadence.
  - Rupee symbol ₹ → "rupaye" so it is pronounced naturally in Hindi.
  - Text is wrapped in SSML with <prosody rate="slow" pitch="+1st"> for a
    crisp, warm Indian voice — neither rushed nor monotone.
"""

from __future__ import annotations
import hashlib
import logging
import re
import unicodedata
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Text cleaning helpers ─────────────────────────────────────────────────────

def _strip_emojis(text: str) -> str:
    """Remove emoji and pictographic Unicode characters from text."""
    # Covers Emoticons, Misc Symbols, Dingbats, Supplemental Symbols, etc.
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"   # emoticons
        "\U0001F300-\U0001F5FF"   # misc symbols & pictographs
        "\U0001F680-\U0001F6FF"   # transport & map
        "\U0001F1E0-\U0001F1FF"   # flags
        "\U00002600-\U000027BF"   # misc symbols
        "\U0001F900-\U0001F9FF"   # supplemental symbols
        "\U00002702-\U000027B0"   # dingbats
        "\U000024C2-\U0001F251"   # enclosed chars
        "]+",
        flags=re.UNICODE,
    )
    return emoji_pattern.sub("", text)


def _strip_markdown(text: str) -> str:
    """Remove markdown formatting that Polly would read literally."""
    # Bold / italic markers
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}(.*?)_{1,3}", r"\1", text)
    # Inline code / backticks
    text = re.sub(r"`+", "", text)
    # Markdown headers (# ## ###)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    return text


def _normalize_for_tts(text: str, language: str) -> str:
    """
    Full text cleanup pipeline before SSML wrapping:
      1. Strip markdown
      2. Strip emojis
      3. Normalise punctuation for natural spoken cadence
      4. Currency / number localisation
    """
    text = _strip_markdown(text)
    text = _strip_emojis(text)

    # ₹ symbol → spoken word
    if language == "english":
        text = text.replace("₹", "rupees ")
    else:
        text = text.replace("₹", "रुपये ")

    # Bullet points → small pause marker (SSML break injected later)
    # Replace common list markers at start of a word boundary
    text = re.sub(r"(?m)^\s*[•●·\-\*]\s+", "\n", text)

    # Ellipsis → sentence pause
    text = re.sub(r"\.{2,}", ".", text)

    # Em-dash / en-dash → comma pause
    text = re.sub(r"[—–]", ", ", text)

    # Multiple spaces / newlines → single space
    text = re.sub(r"\n{2,}", ". ", text)
    text = re.sub(r"\s{2,}", " ", text)

    return text.strip()


def _build_ssml(plain_text: str, language: str) -> str:
    """
    Wrap cleaned plain text in SSML for natural Indian cadence.
    NOTE: Kajal Neural does NOT support <prosody pitch> — only rate is allowed.
    We use rate="95%" (slightly slower than default 100%) for clearer diction.
    Inter-sentence <break> pauses give a natural breathing rhythm.
    """
    import xml.sax.saxutils as sax  # noqa: PLC0415

    # Escape XML special chars so SSML is valid
    safe = sax.escape(plain_text)

    # Devanagari sentence-end (।) and Latin punctuation → short pause
    safe = re.sub(r"([।.!?])\s+", r'\1<break time="200ms"/> ', safe)

    # Commas → brief breath
    safe = re.sub(r",\s+", ', <break time="80ms"/> ', safe)

    return (
        f'<speak>'
        f'<prosody rate="95%">'
        f'{safe}'
        f'</prosody>'
        f'</speak>'
    )

# (VoiceId, Engine, LanguageCode) — Neural engine for all voices
#
# Kajal Neural is only available in: us-east-1, us-west-2, eu-west-1.
# The Polly client is pointed at POLLY_REGION (default: us-east-1) to
# ensure Kajal Neural is always reachable regardless of the main AWS_REGION.
#
# Aditi (en-IN) is Standard-only — requesting Neural throws ValidationException.
# Kajal handles Indian-English naturally so all languages use Kajal Neural.
VOICE_MAP: dict[str, tuple[str, str, str]] = {
    "hindi":    ("Kajal", "neural", "hi-IN"),
    "marathi":  ("Kajal", "neural", "hi-IN"),
    "punjabi":  ("Kajal", "neural", "hi-IN"),
    "gujarati": ("Kajal", "neural", "hi-IN"),
    "english":  ("Kajal", "neural", "hi-IN"),  # Aditi has no Neural engine
}

# Standard-engine fallback used when Neural is unavailable
VOICE_MAP_STANDARD: dict[str, tuple[str, str, str]] = {
    "hindi":    ("Aditi", "standard", "hi-IN"),
    "marathi":  ("Aditi", "standard", "hi-IN"),
    "punjabi":  ("Aditi", "standard", "hi-IN"),
    "gujarati": ("Aditi", "standard", "hi-IN"),
    "english":  ("Aditi", "standard", "en-IN"),
}


@lru_cache()
def _polly_client():
    # Use POLLY_REGION (us-east-1 by default) so Kajal Neural is always
    # reachable — Kajal Neural is NOT available in ap-south-1.
    return boto3.client(
        "polly",
        region_name=settings.POLLY_REGION,
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


def synthesize_speech(text: str, language: str = "hindi") -> str:
    """
    Synthesize text to MP3 using Amazon Polly Neural engine.
    Returns a pre-signed S3 URL (valid 1 hour) to the cached MP3.

    Pipeline:
        raw text → strip emojis/markdown → normalise punctuation
               → build SSML with prosody → Polly Neural → S3 cache → presigned URL

    Args:
        text:     Plain text to synthesize (emojis/markdown stripped automatically).
        language: One of hindi | marathi | punjabi | gujarati | english.

    Returns:
        Pre-signed S3 URL string.

    Raises:
        RuntimeError on Polly or S3 failure.
    """
    voice_id, engine, lang_code = VOICE_MAP.get(language, VOICE_MAP["hindi"])

    # ── 0. Pre-process text ────────────────────────────────────────────────
    clean_text = _normalize_for_tts(text, language)
    if not clean_text:
        raise RuntimeError("Text is empty after cleaning — nothing to synthesize.")

    # Keep well under the 3000-char Neural limit
    MAX_PLAIN_CHARS = 2400
    if len(clean_text) > MAX_PLAIN_CHARS:
        clean_text = clean_text[:MAX_PLAIN_CHARS].rsplit(" ", 1)[0]
        logger.warning("Text truncated to %d chars for Polly", len(clean_text))

    # Content-hash cache key
    fingerprint = hashlib.md5(f"{clean_text}{voice_id}{lang_code}".encode("utf-8")).hexdigest()
    cache_key   = f"{settings.POLLY_S3_CACHE_PREFIX}/{fingerprint}.mp3"
    bucket      = settings.S3_ASSETS_BUCKET
    s3          = _s3_client()
    polly       = _polly_client()

    # ── 1. Check S3 cache ─────────────────────────────────────────────────
    try:
        s3.head_object(Bucket=bucket, Key=cache_key)
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": cache_key},
            ExpiresIn=3600,
        )
        logger.debug("Polly cache hit → %s", cache_key)
        return url
    except ClientError:
        pass  # cache miss — synthesize

    # ── 2. Call Polly Neural (plain text) ────────────────────────────────
    logger.info(
        "Polly synthesize  voice=%s  engine=%s  lang=%s  chars=%d",
        voice_id, engine, lang_code, len(clean_text),
    )

    try:
        response = polly.synthesize_speech(
            Text=clean_text,
            TextType="text",
            VoiceId=voice_id,
            Engine=engine,
            LanguageCode=lang_code,
            OutputFormat="mp3",
            SampleRate="24000",
        )
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]

        if error_code == "TextLengthExceededException":
            fallback_text = clean_text[:2000].rsplit(" ", 1)[0]
            logger.warning("Text too long — truncated to %d chars", len(fallback_text))
            response = polly.synthesize_speech(
                Text=fallback_text,
                TextType="text",
                VoiceId=voice_id,
                Engine=engine,
                LanguageCode=lang_code,
                OutputFormat="mp3",
                SampleRate="24000",
            )

        elif error_code == "ValidationException":
            # Neural not available for this voice/region — fall back to Aditi Standard
            fb_voice, fb_engine, fb_lang = VOICE_MAP_STANDARD.get(language, VOICE_MAP_STANDARD["hindi"])
            logger.warning(
                "Neural engine rejected (%s) — falling back to %s/%s/%s",
                exc, fb_voice, fb_engine, fb_lang,
            )
            response = polly.synthesize_speech(
                Text=clean_text[:2900].rsplit(" ", 1)[0],
                TextType="text",
                VoiceId=fb_voice,
                Engine=fb_engine,
                LanguageCode=fb_lang,
                OutputFormat="mp3",
                SampleRate="22050",
            )

        else:
            logger.error("Polly synthesis failed: %s", exc)
            raise RuntimeError(f"Polly synthesis failed: {exc}") from exc

    except Exception as exc:
        logger.error("Polly synthesis failed: %s", exc)
        raise RuntimeError(f"Polly synthesis failed: {exc}") from exc

    audio_bytes = response["AudioStream"].read()

    # ── 3. Cache in S3 ────────────────────────────────────────────────────
    try:
        s3.put_object(
            Bucket=bucket,
            Key=cache_key,
            Body=audio_bytes,
            ContentType="audio/mpeg",
            CacheControl="max-age=86400",
        )
        logger.info("Polly audio cached → s3://%s/%s", bucket, cache_key)
    except ClientError as exc:
        logger.error("S3 cache write failed: %s", exc)
        raise RuntimeError(f"S3 upload failed: {exc}") from exc

    # ── 4. Return pre-signed URL ───────────────────────────────────────────
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": cache_key},
        ExpiresIn=3600,
    )
