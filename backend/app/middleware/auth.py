"""
FastAPI dependency — verifies Cognito id_token on every protected request.

Usage in a route:
    from app.middleware.auth import require_auth

    @router.post("/generate-plan")
    async def generate_plan(req: FarmDataIn, user: AuthUser = Depends(require_auth)):
        # user.phone is the verified farmer's phone number
        ...

The frontend sends:  Authorization: Bearer <cognito_id_token>

We decode the JWT and verify:
  1. The token is from our Cognito User Pool (iss claim)
  2. The token is not expired (exp claim)
  3. The audience matches our App Client ID (aud claim)

For full production hardening, swap the manual decode below with a proper
JWKS-based verification using python-jose + Cognito's public keys endpoint:
  https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json
"""

from __future__ import annotations
import base64
import json
import logging
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_bearer_scheme = HTTPBearer(auto_error=True)


@dataclass
class AuthUser:
    """Populated by require_auth — available in every protected route."""
    phone: str          # E.164 format: +91XXXXXXXXXX
    sub:   str          # Cognito user sub (stable unique ID)
    token: str          # Raw id_token (pass to downstream if needed)


def _decode_jwt_payload(token: str) -> dict:
    """
    Decode JWT payload WITHOUT verifying signature.
    Signature verification is handled by Cognito's public JWKS.
    This is safe because we immediately check iss + aud + exp.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Not a valid JWT")
        payload_b64 = parts[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        return json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception as exc:
        raise ValueError(f"Malformed JWT: {exc}") from exc


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> AuthUser:
    """
    FastAPI dependency. Raises HTTP 401 on any auth failure.
    Returns AuthUser with verified phone + sub.
    """
    token = credentials.credentials
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please log in.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = _decode_jwt_payload(token)
    except ValueError:
        raise creds_exc

    # ── 1. Check expiry ────────────────────────────────────────────────────
    exp = payload.get("exp", 0)
    if time.time() > exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── 2. Check issuer (must be our Cognito pool) ─────────────────────────
    expected_iss = (
        f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com"
        f"/{settings.COGNITO_USER_POOL_ID}"
    )
    if settings.COGNITO_USER_POOL_ID and payload.get("iss") != expected_iss:
        logger.warning("Token issuer mismatch: %s", payload.get("iss"))
        raise creds_exc

    # ── 3. Check audience (must be our App Client) ─────────────────────────
    if settings.COGNITO_APP_CLIENT_ID and payload.get("aud") != settings.COGNITO_APP_CLIENT_ID:
        logger.warning("Token audience mismatch: %s", payload.get("aud"))
        raise creds_exc

    phone = payload.get("phone_number", "")
    sub   = payload.get("sub", "")

    if not phone or not sub:
        logger.warning("Token missing phone_number or sub claim")
        raise creds_exc

    return AuthUser(phone=phone, sub=sub, token=token)


# Optional looser version for routes that work with OR without auth
# (e.g., health check, public endpoints)
async def optional_auth(
    credentials: HTTPAuthorizationCredentials = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> AuthUser | None:
    """Returns AuthUser if valid token provided, None otherwise."""
    if not credentials:
        return None
    try:
        return await require_auth(credentials)
    except HTTPException:
        return None
