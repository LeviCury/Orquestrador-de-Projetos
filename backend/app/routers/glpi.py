from fastapi import APIRouter, HTTPException

from ..glpi import get_ticket, get_ticket_tasks

router = APIRouter()


@router.get("/ticket/{ticket_id}")
async def fetch_ticket(ticket_id: str):
    data = await get_ticket(ticket_id)
    if not data:
        raise HTTPException(404, f"Chamado {ticket_id} não encontrado no GLPI")
    return data


@router.get("/ticket/{ticket_id}/tasks")
async def fetch_ticket_tasks(ticket_id: str):
    return await get_ticket_tasks(ticket_id)
