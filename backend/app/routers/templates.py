from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import ProjectTemplate, Project, Stage, Task
from ..schemas import TemplateCreate, TemplateRead

router = APIRouter()


@router.get("/", response_model=list[TemplateRead])
def list_templates(db: Session = Depends(get_db)):
    return db.query(ProjectTemplate).order_by(ProjectTemplate.created_at.desc()).all()


@router.post("/from-project/{project_id}", response_model=TemplateRead, status_code=201)
def create_template_from_project(project_id: int, data: TemplateCreate, db: Session = Depends(get_db)):
    project = db.query(Project).options(
        joinedload(Project.stages).joinedload(Stage.tasks),
    ).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    stages_json = []
    for stage in sorted(project.stages, key=lambda s: s.order_index):
        tasks_json = []
        for task in sorted(stage.tasks, key=lambda t: t.order_index):
            tasks_json.append({
                "name": task.name,
                "description": task.description,
                "priority": task.priority,
                "estimated_hours": task.estimated_hours,
            })
        stages_json.append({
            "name": stage.name,
            "description": stage.description,
            "estimated_hours": stage.estimated_hours,
            "tasks": tasks_json,
        })

    template = ProjectTemplate(
        name=data.name,
        description=data.description or project.description,
        stages_json=stages_json,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    t = db.query(ProjectTemplate).filter(ProjectTemplate.id == template_id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    db.delete(t)
    db.commit()


@router.post("/{template_id}/create-project", status_code=201)
def create_project_from_template(template_id: int, data: TemplateCreate, db: Session = Depends(get_db)):
    tpl = db.query(ProjectTemplate).filter(ProjectTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(404, "Template not found")

    project = Project(
        name=data.name,
        description=data.description or tpl.description,
        status="planning",
        complexity="medium",
        criticality="medium",
        scope="medium",
    )
    db.add(project)
    db.flush()

    DEFAULT_STAGES = [
        "Inicialização", "Especificação e Planejamento",
        "Desenvolvimento", "Homologação",
        "Monitoramento e Controle", "Encerramento",
    ]

    stages_data = tpl.stages_json if tpl.stages_json else [{"name": s, "description": "", "estimated_hours": 0, "tasks": []} for s in DEFAULT_STAGES]

    for idx, stage_data in enumerate(stages_data):
        stage = Stage(
            project_id=project.id,
            name=stage_data.get("name", f"Etapa {idx+1}"),
            description=stage_data.get("description", ""),
            estimated_hours=stage_data.get("estimated_hours", 0),
            order_index=idx,
            status="pending",
        )
        db.add(stage)
        db.flush()

        for tidx, task_data in enumerate(stage_data.get("tasks", [])):
            task = Task(
                stage_id=stage.id,
                name=task_data.get("name", f"Tarefa {tidx+1}"),
                description=task_data.get("description", ""),
                priority=task_data.get("priority", "medium"),
                estimated_hours=task_data.get("estimated_hours", 0),
                order_index=tidx,
                status="pending",
            )
            db.add(task)

    db.commit()
    db.refresh(project)
    return {"id": project.id, "name": project.name, "message": "Project created from template"}
