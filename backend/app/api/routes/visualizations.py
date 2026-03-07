"""
Route: POST /api/analyze-image
Accepts a farm photo, uploads to S3, and runs Bedrock image analysis.

Frontend expects: {success: true, analysis: {agritourismPotential, visualObservations, potentialServices[]}}
"""

from __future__ import annotations
import asyncio
import json
import logging

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.services import bedrock
from app.schemas.schemas import LandVisualizationRequest
from app.services.bedrock import generate_image_prompt, generate_land_visualization
from app.utils.s3 import upload_file
from app.utils.dynamo import log_event

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/analyze-image")
async def analyze_image(image: UploadFile = File(...)):
    """
    Accepts a farm photo and returns AI analysis from Bedrock Claude.
    Also stores the original image in S3 under farm-images/.
    """
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit.")

    # Upload to S3 (run in thread since boto3 is sync)
    s3_result = await asyncio.to_thread(
        upload_file,
        file_bytes=image_bytes,
        filename=image.filename or "farm.jpg",
        prefix="farm-images",
        content_type=image.content_type,
    )

    # Analyse with Bedrock (run in thread)
    try:
        analysis = await asyncio.to_thread(bedrock.analyze_image, image_bytes)
    except Exception as e:
        logger.error("Image analysis failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Analysis failed: {e}")

    log_event("image_analyzed", {
        "potential": analysis.get("agritourismPotential") if isinstance(analysis, dict) else None,
        "s3_key": s3_result["key"],
    })

    return {
        "success": True,
        "analysis": analysis,
        "s3_key": s3_result["key"],
        "url": s3_result["url"],
    }


@router.post("/visualize-land")
async def visualize_land(req: LandVisualizationRequest):
    """
    Generate an AI visualization of the farm with selected agrotourism services.
    Uses Nova Pro to craft a prompt, then Nova Canvas to generate the image.
    """
    try:
        # Decode image so Nova Pro can see the actual farm photo
        import base64 as b64mod
        image_bytes = b64mod.b64decode(req.imageBase64)

        # Step 1: Use Nova Pro (with the image) to generate a grounded prompt
        prompt_data = await asyncio.to_thread(
            generate_image_prompt,
            req.services,
            req.farmData,
            req.mode,
            image_bytes,
        )
        logger.info("Generated image prompt: %s", json.dumps(prompt_data)[:200])

        # Step 2: Generate image with Nova Canvas
        result_image_b64 = await asyncio.to_thread(
            generate_land_visualization,
            req.imageBase64,
            prompt_data,
            req.mode,
        )

        log_event("land_visualized", {
            "mode": req.mode,
            "services": req.services,
        })

        return {
            "success": True,
            "generatedImage": result_image_b64,
            "prompt": prompt_data,
            "mode": req.mode,
        }

    except Exception as e:
        logger.error("Land visualization failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Visualization failed: {e}")
