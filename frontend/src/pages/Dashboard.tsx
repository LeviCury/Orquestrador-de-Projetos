import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  FolderKanban, Clock, AlertTriangle, TrendingUp,
  Filter, X, Layers, CheckSquare, CalendarDays, Activity,
  ChevronRight, ArrowRight, Users, Target, BarChart3, Flame,
  Headset, UserCheck, ChevronDown,
} from 'lucide-react';
import type {
  ExecutiveDashboard as ExecData, DelayedItem, Project, ProjectTimeline,
  TeamOverview as TeamData,
} from '@/types';
import { STATUS_LABELS } from '@/types';
import {
  getExecutiveDashboard, getDelayedItems, getProjects, getTimeline,
  getTeamOverview,
} from '@/api/client';
import { SkeletonDashboard } from '@/components/Skeleton';
import TimelineChart from '@/components/TimelineChart';

const STATUS_PIE: Record<string, string> = {
  planning: '#4a7fa5', pending: '#94a3b8', in_progress: '#c7b475',
  completed: '#10b981', cancelled: '#e83948',
};

const CARD_GRADIENTS = [
  'from-[#2c5372] to-[#4a7fa5]',
  'from-[#c7b475] to-[#d9c48e]',
  'from-[#10b981] to-[#34d399]',
  'from-[#e83948] to-[#f08a94]',
  'from-[#4a7fa5] to-[#6d9dc0]',
  'from-[#2c5372] to-[#c7b475]',
];

function SituationBadge({ level }: { level: string }) {
  const cfg = level === 'high'
    ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Crítico' }
    : level === 'medium'
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Atenção' }
    : { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'OK' };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [exec, setExec] = useState<ExecData | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [delayed, setDelayed] = useState<DelayedItem[]>([]);
  const [timeline, setTimeline] = useState<ProjectTimeline[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [teamDays, setTeamDays] = useState(30);

  const fetchAll = useCallback(async (pid?: number) => {
    setLoading(true);
    try {
      const [e, d, tl, t] = await Promise.all([
        getExecutiveDashboard(pid), getDelayedItems(pid), getTimeline(pid),
        getTeamOverview(teamDays),
      ]);
      setExec(e); setDelayed(d); setTimeline(tl); setTeam(t);
    } finally { setLoading(false); }
  }, [teamDays]);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    getTeamOverview(teamDays).then(setTeam).catch(() => {});
  }, [teamDays]);

  const handleFilter = useCallback((pid?: number) => {
    setSelectedProject(pid); fetchAll(pid); setFilterOpen(false);
  }, [fetchAll]);

  const selProj = projects.find(p => p.id === selectedProject);
  const isSingle = selectedProject !== undefined;

  if (loading) return <SkeletonDashboard />;
  if (!exec) return null;

  const sCurveData = exec.s_curve.map(p => ({
    date: new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    Planejado: p.planned_cumulative,
    Executado: p.actual_cumulative,
  }));

  const statusPie = [
    { name: 'Em Andamento', value: exec.total_in_progress, color: STATUS_PIE.in_progress },
    { name: 'Concluído', value: exec.total_completed, color: STATUS_PIE.completed },
    { name: 'Atrasado', value: exec.total_delayed, color: '#ef4444' },
    { name: 'Outros', value: Math.max(0, exec.total_projects - exec.total_in_progress - exec.total_completed - exec.total_delayed), color: STATUS_PIE.pending },
  ].filter(d => d.value > 0);

  const summaryCards = isSingle ? [
    { label: 'Etapas', value: exec.total_projects, icon: Layers, gradient: CARD_GRADIENTS[0] },
    { label: 'Em Andamento', value: exec.total_in_progress, icon: Clock, gradient: CARD_GRADIENTS[1] },
    { label: 'Concluídas', value: exec.total_completed, icon: TrendingUp, gradient: CARD_GRADIENTS[2] },
    { label: 'Atrasadas', value: exec.total_delayed, icon: AlertTriangle, gradient: CARD_GRADIENTS[3] },
    { label: 'Colaboradores', value: exec.collaborator_load.length, icon: Users, gradient: CARD_GRADIENTS[4] },
  ] : [
    { label: 'Projetos', value: exec.total_projects, icon: FolderKanban, gradient: CARD_GRADIENTS[0] },
    { label: 'Em Andamento', value: exec.total_in_progress, icon: Clock, gradient: CARD_GRADIENTS[1] },
    { label: 'Concluídos', value: exec.total_completed, icon: TrendingUp, gradient: CARD_GRADIENTS[2] },
    { label: 'Atrasados', value: exec.total_delayed, icon: AlertTriangle, gradient: CARD_GRADIENTS[3] },
    { label: 'Chamados Atendidos', value: exec.unique_tickets_count, icon: Headset, gradient: CARD_GRADIENTS[5] },
    { label: 'Colaboradores', value: exec.collaborator_load.length, icon: Users, gradient: CARD_GRADIENTS[4] },
  ];

  const workSplitData = team ? [
    { name: 'Projetos', value: team.total_project_hours, color: '#4a7fa5' },
    { name: 'Chamados', value: team.total_ticket_hours, color: '#c7b475' },
  ].filter(d => d.value > 0) : [];

  const dailyStackData = (team?.daily_distribution ?? []).slice(-14).map(d => ({
    date: new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    Projetos: d.project_hours,
    Chamados: d.ticket_hours,
  }));

  return (
    <div className="space-y-8">

      {/* ════ HEADER ════ */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <img src="/minerva-logo.svg" alt="Minerva Foods" className="h-7 opacity-80 hidden sm:block" />
          <div className="hidden sm:block w-px h-8 bg-slate-200" />
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {isSingle ? selProj?.name ?? 'Projeto' : 'Dashboard'}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {isSingle ? 'Visão detalhada do projeto' : 'Visão geral — projetos, chamados e time'}
            </p>
          </div>
        </div>
        <div className="relative">
          {isSingle ? (
            <button onClick={() => handleFilter(undefined)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#eef3f8] text-[#1a3550] rounded-xl text-sm font-semibold
                hover:bg-[#dce7f0] transition-all border border-indigo-200/60 shadow-sm">
              <FolderKanban size={15} />
              <span className="max-w-[200px] truncate">{selProj?.name}</span>
              <X size={14} className="text-indigo-400" />
            </button>
          ) : (
            <button onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm
                font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
              <Filter size={15} /> Filtrar Projeto
            </button>
          )}
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden animate-slide-up">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Selecione um projeto</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {projects.map(p => (
                    <button key={p.id} onClick={() => handleFilter(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#eef3f8] transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-[#eef3f8] group-hover:bg-[#dce7f0] flex items-center justify-center shrink-0">
                        <FolderKanban size={14} className="text-[#4a7fa5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-400">{STATUS_LABELS[p.status] ?? p.status}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-[#4a7fa5] shrink-0" />
                    </button>
                  ))}
                  {!projects.length && <p className="px-4 py-8 text-sm text-slate-400 text-center">Nenhum projeto</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ════ CARDS ════ */}
      <div className={`grid gap-4 ${isSingle ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'}`}>
        {summaryCards.map((card, i) => (
          <div key={card.label}
            onClick={() => {
              if (card.label === 'Projetos' || card.label === 'Etapas') navigate('/projects');
              else if (card.label === 'Colaboradores') navigate('/collaborators');
              else if (card.label === 'Chamados Atendidos') navigate('/tickets');
              else if (card.label === 'Atrasados' || card.label === 'Atrasadas') {
                document.getElementById('delayed-section')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg animate-fade-in
              group hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
            <div className="absolute bottom-0 right-0 opacity-[0.08] group-hover:opacity-[0.15] transition-opacity">
              <card.icon size={56} />
            </div>
            <div className="relative">
              <card.icon size={20} className="opacity-80 mb-2" />
              <p className="text-2xl font-black">{card.value}</p>
              <p className="text-xs opacity-80 mt-0.5 font-medium">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {exec.total_delayed > 0 && !isSingle && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200/60 rounded-xl text-sm animate-fade-in">
          <Flame size={15} className="text-red-500 shrink-0" />
          <span className="text-red-700 font-semibold">{exec.total_delayed} projeto(s) atrasado(s)</span>
          <span className="text-red-500">requerem atenção</span>
          <button onClick={() => document.getElementById('delayed-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="ml-auto text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors">
            Ver detalhes <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ════ DISTRIBUICAO DO TRABALHO (projetos vs chamados) ════ */}
      {!isSingle && team && team.total_hours > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
          {/* Donut: split % */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#eaeff5] flex items-center justify-center">
                  <Target size={18} className="text-[#2c5372]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Distribuição do Trabalho</h2>
                  <p className="text-[11px] text-slate-400">Últimos {teamDays} dias</p>
                </div>
              </div>
              <div className="relative">
                <select value={teamDays} onChange={e => setTeamDays(Number(e.target.value))}
                  className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#b4c7d8]">
                  <option value={7}>7 dias</option>
                  <option value={14}>14 dias</option>
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                  <option value={90}>90 dias</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={workSplitData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={4} dataKey="value" strokeWidth={2} stroke="#fff">
                      {workSplitData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(v: number) => `${v.toFixed(1)}h`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-[#4a7fa5]" />
                      <span className="text-xs text-slate-500 font-medium">Projetos</span>
                    </div>
                    <p className="text-xl font-black text-slate-800">{team.total_project_hours.toFixed(0)}h</p>
                    <p className="text-xs text-[#4a7fa5] font-bold">{team.project_pct.toFixed(0)}%</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-[#c7b475]" />
                      <span className="text-xs text-slate-500 font-medium">Chamados</span>
                    </div>
                    <p className="text-xl font-black text-slate-800">{team.total_ticket_hours.toFixed(0)}h</p>
                    <p className="text-xs text-[#c7b475] font-bold">{team.ticket_pct.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-center">
                <span className="text-xs text-slate-400">Total: </span>
                <span className="text-sm font-black text-slate-800">{team.total_hours.toFixed(0)}h</span>
                <span className="text-xs text-slate-400 ml-2">em {teamDays} dias</span>
              </div>
            </div>
          </div>

          {/* Stacked bar: daily distribution */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <BarChart3 size={18} className="text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Horas Diárias do Time</h2>
                <p className="text-[11px] text-slate-400">Projetos vs Chamados — últimos 14 dias</p>
              </div>
            </div>
            <div className="p-5">
              {dailyStackData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyStackData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(v: number) => `${v.toFixed(1)}h`} cursor={{ fill: 'rgba(44,83,114,.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Projetos" stackId="a" fill="#4a7fa5" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Chamados" stackId="a" fill="#c7b475" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <BarChart3 size={36} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">Nenhum dado no período</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ VISAO DO TIME (tabela consolidada) ════ */}
      {!isSingle && team && team.collaborators.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in"
          style={{ animationDelay: '300ms' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <UserCheck size={18} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Visão do Time</h2>
              <p className="text-[11px] text-slate-400">Horas por colaborador — projetos, chamados e aderência à meta de 9h/dia</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-bold">Colaborador</th>
                  <th className="text-center px-3 py-3 font-bold">Projetos</th>
                  <th className="text-center px-3 py-3 font-bold">Chamados</th>
                  <th className="text-center px-3 py-3 font-bold">Total</th>
                  <th className="text-center px-3 py-3 font-bold">Meta</th>
                  <th className="text-center px-3 py-3 font-bold">Aderência</th>
                  <th className="text-center px-3 py-3 font-bold">Média/dia</th>
                  <th className="text-center px-3 py-3 font-bold">Distribuição</th>
                </tr>
              </thead>
              <tbody>
                {team.collaborators.map(c => {
                  const adhColor = c.adherence_pct >= 95 ? 'text-emerald-600 bg-emerald-50' :
                                  c.adherence_pct >= 80 ? 'text-amber-600 bg-amber-50' :
                                  'text-red-600 bg-red-50';
                  return (
                    <tr key={c.id} className="border-t border-slate-50 hover:bg-[#eef3f8]/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/collaborators/${c.id}`)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#dce7f0] flex items-center justify-center text-xs font-bold text-[#2c5372] shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{c.name}</p>
                            {c.role && <p className="text-[10px] text-slate-400">{c.role}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <span className="text-xs font-bold text-[#2c5372]">{c.project_hours.toFixed(1)}h</span>
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <span className="text-xs font-bold text-amber-600">{c.ticket_hours.toFixed(1)}h</span>
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <span className="text-sm font-black text-slate-800">{c.total_hours.toFixed(1)}h</span>
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <span className="text-xs text-slate-500">{c.target_hours.toFixed(0)}h</span>
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${adhColor}`}>
                          {c.adherence_pct.toFixed(0)}%
                        </span>
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <span className="text-xs font-semibold text-slate-600">{c.avg_daily_hours.toFixed(1)}h</span>
                        <span className="text-[10px] text-slate-400"> / {c.working_days}d</span>
                      </td>
                      <td className="px-3 py-3.5">
                        {c.total_hours > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                              <div className="h-full bg-[#4a7fa5] transition-all" style={{ width: `${c.project_pct}%` }} />
                              <div className="h-full bg-amber-500 transition-all" style={{ width: `${c.ticket_pct}%` }} />
                            </div>
                            <span className="text-[9px] text-slate-400 w-12 text-right shrink-0">{c.project_pct.toFixed(0)}%P</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Ticket summary footer */}
          {team.ticket_stats.total_entries > 0 && (
            <div className="px-6 py-3 bg-amber-50/40 border-t border-amber-100/60 flex items-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <Headset size={13} className="text-amber-500" />
                <span className="font-bold text-slate-700">Chamados no período:</span>
              </div>
              <span className="text-slate-600"><strong>{team.ticket_stats.unique_tickets}</strong> chamados únicos</span>
              <span className="text-slate-600"><strong>{team.ticket_stats.total_hours.toFixed(1)}h</strong> trabalhadas</span>
              {team.ticket_stats.unique_tickets > 0 && (
                <span className="text-slate-600">Média <strong>{team.ticket_stats.avg_hours_per_ticket.toFixed(1)}h</strong>/chamado</span>
              )}
              <button onClick={() => navigate('/tickets')} className="ml-auto text-[#4a7fa5] hover:text-[#1a3550] font-bold flex items-center gap-1">
                Ver lançamentos <ArrowRight size={11} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════ SITUAÇÃO POR PROJETO ════ */}
      {exec.project_health.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in"
          style={{ animationDelay: '400ms' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef3f8] flex items-center justify-center">
              <BarChart3 size={18} className="text-[#4a7fa5]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{isSingle ? 'Situação por Etapa' : 'Situação por Projeto'}</h2>
              <p className="text-[11px] text-slate-400">Comparativo individual de horas e prazo</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-bold">{isSingle ? 'Etapa' : 'Projeto'}</th>
                  <th className="text-center px-3 py-3 font-bold">Horas (real / est.)</th>
                  <th className="text-center px-3 py-3 font-bold">Prazo (plan.)</th>
                  <th className="text-center px-3 py-3 font-bold">Situação</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {exec.project_health
                  .sort((a, b) => {
                    const ro: Record<string, number> = { high: 0, medium: 1, low: 2 };
                    return (ro[a.risk_level] ?? 2) - (ro[b.risk_level] ?? 2);
                  })
                  .map(ph => (
                    <tr key={ph.id}
                      className="border-t border-slate-50 hover:bg-[#eef3f8]/30 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/projects/${ph.id}`)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded-full shrink-0 ${
                            ph.risk_level === 'high' ? 'bg-red-400' :
                            ph.risk_level === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
                          }`} />
                          <div>
                            <p className="font-semibold text-slate-800">{ph.name}</p>
                            <p className="text-[10px] text-slate-400">{STATUS_LABELS[ph.status] ?? ph.status}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <span className="text-xs font-semibold text-slate-700">{ph.actual_hours.toFixed(0)}</span>
                        <span className="text-[10px] text-slate-400"> / {ph.planned_hours.toFixed(0)}h</span>
                        {ph.hours_delta !== 0 && (
                          <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            ph.hours_delta > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>{ph.hours_delta > 0 ? '+' : ''}{ph.hours_delta.toFixed(0)}h</span>
                        )}
                      </td>
                      <td className="text-center px-3 py-3.5">
                        {ph.planned_end ? (
                          <span className="text-xs font-semibold text-slate-700">
                            {new Date(ph.planned_end + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Sem prazo</span>
                        )}
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <SituationBadge level={ph.risk_level} />
                      </td>
                      <td className="px-3 py-3.5">
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-[#4a7fa5] transition-colors" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ CARGA POR COLABORADOR ════ */}
      {exec.collaborator_load.length > 0 && isSingle && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in"
          style={{ animationDelay: '440ms' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
              <Users size={18} className="text-cyan-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Carga por Colaborador</h2>
              <p className="text-[11px] text-slate-400">Horas executadas vs capacidade estimada</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {exec.collaborator_load.slice(0, 10).map(cl => {
              const barPct = cl.estimated_capacity > 0 ? Math.min((cl.total_hours / cl.estimated_capacity) * 100, 150) : 0;
              const barColor = barPct > 120 ? '#ef4444' : barPct > 90 ? '#f59e0b' : '#10b981';
              const statusLabel = barPct > 120 ? 'Sobrecarregado' : barPct > 90 ? 'No limite' : 'OK';
              const statusClass = barPct > 120 ? 'bg-red-50 text-red-600 border-red-100' :
                                  barPct > 90 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                  'bg-emerald-50 text-emerald-600 border-emerald-100';
              return (
                <div key={cl.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
                        style={{ backgroundColor: barColor }}>
                        {cl.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-slate-700 truncate block">{cl.name}</span>
                        <span className="text-[10px] text-slate-400">{cl.project_count} {cl.project_count === 1 ? 'projeto' : 'projetos'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-slate-800">{cl.total_hours.toFixed(0)}h</span>
                      {cl.estimated_capacity > 0 && <span className="text-[10px] text-slate-400">de {cl.estimated_capacity.toFixed(0)}h</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusClass}`}>{statusLabel}</span>
                    </div>
                  </div>
                  {cl.estimated_capacity > 0 && (
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${Math.min(barPct / 1.5 * 100, 100)}%`,
                        backgroundColor: barColor,
                        boxShadow: `0 0 6px ${barColor}30`,
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════ ATRASADOS ════ */}
      {delayed.length > 0 && (
        <div id="delayed-section" className="bg-white rounded-2xl border border-red-200/80 shadow-sm overflow-hidden animate-fade-in"
          style={{ animationDelay: '480ms' }}>
          <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-800">{delayed.length} {delayed.length === 1 ? 'item atrasado' : 'itens atrasados'}</h2>
              <p className="text-[11px] text-red-500">Ultrapassaram a data prevista de término</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100/80">
            {delayed.slice(0, 6).map((item, idx) => (
              <div key={`${item.item_type}-${item.id}-${idx}`}
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-red-50/30 cursor-pointer transition-colors group"
                onClick={() => item.item_type === 'project' ? navigate(`/projects/${item.id}`) : undefined}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  item.item_type === 'project' ? 'bg-[#eef3f8]' : item.item_type === 'stage' ? 'bg-amber-50' : 'bg-slate-50'
                }`}>
                  {item.item_type === 'stage' ? <Layers size={15} className="text-amber-500" /> :
                   item.item_type === 'task' ? <CheckSquare size={15} className="text-slate-400" /> :
                   <FolderKanban size={15} className="text-[#4a7fa5]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                  {!isSingle && <p className="text-[11px] text-slate-400">{item.project_name}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-red-600">{item.days_delayed}d</span>
                  <p className="text-[10px] text-slate-400">de atraso</p>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-red-400 transition-colors shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ EVOLUÇÃO ════ */}
      {sCurveData.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in"
          style={{ animationDelay: '520ms' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <TrendingUp size={18} className="text-violet-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Evolução do Trabalho</h2>
              <p className="text-[11px] text-slate-400">Horas acumuladas ao longo do tempo</p>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={sCurveData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a7fa5" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4a7fa5" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 10px 40px -5px rgba(0,0,0,.08)' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="Planejado" stroke="#4a7fa5" strokeWidth={2.5} fill="url(#gradPlanned)" />
                <Area type="monotone" dataKey="Executado" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gradActual)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ════ TIMELINE ════ */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in"
        style={{ animationDelay: '560ms' }}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#eef3f8] flex items-center justify-center">
            <Activity size={18} className="text-[#4a7fa5]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Linha do Tempo</h2>
            <p className="text-[11px] text-slate-400">Planejado vs Executado</p>
          </div>
        </div>
        <div className="p-5">
          <TimelineChart data={timeline} singleProject={isSingle} />
        </div>
      </div>

      {/* ════ GRÁFICOS ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in hover:shadow-md transition-shadow"
          style={{ animationDelay: '600ms' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <BarChart3 size={16} className="text-violet-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{isSingle ? 'Horas por Etapa' : 'Horas por Projeto'}</h2>
              <p className="text-[11px] text-slate-400">Estimadas vs Reais</p>
            </div>
          </div>
          <div className="p-5">
            {exec.project_health.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={exec.project_health.map(h => ({
                  name: h.name.length > 16 ? h.name.slice(0, 16) + '...' : h.name,
                  Estimadas: h.planned_hours, Reais: h.actual_hours,
                }))} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12 }} cursor={{ fill: 'rgba(44,83,114,.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Estimadas" fill="#4a7fa5" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Reais" fill="#c7b475" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <BarChart3 size={36} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Nenhum dado disponível</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in hover:shadow-md transition-shadow"
          style={{ animationDelay: '640ms' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
              <Target size={16} className="text-cyan-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Distribuição por Status</h2>
              <p className="text-[11px] text-slate-400">Panorama atual</p>
            </div>
          </div>
          <div className="p-5">
            {statusPie.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={260}>
                  <PieChart>
                    <Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                      paddingAngle={4} dataKey="value" strokeWidth={2} stroke="#fff">
                      {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {statusPie.map((e, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <span className="text-xs text-slate-600 flex-1 font-medium">{e.name}</span>
                      <span className="text-sm font-bold text-slate-800">{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Target size={36} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Nenhum dado disponível</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
