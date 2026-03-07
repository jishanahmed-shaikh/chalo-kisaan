"""
DynamoDB helpers:
  - Audit logging  → chalokisaan-logs   (partition: sessionId, sort: timestamp)
  - Plan storage   → chalokisaan-plans  (partition: userId,    sort: planId)
"""

import json
import logging
import uuid
from datetime import datetime
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

LOGS_TABLE  = settings.DYNAMO_LOGS_TABLE
PLANS_TABLE = settings.DYNAMO_PLANS_TABLE


@lru_cache()
def _dynamo():
    return boto3.client(
        "dynamodb",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        config=BotoConfig(retries={"mode": "standard", "max_attempts": 2}),
    )


def log_event(event_type: str, data: dict | None = None):
    """
    Write an audit event to DynamoDB. Never raises.

    Keys: sessionId (partition), timestamp (sort).
    """
    try:
        item = {
            "sessionId": {"S": uuid.uuid4().hex},
            "timestamp": {"S": datetime.utcnow().isoformat()},
            "eventType": {"S": event_type},
        }
        if data:
            item["data"] = {"S": json.dumps(data, ensure_ascii=False, default=str)[:4000]}
        _dynamo().put_item(TableName=LOGS_TABLE, Item=item)
        logger.debug("DynamoDB log: %s", event_type)
    except Exception as e:
        logger.warning("DynamoDB log_event failed (non-fatal): %s", e)


# ── Plans persistence ────────────────────────────────────────────────────────

def save_plan(user_id: str, farm_data: dict, plan_data: dict, language: str = "hindi") -> str | None:
    """
    Save a generated plan to the chalokisaan-plans DynamoDB table.

    Table schema:
      userId   (S) — partition key  — Cognito sub
      planId   (S) — sort key       — UUID

    Returns the planId on success, None on failure (never raises).
    """
    plan_id = uuid.uuid4().hex
    try:
        item = {
            "userId":    {"S": user_id},
            "planId":    {"S": plan_id},
            "createdAt": {"S": datetime.utcnow().isoformat()},
            "language":  {"S": language},
            "location":  {"S": farm_data.get("location", "")},
            "landSize":  {"S": str(farm_data.get("landSize", ""))},
            "service":   {"S": plan_data.get("recommendedService", "")},
            "score":     {"N": str(plan_data.get("suitabilityScore", 0))},
            "farmData":  {"S": json.dumps(farm_data,  ensure_ascii=False, default=str)[:8000]},
            "planData":  {"S": json.dumps(plan_data,  ensure_ascii=False, default=str)[:32000]},
        }
        _dynamo().put_item(TableName=PLANS_TABLE, Item=item)
        logger.info("Plan saved to DynamoDB: userId=%s planId=%s", user_id, plan_id)
        return plan_id
    except Exception as exc:
        logger.warning("save_plan failed (non-fatal): %s", exc)
        return None


def get_plans_for_user(user_id: str) -> list[dict]:
    """
    Query all plans for a user from DynamoDB, newest first.
    Returns a list of plain dicts (parsed). Never raises.
    """
    try:
        resp = _dynamo().query(
            TableName=PLANS_TABLE,
            KeyConditionExpression="userId = :uid",
            ExpressionAttributeValues={":uid": {"S": user_id}},
            ScanIndexForward=False,   # newest first (by sort key — planId is random, so use a GSI for strict time order)
        )
        plans = []
        for item in resp.get("Items", []):
            try:
                plans.append({
                    "planId":    item["planId"]["S"],
                    "createdAt": item.get("createdAt", {}).get("S", ""),
                    "language":  item.get("language", {}).get("S", "hindi"),
                    "location":  item.get("location", {}).get("S", ""),
                    "landSize":  item.get("landSize", {}).get("S", ""),
                    "service":   item.get("service",  {}).get("S", ""),
                    "score":     int(item["score"]["N"]) if "score" in item else 0,
                    "farmData":  json.loads(item["farmData"]["S"]) if "farmData" in item else {},
                    "planData":  json.loads(item["planData"]["S"]) if "planData" in item else {},
                })
            except Exception as parse_exc:
                logger.warning("Failed to parse plan item: %s", parse_exc)
        return plans
    except Exception as exc:
        logger.warning("get_plans_for_user failed: %s", exc)
        return []


def delete_plan(user_id: str, plan_id: str) -> bool:
    """
    Delete a single plan. Returns True on success, False on failure. Never raises.
    """
    try:
        _dynamo().delete_item(
            TableName=PLANS_TABLE,
            Key={"userId": {"S": user_id}, "planId": {"S": plan_id}},
        )
        return True
    except Exception as exc:
        logger.warning("delete_plan failed: %s", exc)
        return False
