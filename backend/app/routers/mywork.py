from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..database import get_db
from ..models import Task, Stage, Project, TimeEntry, task_collaborators
from ..schemas import MyTaskItem, MyWorkSummary

router = APIRouter()


def _task_actual_hours(db: Session, task_id: int) -> float:
    total = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(
        TimeEntry.task_id == task_id
    ).scalar()
    return float(total)


def _task_to_item(db: Session, task: Task) -> MyTaskItem:
    return MyTaskItem(
        task_id=task.id,
        task_name=task.name,
        task_status=task.status,
        task_priority=task.priority,
        planned_end=task.planned_end,
        estimated_hours=task.estimated_hours,
        actual_hours=_task_actual_hours(db, task.id),
        stage_id=task.stage_id,
        stage_name=task.stage.name,
        project_id=task.stage.project_id,
        project_name=task.stage.project.name,
    )


@router.get("/collaborator/{collaborator_id}", response_model=MyWorkSummary)
def my_work(collaborator_id: int, db: Session = Depends(get_db)):
    my_tasks = (
        db.query(Task)
        .join(task_collaborators, Task.id == task_collaborators.c.id_task)
        .filter(task_collaborators.c.id_collaborator == collaborator_id)
        .filter(Task.status.notin_(["completed", "cancelled"]))
        .options(joinedload(Task.stage).joinedload(Stage.project))
        .all()
    )

    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    hours_today = float(
        db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0))
        .filter(TimeEntry.collaborator_id == collaborator_id, TimeEntry.entry_date == today)
        .scalar()
    )

    hours_this_week = float(
        db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0))
        .filter(
            TimeEntry.collaborator_id == collaborator_id,
            TimeEntry.entry_date >= week_start,
            TimeEntry.entry_date <= today,
        )
        .scalar()
    )

    items = [_task_to_item(db, t) for t in my_tasks]

    upcoming = [
        it for it in items
        if it.planned_end and today <= it.planned_end <= today + timedelta(days=3)
    ]
    upcoming.sort(key=lambda x: x.planned_end or today)

    overdue = [
        it for it in items
        if it.planned_end and it.planned_end < today
    ]
    overdue.sort(key=lambda x: x.planned_end or today)

    return MyWorkSummary(
        tasks=items,
        hours_this_week=hours_this_week,
        hours_today=hours_today,
        upcoming_deadlines=upcoming,
        overdue_tasks=overdue,
    )
