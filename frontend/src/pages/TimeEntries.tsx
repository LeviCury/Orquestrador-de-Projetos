import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, Collaborator, Stage, DailyHoursSummary } from '@/types';
import {
  getUnifiedHours, exportExcel, createTimeEntry, createTicketHour,
  updateTimeEntry, deleteTimeEntry, deleteTicketHour,
  getProjects, getCollaborators, getStages, getDailyHours,
  checkTicketDuplicate, type DuplicateCheckResult,
} from '@/api/client';
import Modal from '@/components/Modal';
import { SkeletonRow } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, Clock, Filter, Pencil, Download, X, Check,
  FolderKanban, Headset, Target, ExternalLink, TrendingUp, ChevronDown, Users,
} from 'lucide-react';
import HoursInput from '@/components/HoursInput';
import useGlpiLookup from '@/hooks/useGlpiLookup';

interface UnifiedEntry {
  id: number;
  source: 'project' | 'ticket';
  collaborator_id: number;
  collaborator_name: string;
  entry_date: string;
  hours_worked: number;
  description: string;
  project_id: number | null;
  project_name: string | null;
  stage_name: string | null;
  task_name: string | null;
  glpi_ticket_id: string | null;
  glpi_ticket_title: string | null;
  glpi_link: string | null;
  glpi_status?: string;
  glpi_type?: string;
  glpi_priority?: string;
  glpi_open_date?: string;
  glpi_assigned_to?: string;
  created_at: string;
}

type EntryType = 'project' | 'ticket';
type TabFilter = 'all' | 'project' | 'ticket';

const INITIAL_FILTERS = { project_id: '', collaborator_ids: [] as number[], date_from: '', date_to: '' };

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '—'; }
}

const DATE_PRESETS = [
  { label: 'Hoje', fn: () => { const d = new Date().toISOString().slice(0, 10); return { date_from: d, date_to: d }; } },
  { label: 'Esta Semana', fn: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); return { date_from: mon.toISOString().slice(0, 10), date_to: now.toISOString().slice(0, 10) }; } },
  { label: 'Este Mês', fn: () => { const now = new Date(); return { date_from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, date_to: now.toISOString().slice(0, 10) }; } },
];

export default function TimeEntries() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.system_role === 'manager' || user?.system_role === 'admin';
  const isAnalyst = user?.system_role === 'analyst';

  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [daily, setDaily] = useState<DailyHoursSummary | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>('project');
  const [projectForm, setProjectForm] = useState({ collaborator_id: 0, project_id: 0, stage_id: 0, task_id: 0, entry_date: '', hours_worked: 0, description: '' });
  const [ticketForm, setTicketForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), hours_worked: 0, glpi_ticket_title: '', glpi_link: '' });

  const glpi = useGlpiLookup(ticketForm.glpi_link);
  const [dupWarning, setDupWarning] = useState<DuplicateCheckResult | null>(null);
  const [dupOverride, setDupOverride] = useState(false);

  const [editModal, setEditModal] = useState<UnifiedEntry | null>(null);
  const [editForm, setEditForm] = useState({ entry_date: '', hours_worked: 0, description: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: number; source: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (filters.project_id) params.project_id = parseInt(filters.project_id, 10);
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      if (isAnalyst) {
        params.collaborator_id = user!.id;
      } else if (filters.collaborator_ids.length === 1) {
        params.collaborator_id = filters.collaborator_ids[0];
      }

      const data = await getUnifiedHours(params);
      if (!isAnalyst && filters.collaborator_ids.length > 1) {
        setEntries(data.filter(e => filters.collaborator_ids.includes(e.collaborator_id)));
      } else {
        setEntries(data);
      }
    } catch { toast('error', 'Erro ao carregar apontamentos'); }
    finally { setLoading(false); }
  }, [filters, user]);

  const [collabDropdownOpen, setCollabDropdownOpen] = useState(false);
  const collabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getProjects(), getCollaborators(true)]).then(([p, c]) => {
      setProjects(p);
      setCollaborators(c);
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (collabRef.current && !collabRef.current.contains(e.target as Node)) setCollabDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { void fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    if (!user?.id) return;
    getDailyHours(user.id).then(setDaily).catch(() => {});
  }, [user, entries]);

  useEffect(() => {
    if (glpi.info?.title && !ticketForm.glpi_ticket_title) {
      setTicketForm(f => ({ ...f, glpi_ticket_title: glpi.info!.title }));
    }
  }, [glpi.info]);

  const closeModal = () => {
    setModalOpen(false);
    setTicketForm({ entry_date: new Date().toISOString().slice(0, 10), hours_worked: 0, glpi_ticket_title: '', glpi_link: '' });
    setProjectForm({ collaborator_id: 0, project_id: 0, stage_id: 0, task_id: 0, entry_date: '', hours_worked: 0, description: '' });
    glpi.reset();
  };

  useEffect(() => {
    if (projectForm.project_id) getStages(projectForm.project_id).then(setStages).catch(() => setStages([]));
    else setStages([]);
  }, [projectForm.project_id]);

  const filtered = tabFilter === 'all' ? entries : entries.filter(e => e.source === tabFilter);

  const totalProject = entries.filter(e => e.source === 'project').reduce((s, e) => s + e.hours_worked, 0);
  const totalTicket = entries.filter(e => e.source === 'ticket').reduce((s, e) => s + e.hours_worked, 0);
  const totalAll = totalProject + totalTicket;
  const activeFilters = [filters.project_id, filters.date_from, filters.date_to].filter(Boolean).length + (filters.collaborator_ids.length > 0 ? 1 : 0);

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const collabId = isAnalyst ? user!.id : projectForm.collaborator_id;
    try {
      await createTimeEntry({ collaborator_id: collabId, project_id: projectForm.project_id, stage_id: projectForm.stage_id || null, task_id: projectForm.task_id || null, entry_date: projectForm.entry_date, hours_worked: projectForm.hours_worked, description: projectForm.description });
      setModalOpen(false);
      setProjectForm({ collaborator_id: 0, project_id: 0, stage_id: 0, task_id: 0, entry_date: '', hours_worked: 0, description: '' });
      toast('success', 'Horas de projeto registradas!');
      await fetchEntries();
    } catch (err) { toast('error', err instanceof Error ? err.message : 'Erro ao salvar'); }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const collabId = isAnalyst ? user!.id : projectForm.collaborator_id;
    if (!ticketForm.hours_worked || !ticketForm.entry_date) return;
    const ticketId = ticketForm.glpi_link.match(/[?&]id=(\d+)/)?.[1] ?? '';

    if (ticketId && !dupOverride) {
      try {
        const dup = await checkTicketDuplicate(ticketId, collabId, ticketForm.entry_date);
        if (dup.exists) {
          setDupWarning(dup);
          return;
        }
      } catch { /* proceed */ }
    }

    try {
      await createTicketHour({ collaborator_id: collabId, entry_date: ticketForm.entry_date, hours_worked: ticketForm.hours_worked, glpi_ticket_id: ticketId, glpi_ticket_title: ticketForm.glpi_ticket_title, glpi_link: ticketForm.glpi_link });
      setModalOpen(false);
      setTicketForm({ entry_date: new Date().toISOString().slice(0, 10), hours_worked: 0, glpi_ticket_title: '', glpi_link: '' });
      glpi.reset();
      setDupWarning(null);
      setDupOverride(false);
      toast('success', 'Horas de chamado registradas!');
      await fetchEntries();
    } catch (err) { toast('error', err instanceof Error ? err.message : 'Erro ao salvar'); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    if (editModal.source === 'project') {
      try { await updateTimeEntry(editModal.id, editForm); setEditModal(null); toast('success', 'Atualizado!'); await fetchEntries(); }
      catch { toast('error', 'Erro ao atualizar'); }
    } else {
      toast('error', 'Edição de chamados não suportada. Exclua e relance.');
    }
  };

  const handleDelete = async (id: number, source: string) => {
    try {
      if (source === 'project') await deleteTimeEntry(id);
      else await deleteTicketHour(id);
      setDeleteConfirmId(null);
      toast('success', 'Apontamento excluído.');
      await fetchEntries();
    } catch { toast('error', 'Erro ao excluir'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, unknown> = {};
      if (filters.project_id) params.project_id = parseInt(filters.project_id, 10);
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (isAnalyst) params.collaborator_id = user!.id;
      else if (filters.collaborator_ids.length === 1) params.collaborator_id = filters.collaborator_ids[0];
      await exportExcel(params);
      toast('success', 'Excel exportado com sucesso!');
    } catch { toast('error', 'Erro ao exportar'); }
    finally { setExporting(false); }
  };

  const selectedStage = stages.find(s => s.id === projectForm.stage_id);
  const tasks = selectedStage?.tasks ?? [];

  const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none transition-all bg-white';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Apontamento de Horas</h1>
          <p className="text-slate-500 mt-1">
            {filtered.length} lançamento(s) &middot; <span className="font-semibold text-slate-700">{totalAll.toFixed(1)}h</span> total
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all text-sm font-medium disabled:opacity-50">
            <Download size={16} /> {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
          {isAnalyst && (
            <button onClick={() => { setEntryType('project'); setModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-[#e83948] text-white rounded-xl hover:bg-[#d42d3b] transition-all font-bold shadow-lg shadow-[#e83948]/25">
              <Plus size={18} /> Novo Apontamento
            </button>
          )}
        </div>
      </div>

      {/* Daily summary for analyst */}
      {isAnalyst && daily && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={13} /> Hoje — Meta {daily.target_hours}h
            </span>
            <span className={`text-sm font-bold ${daily.pct >= 100 ? 'text-emerald-600' : daily.pct >= 70 ? 'text-[#2c5372]' : 'text-amber-600'}`}>
              {daily.total_hours}h / {daily.target_hours}h
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all duration-700 ${daily.pct >= 100 ? 'bg-emerald-500' : daily.pct >= 70 ? 'bg-[#4a7fa5]' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(daily.pct, 100)}%` }} />
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1"><FolderKanban size={12} className="text-[#4a7fa5]" /> Projetos: <strong>{daily.project_hours}h</strong></span>
            <span className="flex items-center gap-1"><Headset size={12} className="text-amber-500" /> Chamados: <strong>{daily.ticket_hours}h</strong></span>
            {daily.remaining > 0 ? <span className="ml-auto font-bold text-amber-600">Faltam {daily.remaining}h</span> : <span className="ml-auto font-bold text-emerald-600">Meta atingida!</span>}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Projetos', value: `${totalProject.toFixed(1)}h`, icon: FolderKanban, color: 'text-[#2c5372] bg-[#eef3f8]' },
          { label: 'Chamados', value: `${totalTicket.toFixed(1)}h`, icon: Headset, color: 'text-amber-600 bg-amber-50' },
          { label: 'Total Geral', value: `${totalAll.toFixed(1)}h`, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Lançamentos', value: entries.length, icon: Target, color: 'text-violet-600 bg-violet-50' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-slate-200/60 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${m.color.split(' ')[1]} flex items-center justify-center shrink-0`}>
              <m.icon size={18} className={m.color.split(' ')[0]} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-800">{m.value}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* Type tabs */}
          <div className="flex bg-slate-100 rounded-xl p-0.5">
            {([['all', 'Tudo'], ['project', 'Projetos'], ['ticket', 'Chamados']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTabFilter(key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tabFilter === key ? 'bg-white text-[#2c5372] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200" />

          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Filter size={15} className="text-slate-500" /></div>
          <span className="font-semibold text-slate-700 text-sm">Filtros</span>
          {activeFilters > 0 && (
            <button onClick={() => setFilters(INITIAL_FILTERS)} className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg font-medium">
              <X size={12} /> Limpar ({activeFilters})
            </button>
          )}
          <div className="flex-1" />
          <div className="flex gap-1.5">
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => setFilters(f => ({ ...f, ...p.fn() }))} className="px-3 py-1.5 text-xs font-medium text-[#2c5372] bg-[#eef3f8] hover:bg-[#dce7f0] rounded-lg transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {tabFilter !== 'ticket' && (
            <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm min-w-[180px] focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none">
              <option value="">Todos os projetos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {isManager && (
            <div className="relative" ref={collabRef}>
              <button type="button" onClick={() => setCollabDropdownOpen(o => !o)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm min-w-[220px] outline-none transition-all ${
                  collabDropdownOpen ? 'border-[#4a7fa5] ring-2 ring-[#4a7fa5]/20' : 'border-slate-200 hover:border-slate-300'
                } bg-white`}>
                <Users size={14} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-left truncate">
                  {filters.collaborator_ids.length === 0
                    ? <span className="text-slate-500">Todos os colaboradores</span>
                    : filters.collaborator_ids.length === 1
                    ? <span className="text-slate-800 font-medium">{collaborators.find(c => c.id === filters.collaborator_ids[0])?.name}</span>
                    : <span className="text-slate-800 font-medium">{filters.collaborator_ids.length} colaboradores</span>
                  }
                </span>
                {filters.collaborator_ids.length > 0 && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4a7fa5] text-white text-[10px] font-bold shrink-0">
                    {filters.collaborator_ids.length}
                  </span>
                )}
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${collabDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {collabDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in">
                  {filters.collaborator_ids.length > 0 && (
                    <button onClick={() => setFilters(f => ({ ...f, collaborator_ids: [] }))}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-50 border-b border-slate-100 transition-colors">
                      <X size={12} /> Limpar seleção
                    </button>
                  )}
                  <div className="max-h-64 overflow-y-auto">
                    {collaborators.map(c => {
                      const selected = filters.collaborator_ids.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => setFilters(f => ({
                          ...f,
                          collaborator_ids: selected
                            ? f.collaborator_ids.filter(id => id !== c.id)
                            : [...f.collaborator_ids, c.id],
                        }))}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            selected ? 'bg-[#eef3f8]' : 'hover:bg-slate-50'
                          }`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                            selected ? 'bg-[#4a7fa5] text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {selected ? <Check size={14} /> : c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm truncate ${selected ? 'font-semibold text-[#2c5372]' : 'text-slate-700'}`}>{c.name}</p>
                            {c.role && <p className="text-[10px] text-slate-400 truncate">{c.role}</p>}
                          </div>
                          {selected && <Check size={14} className="text-[#4a7fa5] shrink-0" />}
                        </button>
                      );
                    })}
                    {collaborators.length === 0 && (
                      <p className="px-4 py-6 text-sm text-slate-400 text-center">Nenhum colaborador encontrado</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none" />
          <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-16 text-center">
          <Clock size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhum apontamento encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Data</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Colaborador</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Projeto / Chamado</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Horas</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descrição</th>
                  {isAnalyst && <th className="w-24 px-5 py-3.5" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => {
                  const isProject = entry.source === 'project';
                  const ref = isProject
                    ? [entry.project_name, entry.stage_name, entry.task_name].filter(Boolean).join(' / ')
                    : (entry.glpi_ticket_id ? `#${entry.glpi_ticket_id} — ${entry.glpi_ticket_title || 'Chamado GLPI'}` : (entry.glpi_ticket_title || 'Chamado GLPI'));
                  const delKey = `${entry.source}-${entry.id}`;

                  return (
                    <tr key={delKey} className={`border-b border-slate-50 hover:bg-[#eef3f8]/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${isProject ? 'bg-[#eef3f8] text-[#2c5372]' : 'bg-amber-50 text-amber-700'}`}>
                          {isProject ? <FolderKanban size={12} /> : <Headset size={12} />}
                          {isProject ? 'Projeto' : 'Chamado'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{formatDate(entry.entry_date)}</td>
                      <td className="px-5 py-3.5 text-sm">
                        <div className="font-medium text-slate-800">{entry.collaborator_name}</div>
                        {!isProject && entry.glpi_assigned_to && entry.glpi_assigned_to !== entry.collaborator_name && (
                          <div className="text-[10px] text-slate-400 mt-0.5">Técnico GLPI: {entry.glpi_assigned_to}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 max-w-[300px]">
                        <div className="truncate font-medium">{ref}</div>
                        {!isProject && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {entry.glpi_status && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{entry.glpi_status}</span>}
                            {entry.glpi_type && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{entry.glpi_type}</span>}
                            {entry.glpi_priority && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{entry.glpi_priority}</span>}
                            {entry.glpi_link && (
                              <a href={entry.glpi_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#4a7fa5] hover:text-[#2c5372] flex items-center gap-0.5">
                                <ExternalLink size={10} /> GLPI
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-bold ${isProject ? 'bg-[#eef3f8] text-[#2c5372]' : 'bg-amber-50 text-amber-700'}`}>
                          {entry.hours_worked}h
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[200px] truncate">{entry.description || '—'}</td>
                      {isAnalyst && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            {isProject && (
                              <button onClick={() => { setEditModal(entry); setEditForm({ entry_date: entry.entry_date, hours_worked: entry.hours_worked, description: entry.description }); }}
                                className="p-1.5 text-slate-300 hover:text-[#2c5372] hover:bg-[#eef3f8] rounded-lg transition-all"><Pencil size={14} /></button>
                            )}
                            {deleteConfirmId?.id === entry.id && deleteConfirmId?.source === entry.source ? (
                              <div className="flex gap-1 animate-fade-in">
                                <button onClick={() => handleDelete(entry.id, entry.source)} className="px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 rounded font-bold">Sim</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 rounded">Não</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirmId({ id: entry.id, source: entry.source })} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={closeModal} title="Novo Apontamento" wide>
        {/* Type tabs */}
        <div className="flex bg-slate-100 rounded-xl p-0.5 mb-5">
          <button onClick={() => setEntryType('project')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${entryType === 'project' ? 'bg-white text-[#2c5372] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <FolderKanban size={16} /> Projeto
          </button>
          <button onClick={() => setEntryType('ticket')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${entryType === 'ticket' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Headset size={16} /> Chamado
          </button>
        </div>

        {entryType === 'project' ? (
          <form onSubmit={handleProjectSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Projeto *</label>
                <select value={projectForm.project_id || ''} onChange={e => setProjectForm(f => ({ ...f, project_id: parseInt(e.target.value, 10) || 0, stage_id: 0, task_id: 0 }))} className={inputCls} required>
                  <option value="">Selecione...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Etapa</label>
                <select value={projectForm.stage_id || ''} onChange={e => setProjectForm(f => ({ ...f, stage_id: parseInt(e.target.value, 10) || 0, task_id: 0 }))} className={inputCls} disabled={!projectForm.project_id}>
                  <option value="">Selecione...</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tarefa</label>
                <select value={projectForm.task_id || ''} onChange={e => setProjectForm(f => ({ ...f, task_id: parseInt(e.target.value, 10) || 0 }))} className={inputCls} disabled={!projectForm.stage_id}>
                  <option value="">Selecione...</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data *</label>
                <input type="date" value={projectForm.entry_date} onChange={e => setProjectForm(f => ({ ...f, entry_date: e.target.value }))} className={inputCls} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Horas Trabalhadas *</label>
                <HoursInput value={projectForm.hours_worked} onChange={v => setProjectForm(f => ({ ...f, hours_worked: v }))} className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição</label>
                <input type="text" value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="O que foi feito..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-5 py-2.5 bg-[#e83948] text-white rounded-xl font-bold shadow-lg shadow-[#e83948]/25 transition-all">Salvar</button>
              <button type="button" onClick={closeModal} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all">Cancelar</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTicketSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data *</label>
                <input type="date" value={ticketForm.entry_date} onChange={e => setTicketForm(f => ({ ...f, entry_date: e.target.value }))} className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Horas Trabalhadas *</label>
                <HoursInput value={ticketForm.hours_worked} onChange={v => setTicketForm(f => ({ ...f, hours_worked: v }))} className={inputCls} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link do Chamado GLPI</label>
              <input value={ticketForm.glpi_link} onChange={e => setTicketForm(f => ({ ...f, glpi_link: e.target.value }))} className={inputCls} placeholder="https://central.minervafoods.com/...?id=123" />
              {glpi.loading && <span className="text-xs text-slate-400 mt-1 block animate-pulse">Buscando chamado no GLPI...</span>}
              {glpi.info && (
                <div className="mt-2 p-3 bg-[#eef3f8] rounded-xl border border-[#4a7fa5]/20">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#2c5372]">#{glpi.info.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${glpi.info.status_id <= 3 ? 'bg-amber-100 text-amber-700' : glpi.info.status_id <= 4 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{glpi.info.status}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{glpi.info.type}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{glpi.info.priority}</span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1 font-medium">{glpi.info.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                    {glpi.info.open_date && <span>Aberto em {new Date(glpi.info.open_date).toLocaleDateString('pt-BR')}</span>}
                    {glpi.info.assigned_to && <span><span className="font-semibold text-slate-600">Técnico GLPI:</span> {glpi.info.assigned_to}</span>}
                  </div>
                  {glpi.info.assigned_to && user?.name && !glpi.info.assigned_to.toLowerCase().includes(user.name.split(' ')[0].toLowerCase()) && (
                    <div className="mt-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
                      ⚠ Você ({user.name}) não é o técnico atribuído neste chamado. As horas serão lançadas no seu banco.
                    </div>
                  )}
                </div>
              )}
              {!glpi.loading && !glpi.info && glpi.ticketId && (
                <span className="text-xs text-red-400 mt-1 block">Chamado #{glpi.ticketId} não encontrado no GLPI</span>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Título / Descrição do Chamado</label>
              <input value={ticketForm.glpi_ticket_title} onChange={e => setTicketForm(f => ({ ...f, glpi_ticket_title: e.target.value }))} className={inputCls} placeholder={glpi.loading ? 'Buscando...' : 'Correção RPA Faturamento'} />
            </div>
            {dupWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in">
                <p className="text-xs font-bold text-amber-700 mb-1.5">
                  ⚠ Apontamento duplicado detectado!
                </p>
                <p className="text-xs text-amber-600 mb-2">
                  Já {dupWarning.count === 1 ? 'existe 1 apontamento' : `existem ${dupWarning.count} apontamentos`} para este chamado nesta data:
                </p>
                <div className="space-y-1 mb-2">
                  {dupWarning.entries.map(e => (
                    <div key={e.id} className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-100/50 px-2 py-1 rounded-lg">
                      <span>{new Date(e.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <span className="font-bold">{e.hours_worked}h</span>
                      {e.collaborator_name && <span className="text-amber-600">— {e.collaborator_name}</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDupOverride(true); setTimeout(() => { const fakeEvent = { preventDefault: () => {} } as React.FormEvent; handleTicketSubmit(fakeEvent); }, 50); }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
                    Sim, lançar mesmo assim
                  </button>
                  <button type="button" onClick={() => { setDupWarning(null); setDupOverride(false); }}
                    className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-5 py-2.5 bg-[#e83948] text-white rounded-xl font-bold shadow-lg shadow-[#e83948]/25 transition-all">Lançar</button>
              <button type="button" onClick={() => { closeModal(); setDupWarning(null); setDupOverride(false); }} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all">Cancelar</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit Modal (project only) */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Apontamento">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data</label>
            <input type="date" value={editForm.entry_date} onChange={e => setEditForm(f => ({ ...f, entry_date: e.target.value }))} className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Horas Trabalhadas</label>
            <HoursInput value={editForm.hours_worked} onChange={v => setEditForm(f => ({ ...f, hours_worked: v }))} className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição</label>
            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="px-5 py-2.5 bg-[#e83948] text-white rounded-xl font-bold shadow-lg shadow-[#e83948]/25 transition-all">Salvar</button>
            <button type="button" onClick={() => setEditModal(null)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all">Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
