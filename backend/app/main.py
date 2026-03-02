"""
Chalo Kisaan — FastAPI Application Entry Point
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routes import (
    health,
    plans,
    transcribe,
    visualizations,
    generate_viz,
    tts,
)

settings = get_settings()

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = "/api"

app.include_router(health.router,          prefix=PREFIX, tags=["Health"])
app.include_router(plans.router,           prefix=PREFIX, tags=["Plan Generation"])
app.include_router(transcribe.router,      prefix=PREFIX, tags=["Voice / Transcribe"])
app.include_router(visualizations.router,  prefix=PREFIX, tags=["Image Analysis"])
app.include_router(generate_viz.router,    prefix=PREFIX, tags=["Visualization"])
app.include_router(tts.router,             prefix=PREFIX, tags=["Text-to-Speech"])


@app.on_event("startup")
async def on_startup():
    logger.info("🌾 Chalo Kisaan API starting — region=%s", settings.AWS_REGION)


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Chalo Kisaan API shutting down.")
