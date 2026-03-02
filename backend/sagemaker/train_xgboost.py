"""
Train and deploy an XGBoost model for agritourism activity recommendations.
This script handles: data prep → training → evaluation → deployment.

Usage:
    python sagemaker/train_xgboost.py [train|deploy|delete]

Training data format (CSV):
    land_size, soil_enc, water_enc, budget_norm, activity_label
    5.0, 1, 2, 1.5, 0
    12.0, 0, 0, 3.0, 3
    ...

Activity label encoding (matches ACTIVITY_LABELS in services/sagemaker.py):
    0 = Farm Stay & Homestay
    1 = Crop Harvesting Tours
    2 = Organic Farm Experience
    3 = Vineyard / Orchard Tours
    4 = Dairy & Cattle Experience
    5 = Cooking & Food Tourism
    6 = Bird Watching & Nature Trails
    7 = Adventure Agri-Camping
"""

import boto3
import sagemaker
from sagemaker.xgboost import XGBoost
from sagemaker.inputs import TrainingInput
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.config import get_settings  # noqa: E402

settings = get_settings()

ROLE_ARN        = "arn:aws:iam::YOUR_ACCOUNT_ID:role/chalokisaan-sagemaker-role"
ENDPOINT_NAME   = settings.SAGEMAKER_XGBOOST_ENDPOINT
REGION          = settings.AWS_REGION
DATA_BUCKET     = settings.S3_MODELS_BUCKET


def train_and_deploy():
    sess = sagemaker.Session(
        boto_session=boto3.Session(region_name=REGION)
    )

    estimator = XGBoost(
        entry_point="train_recommendations.py",
        source_dir=os.path.dirname(__file__),
        role=ROLE_ARN,
        instance_count=1,
        instance_type="ml.m5.large",     # cheap CPU instance for training
        framework_version="1.7-1",
        hyperparameters={
            "max_depth":    6,
            "eta":          0.3,
            "n_estimators": 100,
            "objective":    "multi:softmax",
            "num_class":    8,
        },
        sagemaker_session=sess,
    )

    estimator.fit({
        "train":      TrainingInput(f"s3://{DATA_BUCKET}/training/",   content_type="text/csv"),
        "validation": TrainingInput(f"s3://{DATA_BUCKET}/validation/", content_type="text/csv"),
    })

    print("Training complete. Deploying endpoint...")
    predictor = estimator.deploy(
        initial_instance_count=1,
        instance_type="ml.t2.medium",    # smallest, cheapest for dev inference
        endpoint_name=ENDPOINT_NAME,
    )
    print(f"✅ XGBoost endpoint deployed: {ENDPOINT_NAME}")
    return predictor


def delete_endpoint():
    client = boto3.client("sagemaker", region_name=REGION)
    client.delete_endpoint(EndpointName=ENDPOINT_NAME)
    print(f"🗑  Endpoint {ENDPOINT_NAME} deleted.")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "train"
    if action == "train":
        train_and_deploy()
    elif action == "delete":
        delete_endpoint()
    else:
        print("Usage: python train_xgboost.py [train|delete]")
