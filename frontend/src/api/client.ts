import axios from 'axios';
import type {
  Collaborator, Project, ProjectDetail, Stage, Task, TimeEntry,
  DashboardSummaryFiltered, HoursComparison, StatusDistribution, DelayedItem,
  Activity, Comment, SearchResult, Subtask, Baseline, ProjectTemplate,
  AttachmentInfo, NotificationItem, MyWorkSummary, ProjectTimeline,
} from '@/types';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_user_min');
      window.location.href = '/login';
    }
    if (err.response?.status === 403) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        err.message = detail;
      }
    }
    return Promise.reject(err);
  },
);

export function authenticatedUrl(path: string): string {
  if (!path) return path;
  const token = localStorage.getItem('auth_token');
  if (!token) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}token=${encodeURIComponent(token)}`;
}

// ── Auth ──
export const getAuthMode = () =>
  api.get<{ ad_available: boolean; allowed_domain: string }>('/auth/mode').then(r => r.data);
export const authLogin = (data: { login: string; password: string }) =>
  api.post<{ status: string; token?: string; user?: Collaborator }>('/auth/login', data).then(r => r.data);
export const getMe = () =>
  api.get<Collaborator>('/auth/me').then(r => r.data);
export const getAuthUsers = () =>
  api.get<Collaborator[]>('/auth/users').then(r => r.data);
export const getPendingUsers = () =>
  api.get<Collaborator[]>('/auth/pending').then(r => r.data);
export const approveUser = (userId: number) =>
  api.put<Collaborator>(`/auth/users/${userId}/approve`).then(r => r.data);
export const rejectUser = (userId: number) =>
  api.put<Collaborator>(`/auth/users/${userId}/reject`).then(r => r.data);
export const updateUserRole = (userId: number, system_role: string, is_admin: boolean) =>
  api.put<Collaborator>(`/auth/users/${userId}/role`, null, { params: { system_role, is_admin } }).then(r => r.data);
export const updateMyAvatar = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.put<Collaborator>('/auth/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};
export const updateMyProfile = (data: { bio?: string; personal_phone?: string; personal_link?: string }) =>
  api.put<Collaborator>('/auth/me/profile', data).then(r => r.data);

// ── Collaborators ──
export const getCollaborators = (activeOnly = false, analystsOnly = false) =>
  api.get<Collaborator[]>('/collaborators/', { params: { ...(activeOnly ? { active_only: true } : {}), ...(analystsOnly ? { analysts_only: true } : {}) } }).then(r => r.data);
export const createCollaborator = (data: Partial<Collaborator>) =>
  api.post<Collaborator>('/collaborators/', data).then(r => r.data);
export const updateCollaborator = (id: number, data: Partial<Collaborator>) =>
  api.put<Collaborator>(`/collaborators/${id}`, data).then(r => r.data);
export const deleteCollaborator = (id: number) =>
  api.delete(`/collaborators/${id}`);
export const getCollaboratorDetail = (id: number) =>
  api.get(`/collaborators/${id}/detail`).then(r => r.data);

// ── Projects ──
export const getProjects = (status?: string) =>
  api.get<Project[]>('/projects/', { params: status ? { status } : {} }).then(r => r.data);
export const getProject = (id: number) =>
  api.get<ProjectDetail>(`/projects/${id}`).then(r => r.data);
export const createProject = (data: Record<string, unknown>) =>
  api.post<Project>('/projects/', data).then(r => r.data);
export const updateProject = (id: number, data: Record<string, unknown>) =>
  api.put<Project>(`/projects/${id}`, data).then(r => r.data);
export const deleteProject = (id: number) =>
  api.delete(`/projects/${id}`);

// ── Stages ──
export const getStages = (projectId: number) =>
  api.get<Stage[]>(`/stages/project/${projectId}`).then(r => r.data);
export const createStage = (projectId: number, data: Record<string, unknown>) =>
  api.post<Stage>(`/stages/project/${projectId}`, data).then(r => r.data);
export const updateStage = (id: number, data: Record<string, unknown>) =>
  api.put<Stage>(`/stages/${id}`, data).then(r => r.data);
export const deleteStage = (id: number) =>
  api.delete(`/stages/${id}`);

// ── Tasks ──
export const createTask = (stageId: number, data: Record<string, unknown>) =>
  api.post<Task>(`/tasks/stage/${stageId}`, data).then(r => r.data);
export const updateTask = (id: number, data: Record<string, unknown>) =>
  api.put<Task>(`/tasks/${id}`, data).then(r => r.data);
export const deleteTask = (id: number) =>
  api.delete(`/tasks/${id}`);

// ── Subtasks ──
export const getSubtasks = (taskId: number) =>
  api.get<Subtask[]>(`/subtasks/task/${taskId}`).then(r => r.data);
export const createSubtask = (taskId: number, data: { title: string; done?: boolean }) =>
  api.post<Subtask>(`/subtasks/task/${taskId}`, data).then(r => r.data);
export const updateSubtask = (id: number, data: Partial<Subtask>) =>
  api.put<Subtask>(`/subtasks/${id}`, data).then(r => r.data);
export const deleteSubtask = (id: number) =>
  api.delete(`/subtasks/${id}`);

// ── Time Entries ──
export const getTimeEntries = (params?: Record<string, unknown>) =>
  api.get<TimeEntry[]>('/time-entries/', { params }).then(r => r.data);
export const createTimeEntry = (data: Record<string, unknown>) =>
  api.post<TimeEntry>('/time-entries/', data).then(r => r.data);
export const updateTimeEntry = (id: number, data: Record<string, unknown>) =>
  api.put<TimeEntry>(`/time-entries/${id}`, data).then(r => r.data);
export const deleteTimeEntry = (id: number) =>
  api.delete(`/time-entries/${id}`);
export const quickTimeEntry = (data: {
  collaborator_id: number; project_id: number; stage_id?: number | null;
  task_id?: number | null; hours_worked: number; description?: string; entry_date?: string;
}) => api.post<TimeEntry>('/time-entries/quick', data).then(r => r.data);
export const getHoursByCollaborator = (projectId: number) =>
  api.get<{ collaborator_id: number; name: string; total_hours: number }[]>(
    '/time-entries/summary/by-collaborator', { params: { project_id: projectId } }
  ).then(r => r.data);

// ── Dashboard ──
export const getDashboardSummary = (projectId?: number) =>
  api.get<DashboardSummaryFiltered>('/dashboard/summary', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data);
export const getHoursComparison = (projectId?: number) =>
  api.get<HoursComparison[]>('/dashboard/hours-comparison', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data);
export const getStatusDistribution = (projectId?: number) =>
  api.get<StatusDistribution[]>('/dashboard/status-distribution', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data);
export const getDelayedItems = (projectId?: number) =>
  api.get<DelayedItem[]>('/dashboard/delayed-items', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data);
export const getTimeline = (projectId?: number) =>
  api.get<ProjectTimeline[]>('/dashboard/timeline', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data);
export const getExecutiveDashboard = (projectId?: number) =>
  api.get<import('@/types').ExecutiveDashboard>('/dashboard/executive', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data);
export const getTeamOverview = (days = 30) =>
  api.get<import('@/types').TeamOverview>('/dashboard/team-overview', { params: { days } }).then(r => r.data);

// ── Search ──
export const globalSearch = (q: string) =>
  api.get<SearchResult[]>('/search/', { params: { q } }).then(r => r.data);

// ── Activities & Comments ──
export const getActivities = (params?: Record<string, unknown>) =>
  api.get<Activity[]>('/activities/', { params }).then(r => r.data);
export const getComments = (params?: Record<string, unknown>) =>
  api.get<Comment[]>('/activities/comments', { params }).then(r => r.data);
export const createComment = (data: {
  project_id: number; stage_id?: number | null; task_id?: number | null;
  author_name: string; content: string;
}) => api.post<Comment>('/activities/comments', data).then(r => r.data);
export const deleteComment = (id: number) =>
  api.delete(`/activities/comments/${id}`);

// ── Baselines ──
export const createBaseline = (projectId: number, name: string) =>
  api.post<Baseline>(`/projects/${projectId}/baselines`, { name }).then(r => r.data);
export const getBaselines = (projectId: number) =>
  api.get<Baseline[]>(`/projects/${projectId}/baselines`).then(r => r.data);
export const deleteBaseline = (id: number) =>
  api.delete(`/projects/baselines/${id}`);

// ── Templates ──
export const getTemplates = () =>
  api.get<ProjectTemplate[]>('/templates/').then(r => r.data);
export const createTemplate = (projectId: number, name: string, description?: string) =>
  api.post<ProjectTemplate>(`/templates/from-project/${projectId}`, { name, description }).then(r => r.data);
export const deleteTemplate = (id: number) =>
  api.delete(`/templates/${id}`);
export const createProjectFromTemplate = (templateId: number, name: string, description?: string) =>
  api.post(`/templates/${templateId}/create-project`, { name, description }).then(r => r.data);

// ── Attachments ──
export const getAttachments = (projectId: number, stageId?: number, taskId?: number) =>
  api.get<AttachmentInfo[]>('/attachments/', { params: { project_id: projectId, stage_id: stageId, task_id: taskId } }).then(r => r.data);
export const uploadAttachment = (form: FormData) =>
  api.post<AttachmentInfo>('/attachments/', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const deleteAttachment = (id: number) =>
  api.delete(`/attachments/${id}`);

// ── Notifications ──
export const getNotifications = (collaboratorId: number, unreadOnly = false) =>
  api.get<NotificationItem[]>(`/notifications/collaborator/${collaboratorId}`, { params: { unread_only: unreadOnly } }).then(r => r.data);
export const getUnreadCount = (collaboratorId: number) =>
  api.get<{ unread_count: number }>(`/notifications/collaborator/${collaboratorId}/count`).then(r => r.data);
export const markNotificationRead = (id: number) =>
  api.put<NotificationItem>(`/notifications/${id}/read`).then(r => r.data);
export const markAllNotificationsRead = (collaboratorId: number) =>
  api.put(`/notifications/collaborator/${collaboratorId}/read-all`);

// ── My Work ──
export const getMyWork = (collaboratorId: number) =>
  api.get<MyWorkSummary>(`/my-work/collaborator/${collaboratorId}`).then(r => r.data);

// ── Dependencies ──
export const getProjectDependencies = (projectId: number) =>
  api.get<import('@/types').TaskDependency[]>(`/dependencies/project/${projectId}`).then(r => r.data);
export const addDependency = (taskId: number, data: { depends_on_id: number; dependency_type?: string; lag_days?: number }) =>
  api.post<import('@/types').TaskDependency>(`/dependencies/task/${taskId}`, data).then(r => r.data);
export const removeDependency = (depId: number) =>
  api.delete(`/dependencies/${depId}`);
export const getCriticalPath = (projectId: number) =>
  api.get<import('@/types').CriticalPathTask[]>(`/dependencies/critical-path/${projectId}`).then(r => r.data);

// ── Workload ──
export const getProjectWorkload = (projectId: number) =>
  api.get<import('@/types').WorkloadWeek[]>(`/dashboard/workload/${projectId}`).then(r => r.data);

// ── Bulk update (reorder) ──
export const bulkReorderStages = (_projectId: number, stageIds: number[]) =>
  Promise.all(stageIds.map((id, i) => api.put(`/stages/${id}`, { order_index: i })));
export const bulkReorderTasks = (_stageId: number, taskIds: number[]) =>
  Promise.all(taskIds.map((id, i) => api.put(`/tasks/${id}`, { order_index: i })));

// ── Unified Hours ──
export const getUnifiedHours = (params?: Record<string, unknown>) =>
  api.get<any[]>('/time-entries/unified', { params }).then(r => r.data);
export const exportExcel = (params?: Record<string, unknown>) =>
  api.get('/time-entries/export-excel', { params, responseType: 'blob' }).then(r => {
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `horas_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  });

// ── GLPI Integration ──
export interface GlpiTicketInfo {
  id: number;
  title: string;
  status: string;
  status_id: number;
  type: string;
  urgency: string;
  priority: string;
  category_id: number | null;
  open_date: string | null;
  due_date: string | null;
  solve_date: string | null;
  close_date: string | null;
  description: string;
  requester_id: number | null;
  assigned_to: string;
  requester: string;
}
export const getGlpiTicket = (ticketId: string) =>
  api.get<GlpiTicketInfo>(`/glpi/ticket/${ticketId}`).then(r => r.data);

// ── Ticket Hours (GLPI) ──
export const getTicketHours = (params?: Record<string, unknown>) =>
  api.get<import('@/types').TicketHourEntry[]>('/tickets/hours', { params }).then(r => r.data);
export const createTicketHour = (data: {
  collaborator_id: number; entry_date: string; hours_worked: number;
  glpi_ticket_id?: string; glpi_ticket_title?: string; glpi_link?: string;
}) => api.post<import('@/types').TicketHourEntry>('/tickets/hours', data).then(r => r.data);
export const deleteTicketHour = (id: number) =>
  api.delete(`/tickets/hours/${id}`);

export interface DuplicateCheckResult {
  exists: boolean;
  count: number;
  entries: { id: number; entry_date: string; hours_worked: number; collaborator_name: string }[];
}
export const checkTicketDuplicate = (glpiTicketId: string, collaboratorId: number, entryDate?: string) =>
  api.get<DuplicateCheckResult>('/tickets/hours/check-duplicate', {
    params: { glpi_ticket_id: glpiTicketId, collaborator_id: collaboratorId, ...(entryDate ? { entry_date: entryDate } : {}) },
  }).then(r => r.data);
export const getDailyHours = (collaboratorId: number, targetDate?: string) =>
  api.get<import('@/types').DailyHoursSummary>(`/tickets/daily-hours/${collaboratorId}`, { params: targetDate ? { target_date: targetDate } : {} }).then(r => r.data);

// ── Sprints ──
export const getSprints = (projectId: number) =>
  api.get<import('@/types').Sprint[]>(`/sprints/project/${projectId}`).then(r => r.data);
export const createSprint = (projectId: number, data: Record<string, unknown>) =>
  api.post<import('@/types').Sprint>(`/sprints/project/${projectId}`, data).then(r => r.data);
export const updateSprint = (id: number, data: Record<string, unknown>) =>
  api.put<import('@/types').Sprint>(`/sprints/${id}`, data).then(r => r.data);
export const deleteSprint = (id: number) =>
  api.delete(`/sprints/${id}`);
export const assignTaskToSprint = (sprintId: number, taskId: number) =>
  api.post(`/sprints/${sprintId}/tasks/${taskId}`).then(r => r.data);
export const unassignTaskFromSprint = (sprintId: number, taskId: number) =>
  api.delete(`/sprints/${sprintId}/tasks/${taskId}`);
