import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, Collaborator, ClassificationLevel } from '@/types';
import {
  CLASSIFICATION_LABELS, CLASSIFICATION_COLORS,
  COMPLEXITY_DESCRIPTIONS, CRITICALITY_DESCRIPTIONS, SCOPE_DESCRIPTIONS,
  STATUS_LABELS,
} from '@/types';
import { getProjects, createProject, deleteProject, getCollaborators } from '@/api/client';
import Modal from '@/components/Modal';
import ProgressBar from '@/components/ProgressBar';
import HoursDisplay from '@/components/HoursDisplay';
import { SkeletonCard } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, Calendar, Users, FolderKanban, ArrowRight,
  Search, ArrowUpDown, AlertTriangle, TrendingUp, Clock, Flame,
  CheckCircle2, XCircle, Layers,
} from 'lucide-react';

const STATUS_TABS = [
  { key: '', label: 'Todos' },
  { key: 'planning', label: 'Planejamento' },
  { key: 'in_progress', label: 'Em Andamento' },
  { key: 'completed', label: 'Concluído' },
  { key: 'cancelled', label: 'Cancelado' },
] as const;

const LEVELS: ClassificationLevel[] = ['low', 'medium', 'high'];

const INITIAL_FORM = {
  name: '', description: '',
  complexity: '' as string, criticality: '' as string, scope: '' as string,
  collaborator_id: 0,
};

function formatDateHuman(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00').getTime();
  const todayMidnight = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime();
  return Math.round((target - todayMidnight) / 86400000);
}

const STATUS_BADGE: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  planning:    { bg: 'bg-blue-50 border-blue-200',        text: 'text-blue-700',    icon: Clock },
  pending:     { bg: 'bg-slate-50 border-slate-200',      text: 'text-slate-600',   icon: Clock },
  in_progress: { bg: 'bg-amber-50 border-amber-200',      text: 'text-amber-700',   icon: Clock },
  completed:   { bg: 'bg-emerald-50 border-emerald-200',  text: 'text-emerald-700', icon: CheckCircle2 },
  cancelled:   { bg: 'bg-red-50 border-red-200',          text: 'text-red-600',     icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${s.bg} ${s.text}`}>
      <Icon size={12} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ProjectHealthIndicator({ project }: { project: Project }) {
  if (project.status === 'planning') return null;
  if (project.status === 'completed') {
    return <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100"><CheckCircle2 size={11} /> Entregue</div>;
  }
  if (project.status === 'cancelled') {
    return <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200"><XCircle size={11} /> Cancelado</div>;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const overdue = project.planned_end && project.planned_end < todayStr;
  const overBudget = project.estimated_hours > 0 && project.actual_hours > project.estimated_hours * 1.05;
  const dl = daysUntil(project.planned_end);
  const nearDeadline = project.planned_end && !overdue && dl !== null && dl <= 5 && dl >= 0;

  if (overdue || overBudget) {
    const label = overdue && overBudget ? 'Atrasado + Acima do orçamento' : overdue ? 'Atrasado' : 'Acima do orçamento';
    return <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100 animate-pulse"><Flame size={11} /> {label}</div>;
  }
  if (nearDeadline) {
    return <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100"><AlertTriangle size={11} /> Prazo próximo</div>;
  }
  return <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100"><TrendingUp size={11} /> No prazo</div>;
}

export default function Projects() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isViewer = user?.system_role === 'viewer';
  const [projects, setProjects] = useState<Project[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'progress' | 'urgency'>('urgency');

  const fetchProjects = useCallback(async () => {
    setLoading(true); setError(null);
    try { setProjects(await getProjects(statusFilter || undefined)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar projetos'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  const fetchCollaborators = useCallback(async () => {
    try { setCollaborators(await getCollaborators(true)); } catch {}
  }, []);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);
  useEffect(() => { if (modalOpen) void fetchCollaborators(); }, [modalOpen, fetchCollaborators]);

  const openCreateModal = () => { setForm(INITIAL_FORM); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setForm(INITIAL_FORM); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('error', 'Nome do projeto é obrigatório.'); return; }
    if (!form.complexity || !form.criticality || !form.scope) { toast('error', 'Preencha todos os critérios de classificação.'); return; }
    if (!form.collaborator_id) { toast('error', 'Selecione o responsável.'); return; }
    try {
      await createProject({
        name: form.name, description: form.description,
        complexity: form.complexity, criticality: form.criticality, scope: form.scope,
        collaborator_ids: [form.collaborator_id],
      });
      closeModal(); toast('success', 'Projeto criado com sucesso!'); await fetchProjects();
    } catch (e) { toast('error', e instanceof Error ? e.message : 'Erro ao criar projeto'); }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try { await deleteProject(id); setDeleteConfirmId(null); toast('success', 'Projeto excluído.'); await fetchProjects(); }
    catch (e) { toast('error', e instanceof Error ? e.message : 'Erro ao excluir projeto'); }
  };

  const stats = useMemo(() => {
    const todayS = new Date().toISOString().slice(0, 10);
    let atrasados = 0, noPrazo = 0, criticos = 0, concluidos = 0;
    for (const p of projects) {
      if (p.status === 'completed') { concluidos++; continue; }
      if (p.status === 'cancelled' || p.status === 'planning') continue;
      const overdue = p.planned_end && p.planned_end < todayS;
      if (overdue) atrasados++;
      else noPrazo++;
      if (p.criticality === 'high') criticos++;
    }
    return { atrasados, noPrazo, criticos, concluidos };
  }, [projects]);

  const urgencyScore = (p: Project): number => {
    if (p.status === 'completed' || p.status === 'cancelled') return 100;
    let score = 50;
    const d = daysUntil(p.planned_end);
    if (d !== null && d < 0) score = 0;
    else if (d !== null && d <= 5) score = 10;
    if (p.criticality === 'high') score -= 5;
    if (p.estimated_hours > 0 && p.actual_hours > p.estimated_hours) score -= 10;
    return score;
  };

  const filtered = useMemo(() => {
    return projects
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'date') return (b.planned_start ?? '').localeCompare(a.planned_start ?? '');
        if (sortBy === 'progress') return (b.progress ?? 0) - (a.progress ?? 0);
        if (sortBy === 'urgency') return urgencyScore(a) - urgencyScore(b);
        return a.name.localeCompare(b.name);
      });
  }, [projects, search, sortBy]);

  const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none transition-all bg-white';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projetos</h1>
          <p className="text-slate-500 mt-1">{projects.length} projeto(s) cadastrado(s)</p>
        </div>
        {!isViewer && (
          <button onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#e83948] text-white rounded-xl hover:bg-[#d42d3b] transition-all font-bold shadow-lg shadow-[#e83948]/25 hover:shadow-[#e83948]/40 hover:scale-[1.02] active:scale-[0.98]">
            <Plus size={18} /> Novo Projeto
          </button>
        )}
      </div>

      {/* Quick stats */}
      {projects.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {stats.atrasados > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-red-50 border border-red-200/60 rounded-xl animate-fade-in">
              <Flame size={15} className="text-red-500" />
              <span className="text-sm font-bold text-red-700">{stats.atrasados}</span>
              <span className="text-xs text-red-500">atrasado(s)</span>
            </div>
          )}
          {stats.criticos > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-200/60 rounded-xl animate-fade-in">
              <AlertTriangle size={15} className="text-amber-500" />
              <span className="text-sm font-bold text-amber-700">{stats.criticos}</span>
              <span className="text-xs text-amber-500">criticidade alta</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200/60 rounded-xl animate-fade-in">
            <TrendingUp size={15} className="text-emerald-500" />
            <span className="text-sm font-bold text-emerald-700">{stats.noPrazo}</span>
            <span className="text-xs text-emerald-500">no prazo</span>
          </div>
          {stats.concluidos > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-[#eef3f8] border border-[#b4cde0]/60 rounded-xl animate-fade-in">
              <CheckCircle2 size={15} className="text-[#4a7fa5]" />
              <span className="text-sm font-bold text-[#1a3550]">{stats.concluidos}</span>
              <span className="text-xs text-[#4a7fa5]">concluído(s)</span>
            </div>
          )}
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projetos..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none transition-all bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-slate-400 shrink-0" />
          {([['urgency', 'Urgência'], ['name', 'Nome'], ['date', 'Data'], ['progress', 'Progresso']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                sortBy === key ? 'bg-[#2c5372] text-white shadow-md shadow-[#2c5372]/25' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(({ key, label }) => (
          <button key={key || 'all'} onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              statusFilter === key
                ? 'bg-[#2c5372] text-white shadow-md shadow-[#2c5372]/25'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 animate-fade-in">{error}</div>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-16 text-center">
          <FolderKanban size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhum projeto encontrado</p>
          <p className="text-slate-400 text-sm mt-1">{search ? 'Tente outro termo de busca' : 'Crie seu primeiro projeto para começar'}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => {
            const isOverdue = p.planned_end && p.planned_end < new Date().toISOString().slice(0, 10) && !['planning', 'completed', 'cancelled'].includes(p.status);
            const isOverBudget = p.estimated_hours > 0 && p.actual_hours > p.estimated_hours * 1.05;
            const isCritical = isOverdue || isOverBudget;
            const deadlineDays = daysUntil(p.planned_end);

            return (
              <div key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className={`group rounded-2xl bg-white border shadow-sm hover:shadow-xl hover:shadow-[#4a7fa5]/5 transition-all duration-300 cursor-pointer overflow-hidden animate-fade-in ${
                  isCritical ? 'border-red-200 hover:border-red-300' : 'border-slate-200/60 hover:border-[#b4cde0]'
                }`}
                style={{ animationDelay: `${i * 50}ms` }}>
                {/* Top accent */}
                <div className={`h-1.5 ${
                  p.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-teal-400' :
                  isOverdue ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                  isOverBudget ? 'bg-gradient-to-r from-orange-400 to-red-400' :
                  p.status === 'in_progress' ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                  p.status === 'cancelled' ? 'bg-gradient-to-r from-slate-300 to-slate-400' :
                  'bg-gradient-to-r from-[#4a7fa5] to-[#c7b475]'
                }`} />

                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                      isCritical ? 'bg-red-50 group-hover:bg-red-100' : 'bg-gradient-to-br from-[#eef3f8] to-[#dce7f0]/50 group-hover:from-[#dce7f0] group-hover:to-[#b4cde0]/50'
                    }`}>
                      {isCritical ? <Flame size={20} className="text-red-500" /> : <FolderKanban size={20} className="text-[#4a7fa5]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 truncate group-hover:text-[#2c5372] transition-colors">{p.name}</h3>
                      <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{p.description || 'Sem descrição'}</p>
                    </div>
                    {!isViewer && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(deleteConfirmId === p.id ? null : p.id); }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Health + Status + Inactivity */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <ProjectHealthIndicator project={p} />
                    <StatusBadge status={p.status} />
                    {p.complexity && <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${CLASSIFICATION_COLORS[p.complexity]}`}>C: {CLASSIFICATION_LABELS[p.complexity]}</span>}
                    {p.criticality && <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${CLASSIFICATION_COLORS[p.criticality]}`}>K: {CLASSIFICATION_LABELS[p.criticality]}</span>}
                    {(() => {
                      if (['completed', 'cancelled'].includes(p.status)) return null;
                      const lastUpdate = p.updated_at || p.created_at;
                      const inactiveDays = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 86400000) : 0;
                      if (inactiveDays >= 3) return (
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border animate-pulse ${inactiveDays >= 7 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                          <AlertTriangle className="inline w-2.5 h-2.5 mr-0.5 -mt-px" /> Parado há {inactiveDays}d
                        </span>
                      );
                      return null;
                    })()}
                  </div>

                  {/* Stage/Task progress */}
                  {p.stages_total > 0 && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-semibold">
                        <Layers className="inline w-3 h-3 mr-0.5 -mt-px" /> {p.stages_completed}/{p.stages_total} etapas
                      </span>
                      {p.tasks_total > 0 && (
                        <span className="font-semibold">
                          <CheckCircle2 className="inline w-3 h-3 mr-0.5 -mt-px" /> {p.tasks_completed}/{p.tasks_total} tarefas
                        </span>
                      )}
                    </div>
                  )}

                  {/* Deadline context */}
                  {p.planned_end && !['planning', 'completed', 'cancelled'].includes(p.status) && (
                    <div className={`mt-2 text-xs font-semibold flex items-center gap-1.5 ${
                      isOverdue ? 'text-red-600' : deadlineDays !== null && deadlineDays <= 5 ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      <Calendar size={12} />
                      {isOverdue
                        ? `Atrasado ${Math.abs(deadlineDays!)}d (venceu ${formatDateHuman(p.planned_end)})`
                        : deadlineDays !== null && deadlineDays <= 5
                        ? `Vence em ${deadlineDays}d (${formatDateHuman(p.planned_end)})`
                        : `Prazo: ${formatDateHuman(p.planned_end)}`
                      }
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {deleteConfirmId === p.id && (
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-xl flex items-center gap-2 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-slate-600">Excluir?</span>
                      <button onClick={(e) => handleDelete(e, p.id)} className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-100 rounded-lg font-semibold">Sim</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg">Não</button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-50 space-y-3">
                  <ProgressBar value={p.progress ?? 0} />
                  <HoursDisplay estimated={p.estimated_hours} actual={p.actual_hours ?? 0} showBar={false} />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDateHuman(p.planned_start) || '—'} {'\u2192'} {formatDateHuman(p.planned_end) || '—'}
                    </span>
                    <span className="flex items-center gap-1"><Users size={12} />{p.collaborators?.length ?? 0}</span>
                  </div>
                </div>

                <div className="px-5 pb-4 flex justify-end">
                  <span className="flex items-center gap-1 text-xs text-[#6d9dc0] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    Ver detalhes <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={closeModal} title="Novo Projeto"
        subtitle="Defina as informações básicas do projeto" icon={<FolderKanban size={18} className="text-[#4a7fa5]" />} wide>
        <form onSubmit={handleSubmit} className="space-y-5">
          <fieldset className="space-y-4">
            <legend className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Informações básicas</legend>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome do Projeto</label>
              <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Migração do sistema legado" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição</label>
              <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className={inputCls} placeholder="Descreva brevemente o projeto..." />
            </div>
          </fieldset>

          <div className="border-t border-slate-100" />

          <fieldset className="border border-[#dce7f0] rounded-2xl p-5 bg-gradient-to-br from-[#eef3f8]/50 to-white space-y-5">
            <legend className="text-xs font-black uppercase tracking-wider text-[#2c5372] px-2">Critérios de Classificação *</legend>
            {([
              { key: 'complexity' as const, label: 'Complexidade', descs: COMPLEXITY_DESCRIPTIONS },
              { key: 'criticality' as const, label: 'Criticidade', descs: CRITICALITY_DESCRIPTIONS },
              { key: 'scope' as const, label: 'Abrangência', descs: SCOPE_DESCRIPTIONS },
            ]).map(({ key, label, descs }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{label} <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map(level => (
                    <button key={level} type="button"
                      onClick={() => setForm(f => ({ ...f, [key]: level }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        form[key] === level
                          ? 'border-[#4a7fa5] bg-[#eef3f8] shadow-md shadow-[#4a7fa5]/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-lg font-bold mb-1.5 ${CLASSIFICATION_COLORS[level]}`}>{CLASSIFICATION_LABELS[level]}</span>
                      <p className="text-[11px] text-slate-500 leading-tight">{descs[level]}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          <div className="border-t border-slate-100" />

          <fieldset className="space-y-3">
            <legend className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Responsável *</legend>
            <select value={form.collaborator_id} onChange={e => setForm(f => ({ ...f, collaborator_id: Number(e.target.value) }))} className={inputCls} required>
              <option value={0}>Selecione o responsável...</option>
              {collaborators.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ''}</option>
              ))}
            </select>
          </fieldset>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={closeModal} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2.5 bg-[#e83948] text-white rounded-xl hover:bg-[#d42d3b] font-bold shadow-lg shadow-[#e83948]/25 transition-all">
              Criar Projeto
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
