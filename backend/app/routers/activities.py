from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import Activity, Comment
from ..schemas import ActivityRead, CommentCreate, CommentRead

router = APIRouter()


@router.get("/", response_model=list[ActivityRead])
def list_activities(
    project_id: Optional[int] = None,
    stage_id: Optional[int] = None,
    task_id: Optional[int] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Activity)
    if project_id:
        q = q.filter(Activity.project_id == project_id)
    if stage_id:
        q = q.filter(Activity.stage_id == stage_id)
    if task_id:
        q = q.filter(Activity.task_id == task_id)
    return q.order_by(Activity.created_at.desc()).limit(limit).all()


@router.get("/comments", response_model=list[CommentRead])
def list_comments(
    project_id: Optional[int] = None,
    stage_id: Optional[int] = None,
    task_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Comment)
    if project_id:
        q = q.filter(Comment.project_id == project_id)
    if stage_id:
        q = q.filter(Comment.stage_id == stage_id)
    if task_id:
        q = q.filter(Comment.task_id == task_id)
    return q.order_by(Comment.created_at.desc()).all()


@router.post("/comments", response_model=CommentRead, status_code=201)
def create_comment(data: CommentCreate, db: Session = Depends(get_db)):
    comment = Comment(**data.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)

    activity = Activity(
        project_id=data.project_id,
        stage_id=data.stage_id,
        task_id=data.task_id,
        actor_name=data.author_name,
        action="commented",
        target_type="task" if data.task_id else ("stage" if data.stage_id else "project"),
        target_name="",
        details=data.content[:200],
    )
    db.add(activity)
    db.commit()

    return comment


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if comment:
        db.delete(comment)
        db.commit()
