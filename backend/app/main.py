import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .database import engine, Base, SessionLocal
from .auth import decode_token
from .models import Collaborator

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
from .routers import (
    projects, stages, tasks, collaborators, time_entries,
    dashboard, search, activities, subtasks, templates,
    attachments, notifications, mywork, dependencies, tickets,
    auth, glpi,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Project Orchestrator", version="2.0.0")


PUBLIC_PATHS = {
    "/api/auth/login",
    "/api/auth/mode",
    "/api/health",
}

VIEWER_WHITELIST = {
    "/api/auth/login", "/api/auth/me", "/api/auth/mode",
    "/api/auth/me/avatar", "/api/auth/me/profile",
    "/api/health",
}


class AuthGuardMiddleware(BaseHTTPMiddleware):
    """Require valid JWT for all /api/* routes except public ones."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path.rstrip("/")

        if request.method == "OPTIONS":
            return await call_next(request)

        if not path.startswith("/api"):
            return await call_next(request)

        if path in PUBLIC_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        cookie_token = request.cookies.get("access_token", "")
        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
        elif cookie_token:
            token = cookie_token

        if not token:
            return JSONResponse(status_code=401, content={"detail": "Token não fornecido."})

        try:
            payload = decode_token(token)
            db = SessionLocal()
            try:
                user = db.query(Collaborator).filter(
                    Collaborator.id == int(payload["sub"])
                ).first()
                if not user or not user.active or not user.approved:
                    return JSONResponse(status_code=401, content={"detail": "Usuário inativo ou não aprovado."})

                if request.method not in ("GET", "HEAD"):
                    if path not in VIEWER_WHITELIST and not ("/notifications/" in path and "/read" in path):
                        if user.system_role == "viewer":
                            return JSONResponse(
                                status_code=403,
                                content={"detail": "Visualizadores não têm permissão para realizar esta ação."},
                            )
            finally:
                db.close()
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Token inválido ou expirado."})

        return await call_next(request)


app.add_middleware(AuthGuardMiddleware)

_cors_origins_env = os.getenv("CORS_ORIGINS", "")
_cors_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()] if _cors_origins_env else ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(stages.router, prefix="/api/stages", tags=["Stages"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(subtasks.router, prefix="/api/subtasks", tags=["Subtasks"])
app.include_router(collaborators.router, prefix="/api/collaborators", tags=["Collaborators"])
app.include_router(time_entries.router, prefix="/api/time-entries", tags=["Time Entries"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(activities.router, prefix="/api/activities", tags=["Activities"])
app.include_router(templates.router, prefix="/api/templates", tags=["Templates"])
app.include_router(attachments.router, prefix="/api/attachments", tags=["Attachments"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(mywork.router, prefix="/api/my-work", tags=["My Work"])
app.include_router(dependencies.router, prefix="/api/dependencies", tags=["Dependencies"])
app.include_router(tickets.router, prefix="/api/tickets", tags=["Tickets"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(glpi.router, prefix="/api/glpi", tags=["GLPI"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/uploads/{path:path}")
async def serve_upload(path: str, request: Request):
    """Serve uploaded files only to authenticated users."""
    auth_header = request.headers.get("Authorization", "")
    cookie_token = request.cookies.get("access_token", "")
    token_param = request.query_params.get("token", "")

    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif cookie_token:
        token = cookie_token
    elif token_param:
        token = token_param

    if not token:
        return JSONResponse(status_code=401, content={"detail": "Autenticação necessária."})

    try:
        payload = decode_token(token)
        db = SessionLocal()
        try:
            user = db.query(Collaborator).filter(Collaborator.id == int(payload["sub"])).first()
            if not user or not user.active or not user.approved:
                return JSONResponse(status_code=401, content={"detail": "Usuário inativo."})
        finally:
            db.close()
    except Exception:
        return JSONResponse(status_code=401, content={"detail": "Token inválido."})

    from fastapi.responses import FileResponse
    filepath = os.path.join(UPLOADS_DIR, path)
    safe_base = os.path.realpath(UPLOADS_DIR)
    safe_path = os.path.realpath(filepath)
    if not safe_path.startswith(safe_base):
        return JSONResponse(status_code=403, content={"detail": "Acesso negado."})

    if not os.path.isfile(safe_path):
        return JSONResponse(status_code=404, content={"detail": "Arquivo não encontrado."})

    return FileResponse(safe_path)
