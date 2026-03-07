"""
Route: POST /api/analyze-image
Accepts a farm photo, uploads to S3, and runs Bedrock image analysis.

Frontend expects: {success: true, analysis: {agritourismPotential, visualObservations, potentialServices[]}}

Image Validation:
- Must be valid image file (JPEG, PNG, WebP)
- Max 10 MB
- Min 400x400px resolution
- Reasonable aspect ratio (not extreme panoramic/stripe)
"""

from __future__ import annotations
import asyncio
import json
import logging
from io import BytesIO

from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image

from app.services import bedrock
from app.schemas.schemas import LandVisualizationRequest
from app.services.bedrock import generate_image_prompt, generate_land_visualization
from app.utils.s3 import upload_file
from app.utils.dynamo import log_event

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
MIN_IMAGE_DIMENSION = 400  # pixels
MAX_ASPECT_RATIO = 4.0  # width/height
MIN_ASPECT_RATIO = 0.25  # width/height


def validate_image_dimensions(image_bytes: bytes) -> tuple[int, int]:
    """Validate image dimensions and return (width, height). Raises HTTPException on failure."""
    try:
        img = Image.open(BytesIO(image_bytes))
        width, height = img.size
        
        # Check minimum dimensions
        if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
            raise HTTPException(
                status_code=400,
                detail=f"Image too small ({width}x{height}). Min size: {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION}px"
            )
        
        # Check aspect ratio (reject extreme panoramic or stripe-like images)
        aspect_ratio = width / height
        if aspect_ratio > MAX_ASPECT_RATIO or aspect_ratio < MIN_ASPECT_RATIO:
            raise HTTPException(
                status_code=400,
                detail=f"Image aspect ratio unusual ({aspect_ratio:.1f}:1). Please use a normal farm photo (landscape or portrait)"
            )
        
        return width, height
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Image dimension validation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="Invalid image file or corrupted data")


@router.post("/analyze-image")
async def analyze_image(image: UploadFile = File(...)):
    """
    Accepts a farm photo and returns AI analysis from Bedrock Nova Pro vision model.
    Also stores the original image in S3 under farm-images/.
    
    Validations:
    - File type must be image
    - Size must be ≤ 10 MB
    - Dimensions must be ≥ 400x400px
    - Aspect ratio must be reasonable (not extreme panoramic)
    """
    # Validation 1: Content type
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="❌ File must be an image (JPG, PNG, WebP, etc.)")

    # Validation 2: File size
    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        size_mb = len(image_bytes) / 1024 / 1024
        raise HTTPException(
            status_code=413,
            detail=f"❌ Image too large ({size_mb:.1f}MB). Max size: 10MB"
        )

    # Validation 3: Image dimensions and aspect ratio
    width, height = await asyncio.to_thread(validate_image_dimensions, image_bytes)
    logger.info(f"Image validated: {width}x{height}px, {image.content_type}")

    # Upload to S3 (run in thread since boto3 is sync)
    try:
        s3_result = await asyncio.to_thread(
            upload_file,
            file_bytes=image_bytes,
            filename=image.filename or "farm.jpg",
            prefix="farm-images",
            content_type=image.content_type,
        )
    except Exception as e:
        logger.error("S3 upload failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="❌ Failed to store image. Try again.")

    # Analyze with Bedrock (run in thread)
    try:
        analysis = await asyncio.to_thread(bedrock.analyze_image, image_bytes)
    except Exception as e:
        logger.error("Image analysis failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="❌ AI analysis failed. Try a clearer farm photo or different angle."
        )

    log_event("image_analyzed", {
        "potential": analysis.get("agritourismPotential") if isinstance(analysis, dict) else None,
        "s3_key": s3_result["key"],
        "dimensions": f"{width}x{height}",
    })

    return {
        "success": True,
        "analysis": analysis,
        "s3_key": s3_result["key"],
        "url": s3_result["url"],
        "dimensions": {"width": width, "height": height},
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
