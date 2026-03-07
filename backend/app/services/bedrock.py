"""
AWS Bedrock service — plan generation, voice parsing, image analysis,
and visualization description.

Uses Amazon Nova models (no Marketplace subscription required).
Converse API for single-shot calls, ConverseStream for streaming.
Falls back from API key auth to IAM credentials.

All functions are synchronous — routes wrap them with asyncio.to_thread().
"""

from __future__ import annotations
import json
import logging
import os
import re
from functools import lru_cache
from typing import Generator, Any

import boto3
from botocore.config import Config as BotoConfig

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_JSON = [{"text": "You are a helpful assistant. Always respond with valid JSON only. No markdown fences, no explanation, no text before or after the JSON object."}]

# -- Cached boto3 client --------------------------------------------------------

@lru_cache()
def _bedrock_runtime():
    if settings.AWS_BEARER_TOKEN_BEDROCK:
        os.environ["AWS_BEARER_TOKEN_BEDROCK"] = settings.AWS_BEARER_TOKEN_BEDROCK
        logger.info("Using Bedrock API key (bearer token) authentication")
        return boto3.client(
            "bedrock-runtime",
            region_name=settings.BEDROCK_REGION,
            config=BotoConfig(
                retries={"mode": "standard", "max_attempts": 3},
                read_timeout=300,
                connect_timeout=10,
            ),
        )
    else:
        logger.info("Using IAM credentials for Bedrock authentication")
        return boto3.client(
            "bedrock-runtime",
            region_name=settings.BEDROCK_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
            config=BotoConfig(
                retries={"mode": "standard", "max_attempts": 3},
                read_timeout=300,
                connect_timeout=10,
            ),
        )


# -- Language instructions -------------------------------------------------------

LANG_INSTRUCTION = {
    "hindi": "Respond entirely in Hindi (Devanagari script). Use simple language a farmer can understand.",
    "marathi": "Respond entirely in Marathi. Use simple language a farmer can understand.",
    "english": "Respond in clear, simple English.",
    "punjabi": "Respond entirely in Punjabi (Gurmukhi script).",
    "gujarati": "Respond entirely in Gujarati script.",
}


# -- Prompt builders ------------------------------------------------------------

def build_plan_prompt(farm_data: dict, language: str) -> str:
    lang_instr = LANG_INSTRUCTION.get(language, LANG_INSTRUCTION["hindi"])
    return f"""You are an expert agritourism consultant for Indian farmers.
{lang_instr}

Farm Details:
- Location: {farm_data.get('location', 'Unknown')}
- Land Size: {farm_data.get('landSize', 'Unknown')} acres
- Soil Type: {farm_data.get('soilType', 'Unknown')}
- Water Source: {farm_data.get('waterSource', 'Unknown')}
- Budget: Rs.{farm_data.get('budget', 'Unknown')}
- Existing Infrastructure: {', '.join(farm_data['existingInfrastructure']) if isinstance(farm_data.get('existingInfrastructure'), list) else farm_data.get('existingInfrastructure', 'None')}
- Biodiversity / Crops: {farm_data.get('biodiversity', 'Unknown')}

Create a comprehensive, realistic agritourism business plan for this farmer.
All monetary values must be realistic numbers in Indian Rupees (INR).

Return ONLY valid JSON — no markdown fences, no explanation, no text before or after the JSON.

You MUST use this EXACT JSON structure with these EXACT field names:
{{
  "recommendedService": "string — primary agritourism concept name",
  "tagline": "string — catchy one-liner for the farm business",
  "suitabilityScore": number between 0 and 100,
  "monthlyRevenueEstimate": number in INR,
  "yearlyRevenueEstimate": number in INR,
  "totalSetupCost": number in INR,
  "breakEvenMonths": number,
  "suitabilityReason": "string — 2-3 sentences explaining why this farm is suitable",
  "uniqueExperiences": ["string — experience 1", "string — experience 2", "at least 4-6 items"],
  "targetTourists": "string — description of ideal tourist demographic",
  "seasonalCalendar": {{
    "peak": "string — e.g. October-March",
    "offPeak": "string — e.g. April-September",
    "activities": "string — what to do in each season"
  }},
  "riskFactors": ["string — risk 1", "string — risk 2", "at least 3-5 items"],
  "setupPhases": [
    {{
      "phase": 1,
      "title": "string — phase name",
      "duration": "string — e.g. 2 weeks",
      "cost": number in INR,
      "tasks": ["string — task 1", "string — task 2"]
    }}
  ],
  "revenueStreams": [
    {{
      "stream": "string — revenue source name",
      "monthlyRevenue": number in INR,
      "description": "string — brief explanation"
    }}
  ],
  "govtSchemes": [
    {{
      "name": "string — scheme name",
      "benefit": "string — what it provides",
      "eligibility": "string — who qualifies"
    }}
  ],
  "visualizationPrompt": "string — a detailed Stable Diffusion prompt to generate an image of this transformed farm"
}}

Important rules:
- monthlyRevenueEstimate must equal the sum of all revenueStreams[].monthlyRevenue
- yearlyRevenueEstimate must equal monthlyRevenueEstimate * 12
- totalSetupCost must equal the sum of all setupPhases[].cost
- Include at least 3 setupPhases, 3 revenueStreams, 3 govtSchemes
- All numbers must be realistic for Indian rural economics
- govtSchemes should be real Indian government schemes relevant to agritourism"""


def build_voice_parse_prompt(transcript: str, language: str) -> str:
    return f"""You are a farm data extractor for Indian farmers.

The farmer spoke in {language}. Their transcript:
"{transcript}"

Extract farm details from this transcript. Return ONLY valid JSON — no markdown fences.

JSON structure:
{{
  "landSize": "number as string or null",
  "location": "string or null",
  "soilType": "one of: Red Soil, Black Cotton Soil, Alluvial Soil, Laterite Soil, Sandy Soil, Clay Soil — or null",
  "waterSource": "one of: River / Stream, Borewell, Open Well, Canal Irrigation, Rainwater Only, Lake / Pond — or null",
  "existingInfrastructure": "one of: Tea Bungalow, Old House / Barn, Tool Shed, Storage Room, Electricity, Road Access, None — or null",
  "budget": "number as string or null",
  "biodiversity": "one of: Mango Orchard, Sugarcane, Paddy / Rice, Wheat, Grapes / Vineyard, Vegetable Farm, Coconut Grove, Mixed Crops, Barren Land — or null",
  "detectedLanguage": "hindi|marathi|english|punjabi|gujarati"
}}

Rules:
- budget should be in INR (convert lakhs: 2 lakh = 200000)
- landSize should be in acres (convert bigha/hectare if needed)
- Only extract what is clearly mentioned; use null for unmentioned fields
- detectedLanguage: detect from the transcript content"""


def build_image_analysis_prompt() -> str:
    return """Analyze this farm image for agritourism potential. Return ONLY valid JSON — no markdown fences.

JSON structure:
{
  "agritourismPotential": "high|medium|low",
  "visualObservations": "string — describe what you see: land type, vegetation, structures, terrain",
  "potentialServices": ["string — suggested agritourism activity 1", "string — activity 2", "at least 3 items"],
  "farmType": "string — e.g. Vineyard, Orchard, Mixed Crop Farm",
  "estimatedSize": "string — rough estimate like 3-5 acres",
  "vegetation": ["string"],
  "infrastructure": ["string"],
  "waterFeatures": ["string"]
}"""


def build_visualization_prompt(farm_data: dict, plan_data: dict) -> str:
    service = plan_data.get("recommendedService", "agritourism farm")
    location = farm_data.get("location", "rural India")
    crops = farm_data.get("biodiversity", "mixed crops")
    budget = farm_data.get("budget", "unknown")

    return f"""You are a creative farm transformation visualizer.

A farmer near {location} with {crops} on their land wants to build a "{service}" agritourism business with a budget of Rs.{budget}.

Describe the TRANSFORMED farm in vivid detail. Return ONLY valid JSON — no markdown fences.

JSON structure:
{{
  "afterDescription": "string — 3-4 sentences painting a vivid picture of the transformed farm. Include colors, structures, paths, signage, lighting, and the overall feel. Be specific and evocative.",
  "keyChanges": ["string — specific change 1", "string — specific change 2", "at least 5-7 concrete changes like 'Bamboo welcome arch with fairy lights at entrance'"],
  "atmosphereDescription": "string — 2-3 sentences about the sensory experience: sounds, smells, the feeling of being there. Make it emotionally compelling."
}}

Be realistic for Indian rural context. Include traditional elements mixed with modern tourist amenities."""


# -- JSON extraction helper ------------------------------------------------------

def _extract_json(raw: str) -> dict:
    """Extract JSON from a raw LLM response, handling markdown fences."""
    clean = raw.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
        clean = clean.strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", clean)
        if match:
            return json.loads(match.group())
        raise


# -- Core functions (using Converse API) ----------------------------------------

def stream_plan(farm_data: dict, language: str) -> Generator[str, None, None]:
    """
    Streaming plan generation using ConverseStream API.
    Yields raw text chunks.
    """
    prompt = build_plan_prompt(farm_data, language)
    client = _bedrock_runtime()

    response = client.converse_stream(
        modelId=settings.BEDROCK_MODEL_ID,
        system=SYSTEM_JSON,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": settings.BEDROCK_MAX_TOKENS},
    )

    for event in response["stream"]:
        if "contentBlockDelta" in event:
            text = event["contentBlockDelta"]["delta"].get("text", "")
            if text:
                yield text


def _detect_image_format(image_bytes: bytes) -> str:
    """Detect image format from magic bytes."""
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "png"
    if image_bytes[:2] == b'\xff\xd8':
        return "jpeg"
    if image_bytes[:4] == b'GIF8':
        return "gif"
    if image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        return "webp"
    return "jpeg"


def invoke_model(
    prompt: str,
    image_bytes: bytes | None = None,
    model_id: str | None = None,
    max_tokens: int = 2048,
) -> str:
    """Single-shot Bedrock invocation using non-streaming Converse API."""
    client = _bedrock_runtime()
    use_model = model_id or settings.BEDROCK_MODEL_ID

    content: list[dict] = []
    if image_bytes:
        fmt = _detect_image_format(image_bytes)
        content.append({
            "image": {
                "format": fmt,
                "source": {"bytes": image_bytes},
            }
        })
    content.append({"text": prompt})

    response = client.converse(
        modelId=use_model,
        system=SYSTEM_JSON,
        messages=[{"role": "user", "content": content}],
        inferenceConfig={"maxTokens": max_tokens},
    )

    return response["output"]["message"]["content"][0]["text"]


def parse_voice(transcript: str, language: str) -> dict[str, Any]:
    """Extract structured farm data from a voice transcript."""
    prompt = build_voice_parse_prompt(transcript, language)
    raw = invoke_model(prompt, model_id=settings.BEDROCK_LIGHT_MODEL_ID, max_tokens=512)
    return _extract_json(raw)


def analyze_image(image_bytes: bytes) -> dict[str, Any]:
    """Analyze a farm photo for agritourism potential."""
    prompt = build_image_analysis_prompt()
    raw = invoke_model(prompt, image_bytes)
    return _extract_json(raw)


def generate_visualization_description(
    farm_data: dict, plan_data: dict
) -> dict[str, Any]:
    """Generate a vivid text description of the transformed farm."""
    prompt = build_visualization_prompt(farm_data, plan_data)
    raw = invoke_model(prompt, max_tokens=1024)
    return _extract_json(raw)


def generate_image_prompt(
    services: list[str], farm_data: dict, mode: str = "transform",
    image_bytes: bytes | None = None,
) -> dict[str, str]:
    """
    Use Nova Pro (with the actual farm image) to craft an image generation
    prompt that preserves the original scene and adds agrotourism services.
    """
    services_str = ", ".join(services)
    location = farm_data.get("location", "rural India")
    land_size = farm_data.get("landSize", "a few")
    crops = farm_data.get("biodiversity", "mixed crops")
    infrastructure = farm_data.get("existingInfrastructure", [])
    if isinstance(infrastructure, list):
        infrastructure = ", ".join(infrastructure) if infrastructure else "none"

    if mode == "inpaint":
        meta_prompt = f"""Look at this farm photo carefully. Describe EXACTLY what you see — the terrain, colors, vegetation, sky, any structures, field layout, and perspective/angle.

The farmer near {location} with {land_size} acres of {crops} wants to add: {services_str}.
Existing infrastructure: {infrastructure}.

Now generate TWO things:
1. "maskPrompt": A short phrase identifying the best area in THIS SPECIFIC photo to place the new services (e.g., "the green open field on the left side", "the flat empty ground near the barn"). Reference what you actually see.
2. "fillPrompt": A description (60-100 words) of what to place in that masked area. CRITICAL — it must blend seamlessly with the rest of THIS photo. Match the same lighting, color temperature, perspective, and season. Describe structures, materials, and vegetation that fit the existing landscape. Indian rural aesthetic.

Return ONLY valid JSON: {{"maskPrompt": "...", "fillPrompt": "..."}}"""
    else:
        meta_prompt = f"""Look at this farm photo carefully. Describe EXACTLY what you see in detail — the terrain shape, colors, vegetation types, sky condition, any existing structures, field patterns, fencing, roads, trees, and the camera angle/perspective.

The farmer near {location} with {land_size} acres of {crops} wants to transform this into an agritourism destination featuring: {services_str}.
Existing infrastructure: {infrastructure}.

Write a SINGLE image generation prompt (100-180 words) that describes THIS EXACT SAME farm scene — same terrain layout, same sky, same perspective, same field shapes, same existing trees and structures — but with the agritourism services tastefully added.

CRITICAL RULES for the prompt:
- START by describing the existing landscape exactly as it appears (terrain, fields, sky, colors, existing buildings)
- THEN layer the new agrotourism additions into specific locations within that scene
- Preserve the original camera angle, lighting conditions, time of day, and weather
- Keep all existing trees, paths, boundaries, and natural features
- New structures should be small-scale, realistic for Indian rural context (not resort-scale)
- Materials: local stone, bamboo, terracotta tiles, thatch, painted wood
- Add subtle details: small signboard, a few visitors, flower beds along paths, string lights
- The result should look like a realistic "after" photo of THIS SAME farm, not a fantasy scene

Return ONLY valid JSON: {{"imagePrompt": "..."}}"""

    raw = invoke_model(meta_prompt, image_bytes=image_bytes, max_tokens=512)
    return _extract_json(raw)


def generate_land_visualization(
    image_base64: str, prompt_data: dict, mode: str = "transform"
) -> str:
    """
    Generate a transformed farm image using Amazon Nova Canvas.
    Returns base64-encoded result image.

    Uses InvokeModel API (not Converse) — Nova Canvas requires it.
    """
    import base64
    from io import BytesIO
    from PIL import Image

    client = _bedrock_runtime()
    model_id = settings.BEDROCK_IMAGE_MODEL_ID

    # Decode and resize image to fit Nova Canvas requirements
    img_bytes = base64.b64decode(image_base64)
    img = Image.open(BytesIO(img_bytes))

    # Nova Canvas needs dimensions divisible by 64, max 1408 for conditioning/inpainting
    # Resize maintaining aspect ratio, fit within 1024x1024
    max_dim = 1024
    ratio = min(max_dim / img.width, max_dim / img.height)
    if ratio < 1:
        new_w = int(img.width * ratio)
        new_h = int(img.height * ratio)
    else:
        new_w = img.width
        new_h = img.height

    # Round to nearest multiple of 64
    new_w = max(64, (new_w // 64) * 64)
    new_h = max(64, (new_h // 64) * 64)

    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Convert to PNG base64 for Nova Canvas
    buf = BytesIO()
    img.save(buf, format="PNG")
    resized_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    if mode == "inpaint":
        body = {
            "taskType": "INPAINTING",
            "inPaintingParams": {
                "image": resized_b64,
                "maskPrompt": prompt_data.get("maskPrompt", "the empty area"),
                "text": prompt_data.get("fillPrompt", ""),
            },
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "quality": "standard",
                "cfgScale": 8.0,
                "seed": int.from_bytes(os.urandom(4), "big") % 2147483647,
            },
        }
    else:
        # IMAGE_CONDITIONING with SEGMENTATION
        # controlStrength 0.85 = strongly preserve original layout/structure
        body = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {
                "text": prompt_data.get("imagePrompt", ""),
                "conditionImage": resized_b64,
                "controlMode": "SEGMENTATION",
                "controlStrength": 0.85,
            },
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "width": new_w,
                "height": new_h,
                "quality": "standard",
                "cfgScale": 8.0,
                "seed": int.from_bytes(os.urandom(4), "big") % 2147483647,
            },
        }

    logger.info("Invoking Nova Canvas (%s) — mode=%s, size=%dx%d", model_id, mode, new_w, new_h)

    response = client.invoke_model(
        modelId=model_id,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )

    result = json.loads(response["body"].read())

    if result.get("error"):
        raise RuntimeError(f"Nova Canvas error: {result['error']}")

    images = result.get("images", [])
    if not images:
        raise RuntimeError("Nova Canvas returned no images")

    return images[0]
