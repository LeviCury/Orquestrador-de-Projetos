from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import TimeEntry, Task, Stage


def task_actual_hours(db: Session, task_id: int) -> float:
    total = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.task_id == task_id
    ).scalar()
    return float(total)


def stage_actual_hours(db: Session, stage_id: int) -> float:
    total = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.stage_id == stage_id
    ).scalar()
    return float(total)


def compute_actual_hours(db: Session, project_id: int) -> float:
    total = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.project_id == project_id
    ).scalar()
    return float(total)


def compute_progress(db: Session, project_id: int) -> float:
    total_tasks = db.query(func.count(Task.id)).join(Stage).filter(
        Stage.project_id == project_id
    ).scalar()
    if total_tasks == 0:
        return 0
    done_tasks = db.query(func.count(Task.id)).join(Stage).filter(
        Stage.project_id == project_id, Task.status == "completed"
    ).scalar()
    return round((done_tasks / total_tasks) * 100, 1)


def build_snapshot(db: Session, project) -> dict:
    stages_snap = []
    for stage in project.stages:
        tasks_snap = []
        for task in stage.tasks:
            tasks_snap.append({
                "id": task.id, "name": task.name, "status": task.status, "priority": task.priority,
                "planned_start": str(task.planned_start) if task.planned_start else None,
                "planned_end": str(task.planned_end) if task.planned_end else None,
                "replanned_start": str(task.replanned_start) if task.replanned_start else None,
                "replanned_end": str(task.replanned_end) if task.replanned_end else None,
                "estimated_hours": task.estimated_hours,
                "actual_hours": task_actual_hours(db, task.id),
            })
        stages_snap.append({
            "id": stage.id, "name": stage.name, "status": stage.status, "order_index": stage.order_index,
            "planned_start": str(stage.planned_start) if stage.planned_start else None,
            "planned_end": str(stage.planned_end) if stage.planned_end else None,
            "replanned_start": str(stage.replanned_start) if stage.replanned_start else None,
            "replanned_end": str(stage.replanned_end) if stage.replanned_end else None,
            "estimated_hours": stage.estimated_hours,
            "actual_hours": stage_actual_hours(db, stage.id),
            "tasks": tasks_snap,
        })
    return {
        "name": project.name, "status": project.status,
        "planned_start": str(project.planned_start) if project.planned_start else None,
        "planned_end": str(project.planned_end) if project.planned_end else None,
        "replanned_start": str(project.replanned_start) if project.replanned_start else None,
        "replanned_end": str(project.replanned_end) if project.replanned_end else None,
        "estimated_hours": project.estimated_hours,
        "actual_hours": compute_actual_hours(db, project.id),
        "progress": compute_progress(db, project.id),
        "stages": stages_snap,
    }
