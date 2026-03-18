from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Notification
from ..schemas import NotificationRead

router = APIRouter()


@router.get("/collaborator/{collaborator_id}", response_model=list[NotificationRead])
def list_notifications(
    collaborator_id: int,
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Notification).filter(Notification.collaborator_id == collaborator_id)
    if unread_only:
        q = q.filter(Notification.read == False)
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


@router.get("/collaborator/{collaborator_id}/count")
def unread_count(collaborator_id: int, db: Session = Depends(get_db)):
    count = db.query(func.count(Notification.id)).filter(
        Notification.collaborator_id == collaborator_id,
        Notification.read == False,
    ).scalar()
    return {"unread_count": count}


@router.put("/{notification_id}/read", response_model=NotificationRead)
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.read = True
    db.commit()
    db.refresh(n)
    return n


@router.put("/collaborator/{collaborator_id}/read-all")
def mark_all_read(collaborator_id: int, db: Session = Depends(get_db)):
    db.query(Notification).filter(
        Notification.collaborator_id == collaborator_id,
        Notification.read == False,
    ).update({"read": True})
    db.commit()
    return {"status": "ok"}


def create_notification(db: Session, collaborator_id: int, title: str, message: str, type: str = "info", link: str = ""):
    n = Notification(
        collaborator_id=collaborator_id,
        title=title,
        message=message,
        type=type,
        link=link,
    )
    db.add(n)
