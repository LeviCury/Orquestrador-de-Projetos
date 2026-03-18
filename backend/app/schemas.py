from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum


class ClassificationLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


# ── Collaborator ──

class CollaboratorBase(BaseModel):
    name: str
    email: str
    role: str = ""
    active: bool = True

class CollaboratorCreate(CollaboratorBase):
    pass

class CollaboratorRead(CollaboratorBase):
    id: int
    created_at: datetime
    avatar_url: str = ""
    system_role: str = "viewer"
    is_admin: bool = False
    is_owner: bool = False
    approved: bool = True

    # AD Profile
    username: Optional[str] = None
    first_name: str = ""
    last_name: str = ""
    full_name: str = ""
    user_principal_name: str = ""
    job_title: str = ""
    department: str = ""
    company: str = ""
    manager: str = ""
    description: str = ""
    office: str = ""
    telephone: str = ""
    web_page: str = ""
    street: str = ""
    postal_code: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    account_expires: Optional[datetime] = None

    # User-editable
    bio: str = ""
    personal_phone: str = ""
    personal_link: str = ""

    model_config = {"from_attributes": True}

class CollaboratorSummary(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: str = ""
    job_title: str = ""
    model_config = {"from_attributes": True}

class CollaboratorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    system_role: Optional[str] = None
    is_admin: Optional[bool] = None
    approved: Optional[bool] = None

class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    personal_phone: Optional[str] = None
    personal_link: Optional[str] = None


# ── Subtask ──

class SubtaskCreate(BaseModel):
    title: str
    done: bool = False
    order_index: int = 0

class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None
    order_index: Optional[int] = None

class SubtaskRead(BaseModel):
    id: int
    task_id: int
    title: str
    done: bool
    order_index: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Time Entry ──

class TimeEntryBase(BaseModel):
    collaborator_id: int
    project_id: int
    stage_id: Optional[int] = None
    task_id: Optional[int] = None
    entry_date: date
    hours_worked: float
    description: str = ""

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryRead(TimeEntryBase):
    id: int
    created_at: datetime
    collaborator: Optional[CollaboratorSummary] = None
    model_config = {"from_attributes": True}

class TimeEntryUpdate(BaseModel):
    entry_date: Optional[date] = None
    hours_worked: Optional[float] = None
    description: Optional[str] = None
    stage_id: Optional[int] = None
    task_id: Optional[int] = None


# ── Task ──

class TaskBase(BaseModel):
    name: str
    description: str = ""
    status: str = "pending"
    priority: str = "medium"
    order_index: int = 0
    planned_start: Optional[date] = None
    actual_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_end: Optional[date] = None
    replanned_start: Optional[date] = None
    replanned_end: Optional[date] = None
    estimated_hours: float = 0

class TaskCreate(BaseModel):
    name: str
    description: str = ""
    priority: str = "medium"
    order_index: int = 0
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    estimated_hours: float = 0
    collaborator_ids: list[int] = []
    sprint_id: Optional[int] = None

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    order_index: Optional[int] = None
    planned_start: Optional[date] = None
    actual_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_end: Optional[date] = None
    replanned_start: Optional[date] = None
    replanned_end: Optional[date] = None
    estimated_hours: Optional[float] = None
    collaborator_ids: Optional[list[int]] = None
    sprint_id: Optional[int] = None

class TaskRead(TaskBase):
    id: int
    stage_id: int
    sprint_id: Optional[int] = None
    created_at: datetime
    collaborators: list[CollaboratorSummary] = []
    actual_hours: float = 0
    subtasks: list[SubtaskRead] = []
    model_config = {"from_attributes": True}


# ── Stage ──

class StageBase(BaseModel):
    name: str
    description: str = ""
    status: str = "pending"
    order_index: int = 0
    planned_start: Optional[date] = None
    actual_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_end: Optional[date] = None
    replanned_start: Optional[date] = None
    replanned_end: Optional[date] = None
    estimated_hours: float = 0

class StageCreate(BaseModel):
    name: str
    description: str = ""
    order_index: int = 0
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    estimated_hours: float = 0
    collaborator_ids: list[int] = []

class StageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None
    planned_start: Optional[date] = None
    actual_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_end: Optional[date] = None
    replanned_start: Optional[date] = None
    replanned_end: Optional[date] = None
    estimated_hours: Optional[float] = None
    collaborator_ids: Optional[list[int]] = None

class StageRead(StageBase):
    id: int
    project_id: int
    created_at: datetime
    collaborators: list[CollaboratorSummary] = []
    tasks: list[TaskRead] = []
    actual_hours: float = 0
    model_config = {"from_attributes": True}


# ── Project ──

class ProjectBase(BaseModel):
    name: str
    description: str = ""
    status: str = "planning"
    complexity: ClassificationLevel
    criticality: ClassificationLevel
    scope: ClassificationLevel
    planned_start: Optional[date] = None
    actual_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_end: Optional[date] = None
    replanned_start: Optional[date] = None
    replanned_end: Optional[date] = None
    estimated_hours: float = 0

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    complexity: ClassificationLevel
    criticality: ClassificationLevel
    scope: ClassificationLevel
    collaborator_ids: list[int] = []
    skip_default_stages: bool = False

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    complexity: Optional[ClassificationLevel] = None
    criticality: Optional[ClassificationLevel] = None
    scope: Optional[ClassificationLevel] = None
    planned_start: Optional[date] = None
    actual_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_end: Optional[date] = None
    replanned_start: Optional[date] = None
    replanned_end: Optional[date] = None
    estimated_hours: Optional[float] = None
    collaborator_ids: Optional[list[int]] = None

class ProjectRead(ProjectBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    collaborators: list[CollaboratorSummary] = []
    actual_hours: float = 0
    progress: float = 0
    stages_total: int = 0
    stages_completed: int = 0
    tasks_total: int = 0
    tasks_completed: int = 0
    model_config = {"from_attributes": True}

class ProjectDetail(ProjectRead):
    stages: list[StageRead] = []
    baselines: list['BaselineRead'] = []


# ── Quick Time Entry (simplified) ──

class QuickTimeEntry(BaseModel):
    collaborator_id: int
    project_id: int
    stage_id: Optional[int] = None
    task_id: Optional[int] = None
    hours_worked: float
    description: str = ""
    entry_date: Optional[str] = None


# ── Dashboard ──

class DashboardSummary(BaseModel):
    total_projects: int
    active_projects: int
    completed_projects: int
    delayed_projects: int
    total_collaborators: int
    total_hours_estimated: float
    total_hours_actual: float

class HoursComparison(BaseModel):
    project_id: int
    project_name: str
    estimated_hours: float
    actual_hours: float

class StatusDistribution(BaseModel):
    status: str
    count: int

class DelayedItem(BaseModel):
    id: int
    name: str
    item_type: str
    planned_end: Optional[date]
    days_delayed: int
    project_name: str


# ── Activity / Comment ──

class ActivityRead(BaseModel):
    id: int
    project_id: int
    stage_id: Optional[int] = None
    task_id: Optional[int] = None
    actor_name: str
    action: str
    target_type: str
    target_name: str
    details: str = ""
    created_at: datetime
    model_config = {"from_attributes": True}

class CommentCreate(BaseModel):
    project_id: int
    stage_id: Optional[int] = None
    task_id: Optional[int] = None
    author_name: str
    content: str

class CommentRead(BaseModel):
    id: int
    project_id: int
    stage_id: Optional[int] = None
    task_id: Optional[int] = None
    author_name: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Search ──

class SearchResult(BaseModel):
    type: str
    id: int
    name: str
    description: str = ""
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    status: Optional[str] = None


# ── Baseline ──

class BaselineCreate(BaseModel):
    name: str

class BaselineRead(BaseModel):
    id: int
    project_id: int
    name: str
    snapshot: Any
    is_auto: bool = False
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Template ──

class TemplateCreate(BaseModel):
    name: str
    description: str = ""

class TemplateRead(BaseModel):
    id: int
    name: str
    description: str
    stages_json: Any
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Attachment ──

class AttachmentRead(BaseModel):
    id: int
    project_id: int
    stage_id: Optional[int] = None
    task_id: Optional[int] = None
    filename: str
    filepath: str
    size_bytes: int
    content_type: str
    uploaded_by: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Notification ──

class NotificationRead(BaseModel):
    id: int
    collaborator_id: int
    title: str
    message: str
    type: str
    read: bool
    link: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ── My Work ──

class MyTaskItem(BaseModel):
    task_id: int
    task_name: str
    task_status: str
    task_priority: str
    planned_end: Optional[date] = None
    estimated_hours: float = 0
    actual_hours: float = 0
    stage_id: int
    stage_name: str
    project_id: int
    project_name: str

class MyWorkSummary(BaseModel):
    tasks: list[MyTaskItem]
    hours_this_week: float
    hours_today: float
    upcoming_deadlines: list[MyTaskItem]
    overdue_tasks: list[MyTaskItem]


# ── Timeline ──

class TimelineBar(BaseModel):
    id: int
    name: str
    level: str  # "project" | "stage" | "task"
    status: str
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None
    estimated_hours: float = 0
    actual_hours: float = 0
    planned_days: int = 0
    actual_days: int = 0
    days_delta: int = 0  # positive = late, negative = early
    hours_delta: float = 0  # positive = over budget
    parent_id: Optional[int] = None
    children_ids: list[int] = []

class ProjectTimelineResponse(BaseModel):
    project_id: int
    project_name: str
    bars: list[TimelineBar]
    earliest_date: Optional[date] = None
    latest_date: Optional[date] = None
    total_planned_days: int = 0
    total_actual_days: int = 0
    total_days_delta: int = 0

class DashboardSummaryFiltered(DashboardSummary):
    project_name: Optional[str] = None
    total_planned_days: int = 0
    total_actual_days: int = 0
    total_days_delta: int = 0


# ── Task Dependencies ──

class TaskDependencyCreate(BaseModel):
    depends_on_id: int
    dependency_type: str = "finish_to_start"
    lag_days: int = 0

class TaskDependencyRead(BaseModel):
    id: int
    task_id: int
    depends_on_id: int
    dependency_type: str
    lag_days: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Sprint ──

class SprintCreate(BaseModel):
    name: str
    goal: str = ""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = "planning"
    order_index: int = 0

class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    order_index: Optional[int] = None

class SprintRead(BaseModel):
    id: int
    project_id: int
    name: str
    goal: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    order_index: int
    created_at: datetime
    task_count: int = 0
    completed_count: int = 0
    model_config = {"from_attributes": True}


# ── Workload ──

class WorkloadWeek(BaseModel):
    collaborator_id: int
    collaborator_name: str
    week_start: str
    allocated_hours: float = 0
    logged_hours: float = 0
    capacity_hours: float = 40


# ── Critical Path ──

class CriticalPathTask(BaseModel):
    task_id: int
    task_name: str
    stage_name: str
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    estimated_hours: float = 0
    status: str = ""
    early_start: int = 0
    early_finish: int = 0
    late_start: int = 0
    late_finish: int = 0
    slack: int = 0
    is_critical: bool = False
    dependencies: list[int] = []


# ── Executive Dashboard ──

class ProjectHealthRow(BaseModel):
    id: int
    name: str
    status: str
    complexity: str
    criticality: str
    spi: float = 0
    cpi_hours: float = 0
    pct_schedule: float = 0
    pct_hours: float = 0
    planned_hours: float = 0
    actual_hours: float = 0
    planned_days: int = 0
    actual_days: int = 0
    days_delta: int = 0
    hours_delta: float = 0
    planned_end: Optional[date] = None
    risk_level: str = "low"

class CollaboratorLoad(BaseModel):
    id: int
    name: str
    total_hours: float = 0
    estimated_capacity: float = 0
    load_pct: float = 0
    project_count: int = 0
    deviation_pct: float = 0

class SCurvePoint(BaseModel):
    date: str
    planned_cumulative: float = 0
    actual_cumulative: float = 0

class ExecutiveDashboard(BaseModel):
    pct_on_schedule: float = 0
    pct_within_budget: float = 0
    projects_at_risk: int = 0
    avg_schedule_deviation: float = 0
    avg_hours_deviation: float = 0
    total_ev: float = 0
    total_pv: float = 0
    total_ac: float = 0
    portfolio_spi: float = 0
    portfolio_cpi: float = 0
    project_health: list[ProjectHealthRow] = []
    collaborator_load: list[CollaboratorLoad] = []
    s_curve: list[SCurvePoint] = []
    total_projects: int = 0
    total_completed: int = 0
    total_in_progress: int = 0
    total_delayed: int = 0
    total_project_hours: float = 0
    total_ticket_hours: float = 0
    total_all_hours: float = 0
    ticket_entries_count: int = 0
    unique_tickets_count: int = 0


# ── Team Overview (projetos + chamados consolidado) ──

class CollaboratorWorkRow(BaseModel):
    id: int
    name: str
    role: str = ""
    project_hours: float = 0
    ticket_hours: float = 0
    total_hours: float = 0
    target_hours: float = 0
    adherence_pct: float = 0
    project_pct: float = 0
    ticket_pct: float = 0
    avg_daily_hours: float = 0
    working_days: int = 0

class TicketStats(BaseModel):
    total_entries: int = 0
    total_hours: float = 0
    unique_tickets: int = 0
    avg_hours_per_ticket: float = 0
    top_areas: list[dict] = []
    hours_by_day: list[dict] = []

class TeamOverview(BaseModel):
    period_start: date
    period_end: date
    total_project_hours: float = 0
    total_ticket_hours: float = 0
    total_hours: float = 0
    project_pct: float = 0
    ticket_pct: float = 0
    collaborators: list[CollaboratorWorkRow] = []
    ticket_stats: TicketStats = TicketStats()
    daily_distribution: list[dict] = []


# ── Ticket Hours (apontamento GLPI) ──

class TicketHourCreate(BaseModel):
    collaborator_id: int
    entry_date: date
    hours_worked: float
    glpi_ticket_id: str = ""
    glpi_ticket_title: str = ""
    glpi_link: str = ""
    glpi_status: str = ""
    glpi_type: str = ""
    glpi_priority: str = ""
    glpi_open_date: str = ""
    glpi_assigned_to: str = ""

class TicketHourRead(BaseModel):
    id: int
    collaborator_id: int
    entry_date: date
    hours_worked: float
    glpi_ticket_id: str
    glpi_ticket_title: str
    glpi_link: str
    glpi_status: str = ""
    glpi_type: str = ""
    glpi_priority: str = ""
    glpi_open_date: str = ""
    glpi_assigned_to: str = ""
    created_at: datetime
    collaborator: Optional[CollaboratorSummary] = None
    model_config = {"from_attributes": True}

class DailyHoursSummary(BaseModel):
    date: date
    target_hours: float = 9.0
    project_hours: float = 0
    ticket_hours: float = 0
    total_hours: float = 0
    remaining: float = 0
    pct: float = 0
