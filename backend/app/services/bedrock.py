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
    "hindi": """CRITICAL LANGUAGE RULE: ALL text values in the JSON MUST be written ONLY in Hindi (Devanagari script: हिंदी).
Do NOT use English words anywhere in string values. Do NOT mix scripts. Do NOT use Roman/Latin characters in any string field.
Every single string value — titles, descriptions, tasks, scheme names, experience names — must be in pure Devanagari Hindi.
Only JSON keys, numbers, and structural elements remain in English. Use simple Hindi (सरल हिंदी) that any village farmer can understand.
Example correct: "title": "बुनियादी सुविधाएँ तैयार करना"
Example WRONG: "title": "Basic Infrastructure Setup" or "title": "बुनियादी infrastructure setup\"""",
    "marathi": """CRITICAL LANGUAGE RULE: ALL text values in the JSON MUST be written ONLY in Marathi (मराठी).
Do NOT use English or Hindi words anywhere in string values. Do NOT mix scripts.
Every single string value must be in pure Marathi. Use simple rural Marathi.""",
    "english": "Respond in clear, simple English. Use short sentences. Avoid jargon. All string values must be in English only.",
    "punjabi": """CRITICAL LANGUAGE RULE: ALL text values in the JSON MUST be written ONLY in Punjabi (Gurmukhi script: ਪੰਜਾਬੀ).
Do NOT use English or Hindi words. Every string value must be in pure Gurmukhi Punjabi.""",
    "gujarati": """CRITICAL LANGUAGE RULE: ALL text values in the JSON MUST be written ONLY in Gujarati (ગુજરાતી script).
Do NOT use English or Hindi words. Every string value must be in pure Gujarati.""",
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
  "recommendedService": "string — primary agritourism concept name (in the specified language)",
  "tagline": "string — catchy one-liner for the farm business (in the specified language)",
  "suitabilityScore": number between 0 and 100,
  "monthlyRevenueEstimate": number in INR,
  "yearlyRevenueEstimate": number in INR,
  "totalSetupCost": number in INR,
  "breakEvenMonths": number,
  "suitabilityReason": "string — 2-3 sentences in the specified language explaining why this farm is suitable",
  "uniqueExperiences": ["string in specified language — experience 1", "experience 2", "at least 4-6 items"],
  "targetTourists": "string in specified language — description of ideal tourist demographic",
  "seasonalCalendar": {{
    "peak": "string — e.g. October-March",
    "offPeak": "string — e.g. April-September",
    "activities": "string in specified language — what to do in each season"
  }},
  "riskFactors": ["string in specified language — risk 1", "risk 2", "at least 3-5 items"],
  "setupPhases": [
    {{
      "phase": 1,
      "title": "string in specified language — phase name",
      "duration": "string — e.g. 2 सप्ताह / 2 weeks (in the specified language)",
      "cost": number in INR,
      "tasks": ["string in specified language — clearly describe each task in 1 sentence", "task 2"]
    }}
  ],
  "revenueStreams": [
    {{
      "stream": "string in specified language — revenue source name",
      "monthlyRevenue": number in INR,
      "description": "string in specified language — brief explanation"
    }}
  ],
  "govtSchemes": [
    {{
      "name": "string — real Indian govt scheme name (can keep official name)",
      "benefit": "string in specified language — what it provides",
      "eligibility": "string in specified language — who qualifies"
    }}
  ],
  "visualizationPrompt": "string — a detailed Stable Diffusion prompt IN ENGLISH to generate an image of this transformed farm"
}}

CRITICAL RULES:
1. ALL string values (titles, descriptions, tasks, experiences, risks) MUST be in the specified language. DO NOT mix languages.
2. monthlyRevenueEstimate must equal the sum of all revenueStreams[].monthlyRevenue
3. yearlyRevenueEstimate must equal monthlyRevenueEstimate * 12
4. totalSetupCost must equal the sum of all setupPhases[].cost
5. Include at least 3 setupPhases, 3 revenueStreams, 3 govtSchemes
6. All monetary numbers must be realistic for Indian rural economics
7. govtSchemes should be REAL Indian government schemes (PMKSY, NABARD, ATDC, Mudra etc.)
8. Each task in setupPhases must be a clear, specific, actionable sentence — NOT gibberish or random words
9. The visualizationPrompt is the ONLY field that should be in English (for image generation)
10. Duration values should use the specified language (e.g. "2 सप्ताह" for Hindi, "2 weeks" for English)"""


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
    return """Analyze this image. First check if it is actually a farm, agricultural land, rural landscape, or outdoor natural/rural scene.

If the image is NOT a farm image (e.g. it is a logo, screenshot, person, building, urban scene, animal, etc.), return ONLY this JSON:
{
  "agritourismPotential": "not_farm",
  "visualObservations": "Brief description of what the image actually shows and why it is not a farm image.",
  "potentialServices": [],
  "farmType": null,
  "estimatedSize": null,
  "vegetation": [],
  "infrastructure": [],
  "waterFeatures": []
}

If it IS a farm or rural land image, analyze it for agritourism potential and return ONLY valid JSON — no markdown fences:
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
    land_size = farm_data.get("landSize", "unknown")

    return f"""You are an expert agritourism consultant who has designed farm experiences across rural Maharashtra, Karnataka, and Rajasthan. You deeply understand Indian rural aesthetics, locally available materials, and what domestic and international tourists actually pay for.

A farmer near {location} grows {crops} on {land_size} acres. They want to build a "{service}" agritourism experience with a budget of ₹{budget}.

Your job: describe exactly how this specific farm will look and feel AFTER transformation — not a generic farm, but THIS farm, in THIS region, with THESE crops.

Rules:
- Use only materials and structures realistic for {location} (bamboo, laterite stone, mud plaster, teak, jute, terracotta — whatever fits the region)
- Every change must be achievable within ₹{budget}
- Reference the actual crops ({crops}) as part of the experience — they are the attraction, not just the backdrop
- Include at least one traditional regional element (a specific local architecture style, craft, or food custom from near {location})
- No generic phrases like "lush greenery" or "serene atmosphere" — be concrete and specific

Return ONLY valid JSON. No markdown. No explanation outside the JSON.

{{
  "afterDescription": "3-4 sentences. Paint the scene as if a travel writer is standing at the farm entrance at golden hour. Name specific structures, colors, smells, sounds. Reference the crops and the regional character of {location}.",
  "keyChanges": [
    "List 6-8 specific, costed-feeling changes. Each should name the material, location on farm, and visual detail. Example: 'Mud-plastered welcome hut with a Warli art mural at the entrance gate, roofed with red Mangalore tiles' NOT 'Build a welcome hut'."
  ],
  "atmosphereDescription": "2-3 sentences. Describe what a tourist FEELS — the sounds (specific birds, water, wind through which crop), the smells (soil after rain, which flower or fruit), the emotional pull. Make it bookable.",
  "estimatedVisitorExperience": "1 sentence. What is the single most memorable thing a tourist will do or see here that they cannot experience anywhere else?"
}}"""


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


# -- FAQ Knowledge Base (embedded) -----------------------------------------------

AGRITOURISM_FAQ = """
=== AGRITOURISM FAQ KNOWLEDGE BASE ===

Q: What is agritourism?
A: Agritourism (कृषि पर्यटन) is a form of tourism where visitors experience rural farm life. It includes farm stays, fruit picking, organic farming workshops, bullock cart rides, pottery, traditional cooking classes, and more. It turns farmland into a tourist destination.

Q: What are the government schemes for agritourism in India?
A: Key schemes: (1) Agri Tourism Development Corporation (ATDC) Maharashtra registration — free, gives tax benefits. (2) PM Kisan Samman Nidhi — ₹6000/year support. (3) NABARD subsidies — up to 33% capital subsidy for agri-infrastructure. (4) Mudra Loan — up to ₹10L without collateral. (5) State-specific schemes like Maharashtra Agri Tourism Policy, Karnataka Farm Tourism Policy. (6) PMEGP — up to 35% subsidy for rural entrepreneurs.

Q: How much can I earn from agritourism?
A: Earnings depend on location, land size, and activities. Typical ranges: Small farm (2-5 acres) — ₹20,000-50,000/month. Medium farm (5-15 acres) — ₹50,000-1,50,000/month. Large farm (15+ acres) — ₹1,50,000-5,00,000/month. Weekend farm visits typically charge ₹500-2000 per person including meals.

Q: What permissions/licenses do I need?
A: (1) FSSAI food license — ₹100 for basic registration. (2) Local panchayat permission. (3) ATDC registration (Maharashtra). (4) GST registration if turnover > ₹20L. (5) Fire safety certificate for stay facilities. (6) Tourism department registration of your state.

Q: What activities can I offer on my farm?
A: Farm tours, fruit/vegetable picking, organic farming workshops, pottery making, bullock cart rides, tractor rides, milking cows, cooking classes with farm produce, bird watching, star gazing, campfire nights, yoga & wellness retreats, fishing (if pond available), seed planting workshops, farm-to-table dining.

Q: What is the best season for agritourism?
A: Peak season: October to March (pleasant weather, harvest season). Monsoon: June to September (lush greenery, lower footfall but unique experience). Summer: April to June (mango season, but hot — focus on early morning/evening activities).

Q: How do I market my agritourism farm?
A: (1) List on Google Maps and Google My Business. (2) Create Instagram/Facebook page with farm photos. (3) Register on MakeMyTrip, Airbnb Experiences, Thrillophilia. (4) Partner with local travel agents. (5) Word of mouth from satisfied visitors. (6) WhatsApp Business for bookings.

Q: What about food safety and hygiene?
A: (1) Get FSSAI registration. (2) Use clean water — install RO/UV if needed. (3) Maintain clean cooking area. (4) Use farm-fresh organic produce. (5) Proper waste disposal. (6) Clean washrooms — essential for tourist satisfaction.

Q: Where can I sell my farm produce?
A: (1) Local mandis (APMC markets). (2) Direct-to-consumer via farm stays. (3) Online platforms: BigBasket, Amazon Fresh, JioMart. (4) Farm-to-fork restaurants. (5) Organic stores in nearby cities. (6) Weekly haats/farmers' markets. (7) eNAM (National Agriculture Market) — online mandi platform. (8) Processing and selling value-added products (pickles, jams, dried fruits).

Q: What are the risks?
A: (1) Seasonal dependency — diversify activities. (2) Weather damage — get crop insurance. (3) Low initial footfall — start with weekends only. (4) Hygiene complaints — maintain strict standards. (5) Legal issues — get all licenses. (6) Competition — differentiate with unique experiences.

Q: What is the typical setup cost?
A: Basic setup (tents + meals): ₹50,000-2,00,000. Mid-range (rooms + activities): ₹2,00,000-10,00,000. Premium (cottages + pool + full experience): ₹10,00,000-50,00,000. Start small and reinvest profits.
"""

NEARBY_MARKET_KNOWLEDGE = """
=== NEARBY MARKETPLACE & MANDI INFORMATION ===

When users ask about nearby markets, mandis, or where to sell produce, provide information based on their location:

Major Agricultural Markets (Mandis) in India by region:
- Maharashtra: Vashi APMC (Mumbai), Pune Market Yard, Nashik Grape Market, Nagpur Orange Market, Sangli Turmeric Market, Kolhapur Gur Market
- Karnataka: Yeshwanthpur APMC (Bangalore), Hubli-Dharwad APMC, Raichur Market
- Rajasthan: Jaipur Mandi, Jodhpur Mandi, Kota APMC
- Gujarat: Ahmedabad APMC, Rajkot Market Yard, Surat Mandi
- Punjab: Ludhiana Grain Market, Amritsar Mandi, Jalandhar APMC
- UP: Azadpur Mandi (Delhi NCR), Lucknow Mandi, Varanasi Market
- Tamil Nadu: Koyambedu Market (Chennai), Oddanchatram (vegetables)
- Kerala: Ernakulam Market, Wayanad Spice Market

Online Platforms for farmers:
- eNAM (National Agriculture Market) — www.enam.gov.in — 1000+ mandis connected
- Kisan Mandi — direct farmer-to-consumer
- AgriBazaar — commodity trading for farmers
- DeHaat — complete farmer platform
- Ninjacart — farm-to-business supply chain
- BigHaat — agri inputs and selling

Tips for getting better prices:
1. Check eNAM for real-time mandi prices before selling
2. Form Farmer Producer Organizations (FPOs) for collective bargaining
3. Grade and sort produce — better grading = 10-20% higher prices
4. Add value — process into pickles, jams, dried products
5. Sell directly to restaurants and hotels through agritourism contacts
6. Use cold storage to sell in off-season at higher prices
"""


def _build_assistant_system_prompt(language: str, farm_context: dict, user_context: dict) -> str:
    """Build a comprehensive system prompt for the AI assistant."""

    LANG_STRICT = {
        "hindi": "CRITICAL: You MUST respond ONLY in Hindi (Devanagari script: हिंदी). Do NOT mix English words. Do NOT use any other script. Even numbers should be in context with Hindi. Use simple village-level Hindi (ग्रामीण हिंदी) that any farmer can understand. Avoid technical English terms — always use Hindi equivalents.",
        "marathi": "CRITICAL: You MUST respond ONLY in Marathi (मराठी). Do NOT mix English or Hindi words. Use simple, conversational Marathi that a farmer from rural Maharashtra would understand.",
        "english": "Respond in simple, clear English. Use short sentences. Avoid jargon. Explain concepts as if talking to someone new to business.",
        "punjabi": "CRITICAL: You MUST respond ONLY in Punjabi (Gurmukhi script: ਪੰਜਾਬੀ). Do NOT mix English or Hindi. Use simple village-level Punjabi.",
        "gujarati": "CRITICAL: You MUST respond ONLY in Gujarati (ગુજરાતી). Do NOT mix English or Hindi. Use simple conversational Gujarati.",
    }

    lang_rule = LANG_STRICT.get(language, LANG_STRICT["hindi"])

    # Format farm context
    farm_section = ""
    if farm_context.get("hasPlan"):
        farm_section = f"""
=== USER'S FARM DETAILS (from their saved plan) ===
- Location: {farm_context.get('location', 'Unknown')}
- Land Size: {farm_context.get('landSize', 'Unknown')} acres
- Soil Type: {farm_context.get('soilType', 'Unknown')}
- Water Source: {farm_context.get('waterSource', 'Unknown')}
- Budget: ₹{farm_context.get('budget', 'Unknown')}
- Crops/Biodiversity: {farm_context.get('biodiversity', 'Unknown')}
- Infrastructure: {farm_context.get('existingInfrastructure', 'None')}
- Recommended Business: {farm_context.get('recommendedService', 'Not yet decided')}
- Suitability Score: {farm_context.get('suitabilityScore', 0)}/100
- Monthly Revenue Potential: ₹{farm_context.get('monthlyRevenueEstimate', 0)}
- Total Setup Cost: ₹{farm_context.get('totalSetupCost', 0)}
- Break-even: {farm_context.get('breakEvenMonths', 0)} months
- Target Tourists: {farm_context.get('targetTourists', 'General')}
- Revenue Streams: {json.dumps(farm_context.get('revenueStreams', []), ensure_ascii=False)}
- Setup Phases: {json.dumps(farm_context.get('setupPhases', []), ensure_ascii=False)}
- Govt Schemes: {json.dumps(farm_context.get('govtSchemes', []), ensure_ascii=False)}
- Risks: {json.dumps(farm_context.get('riskFactors', []), ensure_ascii=False)}
- Unique Experiences: {json.dumps(farm_context.get('uniqueExperiences', []), ensure_ascii=False)}
- Seasonal Calendar: {json.dumps(farm_context.get('seasonalCalendar', {}), ensure_ascii=False)}
=== END FARM DETAILS ===

IMPORTANT: When the user asks questions, ALWAYS reference their specific farm details above. For example:
- If they ask about income, cite their specific revenue streams and monthly estimate.
- If they ask about costs, cite their specific setup phases and costs.
- If they ask what to grow, consider their soil type, water source, and location.
- If they ask about risks, cite the specific risks identified for their farm.
- If they ask about markets, suggest markets near their location.
"""
    else:
        farm_section = """
Note: This user has not yet created a farm plan. Encourage them to go to "My Land" page and fill in their farm details to get a personalized agritourism plan. You can still answer general agritourism questions.
"""

    user_section = ""
    name = user_context.get("name", "")
    address = user_context.get("address", "")
    coordinates = user_context.get("coordinates", "")

    if name:
        user_section += f"\nThe user's name is {name}. Address them by name occasionally to make the conversation personal.\n"
    if address:
        user_section += f"\nThe user's location/address is: {address}. Use this to suggest nearby mandis, markets, and state-specific government schemes.\n"
    if coordinates:
        user_section += f"\nThe user's approximate GPS coordinates are: {coordinates} (lat,lng). Use this for geographic context when suggesting nearby resources.\n"

    return f"""You are "Chalo Kisaan AI" (चलो किसान AI) — a warm, knowledgeable agritourism expert and farming advisor for Indian farmers.

{lang_rule}

YOUR PERSONALITY:
- You are like a wise, experienced farming elder (बुजुर्ग) combined with a modern business consultant
- Use warm, respectful tone — address the farmer with respect (आप, not तू/तुम)
- Be encouraging but realistic — don't make false promises about income
- Give specific, actionable advice with numbers when possible
- Keep responses concise — 3-5 short paragraphs maximum
- Use bullet points (•) for lists, not numbered lists
- When citing money, always use ₹ symbol with Indian number format

{user_section}
{farm_section}

{AGRITOURISM_FAQ}

{NEARBY_MARKET_KNOWLEDGE}

RESPONSE RULES:
1. LANGUAGE: {lang_rule}
2. Keep responses SHORT and ACTIONABLE — farmers are busy. Max 200 words.
3. Always give SPECIFIC numbers (costs, income, dates) when available.
4. Reference the user's SPECIFIC farm data when answering (if available).
5. For market/mandi questions, suggest nearby markets based on the user's location.
6. For scheme questions, mention eligibility and how to apply.
7. If the user asks something outside farming/agritourism, politely redirect.
8. End with a helpful follow-up suggestion or question.
9. Do NOT use markdown headers (#). Use bullet points (•) for structure.
10. Do NOT switch languages mid-response. Stay in the chosen language throughout.
11. CRITICAL: Do NOT use emojis or any Unicode emoji/pictograph symbols in your response. The response is read aloud by a voice engine — emojis will be spoken as gibberish. Use plain text and punctuation only."""


def chat_with_assistant(
    message: str,
    language: str,
    farm_context: dict,
    user_context: dict,
    history: list[dict],
) -> Generator[str, None, None]:
    """
    Streaming chat with the AI assistant using ConverseStream API.
    Yields raw text chunks.
    """
    system_prompt = _build_assistant_system_prompt(language, farm_context, user_context)
    client = _bedrock_runtime()

    # Build messages array with conversation history
    # Bedrock Converse API requires alternating user/assistant roles.
    # Deduplicate consecutive same-role messages by merging them.
    messages = []
    for msg in history:
        role = msg["role"]
        text = msg.get("content") or msg.get("text") or ""
        if not text:
            continue
        if messages and messages[-1]["role"] == role:
            # Merge consecutive same-role entries (prevents Bedrock ValidationException)
            messages[-1]["content"][0]["text"] += "\n" + text
        else:
            messages.append({
                "role": role,
                "content": [{"text": text}],
            })

    # Add current user message
    messages.append({
        "role": "user",
        "content": [{"text": message}],
    })

    response = client.converse_stream(
        modelId=settings.BEDROCK_MODEL_ID,
        system=[{"text": system_prompt}],
        messages=messages,
        inferenceConfig={
            "maxTokens": 1024,   # Keep assistant responses concise
            "temperature": 0.7,  # Some creativity but mostly factual
            "topP": 0.9,
        },
    )

    for event in response["stream"]:
        if "contentBlockDelta" in event:
            text = event["contentBlockDelta"]["delta"].get("text", "")
            if text:
                yield text


def analyze_image(image_bytes: bytes) -> dict[str, Any]:
    """Analyze a farm photo for agritourism potential.
    Always uses BEDROCK_VISION_MODEL_ID — the main model may not support images.
    """
    prompt = build_image_analysis_prompt()
    raw = invoke_model(prompt, image_bytes, model_id=settings.BEDROCK_VISION_MODEL_ID)
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
