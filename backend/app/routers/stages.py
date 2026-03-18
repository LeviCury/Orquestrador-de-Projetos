from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..database import get_db
from ..models import Stage, Task, Collaborator, TimeEntry, Activity, Project, Baseline
from ..schemas import StageCreate, StageRead, StageUpdate, TaskRead
from ..automations import on_stage_status_change
from ..utils import build_snapshot

router = APIRouter()


def _propagate_stage_replanning(db: Session, stage: Stage):
    """When a stage's replanned dates change, recalculate the project replanned
    dates.  Creates an automatic baseline when the project deadline is pushed."""
    project = db.query(Project).options(
        joinedload(Project.stages).joinedload(Stage.tasks)
    ).filter(Project.id == stage.project_id).first()
    if not project:
        return

    all_stages = project.stages
    stage_starts = [s.replanned_start or s.planned_start for s in all_stages if (s.replanned_start or s.planned_start)]
    stage_ends = [s.replanned_end or s.planned_end for s in all_stages if (s.replanned_end or s.planned_end)]

    has_any_replan = any(s.replanned_start or s.replanned_end for s in all_stages)

    if has_any_replan and stage_ends:
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


def _stage_actual_hours(db: Session, stage_id: int) -> float:
    total = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.stage_id == stage_id
    ).scalar()
    return float(total)


def _task_actual_hours(db: Session, task_id: int) -> float:
    total = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.task_id == task_id
    ).scalar()
    return float(total)


def _enrich_stage(db: Session, stage: Stage) -> dict:
    tasks_data = []
    tasks_estimated = 0.0
    for task in stage.tasks:
        tasks_data.append({
            **TaskRead.model_validate(task).model_dump(),
            "actual_hours": _task_actual_hours(db, task.id),
        })
        tasks_estimated += task.estimated_hours or 0

    data = StageRead.model_validate(stage).model_dump(exclude={"tasks"})
    if tasks_estimated > 0:
        data["estimated_hours"] = tasks_estimated
    data["actual_hours"] = _stage_actual_hours(db, stage.id)
    data["tasks"] = tasks_data
    return data


@router.get("/project/{project_id}", response_model=list[StageRead])
def list_stages(project_id: int, db: Session = Depends(get_db)):
    stages = db.query(Stage).options(
        joinedload(Stage.collaborators),
        joinedload(Stage.tasks).joinedload(Task.collaborators),
    ).filter(Stage.project_id == project_id).order_by(Stage.order_index).all()
    return [_enrich_stage(db, s) for s in stages]


@router.post("/project/{project_id}", response_model=StageRead, status_code=201)
def create_stage(project_id: int, data: StageCreate, db: Session = Depends(get_db)):
    payload = data.model_dump(exclude={"collaborator_ids"})
    stage = Stage(project_id=project_id, **payload)
    if data.collaborator_ids:
        collabs = db.query(Collaborator).filter(Collaborator.id.in_(data.collaborator_ids)).all()
        stage.collaborators = collabs
    db.add(stage)
    db.commit()
    db.refresh(stage)

    db.add(Activity(
        project_id=project_id, stage_id=stage.id, task_id=None,
        actor_name="Usuário", action="created", target_type="stage", target_name=stage.name,
    ))
    db.commit()

    return _enrich_stage(db, stage)


@router.get("/{stage_id}", response_model=StageRead)
def get_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = db.query(Stage).options(
        joinedload(Stage.collaborators),
        joinedload(Stage.tasks).joinedload(Task.collaborators),
    ).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(404, "Stage not found")
    return _enrich_stage(db, stage)


@router.put("/{stage_id}", response_model=StageRead)
def update_stage(stage_id: int, data: StageUpdate, db: Session = Depends(get_db)):
    stage = db.query(Stage).options(
        joinedload(Stage.collaborators),
        joinedload(Stage.tasks).joinedload(Task.collaborators),
    ).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(404, "Stage not found")

    updates = data.model_dump(exclude_unset=True)
    collab_ids = updates.pop("collaborator_ids", None)
    new_status = updates.pop("status", None)

    for key, val in updates.items():
        setattr(stage, key, val)
    if collab_ids is not None:
        collabs = db.query(Collaborator).filter(Collaborator.id.in_(collab_ids)).all()
        stage.collaborators = collabs

    if new_status and new_status != stage.status:
        on_stage_status_change(db, stage, new_status)

    if "replanned_start" in data.model_dump(exclude_unset=True) or "replanned_end" in data.model_dump(exclude_unset=True):
        _propagate_stage_replanning(db, stage)

    db.commit()
    db.refresh(stage)
    return _enrich_stage(db, stage)


@router.delete("/{stage_id}", status_code=204)
def delete_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(404, "Stage not found")
    db.delete(stage)
    db.commit()
