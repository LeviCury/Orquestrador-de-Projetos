"""
Automation logic for cascade status updates and auto-dating.

- When a task status changes to 'in_progress', set actual_start if blank.
- When a task status changes to 'completed', set actual_end if blank.
- When all tasks in a stage are completed, auto-complete the stage.
- When a stage's first task starts, auto-start the stage.
- When all stages are completed, auto-complete the project.
- When the first stage starts, auto-start the project.
"""
from datetime import date
from sqlalchemy.orm import Session
from .models import Task, Stage, Project, Activity, Notification, task_collaborators


def _log_auto(db: Session, project_id: int, stage_id: int | None,
              task_id: int | None, action: str, target_type: str, target_name: str, details: str = ""):
    db.add(Activity(
        project_id=project_id, stage_id=stage_id, task_id=task_id,
        actor_name="Sistema", action=action,
        target_type=target_type, target_name=target_name, details=details,
    ))


def _notify_task_assignees(db: Session, task: Task, title: str, message: str, type: str, link: str):
    collab_ids = db.query(task_collaborators.c.id_collaborator).filter(
        task_collaborators.c.id_task == task.id
    ).all()
    for (cid,) in collab_ids:
        db.add(Notification(collaborator_id=cid, title=title, message=message, type=type, link=link))


def check_deadline_alerts(db: Session):
    """Call periodically to create deadline notifications."""
    from datetime import timedelta
    today = date.today()
    soon = today + timedelta(days=2)

    tasks = db.query(Task).filter(
        Task.planned_end != None,
        Task.planned_end <= soon,
        Task.planned_end >= today,
        Task.status.notin_(["completed", "cancelled"]),
    ).all()
    for task in tasks:
        days_left = (task.planned_end - today).days
        label = "hoje" if days_left == 0 else f"em {days_left} dia(s)"
        _notify_task_assignees(
            db, task,
            f"Prazo {label}: {task.name}",
            f"A tarefa \"{task.name}\" vence {label}.",
            "warning",
            f"/projects/{task.stage.project_id}",
        )
    db.commit()


def on_task_status_change(db: Session, task: Task, new_status: str):
    old_status = task.status
    if old_status == new_status:
        return

    task.status = new_status
    stage = task.stage
    project = stage.project

    if new_status == "in_progress" and not task.actual_start:
        task.actual_start = date.today()
        _log_auto(db, project.id, stage.id, task.id, "auto_start", "task", task.name)

    if new_status == "completed" and not task.actual_end:
        task.actual_end = date.today()
        _log_auto(db, project.id, stage.id, task.id, "auto_complete", "task", task.name)

    if new_status == "pending":
        task.actual_start = None
        task.actual_end = None
    elif new_status == "in_progress":
        task.actual_end = None

    _notify_task_assignees(
        db, task,
        f"Tarefa atualizada: {task.name}",
        f"Status alterado para \"{new_status}\" na tarefa \"{task.name}\".",
        "info",
        f"/projects/{project.id}",
    )

    _cascade_stage(db, stage, project)


def on_stage_status_change(db: Session, stage: Stage, new_status: str):
    old_status = stage.status
    if old_status == new_status:
        return

    stage.status = new_status
    project = stage.project

    if new_status == "in_progress" and not stage.actual_start:
        stage.actual_start = date.today()
        _log_auto(db, project.id, stage.id, None, "auto_start", "stage", stage.name)

    if new_status == "completed" and not stage.actual_end:
        stage.actual_end = date.today()
        _log_auto(db, project.id, stage.id, None, "auto_complete", "stage", stage.name)

    _cascade_project(db, project)


def _cascade_stage(db: Session, stage: Stage, project: Project):
    tasks = stage.tasks
    if not tasks:
        return

    all_completed = all(t.status == "completed" for t in tasks)
    any_started = any(t.status in ("in_progress", "completed") for t in tasks)
    all_pending = all(t.status == "pending" for t in tasks)

    if all_completed and stage.status != "completed":
        stage.status = "completed"
        if not stage.actual_end:
            stage.actual_end = date.today()
        _log_auto(db, project.id, stage.id, None, "auto_complete", "stage", stage.name,
                  "Todas as tarefas foram concluídas")

    elif all_pending and stage.status != "pending":
        stage.status = "pending"
        stage.actual_start = None
        stage.actual_end = None

    elif any_started and not all_completed:
        if stage.status == "completed":
            stage.actual_end = None
        if stage.status in ("pending", "completed"):
            stage.status = "in_progress"
        if not stage.actual_start:
            stage.actual_start = date.today()
            _log_auto(db, project.id, stage.id, None, "auto_start", "stage", stage.name,
                      "Uma tarefa foi iniciada")

    _cascade_project(db, project)


def _cascade_project(db: Session, project: Project):
    stages = project.stages
    if not stages:
        return

    all_completed = all(s.status == "completed" for s in stages)
    any_started = any(s.status in ("in_progress", "completed") for s in stages)

    if all_completed and project.status != "completed":
        project.status = "completed"
        if not project.actual_end:
            project.actual_end = date.today()
        _log_auto(db, project.id, None, None, "auto_complete", "project", project.name,
                  "Todas as etapas foram concluídas")

    elif any_started and project.status == "planning":
        project.status = "in_progress"
        if not project.actual_start:
            project.actual_start = date.today()
        _log_auto(db, project.id, None, None, "auto_start", "project", project.name,
                  "Uma etapa foi iniciada")
