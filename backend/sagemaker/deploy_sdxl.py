"""
Deploy Stable Diffusion XL to a SageMaker Serverless Inference endpoint.
Run this script ONCE from your local machine after AWS credentials are configured.

Usage:
    python sagemaker/deploy_sdxl.py

Requirements:
    pip install sagemaker boto3

Cost: Serverless inference — billed per request only (~$0.03/image).
      No 24/7 GPU cost during development.
"""

import boto3
import sagemaker
from sagemaker.huggingface import HuggingFaceModel
from sagemaker.serverless import ServerlessInferenceConfig

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.config import get_settings  # noqa: E402

settings = get_settings()

ROLE_ARN        = settings.SAGEMAKER_ROLE_ARN
ENDPOINT_NAME   = settings.SAGEMAKER_SDXL_ENDPOINT
REGION          = settings.AWS_REGION


def deploy_sdxl_serverless():
    sess = sagemaker.Session(
        boto_session=boto3.Session(region_name=REGION)
    )

    # Use Hugging Face Hub directly (no need to upload model weights to S3 in dev)
    model = HuggingFaceModel(
        env={
            "HF_MODEL_ID":  "stabilityai/stable-diffusion-xl-base-1.0",
            "HF_TASK":      "text-to-image",
        },
        role=ROLE_ARN,
        transformers_version="4.37",
        pytorch_version="2.1",
        py_version="py310",
        sagemaker_session=sess,
    )

    # Serverless config — no GPU instance running 24/7
    serverless_config = ServerlessInferenceConfig(
        memory_size_in_mb=6144,   # 6 GB RAM (minimum for SDXL)
        max_concurrency=2,        # max 2 simultaneous requests in dev
    )

    print(f"Deploying SDXL serverless endpoint: {ENDPOINT_NAME}")
    predictor = model.deploy(
        serverless_inference_config=serverless_config,
        endpoint_name=ENDPOINT_NAME,
    )
    print(f"✅ SDXL endpoint deployed: {ENDPOINT_NAME}")
    return predictor


def delete_sdxl_endpoint():
    """Call this to tear down the endpoint and stop all charges."""
    client = boto3.client("sagemaker", region_name=REGION)
    client.delete_endpoint(EndpointName=ENDPOINT_NAME)
    print(f"🗑  Endpoint {ENDPOINT_NAME} deleted.")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "deploy"
    if action == "deploy":
        deploy_sdxl_serverless()
    elif action == "delete":
        delete_sdxl_endpoint()
    else:
        print("Usage: python deploy_sdxl.py [deploy|delete]")
