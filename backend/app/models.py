from datetime import date, datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Boolean, Text,
    ForeignKey, Table, JSON,
)
from sqlalchemy.orm import relationship
from .database import Base

# ── Association Tables ──

project_collaborators = Table(
    "tab_project_collaborator",
    Base.metadata,
    Column("id_project", Integer, ForeignKey("tab_project.id_project", ondelete="CASCADE"), primary_key=True),
    Column("id_collaborator", Integer, ForeignKey("tab_collaborator.id_collaborator", ondelete="CASCADE"), primary_key=True),
    Column("name_role_in_project", String(100), default=""),
)

stage_collaborators = Table(
    "tab_stage_collaborator",
    Base.metadata,
    Column("id_stage", Integer, ForeignKey("tab_stage.id_stage", ondelete="CASCADE"), primary_key=True),
    Column("id_collaborator", Integer, ForeignKey("tab_collaborator.id_collaborator", ondelete="CASCADE"), primary_key=True),
)

task_collaborators = Table(
    "tab_task_collaborator",
    Base.metadata,
    Column("id_task", Integer, ForeignKey("tab_task.id_task", ondelete="CASCADE"), primary_key=True),
    Column("id_collaborator", Integer, ForeignKey("tab_collaborator.id_collaborator", ondelete="CASCADE"), primary_key=True),
)


# ── Collaborator ──

class Collaborator(Base):
    __tablename__ = "tab_collaborator"

    id = Column("id_collaborator", Integer, primary_key=True, index=True)
    name = Column("name_collaborator", String(200), nullable=False)
    email = Column("name_email", String(200), unique=True, nullable=False)
    role = Column("name_role", String(100), default="")
    active = Column("ind_active", Boolean, default=True)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    approved = Column("ind_approved", Boolean, default=False)
    avatar_url = Column("txt_avatar_url", String(500), default="")
    system_role = Column("ind_system_role", String(50), default="viewer")
    is_admin = Column("ind_admin", Boolean, default=False)
    is_owner = Column("ind_owner", Boolean, default=False)

    # ── AD Profile: BasicInfo ──
    username = Column("name_user", String(200), unique=True, nullable=True)
    first_name = Column("name_first", String(200), default="")
    last_name = Column("name_last", String(200), default="")
    full_name = Column("name_full", String(400), default="")
    user_principal_name = Column("name_user_principal", String(300), default="")

    # ── AD Profile: OrganizationInfo ──
    job_title = Column("name_job_title", String(200), default="")
    department = Column("name_department", String(200), default="")
    company = Column("name_company", String(200), default="")
    manager = Column("name_manager", String(200), default="")

    # ── AD Profile: PersonalInfo ──
    description = Column("desc_collaborator", Text, default="")
    office = Column("name_office", String(200), default="")
    telephone = Column("num_telephone", String(100), default="")
    web_page = Column("txt_web_page", String(500), default="")

    # ── AD Profile: Address ──
    street = Column("name_street", String(300), default="")
    postal_code = Column("code_postal", String(50), default="")
    city = Column("name_city", String(200), default="")
    state = Column("name_state", String(200), default="")
    country = Column("name_country", String(200), default="")

    # ── AD Profile: GroupInfo & Advanced ──
    ad_groups = Column("json_ad_groups", JSON, default=list)
    distinguished_name = Column("name_distinguished", String(500), default="")
    account_expires = Column("dt_account_expires", DateTime, nullable=True)

    # ── User-editable profile fields ──
    bio = Column("txt_bio", Text, default="")
    personal_phone = Column("num_personal_phone", String(100), default="")
    personal_link = Column("txt_personal_link", String(500), default="")

    projects = relationship("Project", secondary=project_collaborators, back_populates="collaborators")
    stages = relationship("Stage", secondary=stage_collaborators, back_populates="collaborators")
    tasks = relationship("Task", secondary=task_collaborators, back_populates="collaborators")
    time_entries = relationship("TimeEntry", back_populates="collaborator", cascade="all, delete-orphan")


# ── Project ──

class Project(Base):
    __tablename__ = "tab_project"

    id = Column("id_project", Integer, primary_key=True, index=True)
    name = Column("name_project", String(300), nullable=False)
    description = Column("desc_project", Text, default="")
    status = Column("ind_status", String(50), default="planning")
    planned_start = Column("dt_planned_start", Date, nullable=True)
    actual_start = Column("dt_actual_start", Date, nullable=True)
    planned_end = Column("dt_planned_end", Date, nullable=True)
    actual_end = Column("dt_actual_end", Date, nullable=True)
    replanned_start = Column("dt_replanned_start", Date, nullable=True)
    replanned_end = Column("dt_replanned_end", Date, nullable=True)
    complexity = Column("ind_complexity", String(10), nullable=False, default="medium")
    criticality = Column("ind_criticality", String(10), nullable=False, default="medium")
    scope = Column("ind_scope", String(10), nullable=False, default="medium")
    estimated_hours = Column("val_estimated_hours", Float, default=0)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column("dt_updated", DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    stages = relationship("Stage", back_populates="project", cascade="all, delete-orphan", order_by="Stage.order_index")
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan", order_by="Sprint.order_index")
    collaborators = relationship("Collaborator", secondary=project_collaborators, back_populates="projects")
    time_entries = relationship("TimeEntry", back_populates="project", cascade="all, delete-orphan")
    baselines = relationship("Baseline", back_populates="project", cascade="all, delete-orphan", order_by="Baseline.created_at.desc()")
    attachments = relationship("Attachment", back_populates="project", cascade="all, delete-orphan")


# ── Stage ──

class Stage(Base):
    __tablename__ = "tab_stage"

    id = Column("id_stage", Integer, primary_key=True, index=True)
    project_id = Column("id_project", Integer, ForeignKey("tab_project.id_project", ondelete="CASCADE"), nullable=False)
    name = Column("name_stage", String(300), nullable=False)
    description = Column("desc_stage", Text, default="")
    status = Column("ind_status", String(50), default="pending")
    order_index = Column("num_order_index", Integer, default=0)
    planned_start = Column("dt_planned_start", Date, nullable=True)
    actual_start = Column("dt_actual_start", Date, nullable=True)
    planned_end = Column("dt_planned_end", Date, nullable=True)
    actual_end = Column("dt_actual_end", Date, nullable=True)
    replanned_start = Column("dt_replanned_start", Date, nullable=True)
    replanned_end = Column("dt_replanned_end", Date, nullable=True)
    estimated_hours = Column("val_estimated_hours", Float, default=0)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="stages")
    tasks = relationship("Task", back_populates="stage", cascade="all, delete-orphan", order_by="Task.order_index")
    collaborators = relationship("Collaborator", secondary=stage_collaborators, back_populates="stages")
    time_entries = relationship("TimeEntry", back_populates="stage", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="stage", cascade="all, delete-orphan")


# ── Task ──

class Task(Base):
    __tablename__ = "tab_task"

    id = Column("id_task", Integer, primary_key=True, index=True)
    stage_id = Column("id_stage", Integer, ForeignKey("tab_stage.id_stage", ondelete="CASCADE"), nullable=False)
    name = Column("name_task", String(300), nullable=False)
    description = Column("desc_task", Text, default="")
    status = Column("ind_status", String(50), default="pending")
    priority = Column("ind_priority", String(20), default="medium")
    order_index = Column("num_order_index", Integer, default=0)
    planned_start = Column("dt_planned_start", Date, nullable=True)
    actual_start = Column("dt_actual_start", Date, nullable=True)
    planned_end = Column("dt_planned_end", Date, nullable=True)
    actual_end = Column("dt_actual_end", Date, nullable=True)
    replanned_start = Column("dt_replanned_start", Date, nullable=True)
    replanned_end = Column("dt_replanned_end", Date, nullable=True)
    estimated_hours = Column("val_estimated_hours", Float, default=0)
    sprint_id = Column("id_sprint", Integer, ForeignKey("tab_sprint.id_sprint", ondelete="SET NULL"), nullable=True)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    stage = relationship("Stage", back_populates="tasks")
    sprint = relationship("Sprint", backref="tasks")
    dependencies = relationship("TaskDependency", foreign_keys="TaskDependency.task_id", cascade="all, delete-orphan")
    collaborators = relationship("Collaborator", secondary=task_collaborators, back_populates="tasks")
    time_entries = relationship("TimeEntry", back_populates="task", cascade="all, delete-orphan")
    subtasks = relationship("Subtask", back_populates="task", cascade="all, delete-orphan", order_by="Subtask.order_index")
    attachments = relationship("Attachment", back_populates="task", cascade="all, delete-orphan")


# ── Subtask ──

class Subtask(Base):
    __tablename__ = "tab_subtask"

    id = Column("id_subtask", Integer, primary_key=True, index=True)
    task_id = Column("id_task", Integer, ForeignKey("tab_task.id_task", ondelete="CASCADE"), nullable=False)
    title = Column("name_title", String(500), nullable=False)
    done = Column("ind_done", Boolean, default=False)
    order_index = Column("num_order_index", Integer, default=0)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    task = relationship("Task", back_populates="subtasks")


# ── TimeEntry ──

class TimeEntry(Base):
    __tablename__ = "tab_time_entry"

    id = Column("id_time_entry", Integer, primary_key=True, index=True)
    collaborator_id = Column("id_collaborator", Integer, ForeignKey("tab_collaborator.id_collaborator", ondelete="CASCADE"), nullable=False)
    project_id = Column("id_project", Integer, ForeignKey("tab_project.id_project", ondelete="CASCADE"), nullable=False)
    stage_id = Column("id_stage", Integer, ForeignKey("tab_stage.id_stage", ondelete="SET NULL"), nullable=True)
    task_id = Column("id_task", Integer, ForeignKey("tab_task.id_task", ondelete="SET NULL"), nullable=True)
    entry_date = Column("dt_entry", Date, nullable=False, default=date.today)
    hours_worked = Column("val_hours_worked", Float, nullable=False)
    description = Column("desc_time_entry", Text, default="")
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    collaborator = relationship("Collaborator", back_populates="time_entries")
    project = relationship("Project", back_populates="time_entries")
    stage = relationship("Stage", back_populates="time_entries")
    task = relationship("Task", back_populates="time_entries")


# ── Activity ──

class Activity(Base):
    __tablename__ = "tab_activity"

    id = Column("id_activity", Integer, primary_key=True, index=True)
    project_id = Column("id_project", Integer, ForeignKey("tab_project.id_project", ondelete="CASCADE"), nullable=False)
    stage_id = Column("id_stage", Integer, ForeignKey("tab_stage.id_stage", ondelete="SET NULL"), nullable=True)
    task_id = Column("id_task", Integer, ForeignKey("tab_task.id_task", ondelete="SET NULL"), nullable=True)
    actor_name = Column("name_actor", String(200), nullable=False)
    action = Column("ind_action", String(50), nullable=False)
    target_type = Column("ind_target_type", String(50), nullable=False)
    target_name = Column("name_target", String(300), nullable=False)
    details = Column("txt_details", Text, default="")
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))


# ── Comment ──

class Comment(Base):
    __tablename__ = "tab_comment"

    id = Column("id_comment", Integer, primary_key=True, index=True)
    project_id = Column("id_project", Integer, ForeignKey("tab_project.id_project", ondelete="CASCADE"), nullable=False)
    stage_id = Column("id_stage", Integer, ForeignKey("tab_stage.id_stage", ondelete="SET NULL"), nullable=True)
    task_id = Column("id_task", Integer, ForeignKey("tab_task.id_task", ondelete="SET NULL"), nullable=True)
    author_name = Column("name_author", String(200), nullable=False)
    content = Column("txt_content", Text, nullable=False)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))


# ── Baseline ──

class Baseline(Base):
    __tablename__ = "tab_baseline"

    id = Column("id_baseline", Integer, primary_key=True, index=True)
    project_id = Column("id_project", Integer, ForeignKey("tab_project.id_project", ondelete="CASCADE"), nullable=False)
    name = Column("name_baseline", String(300), nullable=False)
    snapshot = Column("json_snapshot", JSON, nullable=False)
    is_auto = Column("ind_auto", Boolean, default=False, nullable=False)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="baselines")


# ── ProjectTemplate ──

class ProjectTemplate(Base):
    __tablename__ = "tab_project_template"

    id = Column("id_project_template", Integer, primary_key=True, index=True)
    name = Column("name_template", String(300), nullable=False)
    description = Column("desc_template", Text, default="")
    stages_json = Column("json_stages", JSON, nullable=False)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))


# ── Attachment ──

class Attachment(Base):
    __tablename__ = "tab_attachment"

    id = Column("id_attachment", Integer, primary_key=True, index=True)
    project_id = Column("id_project", Integer, ForeignKey("tab_project.id_project", ondelete="CASCADE"), nullable=False)
    stage_id = Column("id_stage", Integer, ForeignKey("tab_stage.id_stage", ondelete="SET NULL"), nullable=True)
    task_id = Column("id_task", Integer, ForeignKey("tab_task.id_task", ondelete="SET NULL"), nullable=True)
    filename = Column("name_file", String(500), nullable=False)
    filepath = Column("txt_filepath", String(1000), nullable=False)
    size_bytes = Column("val_size_bytes", Integer, default=0)
    content_type = Column("ind_content_type", String(200), default="")
    uploaded_by = Column("name_uploaded_by", String(200), default="")
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="attachments")
    stage = relationship("Stage", back_populates="attachments")
    task = relationship("Task", back_populates="attachments")


# ── Notification ──

class Notification(Base):
    __tablename__ = "tab_notification"

    id = Column("id_notification", Integer, primary_key=True, index=True)
    collaborator_id = Column("id_collaborator", Integer, ForeignKey("tab_collaborator.id_collaborator", ondelete="CASCADE"), nullable=False)
    title = Column("name_title", String(300), nullable=False)
    message = Column("txt_message", Text, nullable=False)
    type = Column("ind_type", String(50), default="info")
    read = Column("ind_read", Boolean, default=False)
    link = Column("txt_link", String(500), default="")
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    collaborator = relationship("Collaborator")


# ── TaskDependency ──

class TaskDependency(Base):
    __tablename__ = "tab_task_dependency"

    id = Column("id_task_dependency", Integer, primary_key=True, index=True)
    task_id = Column("id_task", Integer, ForeignKey("tab_task.id_task", ondelete="CASCADE"), nullable=False)
    depends_on_id = Column("id_depends_on", Integer, ForeignKey("tab_task.id_task", ondelete="CASCADE"), nullable=False)
    dependency_type = Column("ind_dependency_type", String(20), default="finish_to_start")
    lag_days = Column("val_lag_days", Integer, default=0)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))


# ── Sprint ──

class Sprint(Base):
    __tablename__ = "tab_sprint"

    id = Column("id_sprint", Integer, primary_key=True, index=True)
    project_id = Column("id_project", Integer, ForeignKey("tab_project.id_project", ondelete="CASCADE"), nullable=False)
    name = Column("name_sprint", String(300), nullable=False)
    goal = Column("txt_goal", Text, default="")
    start_date = Column("dt_start", Date, nullable=True)
    end_date = Column("dt_end", Date, nullable=True)
    status = Column("ind_status", String(50), default="planning")
    order_index = Column("num_order_index", Integer, default=0)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="sprints")


# ── Ticket Hours ──

class TicketHourEntry(Base):
    __tablename__ = "tab_ticket_hour_entry"

    id = Column("id_ticket_hour_entry", Integer, primary_key=True, index=True)
    collaborator_id = Column("id_collaborator", Integer, ForeignKey("tab_collaborator.id_collaborator", ondelete="CASCADE"), nullable=False)
    entry_date = Column("dt_entry", Date, nullable=False, default=date.today)
    hours_worked = Column("val_hours_worked", Float, nullable=False)
    glpi_ticket_id = Column("code_glpi_ticket", String(50), default="")
    glpi_ticket_title = Column("name_glpi_ticket", String(500), default="")
    glpi_link = Column("txt_glpi_link", String(1000), default="")
    glpi_status = Column("ind_glpi_status", String(100), default="")
    glpi_type = Column("ind_glpi_type", String(50), default="")
    glpi_priority = Column("ind_glpi_priority", String(50), default="")
    glpi_open_date = Column("dt_glpi_open", String(50), default="")
    glpi_assigned_to = Column("name_glpi_assigned_to", String(200), default="")
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))

    collaborator = relationship("Collaborator")


# ── VerificationCode ──

class VerificationCode(Base):
    __tablename__ = "tab_verification_code"

    id = Column("id_verification_code", Integer, primary_key=True, index=True)
    email = Column("name_email", String(200), nullable=False, index=True)
    code = Column("code_verification", String(10), nullable=False)
    used = Column("ind_used", Boolean, default=False)
    expires_at = Column("dt_expires", DateTime, nullable=False)
    created_at = Column("dt_created", DateTime, default=lambda: datetime.now(timezone.utc))
