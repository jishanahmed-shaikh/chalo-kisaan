"""
Route: GET /api/health
Simple health + config check endpoint.
"""

from fastapi import APIRouter
from app.config import get_settings
from app.schemas.schemas import HealthResponse

router   = APIRouter()
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        region=settings.AWS_REGION,
    )
