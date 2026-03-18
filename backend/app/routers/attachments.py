import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Attachment
from ..schemas import AttachmentRead

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter()


@router.get("/", response_model=list[AttachmentRead])
def list_attachments(
    project_id: int,
    stage_id: int | None = None,
    task_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Attachment).filter(Attachment.project_id == project_id)
    if stage_id is not None:
        q = q.filter(Attachment.stage_id == stage_id)
    if task_id is not None:
        q = q.filter(Attachment.task_id == task_id)
    return q.order_by(Attachment.created_at.desc()).all()


@router.post("/", response_model=AttachmentRead, status_code=201)
async def upload_attachment(
    project_id: int = Form(...),
    stage_id: int | None = Form(None),
    task_id: int | None = Form(None),
    uploaded_by: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "file")[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, unique_name)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    attachment = Attachment(
        project_id=project_id,
        stage_id=stage_id,
        task_id=task_id,
        filename=file.filename or "file",
        filepath=unique_name,
        size_bytes=len(contents),
        content_type=file.content_type or "",
        uploaded_by=uploaded_by,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/download/{attachment_id}")
def download_attachment(attachment_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(404, "Attachment not found")
    filepath = os.path.join(UPLOAD_DIR, att.filepath)
    if not os.path.exists(filepath):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(filepath, filename=att.filename, media_type=att.content_type or "application/octet-stream")


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(404, "Attachment not found")
    filepath = os.path.join(UPLOAD_DIR, att.filepath)
    if os.path.exists(filepath):
        os.remove(filepath)
    db.delete(att)
    db.commit()
