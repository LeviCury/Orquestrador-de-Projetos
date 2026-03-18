from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Sprint, Task, Project
from ..schemas import SprintCreate, SprintUpdate, SprintRead

router = APIRouter()


def enrich_sprint(sprint: Sprint) -> dict:
    tasks = sprint.tasks if hasattr(sprint, 'tasks') else []
    return {
        **{c.key: getattr(sprint, c.key) for c in sprint.__table__.columns},
        "task_count": len(tasks),
        "completed_count": sum(1 for t in tasks if t.status == "completed"),
    }


@router.get("/project/{project_id}", response_model=list[SprintRead])
def get_sprints(project_id: int, db: Session = Depends(get_db)):
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).order_by(Sprint.order_index).all()
    return [enrich_sprint(s) for s in sprints]


@router.post("/project/{project_id}", response_model=SprintRead, status_code=201)
def create_sprint(project_id: int, data: SprintCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    sprint = Sprint(
        project_id=project_id,
        name=data.name,
        goal=data.goal,
        start_date=data.start_date,
        end_date=data.end_date,
        status=data.status,
        order_index=data.order_index,
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return enrich_sprint(sprint)


@router.put("/{sprint_id}", response_model=SprintRead)
def update_sprint(sprint_id: int, data: SprintUpdate, db: Session = Depends(get_db)):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(404, "Sprint not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(sprint, key, val)
    db.commit()
    db.refresh(sprint)
    return enrich_sprint(sprint)


@router.delete("/{sprint_id}", status_code=204)
def delete_sprint(sprint_id: int, db: Session = Depends(get_db)):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(404, "Sprint not found")
    db.query(Task).filter(Task.sprint_id == sprint_id).update({"sprint_id": None})
    db.delete(sprint)
    db.commit()


@router.put("/{sprint_id}/assign-task/{task_id}", response_model=SprintRead)
def assign_task_to_sprint(sprint_id: int, task_id: int, db: Session = Depends(get_db)):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(404, "Sprint not found")
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.sprint_id = sprint_id
    db.commit()
    db.refresh(sprint)
    return enrich_sprint(sprint)


@router.put("/{sprint_id}/unassign-task/{task_id}", response_model=SprintRead)
def unassign_task_from_sprint(sprint_id: int, task_id: int, db: Session = Depends(get_db)):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(404, "Sprint not found")
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.sprint_id = None
    db.commit()
    db.refresh(sprint)
    return enrich_sprint(sprint)


@router.get("/project/{project_id}/workload")
def get_project_workload(project_id: int, db: Session = Depends(get_db)):
    """Weekly workload per collaborator for a project."""
    from ..models import Stage, TimeEntry, Collaborator, project_collaborators, task_collaborators
    from sqlalchemy import func
    from datetime import date, timedelta

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    collab_ids = [c.id for c in project.collaborators]
    if not collab_ids:
        return []

    today = date.today()
    start_of_range = today - timedelta(weeks=4)
    end_of_range = today + timedelta(weeks=8)

    entries = db.query(
        TimeEntry.collaborator_id,
        TimeEntry.entry_date,
        func.sum(TimeEntry.hours_worked).label("total"),
    ).filter(
        TimeEntry.project_id == project_id,
        TimeEntry.collaborator_id.in_(collab_ids),
        TimeEntry.entry_date >= start_of_range,
        TimeEntry.entry_date <= end_of_range,
    ).group_by(TimeEntry.collaborator_id, TimeEntry.entry_date).all()

    collab_names = {c.id: c.name for c in db.query(Collaborator).filter(Collaborator.id.in_(collab_ids)).all()}

    all_tasks = []
    for s in db.query(Stage).filter(Stage.project_id == project_id).all():
        for t in s.tasks:
            all_tasks.append(t)

    task_allocations: dict[int, list] = {}
    for t in all_tasks:
        if t.planned_start and t.planned_end and t.estimated_hours > 0:
            days = max((t.planned_end - t.planned_start).days, 1)
            hours_per_day = t.estimated_hours / days
            for c in t.collaborators:
                task_allocations.setdefault(c.id, []).append({
                    "start": t.planned_start, "end": t.planned_end,
                    "hours_per_day": hours_per_day / max(len(t.collaborators), 1),
                })

    def get_monday(d):
        return d - timedelta(days=d.weekday())

    weeks_in_range = []
    current = get_monday(start_of_range)
    while current <= end_of_range:
        weeks_in_range.append(current)
        current += timedelta(weeks=1)

    logged_by_week: dict[tuple, float] = {}
    for e in entries:
        wk = get_monday(e.entry_date)
        key = (e.collaborator_id, str(wk))
        logged_by_week[key] = logged_by_week.get(key, 0) + float(e.total)

    result = []
    for cid in collab_ids:
        for wk in weeks_in_range:
            allocated = 0.0
            for alloc in task_allocations.get(cid, []):
                for d in range(7):
                    day = wk + timedelta(days=d)
                    if alloc["start"] <= day <= alloc["end"] and d < 5:
                        allocated += alloc["hours_per_day"]

            logged = logged_by_week.get((cid, str(wk)), 0)
            result.append({
                "collaborator_id": cid,
                "collaborator_name": collab_names.get(cid, ""),
                "week_start": str(wk),
                "allocated_hours": round(allocated, 1),
                "logged_hours": round(logged, 1),
                "capacity_hours": 40,
            })

    return result
