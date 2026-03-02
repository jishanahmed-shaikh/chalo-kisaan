"""
Amazon SageMaker service — SDXL visualization + XGBoost recommendations.
"""

from __future__ import annotations
import json
import logging
import base64
from typing import Any

import boto3

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _sm_runtime():
    return boto3.client(
        "sagemaker-runtime",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


# ── SDXL Visualization ───────────────────────────────────────────────────────

def generate_visualization(
    farm_data: dict[str, Any],
    plan_data: dict[str, Any],
    control_image_b64: str | None = None,
) -> dict[str, Any]:
    """
    Generate a farm visualization image via SageMaker SDXL endpoint.
    Returns {"success": bool, "visualization": base64_string | None, "error": str | None}
    """
    service    = plan_data.get("recommendedService", "agritourism farm")
    location   = farm_data.get("location", "India")
    crops      = farm_data.get("biodiversity", "mixed crops")

    prompt = (
        f"Aerial view of Indian {service} farm near {location}, "
        f"with {crops}, photorealistic, golden hour lighting, "
        "lush green fields, traditional architecture, cottages, tourists, "
        "ultra detailed, 4K"
    )
    neg_prompt = "urban, industrial, low quality, cartoon, blurry"

    payload: dict[str, Any] = {
        "prompt":               prompt,
        "negative_prompt":      neg_prompt,
        "num_inference_steps":  30,
        "guidance_scale":       7.5,
        "width":                768,
        "height":               512,
    }

    if control_image_b64:
        payload["controlnet_image"]             = control_image_b64
        payload["controlnet_conditioning_scale"] = 0.7

    try:
        client   = _sm_runtime()
        response = client.invoke_endpoint(
            EndpointName=settings.SAGEMAKER_SDXL_ENDPOINT,
            ContentType="application/json",
            Body=json.dumps(payload),
        )
        result = json.loads(response["Body"].read())
        return {"success": True, "visualization": result.get("generated_image")}

    except Exception as e:
        logger.error("SDXL visualization failed: %s", e)
        return {"success": False, "visualization": None, "error": str(e)}


# ── XGBoost Recommendations ──────────────────────────────────────────────────

SOIL_ENCODING = {
    "Red Soil": 0, "Black Cotton Soil": 1, "Alluvial Soil": 2,
    "Laterite Soil": 3, "Sandy Soil": 4, "Clay Soil": 5,
}

WATER_ENCODING = {
    "River / Stream": 0, "Borewell": 1, "Open Well": 2,
    "Canal Irrigation": 3, "Rainwater Only": 4, "Lake / Pond": 5,
}

ACTIVITY_LABELS = [
    "Farm Stay & Homestay",
    "Crop Harvesting Tours",
    "Organic Farm Experience",
    "Vineyard / Orchard Tours",
    "Dairy & Cattle Experience",
    "Cooking & Food Tourism",
    "Bird Watching & Nature Trails",
    "Adventure Agri-Camping",
]


def get_activity_recommendation(farm_data: dict[str, Any]) -> dict[str, Any]:
    """
    Predict best agritourism activity using XGBoost endpoint.
    Falls back gracefully if endpoint is not deployed yet.
    """
    try:
        land_size    = float(farm_data.get("landSize", 5) or 5)
        budget       = float(farm_data.get("budget", 100000) or 100000) / 100000
        soil_enc     = SOIL_ENCODING.get(farm_data.get("soilType", ""), 2)
        water_enc    = WATER_ENCODING.get(farm_data.get("waterSource", ""), 1)

        # Feature vector: [land_size, soil_enc, water_enc, budget_norm]
        features = f"{land_size},{soil_enc},{water_enc},{budget}"

        client   = _sm_runtime()
        response = client.invoke_endpoint(
            EndpointName=settings.SAGEMAKER_XGBOOST_ENDPOINT,
            ContentType="text/csv",
            Body=features,
        )
        prediction = int(float(response["Body"].read()))
        label      = ACTIVITY_LABELS[min(prediction, len(ACTIVITY_LABELS) - 1)]
        return {"success": True, "recommended_activity": label, "class_index": prediction}

    except Exception as e:
        logger.warning("XGBoost recommendation failed (endpoint may not be deployed): %s", e)
        return {
            "success":              False,
            "recommended_activity": "Farm Stay & Homestay",
            "class_index":          0,
            "error":                str(e),
        }
