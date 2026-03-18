from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..database import get_db
from ..models import Task, Stage, Collaborator, TimeEntry, Activity, Project, Baseline
from ..schemas import TaskCreate, TaskRead, TaskUpdate
from ..automations import on_task_status_change
from ..utils import build_snapshot

router = APIRouter()


def _propagate_replanning(db: Session, task: Task):
    """When a task's replanned dates change, recalculate the stage and project
    replanned dates.  If the new project end date exceeds the original
    planned_end, an automatic baseline is saved first."""
    stage = db.query(Stage).options(joinedload(Stage.tasks)).filter(Stage.id == task.stage_id).first()
    if not stage:
        return

    tasks = stage.tasks
    replanned_starts = [t.replanned_start or t.planned_start for t in tasks if (t.replanned_start or t.planned_start)]
    replanned_ends = [t.replanned_end or t.planned_end for t in tasks if (t.replanned_end or t.planned_end)]

    has_any_replan = any(t.replanned_start or t.replanned_end for t in tasks)

    if has_any_replan and replanned_ends:
        stage.replanned_start = min(replanned_starts) if replanned_starts else stage.planned_start
        stage.replanned_end = max(replanned_ends) if replanned_ends else stage.planned_end
    db.flush()

    project = db.query(Project).options(
        joinedload(Project.stages).joinedload(Stage.tasks)
    ).filter(Project.id == stage.project_id).first()
    if not project:
        return

    all_stages = project.stages
    stage_starts = [s.replanned_start or s.planned_start for s in all_stages if (s.replanned_start or s.planned_start)]
    stage_ends = [s.replanned_end or s.planned_end for s in all_stages if (s.replanned_end or s.planned_end)]

    has_any_stage_replan = any(s.replanned_start or s.replanned_end for s in all_stages)

    if has_any_stage_replan and stage_ends:
        new_end = max(stage_ends)
        new_start = min(stage_starts) if stage_starts else project.planned_start

        reference_end = project.planned_end
        if reference_end and new_end > reference_end:
            snapshot = build_snapshot(db, project)
            auto_count = db.query(func.count(Baseline.id)).filter(
                Baseline.project_id == project.id,
                Baseline.is_auto == True,
            ).scalar() or 0
            bl_name = f"Replanejado #{auto_count + 1}"
            db.add(Baseline(
                project_id=project.id,
                name=bl_name,
                snapshot=snapshot,
                is_auto=True,
            ))
            db.flush()

        project.replanned_start = new_start
        project.replanned_end = new_end
    db.flush()


def _task_actual_hours(db: Session, task_id: int) -> float:
    total = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.task_id == task_id
    ).scalar()
    return float(total)


def _enrich_task(db: Session, task: Task) -> dict:
    return {
        **TaskRead.model_validate(task).model_dump(),
        "actual_hours": _task_actual_hours(db, task.id),
    }


@router.get("/stage/{stage_id}", response_model=list[TaskRead])
def list_tasks(stage_id: int, db: Session = Depends(get_db)):
    tasks = db.query(Task).options(
        joinedload(Task.collaborators),
    ).filter(Task.stage_id == stage_id).order_by(Task.order_index).all()
    return [_enrich_task(db, t) for t in tasks]


@router.post("/stage/{stage_id}", response_model=TaskRead, status_code=201)
def create_task(stage_id: int, data: TaskCreate, db: Session = Depends(get_db)):
    payload = data.model_dump(exclude={"collaborator_ids"})
    task = Task(stage_id=stage_id, **payload)
    if data.collaborator_ids:
        collabs = db.query(Collaborator).filter(Collaborator.id.in_(data.collaborator_ids)).all()
        task.collaborators = collabs
    db.add(task)
    db.commit()
    db.refresh(task)

    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if stage:
        db.add(Activity(
            project_id=stage.project_id, stage_id=stage_id, task_id=task.id,
            actor_name="Usuário", action="created", target_type="task", target_name=task.name,
        ))
        db.commit()

    return _enrich_task(db, task)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).options(joinedload(Task.collaborators)).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return _enrich_task(db, task)


@router.put("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).options(
        joinedload(Task.collaborators),
    ).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    updates = data.model_dump(exclude_unset=True)
    collab_ids = updates.pop("collaborator_ids", None)
    new_status = updates.pop("status", None)

    for key, val in updates.items():
        setattr(task, key, val)
    if collab_ids is not None:
        collabs = db.query(Collaborator).filter(Collaborator.id.in_(collab_ids)).all()
        task.collaborators = collabs

    if new_status and new_status != task.status:
        on_task_status_change(db, task, new_status)

    if "replanned_start" in data.model_dump(exclude_unset=True) or "replanned_end" in data.model_dump(exclude_unset=True):
        _propagate_replanning(db, task)

    db.commit()
    db.refresh(task)
    return _enrich_task(db, task)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
