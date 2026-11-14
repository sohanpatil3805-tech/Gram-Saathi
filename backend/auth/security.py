"""
Security, Role-Based Access Control (RBAC), and JWT Authentication for Gram Saathi.
Implements password hashing with PBKDF2-HMAC-SHA256, role hierarchy,
permission enforcement, and JWT token issuance/verification for citizens and officers.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Set, Dict, List, Optional, Union, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from backend.config import settings

# Standard Role Definitions
ROLE_CITIZEN = "citizen"
ROLE_PANCHAYAT_OFFICER = "panchayat_officer"
ROLE_TEHSIL_OFFICER = "tehsil_officer"
ROLE_STATE_ADMIN = "state_admin"

# Permission definitions
PERM_VIEW_OWN_APPLICATION = "application:view_own"
PERM_CREATE_DRAFT = "application:create_draft"
PERM_SUBMIT_APPLICATION = "application:submit"
PERM_VIEW_JURISDICTION_APPLICATIONS = "application:view_jurisdiction"
PERM_REVIEW_APPLICATION = "application:review"
PERM_APPROVE_APPLICATION = "application:approve"
PERM_REJECT_APPLICATION = "application:reject"
PERM_REQUEST_ACTION = "application:request_action"
PERM_VIEW_DOCUMENT = "document:view"
PERM_UPLOAD_DOCUMENT = "document:upload"
PERM_MANAGE_OFFICERS = "admin:manage_officers"
PERM_VIEW_AUDIT_LOGS = "admin:view_audit_logs"

ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    ROLE_CITIZEN: {
        PERM_VIEW_OWN_APPLICATION,
        PERM_CREATE_DRAFT,
        PERM_SUBMIT_APPLICATION,
        PERM_UPLOAD_DOCUMENT,
    },
    ROLE_PANCHAYAT_OFFICER: {
        PERM_VIEW_JURISDICTION_APPLICATIONS,
        PERM_REVIEW_APPLICATION,
        PERM_REQUEST_ACTION,
        PERM_VIEW_DOCUMENT,
    },
    ROLE_TEHSIL_OFFICER: {
        PERM_VIEW_JURISDICTION_APPLICATIONS,
        PERM_REVIEW_APPLICATION,
        PERM_APPROVE_APPLICATION,
        PERM_REJECT_APPLICATION,
        PERM_REQUEST_ACTION,
        PERM_VIEW_DOCUMENT,
    },
    ROLE_STATE_ADMIN: {
        PERM_VIEW_JURISDICTION_APPLICATIONS,
        PERM_REVIEW_APPLICATION,
        PERM_APPROVE_APPLICATION,
        PERM_REJECT_APPLICATION,
        PERM_REQUEST_ACTION,
        PERM_VIEW_DOCUMENT,
        PERM_MANAGE_OFFICERS,
        PERM_VIEW_AUDIT_LOGS,
    },
}


def hash_password(password: str, iterations: int = 100_000) -> str:
    """
    Hash password using PBKDF2 with SHA-256 and a random 16-byte salt.
    Format: pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
    """
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password against stored PBKDF2 hash.
    Constant-time comparison prevents timing attacks.
    """
    try:
        parts = hashed.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected_key = bytes.fromhex(parts[3])
        calculated_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(calculated_key, expected_key)
    except Exception:
        return False


def has_permission(role: str, permission: str) -> bool:
    """Check if a role has the specified permission."""
    perms = ROLE_PERMISSIONS.get(role, set())
    return permission in perms


# ─── JWT Token Management ───────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a generic JWT token with expiration."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_citizen_expire_minutes)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def create_citizen_token(
    citizen_id: Union[str, uuid.UUID],
    phone: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a citizen JWT with 30-day default expiry.
    Payload: { sub: citizen_id, phone: phone, type: 'citizen' }
    """
    if expires_delta is None:
        expires_delta = timedelta(days=30)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": str(citizen_id),
        "phone": phone,
        "type": "citizen",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def create_officer_token(
    officer_id: Union[str, uuid.UUID],
    role: str = "tehsil_officer",
    username: str = "officer",
    district: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create an officer JWT with default 8-hour expiry.
    Payload: { sub: officer_id, role: role, username: username, district: district, type: 'officer' }
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_officer_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": str(officer_id),
        "role": role,
        "username": username,
        "district": district,
        "type": "officer",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    return jwt.decode(
        token,
        settings.jwt_secret_key.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
    )


# ─── FastAPI Dependencies ───────────────────────────────────────────────────

security_bearer = HTTPBearer(auto_error=False)


def get_current_citizen(
    auth: Optional[Union[HTTPAuthorizationCredentials, str]] = Depends(security_bearer),
) -> uuid.UUID:
    """
    FastAPI dependency to extract and verify citizen JWT.
    Supports both HTTPAuthorizationCredentials (FastAPI dependency) and raw token str.
    Returns citizen_id as uuid.UUID.
    Raises HTTPException 401 if missing, invalid, expired, or not type 'citizen'.
    """
    raw_token = auth.credentials if isinstance(auth, HTTPAuthorizationCredentials) else auth
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Citizen authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(raw_token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "citizen":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not a valid citizen token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing citizen subject.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return uuid.UUID(str(sub))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid citizen ID format in token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_citizen_or_none(
    auth: Optional[Union[HTTPAuthorizationCredentials, str]] = Depends(security_bearer),
) -> Optional[uuid.UUID]:
    """
    Optional citizen token dependency.
    Returns citizen_id if valid token provided; returns None otherwise without raising.
    """
    try:
        return get_current_citizen(auth)
    except HTTPException:
        return None


def get_current_officer(
    auth: Optional[Union[HTTPAuthorizationCredentials, str]] = Depends(security_bearer),
) -> dict:
    """
    FastAPI dependency to extract and verify officer JWT.
    Supports both HTTPAuthorizationCredentials and raw token str.
    Returns decoded token dictionary { sub, role, username, district, type }.
    Raises HTTPException 401 if missing, invalid or expired; 403 if not officer.
    """
    raw_token = auth.credentials if isinstance(auth, HTTPAuthorizationCredentials) else auth
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Officer authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(raw_token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired officer token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Officer authentication error: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "officer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: officer privileges required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def get_officer_or_none(
    auth: Optional[Union[HTTPAuthorizationCredentials, str]] = Depends(security_bearer),
) -> Optional[dict]:
    """Optional officer token dependency. Returns payload or None."""
    try:
        return get_current_officer(auth)
    except HTTPException:
        return None


def get_current_user_payload(
    auth: Optional[Union[HTTPAuthorizationCredentials, str]] = Depends(security_bearer),
) -> Optional[dict]:
    """
    Extracts and decodes JWT payload for either citizen or officer.
    Returns decoded dict or None if no valid token provided (non-raising).
    """
    raw_token = auth.credentials if isinstance(auth, HTTPAuthorizationCredentials) else auth
    if not raw_token:
        return None
    try:
        return decode_token(raw_token)
    except Exception:
        return None


# Aliases and universal token creator for compatibility
decode_access_token = decode_token


def create_access_token(
    payload_or_citizen_id: Union[dict, str, uuid.UUID],
    phone: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Flexible token creator that accepts either a dict payload or (citizen_id, phone).
    """
    if isinstance(payload_or_citizen_id, dict):
        payload = payload_or_citizen_id.copy()
        if "exp" not in payload:
            exp_delta = expires_delta or timedelta(days=getattr(settings, "citizen_jwt_expire_days", 30))
            payload["exp"] = datetime.now(timezone.utc) + exp_delta
        if "iat" not in payload:
            payload["iat"] = datetime.now(timezone.utc)
        return jwt.encode(
            payload,
            settings.jwt_secret_key.get_secret_value(),
            algorithm=settings.jwt_algorithm,
        )
    return create_citizen_token(payload_or_citizen_id, phone or "", expires_delta)


