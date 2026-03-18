"""Authentication via LDAP against Active Directory."""
import logging
import os
import re
import uuid
import time
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from ldap3 import Server, Connection, ALL, SUBTREE, ALL_ATTRIBUTES

from ..config import (
    LDAP_SERVER, LDAP_BASE_DN, LDAP_SVC_USER, LDAP_SVC_PASSWORD,
    ALLOWED_EMAIL_DOMAIN,
)
from ..database import get_db
from ..models import Collaborator
from ..auth import create_token, get_current_user
from ..schemas import CollaboratorRead, ProfileUpdate

LOGIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 12 * 60 * 60


def _set_token_cookie(response: JSONResponse, token: str) -> JSONResponse:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
    return response

AVATAR_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_AVATAR_SIZE = 2 * 1024 * 1024

router = APIRouter()
logger = logging.getLogger("auth")

LDAP_USER_ATTRS = [
    "sAMAccountName", "userPrincipalName", "mail",
    "displayName", "givenName", "sn",
    "title", "department", "company", "manager", "description",
    "physicalDeliveryOfficeName", "telephoneNumber", "wWWHomePage",
    "streetAddress", "postalCode", "l", "st", "co",
    "distinguishedName", "accountExpires", "memberOf",
    "userAccountControl",
]


def _ldap_svc_bind() -> Connection:
    """Bind to LDAP with the service account. Raises on failure."""
    server = Server(LDAP_SERVER, get_info=ALL, connect_timeout=10)
    svc_dn = f"{LDAP_SVC_USER}@minerva.local"
    conn = Connection(server, user=svc_dn, password=LDAP_SVC_PASSWORD, auto_bind=True)
    return conn


def _find_user_dn(conn: Connection, login_value: str) -> tuple[str | None, dict]:
    """Search for user by sAMAccountName or mail. Returns (dn, attributes)."""
    login_value = login_value.strip()
    username = login_value.split("@")[0] if "@" in login_value else login_value

    search_filter = (
        f"(&(objectClass=user)(objectCategory=person)"
        f"(|(sAMAccountName={username})(mail={login_value})(userPrincipalName={login_value})))"
    )

    conn.search(
        search_base=LDAP_BASE_DN,
        search_filter=search_filter,
        search_scope=SUBTREE,
        attributes=LDAP_USER_ATTRS,
    )

    if not conn.entries:
        return None, {}

    entry = conn.entries[0]
    return str(entry.entry_dn), dict(entry.entry_attributes_as_dict)


def _authenticate_user(user_dn: str, password: str) -> bool:
    """Try to bind as the user with their password. Returns True if valid."""
    try:
        server = Server(LDAP_SERVER, get_info=None, connect_timeout=10)
        user_conn = Connection(server, user=user_dn, password=password)
        result = user_conn.bind()
        user_conn.unbind()
        return result
    except Exception:
        return False


def _first_val(attrs: dict, key: str) -> str:
    """Get first value from an LDAP attribute list, or empty string."""
    val = attrs.get(key, [])
    if isinstance(val, list):
        return str(val[0]) if val else ""
    return str(val) if val else ""


def _sync_from_ldap(user: Collaborator, attrs: dict):
    """Sync all AD attributes into the Collaborator model."""
    user.username = _first_val(attrs, "sAMAccountName") or user.username
    user.first_name = _first_val(attrs, "givenName")
    user.last_name = _first_val(attrs, "sn")
    user.full_name = _first_val(attrs, "displayName")
    user.user_principal_name = _first_val(attrs, "userPrincipalName")

    if user.full_name and user.full_name != user.name:
        user.name = user.full_name

    mail = _first_val(attrs, "mail").lower()
    if mail:
        user.email = mail

    user.job_title = _first_val(attrs, "title")
    user.department = _first_val(attrs, "department")
    user.company = _first_val(attrs, "company")
    user.manager = _first_val(attrs, "manager")

    if user.job_title and not user.role:
        user.role = user.job_title

    desc = attrs.get("description", [])
    user.description = str(desc[0]) if isinstance(desc, list) and desc else str(desc) if desc else ""
    user.office = _first_val(attrs, "physicalDeliveryOfficeName")
    user.telephone = _first_val(attrs, "telephoneNumber")

    user.street = _first_val(attrs, "streetAddress")
    user.postal_code = _first_val(attrs, "postalCode")
    user.city = _first_val(attrs, "l")
    user.state = _first_val(attrs, "st")
    user.country = _first_val(attrs, "co")

    member_of = attrs.get("memberOf", [])
    if isinstance(member_of, list):
        user.ad_groups = member_of
    else:
        user.ad_groups = [str(member_of)] if member_of else []

    user.distinguished_name = _first_val(attrs, "distinguishedName")

    expires_raw = _first_val(attrs, "accountExpires")
    if expires_raw and expires_raw not in ("0", "9223372036854775807"):
        try:
            ticks = int(expires_raw)
            epoch = (ticks - 116444736000000000) / 10000000
            user.account_expires = datetime.fromtimestamp(epoch, tz=timezone.utc)
        except (ValueError, OSError):
            pass


def _is_account_disabled(attrs: dict) -> bool:
    uac = _first_val(attrs, "userAccountControl")
    if not uac:
        return False
    try:
        return bool(int(uac) & 0x2)
    except ValueError:
        return False


# ── Auth mode ──

@router.get("/mode")
def auth_mode():
    return {"ad_available": True, "allowed_domain": ALLOWED_EMAIL_DOMAIN}


# ── Login via LDAP ──

class LoginRequest(BaseModel):
    login: str
    password: str


def _check_rate_limit(client_ip: str):
    now = time.time()
    attempts = LOGIN_ATTEMPTS[client_ip]
    LOGIN_ATTEMPTS[client_ip] = [t for t in attempts if now - t < LOGIN_WINDOW_SECONDS]
    if len(LOGIN_ATTEMPTS[client_ip]) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(429, "Muitas tentativas de login. Aguarde 5 minutos.")
    LOGIN_ATTEMPTS[client_ip].append(now)


@router.post("/login")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    login_value = req.login.strip()
    if not login_value or not req.password:
        raise HTTPException(400, "Usuário e senha são obrigatórios.")

    if "@" in login_value:
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', login_value):
            raise HTTPException(400, "Formato de email inválido.")
    else:
        if not re.match(r'^[a-zA-Z0-9._-]+$', login_value):
            raise HTTPException(400, "Formato de usuário inválido.")

    try:
        svc_conn = _ldap_svc_bind()
    except Exception as exc:
        logger.error("LDAP service bind failed: %s", exc)
        raise HTTPException(502, "Erro de conexão com o servidor de autenticação.")

    try:
        user_dn, attrs = _find_user_dn(svc_conn, login_value)
    finally:
        svc_conn.unbind()

    if not user_dn:
        raise HTTPException(401, "Usuário ou senha incorretos.")

    if _is_account_disabled(attrs):
        raise HTTPException(403, "Conta desabilitada no Active Directory.")

    if not _authenticate_user(user_dn, req.password):
        raise HTTPException(401, "Usuário ou senha incorretos.")

    username = _first_val(attrs, "sAMAccountName")
    ad_email = _first_val(attrs, "mail").lower()
    ad_full_name = _first_val(attrs, "displayName") or username

    user = db.query(Collaborator).filter(
        (Collaborator.username == username)
        | (func.lower(Collaborator.email) == ad_email)
    ).first() if ad_email else db.query(Collaborator).filter(
        Collaborator.username == username
    ).first()

    if user:
        _sync_from_ldap(user, attrs)
        db.commit()
        db.refresh(user)

        if not user.active:
            raise HTTPException(403, "Conta desativada. Contate um administrador.")
        if not user.approved:
            return {"status": "pending_approval"}

        token = create_token(user)
        resp = _set_token_cookie(JSONResponse(content=jsonable_encoder({
            "status": "approved",
            "token": token,
            "user": CollaboratorRead.model_validate(user).model_dump(),
        })), token)
        return resp

    is_first = db.query(Collaborator).count() == 0

    email = ad_email or f"{username}@{ALLOWED_EMAIL_DOMAIN}"
    user = Collaborator(
        name=ad_full_name,
        email=email,
        username=username,
        role="",
        approved=is_first,
        system_role="admin" if is_first else "analyst",
        is_admin=is_first,
        is_owner=is_first,
    )
    _sync_from_ldap(user, attrs)
    db.add(user)
    db.commit()
    db.refresh(user)

    if is_first:
        token = create_token(user)
        resp = _set_token_cookie(JSONResponse(content=jsonable_encoder({
            "status": "approved",
            "token": token,
            "user": CollaboratorRead.model_validate(user).model_dump(),
        })), token)
        return resp

    return {"status": "pending_approval"}


# ── Authenticated endpoints ──

@router.get("/me", response_model=CollaboratorRead)
def get_me(user: Collaborator = Depends(get_current_user)):
    return user


@router.put("/me/avatar", response_model=CollaboratorRead)
async def update_avatar(
    file: UploadFile = File(...),
    user: Collaborator = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.")

    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(400, "Arquivo muito grande. Máximo 2 MB.")

    if user.avatar_url:
        old_path = os.path.join(AVATAR_DIR, os.path.basename(user.avatar_url))
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = os.path.splitext(file.filename or "avatar")[1] or ".jpg"
    unique_name = f"{user.id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(AVATAR_DIR, unique_name)

    with open(filepath, "wb") as f:
        f.write(contents)

    user.avatar_url = f"/uploads/avatars/{unique_name}"
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/profile", response_model=CollaboratorRead)
def update_profile(
    data: ProfileUpdate,
    user: Collaborator = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.bio is not None:
        user.bio = data.bio
    if data.personal_phone is not None:
        user.personal_phone = data.personal_phone
    if data.personal_link is not None:
        user.personal_link = data.personal_link
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    system_role: str = Query(...),
    is_admin: bool = Query(False),
    admin: Collaborator = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not admin.is_admin:
        raise HTTPException(403, "Acesso restrito a administradores.")

    target = db.query(Collaborator).filter(Collaborator.id == user_id).first()
    if not target:
        raise HTTPException(404, "Usuário não encontrado.")

    valid_roles = ["viewer", "analyst", "manager", "admin"]
    if system_role not in valid_roles:
        raise HTTPException(400, f"Permissão inválida. Use: {', '.join(valid_roles)}")

    if target.is_owner:
        raise HTTPException(403, "O proprietário do sistema não pode ter sua permissão alterada.")

    if admin.id == user_id:
        raise HTTPException(403, "Você não pode alterar sua própria permissão.")

    if target.is_admin and not admin.is_owner:
        raise HTTPException(403, "Somente o proprietário pode alterar permissões de administradores.")

    if system_role == "admin" and not admin.is_owner:
        raise HTTPException(403, "Somente o proprietário pode promover a administrador.")

    if target.is_admin and system_role != "admin":
        admin_count = db.query(Collaborator).filter(Collaborator.is_admin == True).count()
        if admin_count <= 1:
            raise HTTPException(400, "O sistema precisa ter pelo menos um administrador.")

    target.system_role = system_role
    target.is_admin = is_admin
    db.commit()
    db.refresh(target)
    return CollaboratorRead.model_validate(target).model_dump()


@router.put("/users/{user_id}/approve")
def approve_user(user_id: int, admin: Collaborator = Depends(get_current_user), db: Session = Depends(get_db)):
    if not admin.is_admin:
        raise HTTPException(403, "Acesso restrito a administradores.")
    target = db.query(Collaborator).filter(Collaborator.id == user_id).first()
    if not target:
        raise HTTPException(404, "Usuário não encontrado.")
    target.approved = True
    db.commit()
    db.refresh(target)
    return CollaboratorRead.model_validate(target).model_dump()


@router.put("/users/{user_id}/reject")
def reject_user(user_id: int, admin: Collaborator = Depends(get_current_user), db: Session = Depends(get_db)):
    if not admin.is_admin:
        raise HTTPException(403, "Acesso restrito a administradores.")
    target = db.query(Collaborator).filter(Collaborator.id == user_id).first()
    if not target:
        raise HTTPException(404, "Usuário não encontrado.")
    if target.is_owner:
        raise HTTPException(403, "O proprietário do sistema não pode ser rejeitado.")
    target.active = False
    target.approved = False
    db.commit()
    db.refresh(target)
    return CollaboratorRead.model_validate(target).model_dump()


@router.get("/users")
def list_users(admin: Collaborator = Depends(get_current_user), db: Session = Depends(get_db)):
    if not admin.is_admin:
        raise HTTPException(403, "Acesso restrito a administradores.")
    users = db.query(Collaborator).order_by(Collaborator.name).all()
    return [CollaboratorRead.model_validate(u).model_dump() for u in users]


@router.get("/pending")
def list_pending(admin: Collaborator = Depends(get_current_user), db: Session = Depends(get_db)):
    if not admin.is_admin:
        raise HTTPException(403, "Acesso restrito a administradores.")
    pending = db.query(Collaborator).filter(
        Collaborator.approved == False, Collaborator.active == True,
    ).order_by(Collaborator.created_at).all()
    return [CollaboratorRead.model_validate(u).model_dump() for u in pending]
