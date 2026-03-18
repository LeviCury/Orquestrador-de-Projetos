from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Collaborator, TimeEntry
from ..schemas import CollaboratorCreate, CollaboratorRead, CollaboratorUpdate

router = APIRouter()


@router.get("/", response_model=list[CollaboratorRead])
def list_collaborators(active_only: bool = False, analysts_only: bool = False, db: Session = Depends(get_db)):
    q = db.query(Collaborator)
    if active_only:
        q = q.filter(Collaborator.active == True)
    if analysts_only:
        q = q.filter(Collaborator.system_role == "analyst")
    return q.order_by(Collaborator.name).all()


@router.post("/", response_model=CollaboratorRead, status_code=201)
def create_collaborator(data: CollaboratorCreate, db: Session = Depends(get_db)):
    existing = db.query(Collaborator).filter(Collaborator.email == data.email).first()
    if existing:
        raise HTTPException(400, "E-mail já cadastrado.")
    collab = Collaborator(**data.model_dump())
    db.add(collab)
    db.commit()
    db.refresh(collab)
    return collab


@router.get("/{collaborator_id}", response_model=CollaboratorRead)
def get_collaborator(collaborator_id: int, db: Session = Depends(get_db)):
    collab = db.query(Collaborator).filter(Collaborator.id == collaborator_id).first()
    if not collab:
        raise HTTPException(404, "Colaborador não encontrado.")
    return collab


@router.put("/{collaborator_id}", response_model=CollaboratorRead)
def update_collaborator(collaborator_id: int, data: CollaboratorUpdate, db: Session = Depends(get_db)):
    collab = db.query(Collaborator).filter(Collaborator.id == collaborator_id).first()
    if not collab:
        raise HTTPException(404, "Colaborador não encontrado.")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(collab, key, val)
    db.commit()
    db.refresh(collab)
    return collab


@router.delete("/{collaborator_id}", status_code=204)
def delete_collaborator(collaborator_id: int, db: Session = Depends(get_db)):
    collab = db.query(Collaborator).filter(Collaborator.id == collaborator_id).first()
    if not collab:
        raise HTTPException(404, "Colaborador não encontrado.")
    db.delete(collab)
    db.commit()


@router.get("/{collaborator_id}/hours")
def get_collaborator_hours(collaborator_id: int, db: Session = Depends(get_db)):
    collab = db.query(Collaborator).filter(Collaborator.id == collaborator_id).first()
    if not collab:
        raise HTTPException(404, "Colaborador não encontrado.")
    total = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.collaborator_id == collaborator_id
    ).scalar()
    return {"collaborator_id": collaborator_id, "total_hours": float(total)}


@router.get("/{collaborator_id}/detail")
def get_collaborator_detail(collaborator_id: int, db: Session = Depends(get_db)):
    from ..models import Project, Stage, Task, project_collaborators, task_collaborators
    collab = db.query(Collaborator).filter(Collaborator.id == collaborator_id).first()
    if not collab:
        raise HTTPException(404, "Colaborador não encontrado.")

    total_hours = float(db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.collaborator_id == collaborator_id
    ).scalar())

    projects = db.query(Project).join(project_collaborators).filter(
        project_collaborators.c.id_collaborator == collaborator_id
    ).all()

    tasks = db.query(Task).join(task_collaborators).filter(
        task_collaborators.c.id_collaborator == collaborator_id,
        Task.status.notin_(["completed", "cancelled"]),
    ).all()

    hours_by_project = db.query(
        TimeEntry.project_id,
        func.sum(TimeEntry.hours_worked),
    ).filter(TimeEntry.collaborator_id == collaborator_id).group_by(TimeEntry.project_id).all()
    hours_map = {pid: float(h) for pid, h in hours_by_project}

    project_list = []
    for p in projects:
        est = float(p.estimated_hours or 0)
        n_collabs = len(p.collaborators) or 1
        capacity = est / n_collabs
        actual = hours_map.get(p.id, 0)
        project_list.append({
            "id": p.id, "name": p.name, "status": p.status,
            "estimated_hours": est, "actual_hours": actual,
            "capacity_share": round(capacity, 1),
        })

    task_list = []
    for t in tasks:
        task_list.append({
            "id": t.id, "name": t.name, "status": t.status,
            "priority": t.priority, "planned_end": t.planned_end,
            "stage_name": t.stage.name if t.stage else "",
            "project_name": t.stage.project.name if t.stage and t.stage.project else "",
            "project_id": t.stage.project_id if t.stage else None,
        })

    return {
        "id": collab.id, "name": collab.name, "email": collab.email,
        "role": collab.role, "active": collab.active,
        "avatar_url": collab.avatar_url or "",
        "bio": collab.bio or "",
        "personal_phone": collab.personal_phone or "",
        "personal_link": collab.personal_link or "",
        "total_hours": total_hours,
        "project_count": len(projects),
        "active_task_count": len(tasks),
        "projects": project_list,
        "tasks": task_list,
        "username": collab.username or "",
        "first_name": collab.first_name or "",
        "last_name": collab.last_name or "",
        "full_name": collab.full_name or "",
        "user_principal_name": collab.user_principal_name or "",
        "job_title": collab.job_title or "",
        "department": collab.department or "",
        "company": collab.company or "",
        "manager": collab.manager or "",
        "description": collab.description or "",
        "office": collab.office or "",
        "telephone": collab.telephone or "",
        "web_page": collab.web_page or "",
        "street": collab.street or "",
        "postal_code": collab.postal_code or "",
        "city": collab.city or "",
        "state": collab.state or "",
        "country": collab.country or "",
    }
