"""
Chalo Kisaan — FastAPI Application Entry Point
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

settings = get_settings()

# -- Logging -------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


# -- Lifespan (replaces deprecated on_event) ------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Chalo Kisaan API starting — region=%s", settings.AWS_REGION)
    yield
    logger.info("Chalo Kisaan API shutting down.")


# -- FastAPI app ---------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# -- CORS ----------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Routers -------------------------------------------------------------------
# Import routes after app creation to avoid circular imports
from app.api.routes import (  # noqa: E402
    health,
    plans,
    transcribe,
    visualizations,
    generate_viz,
    tts,
    projects,
    auth,
    assistant,
)

PREFIX = "/api"

app.include_router(auth.router,           prefix=PREFIX, tags=["Authentication"])
app.include_router(health.router,         prefix=PREFIX, tags=["Health"])
app.include_router(plans.router,          prefix=PREFIX, tags=["Plan Generation"])
app.include_router(transcribe.router,     prefix=PREFIX, tags=["Voice / Transcribe"])
app.include_router(visualizations.router, prefix=PREFIX, tags=["Image Analysis"])
app.include_router(generate_viz.router,   prefix=PREFIX, tags=["Visualization"])
app.include_router(tts.router,            prefix=PREFIX, tags=["Text-to-Speech"])
app.include_router(projects.router,       prefix=PREFIX, tags=["Projects"])
app.include_router(assistant.router,      prefix=PREFIX, tags=["AI Assistant"])
