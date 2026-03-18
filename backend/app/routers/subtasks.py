from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Subtask, Task
from ..schemas import SubtaskCreate, SubtaskUpdate, SubtaskRead

router = APIRouter()


@router.get("/task/{task_id}", response_model=list[SubtaskRead])
def list_subtasks(task_id: int, db: Session = Depends(get_db)):
    return db.query(Subtask).filter(Subtask.task_id == task_id).order_by(Subtask.order_index).all()


@router.post("/task/{task_id}", response_model=SubtaskRead, status_code=201)
def create_subtask(task_id: int, data: SubtaskCreate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    sub = Subtask(task_id=task_id, **data.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/{subtask_id}", response_model=SubtaskRead)
def update_subtask(subtask_id: int, data: SubtaskUpdate, db: Session = Depends(get_db)):
    sub = db.query(Subtask).filter(Subtask.id == subtask_id).first()
    if not sub:
        raise HTTPException(404, "Subtask not found")
    updates = data.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(sub, key, val)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{subtask_id}", status_code=204)
def delete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    sub = db.query(Subtask).filter(Subtask.id == subtask_id).first()
    if not sub:
        raise HTTPException(404, "Subtask not found")
    db.delete(sub)
    db.commit()
