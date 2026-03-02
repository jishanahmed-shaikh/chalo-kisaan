"""
Route: POST /api/generate-visualization
Calls SageMaker SDXL to generate a farm transformation image.
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.schemas import VisualizationRequest
from app.services.sagemaker import generate_visualization

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate-visualization")
async def viz(req: VisualizationRequest):
    """
    Generates a photorealistic farm visualization using SageMaker SDXL.
    Returns base64-encoded image or an error message if endpoint is offline.
    """
    farm_dict = req.farmData.model_dump(by_alias=True)
    result    = generate_visualization(farm_dict, req.planData)

    if not result["success"]:
        # Return graceful degradation — frontend shows placeholder
        return {
            "success":       False,
            "visualization": None,
            "message":       result.get("error", "Visualization service unavailable."),
        }

    return {
        "success":       True,
        "visualization": result["visualization"],
    }
