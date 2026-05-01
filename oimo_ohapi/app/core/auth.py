"""Bearer-token auth bridged to Odoo verification levels.

Level 2+ (selfie verified) → create characters
Level 5+ (full KYC)        → higher rate limits & priority queue
"""
from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings


class Principal(BaseModel):
    user_id: str
    verification_level: int = 0
    scopes: list[str] = []


def require_user(authorization: str | None = Header(None)) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.oimo_jwt_secret, algorithms=["HS256"])
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")
    return Principal(**payload)


def require_level(min_level: int):
    def _dep(p: Principal = Depends(require_user)) -> Principal:
        if p.verification_level < min_level:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Verification level {min_level}+ required (have {p.verification_level})",
            )
        return p
    return _dep
