"""
Routes: Auth — Phone + Password via Amazon Cognito

POST /api/auth/register   → create account (phone + password)
POST /api/auth/login      → authenticate, returns Cognito tokens
POST /api/auth/refresh    → silently refreshes expired id_token
GET  /api/auth/me         → returns current farmer profile (requires auth)
"""

from __future__ import annotations
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.services.cognito import register, login, refresh_tokens, get_user_profile, update_user_profile
from app.middleware.auth import AuthUser, require_auth
from app.utils.dynamo import log_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _clean_phone(phone: str) -> str:
    p = phone.strip().replace(" ", "").replace("-", "")
    if not p.startswith("+"):
        p = p.lstrip("0")
        p = f"+91{p}"
    return p


class RegisterRequest(BaseModel):
    phone:       str
    password:    str
    given_name:  str = ""
    family_name: str = ""
    birthdate:   str = ""   # YYYY-MM-DD
    address:     str = ""

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = _clean_phone(v)
        if not re.match(r"^\+[1-9]\d{7,14}$", cleaned):
            raise ValueError("Enter a valid Indian mobile number (10 digits)")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UpdateProfileRequest(BaseModel):
    given_name:  str = ""
    family_name: str = ""
    birthdate:   str = ""
    address:     str = ""


class LoginRequest(BaseModel):
    phone:    str
    password: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _clean_phone(v)


class RefreshRequest(BaseModel):
    phone:         str
    refresh_token: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _clean_phone(v)


@router.post("/register", status_code=201)
async def register_route(req: RegisterRequest):
    """Sign up — create a new farmer account with phone + password + profile details."""
    try:
        result = register(
            req.phone,
            req.password,
            given_name=req.given_name,
            family_name=req.family_name,
            birthdate=req.birthdate,
            address=req.address,
        )
        log_event("auth_register", {"phone_prefix": req.phone[:6]})
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except RuntimeError as exc:
        logger.error("register error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not create account. Try again.")


@router.post("/login")
async def login_route(req: LoginRequest):
    """Log in with phone + password. Returns Cognito tokens on success."""
    try:
        tokens = login(req.phone, req.password)
        log_event("auth_login_success", {"phone_prefix": req.phone[:6]})
        return {
            "success":       True,
            "id_token":      tokens["id_token"],
            "access_token":  tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "expires_in":    tokens["expires_in"],
            "phone":         req.phone,
        }
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except RuntimeError as exc:
        logger.error("login error: %s", exc)
        raise HTTPException(status_code=502, detail="Login failed. Try again.")


@router.post("/refresh")
async def refresh_route(req: RefreshRequest):
    """Silent token refresh."""
    try:
        tokens = refresh_tokens(req.refresh_token, req.phone)
        return {
            "success":      True,
            "id_token":     tokens["id_token"],
            "access_token": tokens["access_token"],
            "expires_in":   tokens["expires_in"],
        }
    except RuntimeError as exc:
        logger.error("token refresh error: %s", exc)
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")


@router.get("/me")
async def get_me(user: AuthUser = Depends(require_auth)):
    """Returns the authenticated farmer's full profile from Cognito."""
    try:
        profile = get_user_profile(user.phone)
        return {"success": True, **profile}
    except RuntimeError as exc:
        logger.error("get_me error: %s", exc)
        # Fallback to token claims if Cognito admin call fails
        return {"success": True, "phone": user.phone, "sub": user.sub,
                "given_name": "", "family_name": "", "birthdate": "", "address": ""}


@router.put("/me")
async def update_me(req: UpdateProfileRequest, user: AuthUser = Depends(require_auth)):
    """Update the authenticated farmer's profile attributes in Cognito."""
    try:
        result = update_user_profile(
            user.phone,
            given_name=req.given_name,
            family_name=req.family_name,
            birthdate=req.birthdate,
            address=req.address,
        )
        log_event("profile_updated", {"phone_prefix": user.phone[:6]})
        return result
    except RuntimeError as exc:
        logger.error("update_me error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not update profile. Try again.")
