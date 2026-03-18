"""JWT utilities and auth dependency for FastAPI."""
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS
from .database import get_db
from .models import Collaborator


def create_token(collaborator: Collaborator) -> str:
    payload = {
        "sub": str(collaborator.id),
        "email": collaborator.email,
        "name": collaborator.name,
        "is_admin": collaborator.is_admin,
        "system_role": collaborator.system_role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalido")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Collaborator:
    auth_header = request.headers.get("Authorization", "")
    cookie_token = request.cookies.get("access_token", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif cookie_token:
        token = cookie_token

    if not token:
        raise HTTPException(401, "Token nao fornecido")
    payload = decode_token(token)
    user = db.query(Collaborator).filter(Collaborator.id == int(payload["sub"])).first()
    if not user or not user.active or not user.approved:
        raise HTTPException(401, "Usuario nao encontrado, inativo ou nao aprovado")
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[Collaborator]:
    """Returns user if authenticated, None otherwise. For gradual auth adoption."""
    auth_header = request.headers.get("Authorization", "")
    cookie_token = request.cookies.get("access_token", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif cookie_token:
        token = cookie_token

    if not token:
        return None
    try:
        payload = decode_token(token)
        return db.query(Collaborator).filter(Collaborator.id == int(payload["sub"])).first()
    except Exception:
        return None


def require_admin(user: Collaborator = Depends(get_current_user)) -> Collaborator:
    if not user.is_admin:
        raise HTTPException(403, "Acesso restrito a administradores")
    return user


def deny_viewer(request: Request, db: Session = Depends(get_db)) -> None:
    """Block write operations for viewers. Apply as a dependency on POST/PUT/DELETE endpoints."""
    auth_header = request.headers.get("Authorization", "")
    cookie_token = request.cookies.get("access_token", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif cookie_token:
        token = cookie_token

    if not token:
        return
    try:
        payload = decode_token(token)
        user = db.query(Collaborator).filter(Collaborator.id == int(payload["sub"])).first()
        if user and user.system_role == "viewer":
            raise HTTPException(
                403,
                "Visualizadores não têm permissão para realizar esta ação. Contate um administrador.",
            )
    except HTTPException:
        raise
    except Exception:
        pass
