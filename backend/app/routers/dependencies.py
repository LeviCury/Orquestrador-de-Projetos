from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TaskDependency, Task
from ..schemas import TaskDependencyCreate, TaskDependencyRead

router = APIRouter()


@router.get("/task/{task_id}", response_model=list[TaskDependencyRead])
def get_task_dependencies(task_id: int, db: Session = Depends(get_db)):
    return db.query(TaskDependency).filter(TaskDependency.task_id == task_id).all()


@router.get("/project/{project_id}", response_model=list[TaskDependencyRead])
def get_project_dependencies(project_id: int, db: Session = Depends(get_db)):
    from ..models import Stage
    stage_ids = [s.id for s in db.query(Stage.id).filter(Stage.project_id == project_id).all()]
    if not stage_ids:
        return []
    task_ids = [t.id for t in db.query(Task.id).filter(Task.stage_id.in_(stage_ids)).all()]
    if not task_ids:
        return []
    return db.query(TaskDependency).filter(TaskDependency.task_id.in_(task_ids)).all()


@router.post("/task/{task_id}", response_model=TaskDependencyRead, status_code=201)
def add_dependency(task_id: int, data: TaskDependencyCreate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    dep_task = db.query(Task).filter(Task.id == data.depends_on_id).first()
    if not dep_task:
        raise HTTPException(404, "Dependency task not found")
    if task_id == data.depends_on_id:
        raise HTTPException(400, "A task cannot depend on itself")

    existing = db.query(TaskDependency).filter(
        TaskDependency.task_id == task_id,
        TaskDependency.depends_on_id == data.depends_on_id,
    ).first()
    if existing:
        raise HTTPException(400, "Dependency already exists")

    dep = TaskDependency(
        task_id=task_id,
        depends_on_id=data.depends_on_id,
        dependency_type=data.dependency_type,
        lag_days=data.lag_days,
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


@router.delete("/{dep_id}", status_code=204)
def remove_dependency(dep_id: int, db: Session = Depends(get_db)):
    dep = db.query(TaskDependency).filter(TaskDependency.id == dep_id).first()
    if not dep:
        raise HTTPException(404, "Dependency not found")
    db.delete(dep)
    db.commit()


@router.get("/critical-path/{project_id}")
def get_critical_path(project_id: int, db: Session = Depends(get_db)):
    from ..models import Stage
    from datetime import date as date_type

    stages = db.query(Stage).filter(Stage.project_id == project_id).all()
    if not stages:
        return []

    all_tasks = []
    task_map = {}
    for s in stages:
        for t in s.tasks:
            task_map[t.id] = (t, s.name)
            all_tasks.append(t)

    deps = db.query(TaskDependency).filter(
        TaskDependency.task_id.in_([t.id for t in all_tasks])
    ).all()

    dep_map: dict[int, list[int]] = {}
    for d in deps:
        dep_map.setdefault(d.task_id, []).append(d.depends_on_id)

    durations: dict[int, int] = {}
    for t in all_tasks:
        if t.planned_start and t.planned_end:
            durations[t.id] = max((t.planned_end - t.planned_start).days, 1)
        elif t.estimated_hours > 0:
            durations[t.id] = max(int(t.estimated_hours / 8), 1)
        else:
            durations[t.id] = 1

    early_start: dict[int, int] = {}
    early_finish: dict[int, int] = {}

    def calc_es(tid: int) -> int:
        if tid in early_start:
            return early_start[tid]
        predecessors = dep_map.get(tid, [])
        if not predecessors:
            early_start[tid] = 0
        else:
            early_start[tid] = max(calc_es(p) + durations.get(p, 1) for p in predecessors if p in task_map)
            if not any(p in task_map for p in predecessors):
                early_start[tid] = 0
        early_finish[tid] = early_start[tid] + durations.get(tid, 1)
        return early_start[tid]

    for t in all_tasks:
        calc_es(t.id)

    project_duration = max(early_finish.values()) if early_finish else 0

    late_finish: dict[int, int] = {}
    late_start: dict[int, int] = {}

    successors: dict[int, list[int]] = {}
    for tid, preds in dep_map.items():
        for p in preds:
            successors.setdefault(p, []).append(tid)

    def calc_lf(tid: int) -> int:
        if tid in late_finish:
            return late_finish[tid]
        succs = successors.get(tid, [])
        if not succs:
            late_finish[tid] = project_duration
        else:
            late_finish[tid] = min(calc_lf(s) - durations.get(s, 1) for s in succs if s in task_map) if any(s in task_map for s in succs) else project_duration
        late_start[tid] = late_finish[tid] - durations.get(tid, 1)
        return late_finish[tid]

    for t in all_tasks:
        calc_lf(t.id)

    result = []
    for t in all_tasks:
        task_obj, stage_name = task_map[t.id]
        es = early_start.get(t.id, 0)
        ef = early_finish.get(t.id, 0)
        ls = late_start.get(t.id, 0)
        lf = late_finish.get(t.id, 0)
        slack = ls - es
        result.append({
            "task_id": t.id,
            "task_name": t.name,
            "stage_name": stage_name,
            "planned_start": str(t.planned_start) if t.planned_start else None,
            "planned_end": str(t.planned_end) if t.planned_end else None,
            "estimated_hours": t.estimated_hours,
            "status": t.status,
            "early_start": es,
            "early_finish": ef,
            "late_start": ls,
            "late_finish": lf,
            "slack": slack,
            "is_critical": slack == 0,
            "dependencies": dep_map.get(t.id, []),
        })

    return result
