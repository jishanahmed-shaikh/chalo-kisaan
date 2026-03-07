"""
Pydantic schemas — request/response validation.
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel
from datetime import datetime


# -----------------------------------------------------------------
# Farm / Plan
# -----------------------------------------------------------------

class FarmDataIn(BaseModel):
    """
    Flat farm data — this is what the frontend sends directly
    as the request body to /api/generate-plan.
    """
    landSize: Optional[str] = None
    location: Optional[str] = None
    soilType: Optional[str] = None
    waterSource: Optional[str] = None
    existingInfrastructure: Optional[Any] = None
    budget: Optional[str] = None
    biodiversity: Optional[str] = None
    language: str = "hindi"


class VisualizationRequest(BaseModel):
    farmData: dict[str, Any]
    planData: dict[str, Any]


class LandVisualizationRequest(BaseModel):
    imageBase64: str
    services: list[str]
    farmData: dict[str, Any]
    mode: str = "transform"  # "transform" or "inpaint"
    planSummary: str = ""


# -----------------------------------------------------------------
# Voice / Transcribe
# -----------------------------------------------------------------

class ParseVoiceRequest(BaseModel):
    transcript: str
    language: str = "hindi"


class TranscribeRequest(BaseModel):
    audio_base64: str
    language: str = "hindi"


class TranscribeResponse(BaseModel):
    success: bool
    transcript: Optional[str] = None
    language: Optional[str] = None
    error: Optional[str] = None


# -----------------------------------------------------------------
# Health
# -----------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    version: str
    region: str


# -----------------------------------------------------------------
# User / Auth (for future use)
# -----------------------------------------------------------------

class UserCreate(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    language: str = "hindi"


class UserOut(BaseModel):
    id: str
    phone: Optional[str]
    email: Optional[str]
    name: Optional[str]
    language: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# -----------------------------------------------------------------
# Project (for future use)
# -----------------------------------------------------------------

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
