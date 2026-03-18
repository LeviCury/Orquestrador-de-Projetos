from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..database import get_db
from ..models import Project, Collaborator, TimeEntry, Stage, Task, Baseline
from ..schemas import (
    ProjectCreate, ProjectRead, ProjectUpdate, ProjectDetail,
    StageRead, CollaboratorSummary, TaskRead,
    BaselineCreate, BaselineRead,
)
from ..utils import (
    task_actual_hours, stage_actual_hours,
    compute_actual_hours, compute_progress,
    build_snapshot,
)

DEFAULT_STAGES = [
    "Inicialização",
    "Especificação e Planejamento",
    "Desenvolvimento",
    "Homologação",
    "Monitoramento e Controle",
    "Encerramento",
]

router = APIRouter()


_compute_actual_hours = compute_actual_hours
_compute_progress = compute_progress
_stage_actual_hours = stage_actual_hours
_task_actual_hours = task_actual_hours


def _clean_classification(val: str | None) -> str:
    if not val:
        return "medium"
    s = str(val)
    for prefix in ("ClassificationLevel.", "classificationlevel."):
        if s.startswith(prefix):
            s = s[len(prefix):]
    return s if s in ("low", "medium", "high") else "medium"


def _compute_from_children(stages):
    """Derive planned_start, planned_end and estimated_hours from stages/tasks."""
    all_items = []
    for s in stages:
        all_items.append(s)
        for t in (s.tasks if s.tasks else []):
            all_items.append(t)

    starts = [it.planned_start for it in all_items if it.planned_start]
    ends = [it.planned_end for it in all_items if it.planned_end]
    hours = sum(it.estimated_hours or 0 for it in all_items
                if hasattr(it, 'stage_id') or not hasattr(it, 'project_id'))

    if not hours:
        hours = sum(s.estimated_hours or 0 for s in stages)

    return (
        min(starts) if starts else None,
        max(ends) if ends else None,
        hours,
    )


def _enrich_project(db: Session, project: Project) -> dict:
    stages = project.stages if project.stages else []
    all_tasks = [t for s in stages for t in (s.tasks if s.tasks else [])]

    calc_start, calc_end, calc_hours = _compute_from_children(stages)

    data = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "complexity": _clean_classification(project.complexity),
        "criticality": _clean_classification(project.criticality),
        "scope": _clean_classification(project.scope),
        "planned_start": project.planned_start or calc_start,
        "actual_start": project.actual_start,
        "planned_end": project.planned_end or calc_end,
        "actual_end": project.actual_end,
        "replanned_start": getattr(project, 'replanned_start', None),
        "replanned_end": getattr(project, 'replanned_end', None),
        "estimated_hours": calc_hours if calc_hours > 0 else (project.estimated_hours or 0),
        "created_at": project.created_at,
        "updated_at": getattr(project, 'updated_at', None) or project.created_at,
        "collaborators": [CollaboratorSummary.model_validate(c) for c in project.collaborators],
        "actual_hours": _compute_actual_hours(db, project.id),
        "progress": _compute_progress(db, project.id),
        "stages_total": len(stages),
        "stages_completed": sum(1 for s in stages if s.status == "completed"),
        "tasks_total": len(all_tasks),
        "tasks_completed": sum(1 for t in all_tasks if t.status == "completed"),
    }
    return data


@router.get("/", response_model=list[ProjectRead])
def list_projects(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Project).options(joinedload(Project.collaborators))
    if status:
        q = q.filter(Project.status == status)
    projects = q.order_by(Project.created_at.desc()).all()
    return [_enrich_project(db, p) for p in projects]


@router.post("/", response_model=ProjectRead, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    payload = data.model_dump(exclude={"collaborator_ids", "skip_default_stages"})
    for k in ("complexity", "criticality", "scope"):
        if k in payload and payload[k] is not None:
            payload[k] = payload[k].value if hasattr(payload[k], 'value') else str(payload[k])
    payload["status"] = "planning"
    project = Project(**payload)
    if data.collaborator_ids:
        collabs = db.query(Collaborator).filter(Collaborator.id.in_(data.collaborator_ids)).all()
        project.collaborators = collabs
    db.add(project)
    db.flush()

    if not data.skip_default_stages:
        for idx, stage_name in enumerate(DEFAULT_STAGES):
            db.add(Stage(project_id=project.id, name=stage_name, order_index=idx))

    db.commit()
    db.refresh(project)
    return _enrich_project(db, project)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).options(
        joinedload(Project.collaborators),
        joinedload(Project.stages).joinedload(Stage.collaborators),
        joinedload(Project.stages).joinedload(Stage.tasks).joinedload(Task.collaborators),
    ).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    enriched = _enrich_project(db, project)
    stages_data = []
    for stage in project.stages:
        tasks_data = []
        tasks_estimated = 0.0
        for task in stage.tasks:
            tasks_data.append({
                **TaskRead.model_validate(task).model_dump(),
                "actual_hours": _task_actual_hours(db, task.id),
            })
            tasks_estimated += task.estimated_hours or 0

        stage_data = StageRead.model_validate(stage).model_dump(exclude={"tasks"})
        if tasks_estimated > 0:
            stage_data["estimated_hours"] = tasks_estimated
        stage_data["actual_hours"] = _stage_actual_hours(db, stage.id)
        stage_data["tasks"] = tasks_data
        stages_data.append(stage_data)
    enriched["stages"] = stages_data

    baselines = db.query(Baseline).filter(
        Baseline.project_id == project_id
    ).order_by(Baseline.created_at.asc()).all()
    enriched["baselines"] = [
        {"id": bl.id, "project_id": bl.project_id, "name": bl.name,
         "snapshot": bl.snapshot, "is_auto": bl.is_auto,
         "created_at": bl.created_at}
        for bl in baselines
    ]
    return enriched


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).options(
        joinedload(Project.collaborators),
        joinedload(Project.stages).joinedload(Stage.tasks),
    ).filter(
        Project.id == project_id
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")

    updates = data.model_dump(exclude_unset=True)

    collab_ids = updates.pop("collaborator_ids", None)
    for k in ("complexity", "criticality", "scope"):
        if k in updates and updates[k] is not None:
            updates[k] = updates[k].value if hasattr(updates[k], 'value') else str(updates[k])
    for key, val in updates.items():
        setattr(project, key, val)
    if collab_ids is not None:
        collabs = db.query(Collaborator).filter(Collaborator.id.in_(collab_ids)).all()
        project.collaborators = collabs
    db.commit()
    db.refresh(project)
    return _enrich_project(db, project)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    db.delete(project)
    db.commit()


# ── Baselines ──

_build_snapshot = build_snapshot


@router.post("/{project_id}/baselines", response_model=BaselineRead, status_code=201)
def create_baseline(project_id: int, data: BaselineCreate, db: Session = Depends(get_db)):
    project = db.query(Project).options(
        joinedload(Project.stages).joinedload(Stage.tasks),
    ).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    snapshot = _build_snapshot(db, project)
    bl = Baseline(project_id=project_id, name=data.name, snapshot=snapshot)
    db.add(bl)
    db.commit()
    db.refresh(bl)
    return bl


@router.get("/{project_id}/baselines", response_model=list[BaselineRead])
def list_baselines(project_id: int, db: Session = Depends(get_db)):
    return db.query(Baseline).filter(Baseline.project_id == project_id).order_by(Baseline.created_at.desc()).all()


@router.delete("/baselines/{baseline_id}", status_code=204)
def delete_baseline(baseline_id: int, db: Session = Depends(get_db)):
    bl = db.query(Baseline).filter(Baseline.id == baseline_id).first()
    if not bl:
        raise HTTPException(404, "Baseline not found")
    db.delete(bl)
    db.commit()
