export interface Collaborator {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  avatar_url?: string;
  system_role: string;
  is_admin: boolean;
  is_owner: boolean;
  approved: boolean;

  // AD Profile
  username?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  user_principal_name?: string;
  job_title?: string;
  department?: string;
  company?: string;
  manager?: string;
  description?: string;
  office?: string;
  telephone?: string;
  web_page?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  state?: string;
  country?: string;
  account_expires?: string;

  // User-editable
  bio?: string;
  personal_phone?: string;
  personal_link?: string;
}

export interface CollaboratorSummary {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  job_title?: string;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  done: boolean;
  order_index: number;
  created_at: string;
}

export interface TimeEntry {
  id: number;
  collaborator_id: number;
  project_id: number;
  stage_id: number | null;
  task_id: number | null;
  entry_date: string;
  hours_worked: number;
  description: string;
  created_at: string;
  collaborator?: CollaboratorSummary;
}

export interface Task {
  id: number;
  stage_id: number;
  sprint_id: number | null;
  name: string;
  description: string;
  status: string;
  priority: string;
  order_index: number;
  planned_start: string | null;
  actual_start: string | null;
  planned_end: string | null;
  actual_end: string | null;
  replanned_start: string | null;
  replanned_end: string | null;
  estimated_hours: number;
  created_at: string;
  collaborators: CollaboratorSummary[];
  actual_hours: number;
  subtasks: Subtask[];
}

export interface TaskDependency {
  id: number;
  task_id: number;
  depends_on_id: number;
  dependency_type: string;
  lag_days: number;
  created_at: string;
}

export interface Sprint {
  id: number;
  project_id: number;
  name: string;
  goal: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  order_index: number;
  created_at: string;
  task_count: number;
  completed_count: number;
}

export interface CriticalPathTask {
  task_id: number;
  task_name: string;
  stage_name: string;
  planned_start: string | null;
  planned_end: string | null;
  estimated_hours: number;
  status: string;
  early_start: number;
  early_finish: number;
  late_start: number;
  late_finish: number;
  slack: number;
  is_critical: boolean;
  dependencies: number[];
}

export interface WorkloadWeek {
  collaborator_id: number;
  collaborator_name: string;
  week_start: string;
  allocated_hours: number;
  logged_hours: number;
  capacity_hours: number;
}

export interface Stage {
  id: number;
  project_id: number;
  name: string;
  description: string;
  status: string;
  order_index: number;
  planned_start: string | null;
  actual_start: string | null;
  planned_end: string | null;
  actual_end: string | null;
  replanned_start: string | null;
  replanned_end: string | null;
  estimated_hours: number;
  created_at: string;
  collaborators: CollaboratorSummary[];
  tasks: Task[];
  actual_hours: number;
}

export type ClassificationLevel = 'low' | 'medium' | 'high';

export const CLASSIFICATION_LABELS: Record<ClassificationLevel, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta',
};

export const CLASSIFICATION_COLORS: Record<ClassificationLevel, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
};

export const COMPLEXITY_DESCRIPTIONS: Record<ClassificationLevel, string> = {
  low: 'Baixa amplitude de escopo, baixa dependência do ambiente organizacional, baixo nível de atividades, poucas decisões.',
  medium: 'Média amplitude de escopo, pouca dependência organizacional, média dependência tecnológica, poucos setores envolvidos.',
  high: 'Alta amplitude de escopo, alta dependência organizacional e tecnológica, muitas atividades e decisões, vários setores.',
};

export const CRITICALITY_DESCRIPTIONS: Record<ClassificationLevel, string> = {
  low: 'Nenhum envolvimento com a alta administração, baixa expectativa, nenhum grau de inovação, sem legislação vigente.',
  medium: 'Baixo envolvimento com a alta administração, média expectativa, baixo grau de inovação, sem legislação vigente.',
  high: 'Alto envolvimento com a alta administração, alta expectativa, alto grau de inovação, legislação vigente sobre o projeto.',
};

export const SCOPE_DESCRIPTIONS: Record<ClassificationLevel, string> = {
  low: 'Projeto com envolvimento de até 3 setores.',
  medium: 'Projeto com envolvimento de 3 a 5 setores.',
  high: 'Projeto com envolvimento acima de 5 setores.',
};

export interface Project {
  id: number;
  name: string;
  description: string;
  status: string;
  complexity: ClassificationLevel;
  criticality: ClassificationLevel;
  scope: ClassificationLevel;
  planned_start: string | null;
  actual_start: string | null;
  planned_end: string | null;
  actual_end: string | null;
  replanned_start: string | null;
  replanned_end: string | null;
  estimated_hours: number;
  created_at: string;
  updated_at: string | null;
  collaborators: CollaboratorSummary[];
  actual_hours: number;
  progress: number;
  stages_total: number;
  stages_completed: number;
  tasks_total: number;
  tasks_completed: number;
}

export interface Baseline {
  id: number;
  name: string;
  snapshot: {
    stages: {
      id: number;
      name: string;
      planned_start: string | null;
      planned_end: string | null;
      replanned_start: string | null;
      replanned_end: string | null;
      tasks: {
        id: number;
        name: string;
        planned_start: string | null;
        planned_end: string | null;
        replanned_start: string | null;
        replanned_end: string | null;
      }[];
    }[];
  };
  is_auto: boolean;
  created_at: string;
}

export interface ProjectDetail extends Project {
  stages: Stage[];
  baselines: Baseline[];
}

export interface DashboardSummary {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  delayed_projects: number;
  total_collaborators: number;
  total_hours_estimated: number;
  total_hours_actual: number;
}

export interface HoursComparison {
  project_id: number;
  project_name: string;
  estimated_hours: number;
  actual_hours: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface DelayedItem {
  id: number;
  name: string;
  item_type: string;
  planned_end: string | null;
  days_delayed: number;
  project_name: string;
}

export interface Activity {
  id: number;
  project_id: number;
  stage_id: number | null;
  task_id: number | null;
  actor_name: string;
  action: string;
  target_type: string;
  target_name: string;
  details: string;
  created_at: string;
}

export interface Comment {
  id: number;
  project_id: number;
  stage_id: number | null;
  task_id: number | null;
  author_name: string;
  content: string;
  created_at: string;
}

export interface SearchResult {
  type: string;
  id: number;
  name: string;
  description: string;
  project_id: number | null;
  project_name: string | null;
  status: string | null;
}


export interface ProjectTemplate {
  id: number;
  name: string;
  description: string;
  stages_json: any;
  created_at: string;
}

export interface AttachmentInfo {
  id: number;
  project_id: number;
  stage_id: number | null;
  task_id: number | null;
  filename: string;
  filepath: string;
  size_bytes: number;
  content_type: string;
  uploaded_by: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  collaborator_id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string;
  created_at: string;
}

export interface MyTaskItem {
  task_id: number;
  task_name: string;
  task_status: string;
  task_priority: string;
  planned_end: string | null;
  estimated_hours: number;
  actual_hours: number;
  stage_id: number;
  stage_name: string;
  project_id: number;
  project_name: string;
}

export interface MyWorkSummary {
  tasks: MyTaskItem[];
  hours_this_week: number;
  hours_today: number;
  upcoming_deadlines: MyTaskItem[];
  overdue_tasks: MyTaskItem[];
}

export interface TimelineBar {
  id: number;
  name: string;
  level: 'project' | 'stage' | 'task';
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  estimated_hours: number;
  actual_hours: number;
  planned_days: number;
  actual_days: number;
  days_delta: number;
  hours_delta: number;
  parent_id: number | null;
  children_ids: number[];
}

export interface ProjectTimeline {
  project_id: number;
  project_name: string;
  bars: TimelineBar[];
  earliest_date: string | null;
  latest_date: string | null;
  total_planned_days: number;
  total_actual_days: number;
  total_days_delta: number;
}

export interface DashboardSummaryFiltered extends DashboardSummary {
  project_name?: string | null;
  total_planned_days: number;
  total_actual_days: number;
  total_days_delta: number;
}

/* ── Executive Dashboard ── */

export interface ProjectHealthRow {
  id: number;
  name: string;
  status: string;
  complexity: string;
  criticality: string;
  spi: number;
  cpi_hours: number;
  pct_schedule: number;
  pct_hours: number;
  planned_hours: number;
  actual_hours: number;
  planned_days: number;
  actual_days: number;
  days_delta: number;
  hours_delta: number;
  planned_end: string | null;
  risk_level: 'low' | 'medium' | 'high';
}

export interface CollaboratorLoad {
  id: number;
  name: string;
  total_hours: number;
  estimated_capacity: number;
  load_pct: number;
  project_count: number;
  deviation_pct: number;
}

export interface SCurvePoint {
  date: string;
  planned_cumulative: number;
  actual_cumulative: number;
}

export interface ExecutiveDashboard {
  pct_on_schedule: number;
  pct_within_budget: number;
  projects_at_risk: number;
  avg_schedule_deviation: number;
  avg_hours_deviation: number;
  total_ev: number;
  total_pv: number;
  total_ac: number;
  portfolio_spi: number;
  portfolio_cpi: number;
  project_health: ProjectHealthRow[];
  collaborator_load: CollaboratorLoad[];
  s_curve: SCurvePoint[];
  total_projects: number;
  total_completed: number;
  total_in_progress: number;
  total_delayed: number;
  total_project_hours: number;
  total_ticket_hours: number;
  total_all_hours: number;
  ticket_entries_count: number;
  unique_tickets_count: number;
}

// ── Team Overview ──

export interface CollaboratorWorkRow {
  id: number;
  name: string;
  role: string;
  project_hours: number;
  ticket_hours: number;
  total_hours: number;
  target_hours: number;
  adherence_pct: number;
  project_pct: number;
  ticket_pct: number;
  avg_daily_hours: number;
  working_days: number;
}

export interface TicketStatsData {
  total_entries: number;
  total_hours: number;
  unique_tickets: number;
  avg_hours_per_ticket: number;
  top_areas: { area: string; hours: number }[];
  hours_by_day: { date: string; hours: number }[];
}

export interface TeamOverview {
  period_start: string;
  period_end: string;
  total_project_hours: number;
  total_ticket_hours: number;
  total_hours: number;
  project_pct: number;
  ticket_pct: number;
  collaborators: CollaboratorWorkRow[];
  ticket_stats: TicketStatsData;
  daily_distribution: { date: string; project_hours: number; ticket_hours: number; total: number }[];
}

// ── Ticket Hours (apontamento GLPI) ──

export interface TicketHourEntry {
  id: number;
  collaborator_id: number;
  entry_date: string;
  hours_worked: number;
  glpi_ticket_id: string;
  glpi_ticket_title: string;
  glpi_link: string;
  glpi_status?: string;
  glpi_type?: string;
  glpi_priority?: string;
  glpi_open_date?: string;
  glpi_assigned_to?: string;
  created_at: string;
  collaborator?: CollaboratorSummary;
}

export interface DailyHoursSummary {
  date: string;
  target_hours: number;
  project_hours: number;
  ticket_hours: number;
  total_hours: number;
  remaining: number;
  pct: number;
}

export const STATUS_LABELS: Record<string, string> = {
  planning: 'Planejamento', pending: 'Pendente', in_progress: 'Em Andamento',
  completed: 'Concluído', cancelled: 'Cancelado',
};

export const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-100 text-gray-800', in_progress: 'bg-amber-100 text-amber-800', completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};
