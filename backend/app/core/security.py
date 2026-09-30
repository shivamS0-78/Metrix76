import base64
import json
import os
from typing import Any

try:
    import jwt
except ImportError:  # pragma: no cover - optional dependency for local JWT verification
    jwt = None

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False)


def _verify_supabase_claims(token: str) -> dict[str, Any]:
    secret = os.getenv('SUPABASE_JWT_SECRET')
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: SUPABASE_JWT_SECRET is not configured for signature verification.",
        )

    if jwt is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: PyJWT is not installed for signature verification.",
        )

    expected_aud = os.getenv('SUPABASE_JWT_AUD', 'authenticated')
    options = {
        'verify_signature': True,
        'require': ['exp'],
        'verify_exp': True,
        'verify_aud': bool(expected_aud),
    }

    try:
        decode_kwargs: dict[str, Any] = {
            'jwt': token,
            'key': secret,
            'algorithms': ['HS256'],
            'options': options,
        }
        if expected_aud:
            decode_kwargs['audience'] = expected_aud

        payload = jwt.decode(**decode_kwargs)
        if not payload:
            raise ValueError('JWT verification did not return claims.')
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f'Invalid or expired token: {str(exc)}',
            headers={'WWW-Authenticate': 'Bearer'},
        ) from exc


def _extract_roles_from_claims(claims: dict[str, Any]) -> list[str]:
    """
    Extracts all roles across standard and Supabase JWT structures.
    CRITICAL SECURITY NOTICE:
    Only server-controlled claims ('role', 'roles', 'user_role', 'app_metadata.roles', 'app_metadata.role')
    are trusted. User-writable claims ('user_metadata') are deliberately EXCLUDED to prevent
    privilege escalation attacks where users modify their own metadata.
    """
    raw_roles: list[Any] = []

    candidates = [
        claims.get("role"),
        claims.get("roles"),
        claims.get("user_role"),
        claims.get("userRole"),
        claims.get("app_metadata", {}).get("role") if isinstance(claims.get("app_metadata"), dict) else None,
        claims.get("app_metadata", {}).get("roles") if isinstance(claims.get("app_metadata"), dict) else None,
    ]


    for candidate in candidates:
        if candidate is None:
            continue
        if isinstance(candidate, list):
            raw_roles.extend(candidate)
        elif isinstance(candidate, (str, bytes)):
            raw_roles.append(candidate.decode("utf-8") if isinstance(candidate, bytes) else candidate)

    normalized: list[str] = []
    for r in raw_roles:
        if isinstance(r, str):
            clean = r.strip().upper()
            if clean and clean not in normalized:
                normalized.append(clean)
    return normalized


def _normalize_primary_role(roles: list[str]) -> str | None:
    """
    Normalizes a list of roles into a single primary role based on system hierarchy.
    Hierarchy: ADMIN > APPROVER > TECHNICIAN > first available role.
    """
    if not roles:
        return None
    for priority in ("ADMIN", "APPROVER", "TECHNICIAN"):
        if priority in roles:
            return priority
    return roles[0]


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Missing bearer token.',
            headers={'WWW-Authenticate': 'Bearer'},
        )

    token = credentials.credentials
    claims = _verify_supabase_claims(token)

    user_id = claims.get('sub') or claims.get('user_id')

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Token is missing a user identifier.',
            headers={'WWW-Authenticate': 'Bearer'},
        )

    roles = _extract_roles_from_claims(claims)
    primary_role = _normalize_primary_role(roles)

    return {
        'user_id': user_id,
        'role': primary_role,
        'roles': roles,
        'claims': claims,
    }


def require_roles(*allowed_roles: str):
    def dependency(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        allowed = {value.upper() for value in allowed_roles}
        user_roles = {r.upper() for r in current_user.get('roles', [])}
        if current_user.get('role'):
            user_roles.add(current_user['role'].upper())

        if not allowed_roles or (user_roles & allowed):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f'Role required: {", ".join(allowed_roles)}',
        )

    return dependency

