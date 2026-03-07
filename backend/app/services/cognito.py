"""
Amazon Cognito service — Phone + Password authentication.

Pool:        ap-south-1_SGaPgFlzd
App Client:  3c33p2er03eq62g3bt9vh65420

Auth flow (USER_PASSWORD_AUTH — no OTP / SMS MFA):
  1. register(phone, password)
       • Creates a new Cognito user with phone_number attribute.
       • Sets a permanent password immediately (no temp password).
       • Returns { success: True } — no tokens yet; user must log in next.

  2. login(phone, password)
       • Calls initiate_auth(USER_PASSWORD_AUTH).
       • Returns { id_token, access_token, refresh_token, expires_in }.

  3. refresh_tokens(refresh_token, phone)
       • Silent background refresh — no password needed.
       • Returns new { id_token, access_token, expires_in }.

AWS Console prerequisites (one-time):
  Cognito → User Pool → App clients → your client
    ✓ Authentication flows: ALLOW_USER_PASSWORD_AUTH, ALLOW_REFRESH_TOKEN_AUTH
    ✗ (disable) ALLOW_CUSTOM_AUTH
  Cognito → User Pool → Sign-in experience → MFA → Disabled

Phone format: always +91XXXXXXXXXX (E.164).
"""

from __future__ import annotations
import base64
import hashlib
import hmac
import logging
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache()
def _cognito_client():
    return boto3.client(
        "cognito-idp",
        region_name=settings.COGNITO_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        config=BotoConfig(retries={"mode": "standard", "max_attempts": 3}),
    )


def _normalize_phone(phone: str) -> str:
    """Ensure phone is in E.164 format: +91XXXXXXXXXX"""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        if phone.startswith("0"):
            phone = phone[1:]
        phone = f"+91{phone}"
    return phone


def _secret_hash(username: str) -> str | None:
    """
    Compute SECRET_HASH required when app client has a secret.
    Returns None if no client secret configured.
    """
    secret = settings.COGNITO_CLIENT_SECRET
    if not secret:
        return None
    message = username + settings.COGNITO_APP_CLIENT_ID
    dig = hmac.new(
        secret.encode("utf-8"),
        msg=message.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    return base64.b64encode(dig).decode()


# ---------------------------------------------------------------------------
# Register (sign up)
# ---------------------------------------------------------------------------

def register(
    phone: str,
    password: str,
    given_name: str = "",
    family_name: str = "",
    birthdate: str = "",
    address: str = "",
) -> dict:
    """
    Create a new farmer account in Cognito with a real password and profile attributes.

    Returns:
        { "success": True, "message": str }

    Raises:
        ValueError  — user already exists, weak password, invalid phone
        RuntimeError — unexpected Cognito error
    """
    phone = _normalize_phone(phone)
    client = _cognito_client()
    pool_id = settings.COGNITO_USER_POOL_ID

    # Check if user already exists
    try:
        client.admin_get_user(UserPoolId=pool_id, Username=phone)
        raise ValueError("An account with this number already exists. Please log in.")
    except client.exceptions.UserNotFoundException:
        pass  # Good — proceed to create

    user_attributes = [
        {"Name": "phone_number",         "Value": phone},
        {"Name": "phone_number_verified", "Value": "true"},
    ]
    if given_name:
        user_attributes.append({"Name": "given_name",  "Value": given_name.strip()})
    if family_name:
        user_attributes.append({"Name": "family_name", "Value": family_name.strip()})
    if birthdate:
        user_attributes.append({"Name": "birthdate",   "Value": birthdate.strip()})
    if address:
        user_attributes.append({"Name": "address",     "Value": address.strip()})

    try:
        client.admin_create_user(
            UserPoolId=pool_id,
            Username=phone,
            UserAttributes=user_attributes,
            MessageAction="SUPPRESS",  # Don't send welcome email/SMS
            TemporaryPassword=password,
        )
        # Set as permanent so user is never forced to change it at login
        client.admin_set_user_password(
            UserPoolId=pool_id,
            Username=phone,
            Password=password,
            Permanent=True,
        )
        logger.info("Registered new Cognito user: %s", phone)
        return {"success": True, "message": "Account created. Please log in."}

    except client.exceptions.InvalidPasswordException as exc:
        raise ValueError(
            "Password must be at least 8 characters with uppercase, lowercase, "
            "a number and a special character."
        ) from exc
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        logger.error("admin_create_user failed (%s): %s", code, exc)
        raise RuntimeError(f"Could not create account: {exc}") from exc


def get_user_profile(phone: str) -> dict:
    """
    Fetch full Cognito user attributes for the given phone number.
    Returns a flat dict with: phone, given_name, family_name, birthdate, address, sub.
    """
    phone = _normalize_phone(phone)
    client = _cognito_client()
    pool_id = settings.COGNITO_USER_POOL_ID
    try:
        resp = client.admin_get_user(UserPoolId=pool_id, Username=phone)
        attrs = {a["Name"]: a["Value"] for a in resp.get("UserAttributes", [])}
        return {
            "phone":        attrs.get("phone_number", phone),
            "given_name":   attrs.get("given_name",   ""),
            "family_name":  attrs.get("family_name",  ""),
            "birthdate":    attrs.get("birthdate",    ""),
            "address":      attrs.get("address",      ""),
            "sub":          attrs.get("sub",          ""),
        }
    except ClientError as exc:
        logger.error("admin_get_user failed: %s", exc)
        raise RuntimeError(f"Could not fetch profile: {exc}") from exc


def update_user_profile(
    phone: str,
    given_name: str = "",
    family_name: str = "",
    birthdate: str = "",
    address: str = "",
) -> dict:
    """
    Update mutable profile attributes for a Cognito user.
    """
    phone = _normalize_phone(phone)
    client = _cognito_client()
    pool_id = settings.COGNITO_USER_POOL_ID

    user_attributes = []
    if given_name  is not None: user_attributes.append({"Name": "given_name",  "Value": given_name.strip()})
    if family_name is not None: user_attributes.append({"Name": "family_name", "Value": family_name.strip()})
    if birthdate   is not None: user_attributes.append({"Name": "birthdate",   "Value": birthdate.strip()})
    if address     is not None: user_attributes.append({"Name": "address",     "Value": address.strip()})

    if not user_attributes:
        return {"success": True, "message": "Nothing to update."}

    try:
        client.admin_update_user_attributes(
            UserPoolId=pool_id,
            Username=phone,
            UserAttributes=user_attributes,
        )
        logger.info("Updated profile for: %s", phone)
        return {"success": True, "message": "Profile updated."}
    except ClientError as exc:
        logger.error("admin_update_user_attributes failed: %s", exc)
        raise RuntimeError(f"Could not update profile: {exc}") from exc


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def login(phone: str, password: str) -> dict:
    """
    Authenticate with phone + password.

    Returns:
        { id_token, access_token, refresh_token, expires_in }

    Raises:
        ValueError  — wrong credentials (user-safe message)
        RuntimeError — unexpected Cognito error
    """
    phone = _normalize_phone(phone)
    client = _cognito_client()

    auth_params: dict = {
        "USERNAME": phone,
        "PASSWORD": password,
    }
    if sh := _secret_hash(phone):
        auth_params["SECRET_HASH"] = sh

    try:
        response = client.initiate_auth(
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters=auth_params,
            ClientId=settings.COGNITO_APP_CLIENT_ID,
        )
    except client.exceptions.NotAuthorizedException:
        raise ValueError("Incorrect phone number or password.")
    except client.exceptions.UserNotFoundException:
        raise ValueError("No account found for this number. Please sign up first.")
    except client.exceptions.UserNotConfirmedException:
        raise ValueError("Account is not confirmed. Please contact support.")
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        logger.error("initiate_auth failed (%s): %s", code, exc)
        raise RuntimeError(f"Login failed: {exc}") from exc

    # With USER_PASSWORD_AUTH + MFA disabled, tokens come back immediately
    auth_result = response.get("AuthenticationResult")
    if not auth_result:
        challenge = response.get("ChallengeName")
        raise RuntimeError(
            f"Unexpected Cognito challenge: {challenge}. "
            "Ensure MFA is disabled and USER_PASSWORD_AUTH is enabled on the app client."
        )

    logger.info("Login successful: %s", phone)
    return {
        "id_token":      auth_result["IdToken"],
        "access_token":  auth_result["AccessToken"],
        "refresh_token": auth_result.get("RefreshToken", ""),
        "expires_in":    auth_result.get("ExpiresIn", 3600),
    }


# ---------------------------------------------------------------------------
# Refresh tokens (unchanged — works for all auth flows)
# ---------------------------------------------------------------------------

def refresh_tokens(refresh_token: str, phone: str) -> dict:
    """
    Use the refresh token to get a new id_token + access_token silently.
    """
    phone = _normalize_phone(phone)
    client = _cognito_client()

    auth_params: dict = {
        "REFRESH_TOKEN": refresh_token,
        "USERNAME":      phone,
    }
    if sh := _secret_hash(phone):
        auth_params["SECRET_HASH"] = sh

    try:
        response = client.initiate_auth(
            AuthFlow="REFRESH_TOKEN_AUTH",
            AuthParameters=auth_params,
            ClientId=settings.COGNITO_APP_CLIENT_ID,
        )
    except ClientError as exc:
        logger.error("Token refresh failed: %s", exc)
        raise RuntimeError(f"Token refresh failed: {exc}") from exc

    auth_result = response["AuthenticationResult"]
    return {
        "id_token":     auth_result["IdToken"],
        "access_token": auth_result["AccessToken"],
        "expires_in":   auth_result.get("ExpiresIn", 3600),
    }


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def get_phone_from_token(id_token: str) -> str:
    """Decode phone_number claim from Cognito JWT payload (no sig check)."""
    import json, base64
    try:
        payload_b64 = id_token.split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("phone_number", "")
    except Exception as exc:
        logger.error("Could not decode id_token: %s", exc)
        raise ValueError("Invalid token") from exc
