"""
SQLAlchemy ORM Models — maps to PostgreSQL tables.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean,
    DateTime, Text, ForeignKey, JSON, BigInteger,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


def _uuid():
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────
# User
# ─────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    phone       = Column(String(20), unique=True, index=True, nullable=True)
    email       = Column(String(255), unique=True, index=True, nullable=True)
    name        = Column(String(200), nullable=True)
    language    = Column(String(20), default="hindi")
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    projects    = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    plans       = relationship("BusinessPlan", back_populates="user")


# ─────────────────────────────────────────────────────────────
# Project  (one farmer can have multiple farm projects)
# ─────────────────────────────────────────────────────────────
class Project(Base):
    __tablename__ = "projects"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id     = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    name        = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    status      = Column(String(30), default="draft")   # draft | active | completed
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user        = relationship("User", back_populates="projects")
    farm        = relationship("FarmDetails", back_populates="project", uselist=False, cascade="all, delete-orphan")
    plans       = relationship("BusinessPlan", back_populates="project", cascade="all, delete-orphan")
    images      = relationship("FarmImage", back_populates="project", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────
# FarmDetails
# ─────────────────────────────────────────────────────────────
class FarmDetails(Base):
    __tablename__ = "farm_details"

    id                      = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id              = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False, unique=True)
    location                = Column(String(500), nullable=True)
    land_size               = Column(Float, nullable=True)           # in acres
    soil_type               = Column(String(100), nullable=True)
    water_source            = Column(String(100), nullable=True)
    existing_infrastructure = Column(String(500), nullable=True)
    budget                  = Column(BigInteger, nullable=True)      # INR
    biodiversity            = Column(String(200), nullable=True)
    language                = Column(String(20), default="hindi")
    raw_voice_transcript    = Column(Text, nullable=True)
    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project     = relationship("Project", back_populates="farm")


# ─────────────────────────────────────────────────────────────
# BusinessPlan
# ─────────────────────────────────────────────────────────────
class BusinessPlan(Base):
    __tablename__ = "business_plans"

    id                  = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id          = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False, index=True)
    user_id             = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    raw_llm_response    = Column(Text, nullable=True)       # full streamed text
    parsed_plan         = Column(JSON, nullable=True)        # structured JSON after parsing
    recommended_service = Column(String(300), nullable=True)
    tagline             = Column(String(500), nullable=True)
    suitability_score   = Column(Integer, nullable=True)
    language            = Column(String(20), default="hindi")
    status              = Column(String(30), default="generating")  # generating | ready | failed
    pdf_s3_key          = Column(String(500), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project     = relationship("Project", back_populates="plans")
    user        = relationship("User", back_populates="plans")


# ─────────────────────────────────────────────────────────────
# FarmImage
# ─────────────────────────────────────────────────────────────
class FarmImage(Base):
    __tablename__ = "farm_images"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id      = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False, index=True)
    image_type      = Column(String(30), default="original")  # original | visualization
    s3_bucket       = Column(String(200), nullable=True)
    s3_key          = Column(String(500), nullable=True)
    public_url      = Column(String(1000), nullable=True)
    analysis_result = Column(JSON, nullable=True)             # Bedrock image analysis
    created_at      = Column(DateTime, default=datetime.utcnow)

    project     = relationship("Project", back_populates="images")
