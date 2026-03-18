"""
GLPI REST API client.

Manages session lifecycle and ticket lookups against the Minerva GLPI instance.
"""

import os
import httpx
from functools import lru_cache
from typing import Optional
import time

GLPI_BASE = os.getenv("GLPI_BASE_URL", "https://central.minervafoods.com/apirest.php")
APP_TOKEN = os.getenv("GLPI_APP_TOKEN", "")
AUTH_BASIC = os.getenv("GLPI_AUTH_BASIC", "")

_session_cache: dict = {"token": None, "expires": 0}


async def _get_session_token() -> str:
    now = time.time()
    if _session_cache["token"] and now < _session_cache["expires"]:
        return _session_cache["token"]

    async with httpx.AsyncClient(verify=True, timeout=15) as client:
        r = await client.get(
            f"{GLPI_BASE}/initSession/",
            headers={
                "Authorization": AUTH_BASIC,
                "App-Token": APP_TOKEN,
            },
        )
        r.raise_for_status()
        token = r.json().get("session_token")
        if not token:
            raise RuntimeError("GLPI initSession did not return a session_token")
        _session_cache["token"] = token
        _session_cache["expires"] = now + 1800  # 30 min
        return token


def _invalidate_session():
    _session_cache["token"] = None
    _session_cache["expires"] = 0


async def _glpi_get(path: str) -> dict | list:
    """GET request against GLPI API with auto session retry."""
    token = await _get_session_token()
    headers = {
        "Session-Token": token,
        "App-Token": APP_TOKEN,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(verify=True, timeout=15) as client:
        r = await client.get(f"{GLPI_BASE}{path}", headers=headers)
        if r.status_code == 401:
            _invalidate_session()
            token = await _get_session_token()
            headers["Session-Token"] = token
            r = await client.get(f"{GLPI_BASE}{path}", headers=headers)
        r.raise_for_status()
        return r.json()


async def _get_user_name(user_id: int) -> str:
    """Resolve a GLPI user ID to a display name."""
    try:
        data = await _glpi_get(f"/User/{user_id}")
        firstname = data.get("firstname", "")
        realname = data.get("realname", "")
        full = f"{firstname} {realname}".strip()
        return full or data.get("name", "")
    except Exception:
        return ""


async def get_ticket(ticket_id: str) -> Optional[dict]:
    """Fetch a ticket by ID and return a clean summary."""
    try:
        data = await _glpi_get(f"/Ticket/{ticket_id}")
    except httpx.HTTPStatusError:
        return None

    status_map = {
        1: "Novo", 2: "Em atendimento (atribuído)",
        3: "Em atendimento (planejado)", 4: "Pendente",
        5: "Solucionado", 6: "Fechado",
    }

    urgency_map = {1: "Muito baixa", 2: "Baixa", 3: "Média", 4: "Alta", 5: "Muito alta"}
    priority_map = urgency_map.copy()

    assigned_name = ""
    requester_name = ""
    try:
        users = await _glpi_get(f"/Ticket/{ticket_id}/Ticket_User")
        if isinstance(users, list):
            for u in users:
                uid = u.get("users_id")
                utype = u.get("type")  # 1=requester, 2=assigned
                if uid and utype == 2 and not assigned_name:
                    assigned_name = await _get_user_name(uid)
                elif uid and utype == 1 and not requester_name:
                    requester_name = await _get_user_name(uid)
    except Exception:
        pass

    return {
        "id": data.get("id"),
        "title": data.get("name", ""),
        "status": status_map.get(data.get("status"), str(data.get("status", ""))),
        "status_id": data.get("status"),
        "type": "Requisição" if data.get("type") == 1 else "Incidente",
        "urgency": urgency_map.get(data.get("urgency"), ""),
        "priority": priority_map.get(data.get("priority"), ""),
        "category_id": data.get("itilcategories_id"),
        "open_date": data.get("date"),
        "due_date": data.get("time_to_resolve"),
        "solve_date": data.get("solvedate"),
        "close_date": data.get("closedate"),
        "description": (data.get("content") or "")[:500],
        "requester_id": data.get("users_id_recipient"),
        "assigned_to": assigned_name,
        "requester": requester_name,
    }


async def get_ticket_tasks(ticket_id: str) -> list[dict]:
    """Fetch tasks (follow-ups / tarefas) for a ticket."""
    try:
        data = await _glpi_get(f"/Ticket/{ticket_id}/TicketTask")
    except httpx.HTTPStatusError:
        return []

    if isinstance(data, dict):
        return []

    return [
        {
            "id": t.get("id"),
            "content": (t.get("content") or "")[:300],
            "date": t.get("date"),
            "duration": t.get("actiontime", 0),
            "user_id": t.get("users_id_tech") or t.get("users_id"),
            "state": t.get("state"),
        }
        for t in data
    ]
