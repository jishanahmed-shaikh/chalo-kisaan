"""
AWS Bedrock service — Claude 3.5 Sonnet plan generation + image analysis.
"""

from __future__ import annotations
import json
import logging
from typing import Generator, Any
import boto3
from botocore.exceptions import ClientError
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── boto3 clients (re-used across requests) ──────────────────────────────────
def _bedrock_runtime():
    return boto3.client(
        "bedrock-runtime",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


def _bedrock_client():
    return boto3.client(
        "bedrock",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


# ── Language → instruction ────────────────────────────────────────────────────
LANG_INSTRUCTION = {
    "hindi":   "Respond entirely in Hindi (Devanagari script). Use simple language a farmer can understand.",
    "marathi": "Respond entirely in Marathi. Use simple language a farmer can understand.",
    "english": "Respond in clear, simple English.",
    "punjabi": "Respond entirely in Punjabi (Gurmukhi script).",
    "gujarati":"Respond entirely in Gujarati script.",
}


def build_plan_prompt(farm_data: dict, language: str) -> str:
    lang_instr = LANG_INSTRUCTION.get(language, LANG_INSTRUCTION["hindi"])
    return f"""You are an expert agritourism consultant for Indian farmers.
{lang_instr}

Farm Details:
- Location: {farm_data.get('location', 'Unknown')}
- Land Size: {farm_data.get('landSize', 'Unknown')} acres
- Soil Type: {farm_data.get('soilType', 'Unknown')}
- Water Source: {farm_data.get('waterSource', 'Unknown')}
- Budget: ₹{farm_data.get('budget', 'Unknown')}
- Existing Infrastructure: {farm_data.get('existingInfrastructure', 'None')}
- Biodiversity / Crops: {farm_data.get('biodiversity', 'Unknown')}

Create a comprehensive agritourism business plan. Return ONLY valid JSON — no markdown fences.

JSON structure:
{{
  "recommendedService": "string — name of the primary agritourism concept",
  "tagline": "string — catchy one-liner for the farm",
  "suitabilityScore": number (0-100),
  "summary": "string — 2-3 sentence overview",
  "revenueStreams": [
    {{"name": "string", "monthlyRevenue": number, "description": "string"}}
  ],
  "setupPhases": [
    {{
      "phase": number,
      "title": "string",
      "duration": "string",
      "cost": number,
      "tasks": ["string"]
    }}
  ],
  "governmentSchemes": [
    {{"name": "string", "benefit": "string", "link": "string"}}
  ],
  "risks": [
    {{"risk": "string", "mitigation": "string"}}
  ],
  "totalSetupCost": number,
  "breakEvenMonths": number,
  "annualRevenueProjection": number
}}"""


def build_voice_parse_prompt(transcript: str, language: str) -> str:
    return f"""You are a farm data extractor for Indian farmers.

The farmer spoke in {language}. Their transcript:
"{transcript}"

Extract farm details. Return ONLY valid JSON — no markdown fences.

JSON structure:
{{
  "landSize": "number as string or null",
  "location": "string or null",
  "soilType": "string or null",
  "waterSource": "string or null",
  "existingInfrastructure": "string or null",
  "budget": "number as string or null",
  "biodiversity": "string or null",
  "detectedLanguage": "hindi|marathi|english|punjabi|gujarati"
}}"""


def build_image_analysis_prompt() -> str:
    return """Analyze this farm image. Return ONLY valid JSON — no markdown fences.

JSON structure:
{
  "farmType": "string",
  "estimatedSize": "string",
  "vegetation": ["string"],
  "infrastructure": ["string"],
  "waterFeatures": ["string"],
  "agritourismPotential": "high|medium|low",
  "suggestedActivities": ["string"],
  "observations": "string"
}"""


# ── Streaming plan generation ─────────────────────────────────────────────────
def stream_plan(farm_data: dict, language: str) -> Generator[str, None, None]:
    """
    Synchronous generator that yields raw text chunks from Bedrock streaming.
    Wrap in a FastAPI StreamingResponse.
    """
    prompt = build_plan_prompt(farm_data, language)
    client = _bedrock_runtime()

    response = client.invoke_model_with_response_stream(
        modelId=settings.BEDROCK_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": settings.BEDROCK_MAX_TOKENS,
            "messages": [{"role": "user", "content": prompt}],
        }),
    )

    for event in response["body"]:
        chunk = json.loads(event["chunk"]["bytes"])
        if chunk.get("type") == "content_block_delta":
            text = chunk["delta"].get("text", "")
            if text:
                yield text


# ── Non-streaming: parse voice / image ───────────────────────────────────────
def invoke_model(prompt: str, image_bytes: bytes | None = None) -> str:
    """Single-shot Bedrock invocation. Returns the full text response."""
    client = _bedrock_runtime()

    if image_bytes:
        import base64
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": base64.b64encode(image_bytes).decode(),
                },
            },
            {"type": "text", "text": prompt},
        ]
    else:
        content = [{"type": "text", "text": prompt}]

    response = client.invoke_model(
        modelId=settings.BEDROCK_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2048,
            "messages": [{"role": "user", "content": content}],
        }),
    )

    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def parse_voice(transcript: str, language: str) -> dict[str, Any]:
    prompt = build_voice_parse_prompt(transcript, language)
    raw = invoke_model(prompt)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Claude sometimes wraps in backticks — strip them
        clean = raw.strip().strip("```json").strip("```").strip()
        return json.loads(clean)


def analyze_image(image_bytes: bytes) -> dict[str, Any]:
    prompt = build_image_analysis_prompt()
    raw = invoke_model(prompt, image_bytes)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        clean = raw.strip().strip("```json").strip("```").strip()
        return json.loads(clean)


# ── Guardrail check ───────────────────────────────────────────────────────────
def apply_guardrail(text: str) -> bool:
    """Returns True if content passes guardrail. False if blocked."""
    if not settings.BEDROCK_GUARDRAIL_ID:
        return True   # skip if not configured yet
    client = _bedrock_runtime()
    try:
        response = client.apply_guardrail(
            guardrailIdentifier=settings.BEDROCK_GUARDRAIL_ID,
            guardrailVersion=settings.BEDROCK_GUARDRAIL_VERSION,
            source="OUTPUT",
            content=[{"text": {"text": text}}],
        )
        return response.get("action") == "NONE"
    except ClientError as e:
        logger.warning("Guardrail check failed: %s", e)
        return True
