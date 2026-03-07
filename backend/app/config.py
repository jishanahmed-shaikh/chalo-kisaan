"""
Chalo Kisaan — Application Configuration
Reads all settings from environment variables (.env file in dev).
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # -- App --
    APP_NAME: str = "Chalo Kisaan API"
    APP_VERSION: str = "1.0.0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_DEBUG: bool = False

    # -- AWS (IAM — for S3, Transcribe, Polly) --
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"

    # Bedrock API Key (bearer token auth — set via env var for boto3)
    AWS_BEARER_TOKEN_BEDROCK: str = ""

    # S3 buckets (ap-south-1)
    S3_ASSETS_BUCKET: str = "chalokisaan-assets"
    S3_AUDIO_TEMP_BUCKET: str = "chalokisaan-audio-temp"
    S3_DATA_BUCKET: str = "chalokisaan-data"
    S3_MODELS_BUCKET: str = "chalokisaan-models"

    # Bedrock
    BEDROCK_MODEL_ID: str = "us.amazon.nova-pro-v1:0"
    BEDROCK_LIGHT_MODEL_ID: str = "us.amazon.nova-lite-v1:0"
    BEDROCK_IMAGE_MODEL_ID: str = "amazon.nova-canvas-v1:0"
    BEDROCK_MAX_TOKENS: int = 4096
    BEDROCK_REGION: str = "us-east-1"

    # SageMaker (optional — not required for MVP)
    SAGEMAKER_SDXL_ENDPOINT: str = ""
    SAGEMAKER_XGBOOST_ENDPOINT: str = ""

    # Transcribe
    TRANSCRIBE_CUSTOM_VOCAB: str = ""

    # Polly
    POLLY_S3_CACHE_PREFIX: str = "tts-cache"

    # -- Database --
    DATABASE_URL: str = "postgresql://kisaan_admin:changeme@localhost:5432/chalo_kisaan"
    DATABASE_ECHO: bool = False

    # -- Auth --
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # -- CORS --
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:8000"

    # -- Logging --
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = (".env", "../.env")
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
