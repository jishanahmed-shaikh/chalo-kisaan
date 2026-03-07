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
    DEV_BYPASS_AUTH: bool = False         # Set true in dev to skip JWT verification

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
    BEDROCK_VISION_MODEL_ID: str = "amazon.nova-pro-v1:0"
    BEDROCK_MAX_TOKENS: int = 4096
    BEDROCK_REGION: str = "us-east-1"

    # SageMaker (optional — not required for MVP)
    SAGEMAKER_SDXL_ENDPOINT: str = ""
    SAGEMAKER_XGBOOST_ENDPOINT: str = ""
    SAGEMAKER_ROLE_ARN: str = ""          # arn:aws:iam::ACCOUNT_ID:role/chalokisaan-sagemaker-role

    # -- DynamoDB table names --
    DYNAMO_LOGS_TABLE: str = "chalokisaan-logs"
    DYNAMO_PLANS_TABLE: str = "chalokisaan-plans"

    # Transcribe
    TRANSCRIBE_CUSTOM_VOCAB: str = ""

    # Polly
    POLLY_S3_CACHE_PREFIX: str = "tts-cache"
    # Kajal Neural is only available in us-east-1, us-west-2, eu-west-1.
    # Override this if your IAM credentials allow cross-region Polly calls.
    POLLY_REGION: str = "us-east-1"

    # -- Bedrock Guardrails (optional) --
    BEDROCK_GUARDRAIL_ID: str = ""
    BEDROCK_GUARDRAIL_VERSION: str = "1"

    # -- Database --
    DATABASE_URL: str = "postgresql://kisaan_admin:changeme@localhost:5432/chalo_kisaan"
    DATABASE_ECHO: bool = False

    # -- Auth --
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 720   # 30 days — farmers shouldn't re-login constantly

    # -- Amazon Cognito (Phone OTP auth) --
    COGNITO_USER_POOL_ID: str = ""          # e.g. ap-south-1_SGaPgFlzd
    COGNITO_APP_CLIENT_ID: str = ""         # App client ID from Cognito console
    COGNITO_CLIENT_SECRET: str = ""         # App client secret (leave blank if client has no secret)
    COGNITO_REGION: str = "ap-south-1"

    # -- CORS --
    # Comma-separated list. In production, set via Secrets Manager / env var to your real domain.
    CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "https://localhost:3000,"
        "https://localhost:3443,"
        "https://6ddkdsh6-8000.inc1.devtunnels.ms,"
        "https://6ddkdsh6-3443.inc1.devtunnels.ms,"
        "https://chalokisaan.in,"            # production — replace with real domain
        "https://www.chalokisaan.in"          # production www — replace with real domain
    )

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
