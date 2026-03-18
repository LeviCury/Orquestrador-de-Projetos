from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from ..models import Project, Stage, Task, Collaborator
from ..schemas import SearchResult

router = APIRouter()


@router.get("/", response_model=list[SearchResult])
def global_search(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    term = f"%{q}%"
    results: list[SearchResult] = []

    projects = db.query(Project).filter(
        or_(Project.name.ilike(term), Project.description.ilike(term))
    ).limit(10).all()
    for p in projects:
        results.append(SearchResult(
            type="project", id=p.id, name=p.name,
            description=p.description[:100] if p.description else "",
            status=p.status,
        ))

    stages = db.query(Stage).filter(
        or_(Stage.name.ilike(term), Stage.description.ilike(term))
    ).limit(10).all()
    for s in stages:
        proj = db.query(Project).filter(Project.id == s.project_id).first()
        results.append(SearchResult(
            type="stage", id=s.id, name=s.name,
            description=s.description[:100] if s.description else "",
            project_id=s.project_id,
            project_name=proj.name if proj else "",
            status=s.status,
        ))

    tasks = db.query(Task).filter(
        or_(Task.name.ilike(term), Task.description.ilike(term))
    ).limit(10).all()
    for t in tasks:
        stage = db.query(Stage).filter(Stage.id == t.stage_id).first()
        proj_id = stage.project_id if stage else None
        proj = db.query(Project).filter(Project.id == proj_id).first() if proj_id else None
        results.append(SearchResult(
            type="task", id=t.id, name=t.name,
            description=t.description[:100] if t.description else "",
            project_id=proj_id,
            project_name=proj.name if proj else "",
            status=t.status,
        ))

    collaborators = db.query(Collaborator).filter(
        or_(Collaborator.name.ilike(term), Collaborator.email.ilike(term))
    ).limit(10).all()
    for c in collaborators:
        results.append(SearchResult(
            type="collaborator", id=c.id, name=c.name,
            description=c.email,
        ))

    return results
