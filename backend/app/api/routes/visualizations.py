"""
Route: POST /api/analyze-image
Accepts a farm photo, uploads to S3, and runs Bedrock image analysis.
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.services import bedrock
from app.utils.s3 import upload_file

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

    # Upload to S3
    s3_result = upload_file(
        file_bytes=image_bytes,
        filename=image.filename or "farm.jpg",
        prefix="farm-images",
        content_type=image.content_type,
    )

    # Analyse with Bedrock
    try:
        analysis = bedrock.analyze_image(image_bytes)
    except Exception as e:
        logger.error("Image analysis failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Analysis failed: {e}")

    return {
        "success":  True,
        "analysis": analysis,
        "s3_key":   s3_result["key"],
        "url":      s3_result["url"],
    }
