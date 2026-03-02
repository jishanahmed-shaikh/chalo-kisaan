"""
Pydantic schemas — request/response validation.
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ─────────────────────────────────────────────────────────────
# Farm / Plan
# ─────────────────────────────────────────────────────────────

class FarmDataIn(BaseModel):
    landSize:               Optional[str]   = None
    location:               Optional[str]   = None
    soilType:               Optional[str]   = None
    waterSource:            Optional[str]   = None
    existingInfrastructure: Optional[str]   = None
    budget:                 Optional[str]   = None
    biodiversity:           Optional[str]   = None
    language:               str             = "hindi"


class GeneratePlanRequest(BaseModel):
    farmData: FarmDataIn
    language: str = "hindi"


class ParseVoiceRequest(BaseModel):
    transcript: str
    language:   str = "hindi"


class VisualizationRequest(BaseModel):
    farmData: FarmDataIn
    planData: dict[str, Any]


# ─────────────────────────────────────────────────────────────
# Transcribe
# ─────────────────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    audio_base64: str
    language:     str = "hindi"   # hindi | marathi | english | punjabi | gujarati


class TranscribeResponse(BaseModel):
    success:    bool
    transcript: Optional[str] = None
    language:   Optional[str] = None
    error:      Optional[str] = None


# ─────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:  str
    version: str
    region:  str


# ─────────────────────────────────────────────────────────────
# User / Auth
# ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    phone:    Optional[str] = None
    email:    Optional[str] = None
    name:     Optional[str] = None
    language: str = "hindi"


class UserOut(BaseModel):
    id:         str
    phone:      Optional[str]
    email:      Optional[str]
    name:       Optional[str]
    language:   str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int


# ─────────────────────────────────────────────────────────────
# Project
# ─────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name:        str
    description: Optional[str] = None


class ProjectOut(BaseModel):
    id:          str
    name:        str
    description: Optional[str]
    status:      str
    created_at:  datetime

    class Config:
        from_attributes = True
