import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Calendar, Clock, Users, Timer, Check, MessageSquare, Send,
  Play, Pause, Square, Layers, LayoutGrid, BarChart3, Activity as ActivityIcon,
} from 'lucide-react';
import type {
  ProjectDetail as ProjectDetailType, Stage, Task, Collaborator,
  Activity, Comment as CommentType,
} from '@/types';
import HoursInput from '@/components/HoursInput';
import {
  STATUS_LABELS, PRIORITY_LABELS,
  CLASSIFICATION_LABELS, CLASSIFICATION_COLORS,
  COMPLEXITY_DESCRIPTIONS, CRITICALITY_DESCRIPTIONS, SCOPE_DESCRIPTIONS,
  type ClassificationLevel,
} from '@/types';
import {
  getProject, updateProject, deleteProject,
  createStage, updateStage, deleteStage,
  createTask, updateTask, deleteTask,
  getCollaborators, quickTimeEntry,
  getActivities, getComments, createComment,
  bulkReorderStages, bulkReorderTasks,
} from '@/api/client';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import type { ConfirmVariant } from '@/components/ConfirmModal';
import ProgressBar from '@/components/ProgressBar';
import HoursDisplay from '@/components/HoursDisplay';
import GanttChart from '@/components/GanttChart';
import GridView from '@/components/GridView';
import ScheduleView from '@/components/ScheduleView';
import InlineStatus from '@/components/InlineStatus';
import RichTooltip from '@/components/RichTooltip';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'stages' | 'kanban' | 'gantt' | 'schedule' | 'grid' | 'hours' | 'activity';

const KANBAN_COLUMNS = [
  { key: 'pending', label: 'Pendente', gradient: 'from-slate-400 to-slate-500', bg: 'bg-slate-50' },
  { key: 'in_progress', label: 'Em Andamento', gradient: 'from-amber-400 to-orange-500', bg: 'bg-amber-50/50' },
  { key: 'completed', label: 'Concluído', gradient: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-50/50' },
];

function wasCompletedOnTime(task: { planned_end: string | null; replanned_end: string | null; actual_end: string | null; status: string }) {
  if (task.status !== 'completed' || !task.actual_end) return null;
  const deadline = task.replanned_end || task.planned_end;
  if (!deadline) return null;
  const endDate = new Date(task.actual_end + 'T00:00:00');
  const deadlineDate = new Date(deadline + 'T00:00:00');
  return endDate <= deadlineDate;
}

const TAB_ITEMS: { key: Tab; label: string; icon: typeof Layers }[] = [
  { key: 'stages', label: 'Etapas', icon: Layers },
  { key: 'grid', label: 'Grade', icon: LayoutGrid },
  { key: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { key: 'gantt', label: 'Gantt', icon: BarChart3 },
  { key: 'schedule', label: 'Cronograma', icon: Calendar },
  { key: 'hours', label: 'Horas', icon: Clock },
  { key: 'activity', label: 'Atividade', icon: ActivityIcon },
];

function formatDateHuman(d: string | null): string {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

function ProjectHealthBanner({ project }: { project: ProjectDetailType }) {
  if (project.status === 'planning') return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const done = ['completed', 'cancelled'];
  const daysDiff = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000);

  type AlertItem = { name: string; type: 'etapa' | 'tarefa'; endDate: string; days: number };

  const overdueItems: AlertItem[] = [];
  const nearItems: AlertItem[] = [];

  for (const s of project.stages ?? []) {
    if (!done.includes(s.status) && s.planned_end) {
      const d = daysDiff(s.planned_end);
      if (d < 0) overdueItems.push({ name: s.name, type: 'etapa', endDate: s.planned_end, days: d });
      else if (d <= 7) nearItems.push({ name: s.name, type: 'etapa', endDate: s.planned_end, days: d });
    }
    for (const t of s.tasks ?? []) {
      if (!done.includes(t.status) && t.planned_end) {
        const d = daysDiff(t.planned_end);
        if (d < 0) overdueItems.push({ name: t.name, type: 'tarefa', endDate: t.planned_end, days: d });
        else if (d <= 7) nearItems.push({ name: t.name, type: 'tarefa', endDate: t.planned_end, days: d });
      }
    }
  }

  overdueItems.sort((a, b) => a.days - b.days);
  nearItems.sort((a, b) => a.days - b.days);

  const overBudget = project.estimated_hours > 0 && project.actual_hours > project.estimated_hours * 1.05;
  const hoursDelta = project.actual_hours - project.estimated_hours;

  const fmtDays = (d: number) => d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : `faltam ${d} dias`;
  const fmtOverdue = (d: number) => { const abs = Math.abs(d); return abs === 1 ? '1 dia de atraso' : `${abs} dias de atraso`; };

  if (project.status === 'completed') {
    return (
      <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 border border-emerald-200/60 rounded-2xl animate-fade-in">
        <div className="w-3 h-3 rounded-full bg-emerald-500" />
        <span className="text-sm font-bold text-emerald-800">Projeto concluído</span>
        {project.actual_end && <span className="text-xs text-emerald-600">Entregue em {formatDateHuman(project.actual_end)}</span>}
      </div>
    );
  }

  if (overdueItems.length > 0 || overBudget) {
    return (
      <div className="px-5 py-3 bg-red-50 border border-red-200/60 rounded-2xl animate-fade-in space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm font-bold text-red-800">
            {overdueItems.length > 0 && overBudget
              ? `${overdueItems.length} ${overdueItems.length === 1 ? 'item atrasado' : 'itens atrasados'} + acima do orçamento`
              : overdueItems.length > 0
                ? `${overdueItems.length} ${overdueItems.length === 1 ? 'item atrasado' : 'itens atrasados'}`
                : `${hoursDelta.toFixed(0)}h acima do orçamento`}
          </span>
          {overBudget && <span className="text-xs text-red-600">({project.actual_hours.toFixed(0)}h de {project.estimated_hours.toFixed(0)}h estimadas)</span>}
        </div>
        {overdueItems.length > 0 && (
          <div className="ml-6 space-y-1">
            {overdueItems.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-700">
                <span className="font-medium bg-red-100 px-1.5 py-0.5 rounded text-[10px] uppercase">{item.type}</span>
                <span className="font-semibold truncate max-w-[250px]">{item.name}</span>
                <span className="text-red-500">&middot; {fmtOverdue(item.days)}</span>
                <span className="text-red-400">(era {formatDateHuman(item.endDate)})</span>
              </div>
            ))}
            {overdueItems.length > 5 && <span className="text-[10px] text-red-400 ml-1">+{overdueItems.length - 5} mais...</span>}
          </div>
        )}
      </div>
    );
  }

  if (nearItems.length > 0) {
    return (
      <div className="px-5 py-3 bg-amber-50 border border-amber-200/60 rounded-2xl animate-fade-in space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
          <span className="text-sm font-bold text-amber-800">
            {nearItems.length === 1
              ? `Prazo próximo em 1 item`
              : `Prazo próximo em ${nearItems.length} itens`}
          </span>
        </div>
        <div className="ml-6 space-y-1">
          {nearItems.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
              <span className="font-medium bg-amber-100 px-1.5 py-0.5 rounded text-[10px] uppercase">{item.type}</span>
              <span className="font-semibold truncate max-w-[250px]">{item.name}</span>
              <span className="text-amber-600">&middot; {fmtDays(item.days)}</span>
              <span className="text-amber-500">({formatDateHuman(item.endDate)})</span>
            </div>
          ))}
          {nearItems.length > 5 && <span className="text-[10px] text-amber-400 ml-1">+{nearItems.length - 5} mais...</span>}
        </div>
      </div>
    );
  }

  if (project.planned_end) {
    const d = daysDiff(project.planned_end);
    return (
      <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50/50 border border-emerald-200/40 rounded-2xl animate-fade-in">
        <div className="w-3 h-3 rounded-full bg-emerald-500" />
        <span className="text-sm font-bold text-emerald-800">No prazo</span>
        {d > 0 && <span className="text-xs text-emerald-600">{d} dias restantes (vencimento: {formatDateHuman(project.planned_end)})</span>}
      </div>
    );
  }
  return null;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isViewer = currentUser?.system_role === 'viewer';
  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [tab, setTab] = useState<Tab>('stages');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [taskFilterStatus, setTaskFilterStatus] = useState('');
  const [taskFilterPriority, setTaskFilterPriority] = useState('');
  const [taskFilterCollab, setTaskFilterCollab] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editProject, setEditProject] = useState(false);
  const [projForm, setProjForm] = useState({
    name: '',
    complexity: 'medium' as string, criticality: 'medium' as string, scope: 'medium' as string,
    collaborator_ids: [] as number[],
  });

  const [stageModal, setStageModal] = useState<{ open: boolean; editing: Stage | null }>({ open: false, editing: null });
  const [stageForm, setStageForm] = useState({
    name: '', description: '', status: 'pending', order_index: 0,
    planned_start: '', actual_start: '', planned_end: '', actual_end: '',
    replanned_start: '', replanned_end: '',
    estimated_hours: 0, collaborator_ids: [] as number[],
  });

  const [taskModal, setTaskModal] = useState<{ open: boolean; stageId: number; editing: Task | null }>({ open: false, stageId: 0, editing: null });
  const [taskForm, setTaskForm] = useState({
    name: '', description: '', status: 'pending', priority: 'medium', order_index: 0,
    planned_start: '', actual_start: '', planned_end: '', actual_end: '',
    replanned_start: '', replanned_end: '',
    estimated_hours: 0, collaborator_ids: [] as number[],
    collaborator_id: 0,
  });

  const [quickHours, setQuickHours] = useState<{
    target: string | null; stageId: number | null; taskId: number | null;
    hours: number; collaboratorId: number; desc: string; entryDate: string; saving: boolean; success: boolean;
  }>({ target: null, stageId: null, taskId: null, hours: 0, collaboratorId: 0, desc: '', entryDate: new Date().toISOString().slice(0, 10), saving: false, success: false });

  const [timer, setTimer] = useState<{
    running: boolean; paused: boolean; stageId: number | null; taskId: number | null;
    taskName: string; collaboratorId: number; startTime: number; elapsed: number; pausedElapsed: number; desc: string;
  }>({ running: false, paused: false, stageId: null, taskId: null, taskName: '', collaboratorId: 0, startTime: 0, elapsed: 0, pausedElapsed: 0, desc: '' });

  const [activities, setActivities] = useState<Activity[]>([]);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [draggingTask, setDraggingTask] = useState<{ taskId: number; stageId: number } | null>(null);
  const [draggingStageId, setDraggingStageId] = useState<number | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; description?: string; details?: string[];
    confirmLabel?: string; variant?: ConfirmVariant; onConfirm: () => void;
  }>({ open: false, title: '', onConfirm: () => {} });
  const showConfirm = (opts: Omit<typeof confirmModal, 'open'>) => setConfirmModal({ ...opts, open: true });
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, open: false }));

  const openQuickHours = (target: string, stageId: number | null, taskId: number | null) => {
    setQuickHours({ target, stageId, taskId, hours: 0, collaboratorId: currentUser?.id ?? 0, desc: '', entryDate: new Date().toISOString().slice(0, 10), saving: false, success: false });
  };

  const submitQuickHours = async () => {
    if (!project || !quickHours.hours || !quickHours.entryDate) {
      if (!quickHours.entryDate) toast('error', 'Selecione a data do lançamento');
      return;
    }
    setQuickHours(prev => ({ ...prev, saving: true }));
    try {
      await quickTimeEntry({ collaborator_id: quickHours.collaboratorId, project_id: project.id, stage_id: quickHours.stageId, task_id: quickHours.taskId, hours_worked: quickHours.hours, description: quickHours.desc, entry_date: quickHours.entryDate });
      setQuickHours(prev => ({ ...prev, saving: false, success: true }));
      toast('success', 'Horas registradas!');
      window.dispatchEvent(new CustomEvent('hours-updated'));
      setTimeout(() => setQuickHours({ target: null, stageId: null, taskId: null, hours: 0, collaboratorId: 0, desc: '', entryDate: new Date().toISOString().slice(0, 10), saving: false, success: false }), 1200);
      load();
    } catch { setQuickHours(prev => ({ ...prev, saving: false })); toast('error', 'Erro ao registrar horas'); }
  };

  const changeStageStatus = async (stageId: number, newStatus: string) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'in_progress') payload.actual_start = today;
      if (newStatus === 'completed') payload.actual_end = today;
      await updateStage(stageId, payload);
      toast('success', `Status: ${STATUS_LABELS[newStatus] ?? newStatus}`);
      load();
    } catch { toast('error', 'Erro ao alterar status'); }
  };

  const changeTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'in_progress') payload.actual_start = today;
      if (newStatus === 'completed') payload.actual_end = today;
      await updateTask(taskId, payload);
      toast('success', `Status: ${STATUS_LABELS[newStatus] ?? newStatus}`);
      load();
    } catch { toast('error', 'Erro ao alterar status'); }
  };

  const changeProjectStatus = async (newStatus: string) => {
    if (!project) return;

    if (project.status === 'planning' && newStatus === 'in_progress') {
      const stages = project.stages ?? [];
      if (stages.length === 0) {
        toast('error', 'O projeto precisa ter ao menos uma etapa para iniciar.');
        return;
      }
      const incomplete: string[] = [];
      for (const s of stages) {
        const validTasks = (s.tasks ?? []).filter(
          t => t.planned_start && t.planned_end && t.estimated_hours > 0
        );
        if (validTasks.length === 0) incomplete.push(s.name);
      }
      if (incomplete.length > 0) {
        const names = incomplete.slice(0, 3).map(n => `"${n}"`).join(', ');
        const extra = incomplete.length > 3 ? ` e mais ${incomplete.length - 3}` : '';
        toast('error', `Cada etapa precisa de ao menos 1 tarefa com datas e horas estimadas. Pendente em: ${names}${extra}`);
        return;
      }
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'in_progress') payload.actual_start = today;
      if (newStatus === 'completed') payload.actual_end = today;
      await updateProject(project.id, payload);
      toast('success', `Status: ${STATUS_LABELS[newStatus] ?? newStatus}`);
      load();
    } catch { toast('error', 'Erro ao alterar status'); }
  };

  const filterTask = (task: Task) => {
    if (taskFilterStatus && task.status !== taskFilterStatus) return false;
    if (taskFilterPriority && task.priority !== taskFilterPriority) return false;
    if (taskFilterCollab && !task.collaborators.some(c => c.id === taskFilterCollab)) return false;
    return true;
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { const [p, c] = await Promise.all([getProject(Number(id)), getCollaborators()]); setProject(p); setCollabs(c); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('hours-updated', handler);
    return () => window.removeEventListener('hours-updated', handler);
  }, [load]);

  const loadActivity = useCallback(async () => {
    if (!id) return;
    const [acts, comms] = await Promise.all([getActivities({ project_id: Number(id), limit: 50 }), getComments({ project_id: Number(id) })]);
    setActivities(acts); setComments(comms);
  }, [id]);

  useEffect(() => { if (tab === 'activity') loadActivity(); }, [tab, loadActivity]);

  useEffect(() => {
    if (!timer.running || timer.paused) return;
    const interval = setInterval(() => setTimer(prev => ({ ...prev, elapsed: prev.pausedElapsed + Date.now() - prev.startTime })), 1000);
    return () => clearInterval(interval);
  }, [timer.running, timer.paused]);

  const startTimer = (stageId: number | null, taskId: number | null, taskName: string = '') => {
    if (currentUser?.system_role !== 'analyst') return;
    setTimer({ running: true, paused: false, stageId, taskId, taskName, collaboratorId: currentUser?.id ?? 0, startTime: Date.now(), elapsed: 0, pausedElapsed: 0, desc: '' });
  };

  const pauseTimer = () => {
    setTimer(prev => ({ ...prev, paused: true, pausedElapsed: prev.elapsed }));
  };

  const resumeTimer = () => {
    setTimer(prev => ({ ...prev, paused: false, startTime: Date.now() }));
  };

  const stopTimer = async () => {
    if (!project || !timer.running) return;
    const hours = Math.round((timer.elapsed / 3600000) * 100) / 100;
    if (hours >= 0.01 && timer.collaboratorId) {
      await quickTimeEntry({ collaborator_id: timer.collaboratorId, project_id: project.id, stage_id: timer.stageId, task_id: timer.taskId, hours_worked: Math.max(hours, 0.1), description: timer.desc || 'Timer automático' });
      toast('success', `${Math.max(hours, 0.1).toFixed(2)}h registradas!`);
      window.dispatchEvent(new CustomEvent('hours-updated'));
      load();
    }
    setTimer({ running: false, paused: false, stageId: null, taskId: null, taskName: '', collaboratorId: 0, startTime: 0, elapsed: 0, pausedElapsed: 0, desc: '' });
  };

  const formatTimer = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60); const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleExpand = (stageId: number) => { setExpanded(prev => { const s = new Set(prev); s.has(stageId) ? s.delete(stageId) : s.add(stageId); return s; }); };

  const handleStageDragStart = (e: React.DragEvent, stageId: number) => {
    setDraggingStageId(stageId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleStageDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleStageDrop = async (e: React.DragEvent, targetStageId: number) => {
    e.preventDefault();
    if (!draggingStageId || draggingStageId === targetStageId || !project) return;
    const ids = project.stages.map(s => s.id);
    const fromIdx = ids.indexOf(draggingStageId);
    const toIdx = ids.indexOf(targetStageId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggingStageId);
    setDraggingStageId(null);
    await bulkReorderStages(project.id, ids);
    toast('success', 'Ordem atualizada!');
    load();
  };

  const openEditProject = () => {
    if (!project) return;
    setProjForm({
      name: project.name,
      complexity: project.complexity ?? 'medium',
      criticality: project.criticality ?? 'medium',
      scope: project.scope ?? 'medium',
      collaborator_ids: project.collaborators.map(c => c.id),
    });
    setEditProject(true);
  };

  const saveProject = async () => {
    if (!project) return;
    await updateProject(project.id, {
      name: projForm.name,
      complexity: projForm.complexity,
      criticality: projForm.criticality,
      scope: projForm.scope,
      collaborator_ids: projForm.collaborator_ids,
    });
    setEditProject(false);
    toast('success', 'Projeto atualizado!');
    load();
  };

  const handleDeleteProject = () => {
    if (!project) return;
    showConfirm({
      title: 'Excluir projeto',
      description: `"${project.name}" será removido permanentemente.`,
      details: ['Todas as etapas, tarefas e apontamentos de horas serão perdidos.', 'Esta ação não pode ser desfeita.'],
      confirmLabel: 'Excluir',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        await deleteProject(project.id);
        toast('success', 'Projeto excluído.');
        navigate('/projects');
      },
    });
  };

  const openNewStage = () => {
    setStageForm({ name: '', description: '', status: 'pending', order_index: project?.stages.length ?? 0, planned_start: '', actual_start: '', planned_end: '', actual_end: '', replanned_start: '', replanned_end: '', estimated_hours: 0, collaborator_ids: [] });
    setStageModal({ open: true, editing: null });
  };
  const openEditStage = (s: Stage) => {
    setStageForm({ name: s.name, description: s.description, status: s.status, order_index: s.order_index, planned_start: s.planned_start ?? '', actual_start: s.actual_start ?? '', planned_end: s.planned_end ?? '', actual_end: s.actual_end ?? '', replanned_start: s.replanned_start ?? '', replanned_end: s.replanned_end ?? '', estimated_hours: s.estimated_hours, collaborator_ids: s.collaborators.map(c => c.id) });
    setStageModal({ open: true, editing: s });
  };
  const saveStage = async () => {
    const isEditing = !!stageModal.editing;
    if (!isEditing) {
      if (!stageForm.name.trim()) { toast('error', 'Nome da etapa é obrigatório.'); return; }
    }
    const payload: Record<string, unknown> = {};
    try {
      if (isEditing) {
        const stageLocked = project?.status !== 'planning';
        payload.name = stageForm.name;
        payload.description = stageForm.description;
        payload.status = stageForm.status;
        payload.order_index = stageForm.order_index;
        payload.collaborator_ids = stageForm.collaborator_ids;
        if (!stageLocked) {
          payload.planned_start = stageForm.planned_start || null;
          payload.planned_end = stageForm.planned_end || null;
        }
        payload.replanned_start = stageForm.replanned_start || null;
        payload.replanned_end = stageForm.replanned_end || null;
        const today = new Date().toISOString().slice(0, 10);
        if (stageForm.status === 'in_progress' && !stageModal.editing!.actual_start) payload.actual_start = today;
        if (stageForm.status === 'completed' && !stageModal.editing!.actual_end) payload.actual_end = today;
        await updateStage(stageModal.editing!.id, payload);
      }
      else { payload.name = stageForm.name; payload.description = stageForm.description; payload.order_index = stageForm.order_index; payload.planned_start = stageForm.planned_start || null; payload.planned_end = stageForm.planned_end || null; payload.estimated_hours = stageForm.estimated_hours; payload.collaborator_ids = stageForm.collaborator_ids; await createStage(project!.id, payload); }
      setStageModal({ open: false, editing: null });
      toast('success', isEditing ? 'Etapa atualizada!' : 'Etapa criada!');
      load();
    } catch (e) { toast('error', e instanceof Error ? e.message : 'Erro ao salvar etapa'); }
  };
  const handleDeleteStage = async (stageId: number) => {
    const stage = project?.stages.find(s => s.id === stageId);
    if (stage && stage.tasks.length > 0) {
      toast('error', `Não é possível excluir a etapa "${stage.name}" pois ela possui ${stage.tasks.length} tarefa(s). Exclua as tarefas primeiro.`);
      return;
    }
    showConfirm({
      title: 'Excluir etapa',
      description: `"${stage?.name ?? 'Etapa'}" será removida permanentemente.`,
      confirmLabel: 'Excluir',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        await deleteStage(stageId);
        toast('success', 'Etapa excluída.');
        load();
      },
    });
    return;
  };

  const openNewTask = (stageId: number) => {
    const stage = project?.stages.find(s => s.id === stageId);
    setTaskForm({ name: '', description: '', status: 'pending', priority: 'medium', order_index: stage?.tasks.length ?? 0, planned_start: '', actual_start: '', planned_end: '', actual_end: '', replanned_start: '', replanned_end: '', estimated_hours: 0, collaborator_ids: [], collaborator_id: 0 });
    setTaskModal({ open: true, stageId, editing: null });
  };
  const openEditTask = (t: Task) => {
    setTaskForm({ name: t.name, description: t.description, status: t.status, priority: t.priority, order_index: t.order_index, planned_start: t.planned_start ?? '', actual_start: t.actual_start ?? '', planned_end: t.planned_end ?? '', actual_end: t.actual_end ?? '', replanned_start: t.replanned_start ?? '', replanned_end: t.replanned_end ?? '', estimated_hours: t.estimated_hours, collaborator_ids: t.collaborators.map(c => c.id), collaborator_id: t.collaborators.length > 0 ? t.collaborators[0].id : 0 });
    setTaskModal({ open: true, stageId: t.stage_id, editing: t });
  };
  const saveTask = async () => {
    const isEditing = !!taskModal.editing;
    if (!isEditing) {
      if (!taskForm.name.trim()) { toast('error', 'Nome da tarefa é obrigatório.'); return; }
      if (!taskForm.planned_start || !taskForm.planned_end) { toast('error', 'Datas planejadas (início e término) são obrigatórias.'); return; }
      if (!taskForm.estimated_hours || taskForm.estimated_hours <= 0) { toast('error', 'Horas estimadas são obrigatórias.'); return; }
      if (!taskForm.collaborator_id) { toast('error', 'Selecione o responsável.'); return; }
    }
    const payload: Record<string, unknown> = {};
    try {
      if (isEditing) {
        const projectLocked = project?.status !== 'planning';
        payload.name = taskForm.name;
        payload.description = taskForm.description;
        payload.status = taskForm.status;
        payload.priority = taskForm.priority;
        payload.order_index = taskForm.order_index;
        payload.estimated_hours = taskForm.estimated_hours;
        payload.collaborator_ids = taskForm.collaborator_id ? [taskForm.collaborator_id] : taskForm.collaborator_ids;
        if (!projectLocked) {
          payload.planned_start = taskForm.planned_start || null;
          payload.planned_end = taskForm.planned_end || null;
        }
        payload.replanned_start = taskForm.replanned_start || null;
        payload.replanned_end = taskForm.replanned_end || null;
        const today = new Date().toISOString().slice(0, 10);
        if (taskForm.status === 'in_progress' && !taskModal.editing!.actual_start) payload.actual_start = today;
        if (taskForm.status === 'completed' && !taskModal.editing!.actual_end) payload.actual_end = today;
        await updateTask(taskModal.editing!.id, payload);
      }
      else { payload.name = taskForm.name; payload.description = taskForm.description; payload.priority = taskForm.priority; payload.order_index = taskForm.order_index; payload.planned_start = taskForm.planned_start || null; payload.planned_end = taskForm.planned_end || null; payload.estimated_hours = taskForm.estimated_hours; payload.collaborator_ids = [taskForm.collaborator_id]; await createTask(taskModal.stageId, payload); }
      setTaskModal({ open: false, stageId: 0, editing: null });
      toast('success', isEditing ? 'Tarefa atualizada!' : 'Tarefa criada!');
      load();
    } catch (e) { toast('error', e instanceof Error ? e.message : 'Erro ao salvar tarefa'); }
  };
  const handleDeleteTask = (taskId: number) => {
    showConfirm({
      title: 'Excluir tarefa',
      description: 'Esta tarefa será removida permanentemente junto com seus apontamentos.',
      confirmLabel: 'Excluir',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        await deleteTask(taskId);
        toast('success', 'Tarefa excluída.');
        load();
      },
    });
  };

  const handleDragStart = (taskId: number, stageId: number) => { setDraggingTask({ taskId, stageId }); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (newStatus: string) => {
    if (!draggingTask) return;
    const today = new Date().toISOString().slice(0, 10);
    const payload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'in_progress') payload.actual_start = today;
    if (newStatus === 'completed') payload.actual_end = today;
    await updateTask(draggingTask.taskId, payload);
    setDraggingTask(null); toast('success', 'Status atualizado!'); load();
  };

  const handleSubmitComment = async () => {
    if (!project || !commentText.trim() || !commentAuthor.trim()) return;
    await createComment({ project_id: project.id, author_name: commentAuthor, content: commentText });
    setCommentText(''); toast('success', 'Comentário adicionado!'); loadActivity();
  };

  const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none transition-all bg-white';
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';
  const btnPrimary = 'px-5 py-2.5 bg-[#e83948] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#e83948]/25 transition-all hover:bg-[#d42d3b]';
  const btnSecondary = 'px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4a7fa5] to-[#c7b475] animate-spin" style={{ animationDuration: '0.8s' }} />
    </div>
  );
  if (!project) return <div className="text-center py-12 text-slate-400">Projeto não encontrado</div>;

  const totalEstStages = project.stages.reduce((s, st) => s + st.estimated_hours, 0);
  const totalActStages = project.stages.reduce((s, st) => s + st.actual_hours, 0);
  const allTasks = project.stages.flatMap(s => s.tasks.map(t => ({ ...t, stageName: s.name, stageId: s.id })));

  return (
    <div className="space-y-6">
      {/* Timer bar */}
      {timer.running && (
        <div className={`fixed top-0 left-0 right-0 z-50 text-white px-6 py-3 shadow-2xl transition-all ${timer.paused ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30' : 'bg-gradient-to-r from-[#2c5372] via-[#4a7fa5] to-[#6d9dc0] shadow-[#2c5372]/30'}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${timer.paused ? 'bg-white/60' : 'bg-white animate-pulse'}`} />
              <span className="font-mono text-2xl font-bold tracking-widest tabular-nums">{formatTimer(timer.elapsed)}</span>
            </div>

            <div className="h-6 w-px bg-white/20" />

            <div className="flex flex-col">
              <span className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{timer.paused ? 'Pausado' : 'Executando'}</span>
              {timer.taskName && <span className="text-xs font-semibold truncate max-w-[200px]">{timer.taskName}</span>}
            </div>

            <div className="h-6 w-px bg-white/20" />

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold border border-white/30">
                {currentUser?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <span className="text-xs font-medium">{currentUser?.name ?? 'Usuário'}</span>
            </div>

            <div className="flex-1" />

            <input type="text" placeholder="Descrição..." className="bg-white/15 text-white placeholder-white/40 text-xs px-3 py-2 rounded-lg max-w-[200px] border border-white/20" value={timer.desc} onChange={e => setTimer(prev => ({ ...prev, desc: e.target.value }))} />

            <div className="flex items-center gap-2">
              {timer.paused ? (
                <button onClick={resumeTimer} className="flex items-center gap-1.5 px-4 py-2 bg-white text-amber-600 rounded-xl text-sm font-bold hover:bg-amber-50 transition-all shadow-lg">
                  <Play size={14} /> Retomar
                </button>
              ) : (
                <button onClick={pauseTimer} className="flex items-center gap-1.5 px-4 py-2 bg-white/15 text-white rounded-xl text-sm font-bold hover:bg-white/25 transition-all border border-white/20">
                  <Pause size={14} /> Pausar
                </button>
              )}
              <button onClick={stopTimer} className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all shadow-lg">
                <Square size={14} /> Parar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start gap-4 ${timer.running ? 'mt-12' : ''}`}>
        <button onClick={() => navigate('/projects')} className="p-2.5 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 hover:shadow-sm mt-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
            <InlineStatus status={project.status} onChange={changeProjectStatus} type="project" />
          </div>
          {project.description && <p className="text-slate-500 mt-1.5">{project.description}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {project.complexity && <span className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold ${CLASSIFICATION_COLORS[project.complexity]}`}>Complexidade: {CLASSIFICATION_LABELS[project.complexity]}</span>}
            {project.criticality && <span className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold ${CLASSIFICATION_COLORS[project.criticality]}`}>Criticidade: {CLASSIFICATION_LABELS[project.criticality]}</span>}
            {project.scope && <span className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold ${CLASSIFICATION_COLORS[project.scope]}`}>Abrangência: {CLASSIFICATION_LABELS[project.scope]}</span>}
          </div>
        </div>
        {!isViewer && (
          <div className="flex gap-1.5">
            <button onClick={openEditProject} className="p-2.5 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-[#2c5372] hover:shadow-sm"><Pencil size={18} /></button>
            <button onClick={handleDeleteProject} className="p-2.5 hover:bg-red-50 rounded-xl transition-all text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
          </div>
        )}
      </div>

      {/* Health banner */}
      <ProjectHealthBanner project={project} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            icon: Calendar, iconBg: 'from-[#4a7fa5] to-[#2c5372]',
            title: 'Período',
            content: <>
              <p className="font-semibold text-sm text-slate-800">{formatDateHuman(project.planned_start) || '—'} {'\u2192'} {formatDateHuman(project.planned_end) || '—'}</p>
              {project.actual_start && <p className="text-xs text-slate-400 mt-1">Real: {formatDateHuman(project.actual_start)} {'\u2192'} {formatDateHuman(project.actual_end) || 'em andamento'}</p>}
            </>,
          },
          {
            icon: Clock, iconBg: 'from-amber-400 to-orange-500',
            title: 'Horas',
            content: <HoursDisplay estimated={project.estimated_hours} actual={project.actual_hours} />,
          },
          (() => {
            const allCollabMap = new Map<number, { id: number; name: string }>();
            for (const c of project.collaborators) allCollabMap.set(c.id, c);
            for (const s of project.stages ?? []) {
              for (const c of s.collaborators ?? []) allCollabMap.set(c.id, c);
              for (const t of s.tasks ?? [])
                for (const c of t.collaborators ?? []) allCollabMap.set(c.id, c);
            }
            const allMembers = Array.from(allCollabMap.values());
            return {
              icon: Users, iconBg: 'from-violet-400 to-purple-500',
              title: 'Equipe',
              content: <>
                <p className="text-2xl font-bold text-slate-800">{allMembers.length}</p>
                {allMembers.length > 0 && (
                  <div className="flex -space-x-2 mt-2">
                    {allMembers.slice(0, 5).map(c => (
                      <div key={c.id} className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4a7fa5] to-[#c7b475] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white" title={c.name}>
                        {c.name.charAt(0)}
                      </div>
                    ))}
                    {allMembers.length > 5 && <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center border-2 border-white">+{allMembers.length - 5}</div>}
                  </div>
                )}
              </>,
            };
          })(),
          {
            icon: Layers, iconBg: 'from-emerald-400 to-teal-500',
            title: 'Progresso',
            content: <><p className="text-2xl font-bold bg-gradient-to-r from-[#2c5372] to-[#c7b475] bg-clip-text text-transparent">{project.progress}%</p><ProgressBar value={project.progress} className="mt-2" /></>,
          },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${card.iconBg} flex items-center justify-center`}>
                <card.icon size={14} className="text-white" />
              </div>
              <span className="font-medium">{card.title}</span>
            </div>
            {card.content}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-1.5 shadow-sm inline-flex gap-1">
        {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === key
                ? 'bg-[#2c5372] text-white shadow-md shadow-[#2c5372]/25'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* TAB: Stages */}
      {tab === 'stages' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Etapas ({project.stages.length})</h2>
            {!isViewer && <button onClick={openNewStage} className={btnPrimary + ' flex items-center gap-2'}><Plus size={16} /> Nova Etapa</button>}
          </div>
          {/* Filtros de tarefas */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtrar tarefas:</span>
            <select className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" value={taskFilterStatus} onChange={e => setTaskFilterStatus(e.target.value)}>
              <option value="">Todos status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" value={taskFilterPriority} onChange={e => setTaskFilterPriority(e.target.value)}>
              <option value="">Todas prioridades</option>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" value={taskFilterCollab} onChange={e => setTaskFilterCollab(Number(e.target.value))}>
              <option value={0}>Todos responsáveis</option>
              {collabs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {(taskFilterStatus || taskFilterPriority || taskFilterCollab > 0) && (
              <button onClick={() => { setTaskFilterStatus(''); setTaskFilterPriority(''); setTaskFilterCollab(0); }} className="text-xs text-[#4a7fa5] font-semibold hover:underline">Limpar</button>
            )}
          </div>
          {project.stages.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-12 text-center">
              <Layers size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400">Nenhuma etapa cadastrada</p>
              <button onClick={openNewStage} className="text-[#4a7fa5] font-medium text-sm mt-2 hover:underline">Criar primeira etapa</button>
            </div>
          ) : (
            <div className="space-y-3">
              {project.stages.map((stage, si) => {
                const stageProgress = stage.tasks.length > 0 ? Math.round((stage.tasks.filter(t => t.status === 'completed').length / stage.tasks.length) * 100) : (stage.status === 'completed' ? 100 : 0);
                const stageBorderColor = stage.status === 'completed' ? 'border-l-emerald-500' : stage.status === 'in_progress' ? 'border-l-amber-500' : 'border-l-slate-300';
                const stageNumberBg = stage.status === 'completed' ? 'from-emerald-400 to-teal-500' : stage.status === 'in_progress' ? 'from-amber-400 to-orange-500' : 'from-slate-300 to-slate-400';

                const taskStarts = stage.tasks.map(t => t.planned_start).filter(Boolean) as string[];
                const taskEnds = stage.tasks.map(t => t.planned_end).filter(Boolean) as string[];
                const derivedStart = taskStarts.length > 0 ? taskStarts.sort()[0] : stage.planned_start;
                const derivedEnd = taskEnds.length > 0 ? taskEnds.sort().reverse()[0] : stage.planned_end;
                const allTasksDone = stage.tasks.length > 0 && stage.tasks.every(t => t.status === 'completed');
                const lastActualEnd = allTasksDone
                  ? (stage.tasks.map(t => t.actual_end).filter(Boolean) as string[]).sort().reverse()[0] ?? stage.actual_end
                  : null;

                return (
                <div key={stage.id} draggable onDragStart={e => handleStageDragStart(e, stage.id)} onDragOver={handleStageDragOver} onDrop={e => handleStageDrop(e, stage.id)}
                  className={`bg-white rounded-2xl border border-slate-200/60 border-l-4 ${stageBorderColor} shadow-sm animate-fade-in hover:shadow-md transition-all ${draggingStageId === stage.id ? 'opacity-50' : ''}`} style={{ animationDelay: `${si * 40}ms` }}>
                  <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => toggleExpand(stage.id)}>
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stageNumberBg} flex items-center justify-center shrink-0 shadow-sm cursor-grab active:cursor-grabbing`}>
                      <span className="text-white text-xs font-black">{si + 1}</span>
                    </div>
                    <RichTooltip data={{ name: stage.name, status: stage.status, planned_start: derivedStart, planned_end: derivedEnd, estimated_hours: stage.estimated_hours, actual_hours: stage.actual_hours, collaborators: stage.collaborators, extra: [{ label: 'Tarefas', value: `${stage.tasks.filter(t => t.status === 'completed').length}/${stage.tasks.length} concluídas` }] }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{stage.name}</span>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                          stage.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          stage.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {STATUS_LABELS[stage.status] ?? stage.status}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {stage.tasks.filter(t => t.status === 'completed').length}/{stage.tasks.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap">
                        {(derivedStart || derivedEnd) && (
                          <span className="flex items-center gap-1 text-blue-400" title="Data prevista">
                            <Calendar size={10} />
                            <span className="text-slate-400">Prevista:</span>
                            <span className="font-medium">{formatDateHuman(derivedStart) || '—'} → {formatDateHuman(derivedEnd) || '—'}</span>
                          </span>
                        )}
                        {stage.replanned_end && (
                          <span className="flex items-center gap-1 text-amber-500 font-medium" title="Replanejado">
                            ↳ {formatDateHuman(stage.replanned_start || derivedStart)} → {formatDateHuman(stage.replanned_end)}
                          </span>
                        )}
                        {!allTasksDone && stage.actual_start && (
                          <span className="flex items-center gap-1 text-emerald-500" title="Início real">
                            ✓ <span className="text-slate-400">Real:</span>
                            <span className="font-medium">{formatDateHuman(stage.actual_start)} → em andamento</span>
                          </span>
                        )}
                        {allTasksDone && lastActualEnd && (
                          <span className="flex items-center gap-1 text-emerald-500 font-medium" title="Data executada">
                            ✓ <span className="text-slate-400">Real:</span>
                            {formatDateHuman(stage.actual_start)} → {formatDateHuman(lastActualEnd)}
                          </span>
                        )}
                        {stage.collaborators.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {stage.collaborators.slice(0, 3).map(c => (
                              <div key={c.id} className="w-5 h-5 rounded-full bg-gradient-to-br from-[#4a7fa5] to-[#c7b475] text-white text-[8px] font-bold flex items-center justify-center border border-white" title={c.name}>{c.name.charAt(0)}</div>
                            ))}
                            {stage.collaborators.length > 3 && <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 text-[8px] font-bold flex items-center justify-center border border-white">+{stage.collaborators.length - 3}</div>}
                          </div>
                        )}
                      </div>
                      {stage.tasks.length > 0 && (
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${stageProgress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#4a7fa5] to-[#c7b475]'}`} style={{ width: `${stageProgress}%` }} />
                        </div>
                      )}
                    </div>
                    </RichTooltip>
                    <div className="w-48 hidden md:block" onClick={e => e.stopPropagation()}>
                      <HoursDisplay estimated={stage.estimated_hours} actual={stage.actual_hours} showBar={false} />
                    </div>
                    {!isViewer && (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openNewTask(stage.id)} className="flex items-center gap-1 px-2 py-1.5 hover:bg-[#eef3f8] rounded-lg text-slate-500 hover:text-[#2c5372] transition-all text-[11px] font-medium" title="Nova tarefa"><Plus size={14} /><span className="hidden lg:inline">Tarefa</span></button>
                        <button onClick={() => openEditStage(stage)} className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-all text-[11px] font-medium" title="Editar etapa"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteStage(stage.id)} className="flex items-center gap-1 px-2 py-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-500 transition-all text-[11px] font-medium" title="Excluir etapa"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>

                  {quickHours.target === `stage-${stage.id}` && (
                    <div className="border-t bg-gradient-to-r from-emerald-50 to-teal-50/50 px-5 py-3" onClick={e => e.stopPropagation()}>
                      {quickHours.success ? (
                        <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm justify-center py-1"><Check size={16} /> Registrado!</div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">{currentUser?.name ?? 'Usuário'}</span>
                          <input type="date" className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" value={quickHours.entryDate} onChange={e => setQuickHours(prev => ({ ...prev, entryDate: e.target.value }))} required title="Data do lançamento" />
                          <HoursInput value={quickHours.hours} onChange={v => setQuickHours(prev => ({ ...prev, hours: v }))} className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" compact />
                          <input type="text" placeholder="Descrição (opcional)" className="flex-1 min-w-[100px] px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" value={quickHours.desc} onChange={e => setQuickHours(prev => ({ ...prev, desc: e.target.value }))} />
                          <button disabled={quickHours.saving || !quickHours.hours || !quickHours.entryDate} onClick={submitQuickHours} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm">{quickHours.saving ? '...' : 'Salvar'}</button>
                          <button onClick={() => setQuickHours(prev => ({ ...prev, target: null }))} className="px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white rounded-lg transition-colors">Cancelar</button>
                        </div>
                      )}
                    </div>
                  )}

                  {expanded.has(stage.id) && stage.tasks.length > 0 && (
                    <div className="border-t border-slate-100">
                      {stage.tasks.filter(filterTask).map(task => (
                        <div key={task.id}>
                          <div className={`px-5 py-3 pl-14 flex items-center gap-3 border-b border-slate-50 last:border-b-0 hover:bg-[#eef3f8]/30 transition-colors ${task.status === 'completed' ? 'opacity-60' : ''}`}>
                            <RichTooltip data={{ name: task.name, status: task.status, planned_start: task.planned_start, planned_end: task.planned_end, estimated_hours: task.estimated_hours, actual_hours: task.actual_hours, collaborators: task.collaborators }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-semibold ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.name}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${task.priority === 'high' || task.priority === 'critical' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                                  {PRIORITY_LABELS[task.priority] ?? task.priority}
                                </span>
                                {task.collaborators.length > 0 && <span className="flex items-center gap-1 text-[10px] text-slate-400"><Users size={10} />{task.collaborators.map(c => c.name).join(', ')}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap">
                                {task.planned_start && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50/60 rounded-md border border-blue-100/60" title="Data planejada">
                                    <Calendar size={10} className="text-blue-400" />
                                    <span className="text-blue-400 font-semibold">Prevista:</span>
                                    <span className="font-medium text-blue-600">{formatDateHuman(task.planned_start)} → {formatDateHuman(task.planned_end)}</span>
                                  </span>
                                )}
                                {task.replanned_end && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50/60 rounded-md border border-amber-100/60" title="Data replanejada">
                                    <span className="text-amber-500 font-semibold">Replanejada:</span>
                                    <span className="font-medium text-amber-600">{formatDateHuman(task.replanned_start || task.planned_start)} → {formatDateHuman(task.replanned_end)}</span>
                                    {task.status === 'in_progress' && <span className="text-amber-400">(em andamento)</span>}
                                  </span>
                                )}
                                {task.actual_start && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50/60 rounded-md border border-emerald-100/60" title="Data real de execução">
                                    <span className="text-emerald-500 font-semibold">Real:</span>
                                    <span className="font-medium text-emerald-600">
                                      {formatDateHuman(task.actual_start)} → {task.actual_end ? formatDateHuman(task.actual_end) : 'em andamento'}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                            </RichTooltip>
                            <div className="w-40 hidden md:block"><HoursDisplay estimated={task.estimated_hours} actual={task.actual_hours} showBar={false} /></div>
                            <div className="flex gap-1.5 items-center shrink-0">
                              {/* === STATUS ACTIONS === */}
                              {!isViewer && task.status === 'pending' && (
                                <button onClick={() => changeTaskStatus(task.id, 'in_progress')}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2c5372] text-white rounded-lg text-[11px] font-bold hover:bg-[#1a3550] transition-all shadow-sm shadow-[#2c5372]/20"
                                  title="Iniciar tarefa — marca a data real de início">
                                  <Play size={12} /> Iniciar
                                </button>
                              )}
                              {!isViewer && task.status === 'in_progress' && (
                                <>
                                  <button onClick={() => changeTaskStatus(task.id, 'completed')}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-500/20"
                                    title="Concluir tarefa — marca a data real de conclusão">
                                    <Check size={12} /> Concluir
                                  </button>
                                  <button onClick={() => showConfirm({
                                      title: 'Voltar tarefa para Pendente',
                                      description: 'A tarefa retornará ao status Pendente.',
                                      details: ['A data de início real será removida.', 'A data de conclusão real será removida.'],
                                      confirmLabel: 'Voltar para Pendente',
                                      variant: 'warning',
                                      onConfirm: () => { closeConfirm(); changeTaskStatus(task.id, 'pending'); },
                                    })}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[11px] font-semibold hover:bg-amber-100 transition-all border border-amber-200/60"
                                    title="Voltar para Pendente — remove a data real de início">
                                    <Pause size={11} /> Voltar
                                  </button>
                                </>
                              )}
                              {!isViewer && task.status === 'completed' && (
                                <button onClick={() => showConfirm({
                                    title: 'Reabrir tarefa',
                                    description: 'A tarefa voltará para Em Andamento.',
                                    details: ['A data de conclusão real será removida.', 'A data de início real será mantida.'],
                                    confirmLabel: 'Reabrir',
                                    variant: 'reopen',
                                    onConfirm: () => { closeConfirm(); changeTaskStatus(task.id, 'in_progress'); },
                                  })}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition-all border border-amber-200/60"
                                  title="Reabrir — remove a data de conclusão, mantém a de início">
                                  <Play size={12} /> Reabrir
                                </button>
                              )}

                              {/* === REPLAN (in_progress only) === */}
                              {!isViewer && task.status === 'in_progress' && (
                                <>
                                  <div className="w-px h-5 bg-slate-200" />
                                  <button onClick={() => openEditTask(task)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50/80 text-amber-600 rounded-lg text-[11px] font-semibold hover:bg-amber-100 transition-all border border-amber-200/40"
                                    title="Replanejar — ajustar datas e horas estimadas">
                                    <Calendar size={11} /> Replanejar
                                  </button>
                                </>
                              )}

                              {/* === TIMER & HOURS (analyst + in_progress) === */}
                              {currentUser?.system_role === 'analyst' && task.status === 'in_progress' && (
                                <>
                                  <div className="w-px h-5 bg-slate-200" />
                                  <button onClick={() => startTimer(stage.id, task.id, task.name)}
                                    className="p-1.5 hover:bg-violet-50 rounded-lg text-slate-500 hover:text-violet-600 transition-all" title="Iniciar timer">
                                    <Play size={13} />
                                  </button>
                                  <button onClick={() => openQuickHours(`task-${task.id}`, stage.id, task.id)}
                                    className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-500 hover:text-emerald-600 transition-all" title="Lançar horas">
                                    <Timer size={13} />
                                  </button>
                                </>
                              )}

                              {/* === EDIT & DELETE === */}
                              {!isViewer && (
                                <>
                                  <div className="w-px h-5 bg-slate-200" />
                                  <button onClick={() => openEditTask(task)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#2c5372] transition-all" title="Editar tarefa">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => handleDeleteTask(task.id)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-500 transition-all" title="Excluir tarefa">
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {quickHours.target === `task-${task.id}` && (
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 px-5 py-2.5 pl-14 border-b border-slate-50" onClick={e => e.stopPropagation()}>
                              {quickHours.success ? (
                                <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm py-0.5"><Check size={16} /> Registrado!</div>
                              ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">{currentUser?.name ?? 'Usuário'}</span>
                                  <input type="date" className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" value={quickHours.entryDate} onChange={e => setQuickHours(prev => ({ ...prev, entryDate: e.target.value }))} required title="Data do lançamento" />
                                  <HoursInput value={quickHours.hours} onChange={v => setQuickHours(prev => ({ ...prev, hours: v }))} className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" compact />
                                  <input type="text" placeholder="Descrição (opcional)" className="flex-1 min-w-[100px] px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" value={quickHours.desc} onChange={e => setQuickHours(prev => ({ ...prev, desc: e.target.value }))} />
                                  <button disabled={quickHours.saving || !quickHours.hours || !quickHours.entryDate} onClick={submitQuickHours} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm">{quickHours.saving ? '...' : 'Salvar'}</button>
                                  <button onClick={() => setQuickHours(prev => ({ ...prev, target: null }))} className="px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white rounded-lg transition-colors">Cancelar</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {expanded.has(stage.id) && stage.tasks.length === 0 && (
                    <div className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-400">
                      Nenhuma tarefa nesta etapa.
                      <button onClick={() => openNewTask(stage.id)} className="ml-2 text-[#4a7fa5] font-semibold hover:underline">Criar tarefa</button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Kanban */}
      {tab === 'kanban' && (
        <div className="grid grid-cols-3 gap-5 min-h-[450px]">
          {KANBAN_COLUMNS.map(col => {
            const tasksInCol = allTasks.filter(t => t.status === col.key);
            const overdueCount = tasksInCol.filter(t => {
              const deadline = t.replanned_end || t.planned_end;
              return deadline && new Date(deadline + 'T00:00:00') < new Date() && t.status !== 'completed';
            }).length;
            const lateCompletedCount = col.key === 'completed' ? tasksInCol.filter(t => wasCompletedOnTime(t) === false).length : 0;
            return (
              <div key={col.key} className={`rounded-2xl ${col.bg} border border-slate-200/60 p-4`} onDragOver={handleDragOver} onDrop={() => handleDrop(col.key)}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className={`w-2 h-6 rounded-full bg-gradient-to-b ${col.gradient}`} />
                  <h3 className="font-bold text-sm text-slate-700">{col.label}</h3>
                  {overdueCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-lg animate-pulse">{overdueCount} atrasada{overdueCount > 1 ? 's' : ''}</span>}
                  {lateCompletedCount > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-lg">{lateCompletedCount} fora do prazo</span>}
                  <span className="ml-auto text-xs bg-white px-2.5 py-1 rounded-lg font-bold text-slate-500 shadow-sm">{tasksInCol.length}</span>
                </div>
                <div className="space-y-3">
                  {tasksInCol.map(task => {
                    const effectiveEnd = task.replanned_end || task.planned_end;
                    const isOverdue = effectiveEnd && new Date(effectiveEnd + 'T00:00:00') < new Date() && task.status !== 'completed';
                    const wasReplanned = !!task.replanned_end;
                    const daysOverdue = effectiveEnd ? Math.ceil((new Date().getTime() - new Date(effectiveEnd + 'T00:00:00').getTime()) / 86400000) : 0;
                    const onTime = wasCompletedOnTime(task);
                    const completedLate = onTime === false;
                    const daysLate = completedLate && task.actual_end && effectiveEnd ? Math.ceil((new Date(task.actual_end + 'T00:00:00').getTime() - new Date(effectiveEnd + 'T00:00:00').getTime()) / 86400000) : 0;

                    const cardBorder = isOverdue
                      ? 'border-red-300 hover:border-red-400 ring-1 ring-red-100'
                      : completedLate
                      ? 'border-amber-300 hover:border-amber-400'
                      : onTime === true
                      ? 'border-emerald-300 hover:border-emerald-400'
                      : 'border-slate-200/60 hover:border-[#b4cde0]';

                    const topAccent = isOverdue
                      ? 'bg-gradient-to-r from-red-400 to-rose-500'
                      : completedLate
                      ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                      : onTime === true
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                      : '';

                    return (
                      <div key={task.id} draggable onDragStart={() => handleDragStart(task.id, task.stageId)}
                        className={`bg-white rounded-xl border cursor-grab active:cursor-grabbing shadow-sm hover:shadow-lg transition-all duration-200 group ${cardBorder}`}>
                        {topAccent && <div className={`h-1 rounded-t-xl ${topAccent}`} />}
                        <div className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm group-hover:text-[#2c5372] transition-colors ${completedLate ? 'text-amber-700' : onTime === true ? 'text-emerald-700' : task.status === 'completed' ? 'text-slate-400' : 'text-slate-800'}`}>{task.name}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{task.stageName}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold shrink-0 ${task.priority === 'high' || task.priority === 'critical' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                              {PRIORITY_LABELS[task.priority] ?? task.priority}
                            </span>
                          </div>

                          {/* Dates: prazo vs entregue */}
                          <div className="mt-2.5 space-y-1 text-[11px]">
                            {/* Prazo line */}
                            {(task.planned_end || wasReplanned) && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 w-[42px] shrink-0">Prazo</span>
                                {task.planned_end && <span className={wasReplanned ? 'line-through text-slate-300' : 'text-slate-600'}>{formatDateHuman(task.planned_end)}</span>}
                                {wasReplanned && <><span className="text-slate-300">→</span><span className="text-amber-600 font-semibold">{formatDateHuman(task.replanned_end)}</span></>}
                              </div>
                            )}
                            {/* Entregue / execucao line */}
                            {(task.actual_end || task.actual_start) && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 w-[42px] shrink-0">{task.actual_end ? 'Feito' : 'Início'}</span>
                                <span className={`font-semibold ${completedLate ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {task.actual_end ? formatDateHuman(task.actual_end) : formatDateHuman(task.actual_start)}
                                </span>
                                {completedLate && <span className="text-[10px] text-amber-500 font-bold">(+{daysLate}d)</span>}
                                {onTime === true && <span className="text-[10px] text-emerald-500 font-bold">✓</span>}
                              </div>
                            )}
                          </div>

                          {/* Overdue for non-completed */}
                          {isOverdue && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-[10px] font-bold text-red-600">
                              <Clock size={9} /> {daysOverdue}d atrasado
                            </div>
                          )}

                          {/* Footer: avatars + hours */}
                          <div className="mt-3 flex items-center justify-between">
                            {task.collaborators.length > 0 ? (
                              <div className="flex -space-x-1.5">
                                {task.collaborators.slice(0, 3).map(c => (
                                  <div key={c.id} className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4a7fa5] to-[#c7b475] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white" title={c.name}>
                                    {c.name.charAt(0)}
                                  </div>
                                ))}
                                {task.collaborators.length > 3 && <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold flex items-center justify-center border-2 border-white">+{task.collaborators.length - 3}</div>}
                              </div>
                            ) : <div />}
                            {task.estimated_hours > 0 && (
                              <div className="text-[10px] text-slate-500">
                                <span className={task.actual_hours > task.estimated_hours ? 'text-red-500 font-bold' : ''}>{task.actual_hours.toFixed(1)}h</span>
                                <span className="text-slate-300 mx-0.5">/</span>
                                <span>{task.estimated_hours.toFixed(1)}h</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {tasksInCol.length === 0 && (
                    <div className="text-center text-xs text-slate-300 py-12 border-2 border-dashed border-slate-200 rounded-xl">Arraste tarefas aqui</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: Grid */}
      {tab === 'grid' && <GridView stages={project.stages} collabs={collabs} onReload={load} />}

      {/* TAB: Cronograma */}
      {tab === 'schedule' && <ScheduleView project={project} />}

      {/* TAB: Gantt */}
      {tab === 'gantt' && <GanttChart stages={project.stages} projectStart={project.planned_start} projectEnd={project.planned_end} baselines={project.baselines ?? []} />}

      {/* TAB: Hours */}
      {tab === 'hours' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-lg">Resumo de Horas por Etapa</h3>
          <div className="rounded-xl bg-gradient-to-r from-[#eef3f8] to-[#fdf9f1] p-4 flex items-center justify-between">
            <span className="font-bold text-indigo-800">Projeto Total</span>
            <HoursDisplay estimated={project.estimated_hours} actual={project.actual_hours} showBar={false} />
          </div>
          {project.stages.map(stage => (
            <div key={stage.id} className="space-y-1">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-700">{stage.name}</span>
                <HoursDisplay estimated={stage.estimated_hours} actual={stage.actual_hours} showBar={false} />
              </div>
              {stage.tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between py-2 px-6 text-sm hover:bg-slate-50/50 rounded-lg transition-colors">
                  <span className="text-slate-500 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" />{task.name}</span>
                  <HoursDisplay estimated={task.estimated_hours} actual={task.actual_hours} showBar={false} />
                </div>
              ))}
            </div>
          ))}
          <div className="border-t border-slate-200 pt-4 flex items-center justify-between font-bold text-slate-800">
            <span>Total Etapas</span>
            <span className="text-lg">{totalActStages.toFixed(1)}h / {totalEstStages.toFixed(1)}h</span>
          </div>
        </div>
      )}

      {/* TAB: Activity */}
      {tab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#eef3f8] flex items-center justify-center"><MessageSquare size={14} className="text-[#4a7fa5]" /></div>
              Comentários
            </h3>
            <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-slate-300 text-sm text-center py-8">Nenhum comentário</p>
              ) : comments.map(c => (
                <div key={c.id} className="bg-slate-50 rounded-xl p-3.5 animate-fade-in">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-slate-700">{c.author_name}</span>
                    <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-sm text-slate-600">{c.content}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <input type="text" placeholder="Seu nome" className={inputCls} value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)} />
              <div className="flex gap-2">
                <input type="text" placeholder="Escreva um comentário..." className={inputCls + ' flex-1'} value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSubmitComment(); }} />
                <button onClick={handleSubmitComment} disabled={!commentText.trim() || !commentAuthor.trim()} className="p-2.5 bg-[#e83948] text-white rounded-xl hover:bg-[#d42d3b] disabled:opacity-50 transition-all shadow-sm">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center"><Clock size={14} className="text-amber-500" /></div>
              Histórico de Atividades
            </h3>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {activities.length === 0 ? (
                <p className="text-slate-300 text-sm text-center py-8">Nenhuma atividade registrada</p>
              ) : activities.map(a => {
                const actionLabels: Record<string, string> = { created: 'criou', auto_start: 'iniciou automaticamente', auto_complete: 'completou automaticamente', commented: 'comentou em', status_changed: 'alterou status de' };
                const typeLabels: Record<string, string> = { project: 'projeto', stage: 'etapa', task: 'tarefa' };
                return (
                  <div key={a.id} className="flex gap-3 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 rounded-lg px-2 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-br from-[#4a7fa5] to-[#c7b475] mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm"><span className="font-semibold text-slate-700">{a.actor_name}</span>{' '}<span className="text-slate-500">{actionLabels[a.action] ?? a.action} {typeLabels[a.target_type] ?? a.target_type}</span>{a.target_name && <span className="font-semibold text-slate-700"> {a.target_name}</span>}</p>
                      {a.details && <p className="text-xs text-slate-400 mt-0.5">{a.details}</p>}
                      <p className="text-[10px] text-slate-300 mt-0.5">{new Date(a.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Project */}
      <Modal open={editProject} onClose={() => setEditProject(false)} title="Editar Projeto"
        subtitle={project.name} icon={<Pencil size={18} className="text-[#4a7fa5]" />} wide>
        <div className="space-y-5">
          <fieldset className="space-y-4">
            <legend className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Nome do Projeto</legend>
            <input className={inputCls} value={projForm.name} onChange={e => setProjForm({ ...projForm, name: e.target.value })} />
          </fieldset>

          <div className="border-t border-slate-100" />

          {/* Classification cards */}
          {([
            { key: 'complexity' as const, label: 'Complexidade', descriptions: COMPLEXITY_DESCRIPTIONS },
            { key: 'criticality' as const, label: 'Criticidade', descriptions: CRITICALITY_DESCRIPTIONS },
            { key: 'scope' as const, label: 'Abrangência', descriptions: SCOPE_DESCRIPTIONS },
          ]).map(({ key, label, descriptions }) => (
            <fieldset key={key} className="space-y-3">
              <legend className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">{label} *</legend>
              <div className="grid grid-cols-3 gap-2.5">
                {(['low', 'medium', 'high'] as ClassificationLevel[]).map(level => {
                  const selected = projForm[key] === level;
                  const colors = {
                    low: selected ? 'border-green-400 bg-green-50 ring-1 ring-green-400/30' : 'border-slate-200 hover:border-green-300 hover:bg-green-50/30',
                    medium: selected ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400/30' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30',
                    high: selected ? 'border-red-400 bg-red-50 ring-1 ring-red-400/30' : 'border-slate-200 hover:border-red-300 hover:bg-red-50/30',
                  };
                  const labelColors = {
                    low: selected ? 'text-green-700 bg-green-100' : 'text-green-600 bg-green-50',
                    medium: selected ? 'text-amber-700 bg-amber-100' : 'text-amber-600 bg-amber-50',
                    high: selected ? 'text-red-700 bg-red-100' : 'text-red-600 bg-red-50',
                  };
                  return (
                    <button key={level} type="button"
                      onClick={() => setProjForm({ ...projForm, [key]: level })}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${colors[level]}`}>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block mb-1.5 ${labelColors[level]}`}>
                        {CLASSIFICATION_LABELS[level]}
                      </span>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{descriptions[level]}</p>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="border-t border-slate-100" />

          <fieldset className="space-y-3">
            <legend className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Responsável</legend>
            <select className={inputCls} value={projForm.collaborator_ids[0] ?? 0} onChange={e => setProjForm({ ...projForm, collaborator_ids: Number(e.target.value) ? [Number(e.target.value)] : [] })}>
              <option value={0}>Selecione o responsável...</option>
              {collabs.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ''}</option>
              ))}
            </select>
          </fieldset>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button className={btnSecondary} onClick={() => setEditProject(false)}>Cancelar</button>
            <button className={btnPrimary} onClick={saveProject}>Salvar Alterações</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Stage */}
      <Modal open={stageModal.open} onClose={() => setStageModal({ open: false, editing: null })} title={stageModal.editing ? 'Editar Etapa' : 'Nova Etapa'}
        subtitle={stageModal.editing ? stageModal.editing.name : 'Definir nova etapa do projeto'} icon={<Layers size={18} className="text-[#4a7fa5]" />} wide>
        <div className="space-y-5">
          <fieldset className="space-y-4">
            <legend className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Definição</legend>
            <div><label className={labelCls}>Nome</label><input className={inputCls} value={stageForm.name} onChange={e => setStageForm({ ...stageForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              {stageModal.editing && <div><label className={labelCls}>Status</label><select className={inputCls} value={stageForm.status} onChange={e => setStageForm({ ...stageForm, status: e.target.value })}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>}
              <div><label className={labelCls}>Ordem</label><input type="number" className={inputCls} value={stageForm.order_index} onChange={e => setStageForm({ ...stageForm, order_index: Number(e.target.value) })} /></div>
            </div>
          </fieldset>
          {/* Datas e responsável removidos: calculados/atribuidos nas tarefas */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100"><button className={btnSecondary} onClick={() => setStageModal({ open: false, editing: null })}>Cancelar</button><button className={btnPrimary} onClick={saveStage}>{stageModal.editing ? 'Salvar Alterações' : 'Criar Etapa'}</button></div>
        </div>
      </Modal>

      {/* Modal: Task */}
      <Modal open={taskModal.open} onClose={() => setTaskModal({ open: false, stageId: 0, editing: null })} title={taskModal.editing ? 'Editar Tarefa' : 'Nova Tarefa'}
        subtitle={taskModal.editing ? taskModal.editing.name : 'Definir nova tarefa na etapa'} icon={<Check size={18} className="text-[#4a7fa5]" />} wide>
        <div className="space-y-5">
          {(() => {
            const locked = taskModal.editing && project?.status !== 'planning';
            return (
              <>
                <fieldset className="space-y-4">
                  <legend className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Definição</legend>
                  <div><label className={labelCls}>Nome</label><input className={inputCls} value={taskForm.name} onChange={e => setTaskForm({ ...taskForm, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    {taskModal.editing && <div><label className={labelCls}>Status</label><select className={inputCls} value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>}
                    {!locked && <div><label className={labelCls}>Horas Estimadas</label><HoursInput value={taskForm.estimated_hours} onChange={v => setTaskForm({ ...taskForm, estimated_hours: v })} className={inputCls} /></div>}
                  </div>
                </fieldset>
                {!locked && (
                  <>
                    <div className="border-t border-slate-100" />
                    <fieldset className="space-y-4">
                      <legend className="text-xs font-black uppercase tracking-wider text-blue-500 mb-2 flex items-center gap-1.5"><Calendar size={12} /> Planejado</legend>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelCls}>Início Previsto</label><input type="date" className={inputCls} value={taskForm.planned_start} onChange={e => setTaskForm({ ...taskForm, planned_start: e.target.value })} /></div>
                        <div><label className={labelCls}>Término Previsto</label><input type="date" className={inputCls} value={taskForm.planned_end} onChange={e => setTaskForm({ ...taskForm, planned_end: e.target.value })} /></div>
                      </div>
                    </fieldset>
                  </>
                )}
                {locked && (
                  <>
                    <div className="border-t border-amber-100" />
                    <fieldset className="space-y-4 bg-amber-50/50 -mx-7 px-7 py-4">
                      <legend className="text-xs font-black uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1.5"><Calendar size={12} /> Replanejamento</legend>
                      <p className="text-[11px] text-amber-500 -mt-2">Ajuste as novas datas e horas se a tarefa precisou ser alterada.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelCls}>Novo Início</label><input type="date" className={inputCls} value={taskForm.replanned_start ?? ''} onChange={e => setTaskForm({ ...taskForm, replanned_start: e.target.value || '' })} /></div>
                        <div><label className={labelCls}>Novo Término</label><input type="date" className={inputCls} value={taskForm.replanned_end ?? ''} onChange={e => setTaskForm({ ...taskForm, replanned_end: e.target.value || '' })} /></div>
                      </div>
                      <div><label className={labelCls}>Horas Estimadas (revisão)</label><HoursInput value={taskForm.estimated_hours} onChange={v => setTaskForm({ ...taskForm, estimated_hours: v })} className={inputCls} /></div>
                    </fieldset>
                  </>
                )}
              </>
            );
          })()}
          <div className="border-t border-slate-100" />
          <fieldset className="space-y-3">
            <legend className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Responsável *</legend>
            <select className={inputCls} value={taskForm.collaborator_id} onChange={e => setTaskForm({ ...taskForm, collaborator_id: Number(e.target.value) })} required>
              <option value={0}>Selecione o responsável...</option>
              {collabs.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ''}</option>
              ))}
            </select>
          </fieldset>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100"><button className={btnSecondary} onClick={() => setTaskModal({ open: false, stageId: 0, editing: null })}>Cancelar</button><button className={btnPrimary} onClick={saveTask}>{taskModal.editing ? 'Salvar Alterações' : 'Criar Tarefa'}</button></div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmModal.open}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        details={confirmModal.details}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
      />
    </div>
  );
}
