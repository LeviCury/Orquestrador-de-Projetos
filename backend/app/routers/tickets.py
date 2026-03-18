from datetime import date
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import TicketHourEntry, TimeEntry, Collaborator
from ..schemas import TicketHourCreate, TicketHourRead, CollaboratorSummary, DailyHoursSummary
from ..glpi import get_ticket

router = APIRouter()


@router.get("/hours", response_model=list[TicketHourRead])
def list_ticket_hours(
    collaborator_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(TicketHourEntry)
    if collaborator_id:
        q = q.filter(TicketHourEntry.collaborator_id == collaborator_id)
    if date_from:
        q = q.filter(TicketHourEntry.entry_date >= date_from)
    if date_to:
        q = q.filter(TicketHourEntry.entry_date <= date_to)

    entries = q.order_by(TicketHourEntry.entry_date.desc(), TicketHourEntry.created_at.desc()).all()
    result = []
    for e in entries:
        r = TicketHourRead.model_validate(e)
        r.collaborator = CollaboratorSummary.model_validate(e.collaborator) if e.collaborator else None
        result.append(r)
    return result


@router.get("/hours/check-duplicate")
def check_duplicate(
    glpi_ticket_id: str = "",
    collaborator_id: int = 0,
    entry_date: date | None = None,
    db: Session = Depends(get_db),
):
    """Check if an entry already exists for this ticket + collaborator + date."""
    if not glpi_ticket_id:
        return {"exists": False, "entries": []}

    q = db.query(TicketHourEntry).filter(TicketHourEntry.glpi_ticket_id == glpi_ticket_id)
    if collaborator_id:
        q = q.filter(TicketHourEntry.collaborator_id == collaborator_id)
    if entry_date:
        q = q.filter(TicketHourEntry.entry_date == entry_date)

    existing = q.order_by(TicketHourEntry.entry_date.desc()).all()
    entries_data = []
    for e in existing:
        entries_data.append({
            "id": e.id,
            "entry_date": str(e.entry_date),
            "hours_worked": e.hours_worked,
            "collaborator_name": e.collaborator.name if e.collaborator else "",
        })

    return {"exists": len(existing) > 0, "count": len(existing), "entries": entries_data}


@router.post("/hours", response_model=TicketHourRead)
async def create_ticket_hour(data: TicketHourCreate, db: Session = Depends(get_db)):
    collab = db.query(Collaborator).filter(Collaborator.id == data.collaborator_id).first()
    if not collab:
        raise HTTPException(404, "Colaborador não encontrado")
    if collab.system_role != "analyst":
        raise HTTPException(403, "Apenas analistas podem registrar horas de chamados.")

    ticket_id = data.glpi_ticket_id
    if not ticket_id and data.glpi_link:
        m = re.search(r'[?&]id=(\d+)', data.glpi_link)
        if m:
            ticket_id = m.group(1)

    glpi_title = data.glpi_ticket_title
    glpi_status = data.glpi_status
    glpi_type = data.glpi_type
    glpi_priority = data.glpi_priority
    glpi_open_date = data.glpi_open_date
    glpi_assigned_to = data.glpi_assigned_to

    if ticket_id and not glpi_status:
        try:
            info = await get_ticket(ticket_id)
            if info:
                glpi_title = glpi_title or info.get("title", "")
                glpi_status = info.get("status", "")
                glpi_type = info.get("type", "")
                glpi_priority = info.get("priority", "")
                glpi_open_date = info.get("open_date", "") or ""
                glpi_assigned_to = info.get("assigned_to", "") or ""
        except Exception:
            pass

    entry = TicketHourEntry(
        collaborator_id=data.collaborator_id,
        entry_date=data.entry_date,
        hours_worked=data.hours_worked,
        glpi_ticket_id=ticket_id,
        glpi_ticket_title=glpi_title,
        glpi_link=data.glpi_link,
        glpi_status=glpi_status,
        glpi_type=glpi_type,
        glpi_priority=glpi_priority,
        glpi_open_date=glpi_open_date,
        glpi_assigned_to=glpi_assigned_to,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    r = TicketHourRead.model_validate(entry)
    r.collaborator = CollaboratorSummary.model_validate(entry.collaborator) if entry.collaborator else None
    return r


@router.delete("/hours/{entry_id}")
def delete_ticket_hour(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(TicketHourEntry).filter(TicketHourEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Lancamento nao encontrado")
    db.delete(entry)
    db.commit()
    return {"ok": True}


@router.get("/daily-hours/{collaborator_id}", response_model=DailyHoursSummary)
def daily_hours(collaborator_id: int, target_date: date | None = None, db: Session = Depends(get_db)):
    d = target_date or date.today()

    project_hours = float(
        db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0))
        .filter(TimeEntry.collaborator_id == collaborator_id, TimeEntry.entry_date == d)
        .scalar()
    )

    ticket_hours = float(
        db.query(func.coalesce(func.sum(TicketHourEntry.hours_worked), 0))
        .filter(TicketHourEntry.collaborator_id == collaborator_id, TicketHourEntry.entry_date == d)
        .scalar()
    )

    total = project_hours + ticket_hours
    target = 9.0
    remaining = max(0, target - total)
    pct = min(100, (total / target) * 100) if target > 0 else 0

    return DailyHoursSummary(
        date=d,
        target_hours=target,
        project_hours=round(project_hours, 1),
        ticket_hours=round(ticket_hours, 1),
        total_hours=round(total, 1),
        remaining=round(remaining, 1),
        pct=round(pct, 1),
    )
