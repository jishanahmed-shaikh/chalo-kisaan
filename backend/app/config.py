"""
Chalo Kisaan — Application Configuration
Reads all settings from environment variables (.env file in dev).
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "Chalo Kisaan API"
    APP_VERSION: str = "1.0.0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_DEBUG: bool = False

    # ── AWS ──────────────────────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"

    # S3 buckets
    S3_ASSETS_BUCKET: str = "chalokisaan-assets"
    S3_AUDIO_TEMP_BUCKET: str = "chalokisaan-audio-temp"
    S3_MODELS_BUCKET: str = "chalokisaan-models"

    # Bedrock
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    BEDROCK_MAX_TOKENS: int = 4096
    BEDROCK_GUARDRAIL_ID: str = ""       # filled after Guardrail is created in AWS console
    BEDROCK_GUARDRAIL_VERSION: str = "1"

    # SageMaker
    SAGEMAKER_SDXL_ENDPOINT: str = "chalokisaan-sdxl-endpoint"
    SAGEMAKER_XGBOOST_ENDPOINT: str = "chalokisaan-xgboost-endpoint"

    # Transcribe
    TRANSCRIBE_CUSTOM_VOCAB: str = "chalokisaan-agri-vocab"

    # Polly
    POLLY_S3_CACHE_PREFIX: str = "tts-cache"

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://kisaan_admin:changeme@localhost:5432/chalo_kisaan"
    DATABASE_ECHO: bool = False

    # ── Auth ─────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # ── CORS ─────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:3000,https://localhost:3000,https://localhost:3443"

    # ── Logging ──────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
