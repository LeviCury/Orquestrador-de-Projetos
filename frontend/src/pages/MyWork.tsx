import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Collaborator, MyWorkSummary, MyTaskItem, TicketHourEntry } from '@/types';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/types';
import { getCollaborators, getMyWork, updateTask, quickTimeEntry, getTicketHours, getDailyHours } from '@/api/client';
import type { DailyHoursSummary } from '@/types';
import HoursInput from '@/components/HoursInput';
import InlineStatus from '@/components/InlineStatus';
import { SkeletonCard } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import {
  User, Clock, AlertTriangle, CalendarClock, Target,
  ArrowRight, TrendingUp, Flame, Play, Check, Timer, Headset,
} from 'lucide-react';

function formatDateHuman(d: string | null): string {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const target = new Date(d + 'T00:00:00').getTime();
  const todayMidnight = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime();
  return Math.round((target - todayMidnight) / 86400000);
}

export default function MyWork() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [selectedCollab, setSelectedCollab] = useState<number>(0);
  const [data, setData] = useState<MyWorkSummary | null>(null);
  const [recentTicketHours, setRecentTicketHours] = useState<TicketHourEntry[]>([]);
  const [dailyHours, setDailyHours] = useState<DailyHoursSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickHoursId, setQuickHoursId] = useState<number | null>(null);
  const [quickHoursVal, setQuickHoursVal] = useState(0);
  const [quickHoursDate, setQuickHoursDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    getCollaborators(true, true).then(c => {
      setCollabs(c);
      if (c.length > 0) setSelectedCollab(c[0].id);
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedCollab) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const [work, ticketH, hours] = await Promise.all([
        getMyWork(selectedCollab),
        getTicketHours({ collaborator_id: selectedCollab, date_from: weekAgo, date_to: today }).catch(() => [] as TicketHourEntry[]),
        getDailyHours(selectedCollab).catch(() => null),
      ]);
      setData(work);
      setRecentTicketHours(ticketH);
      setDailyHours(hours);
    } catch {}
    finally { setLoading(false); }
  }, [selectedCollab]);

  useEffect(() => { loadData(); }, [loadData]);

  const changeStatus = async (taskId: number, status: string) => {
    try {
      await updateTask(taskId, { status });
      toast('success', `Status: ${STATUS_LABELS[status] ?? status}`);
      await loadData();
    } catch { toast('error', 'Erro ao atualizar status'); }
  };

  const submitQuickHours = async (item: MyTaskItem) => {
    if (!quickHoursVal || !selectedCollab || !quickHoursDate) {
      if (!quickHoursDate) toast('error', 'Selecione a data do lançamento');
      return;
    }
    try {
      await quickTimeEntry({
        collaborator_id: selectedCollab, project_id: item.project_id,
        stage_id: item.stage_id, task_id: item.task_id,
        hours_worked: quickHoursVal, description: `Lançamento rápido - ${item.task_name}`,
        entry_date: quickHoursDate,
      });
      toast('success', 'Horas registradas!');
      window.dispatchEvent(new CustomEvent('hours-updated'));
      setQuickHoursId(null); setQuickHoursVal(0); setQuickHoursDate(new Date().toISOString().slice(0, 10));
      await loadData();
    } catch { toast('error', 'Erro ao registrar horas'); }
  };

  const goToProject = (item: MyTaskItem) => navigate(`/projects/${item.project_id}`);

  function TaskRow({ item }: { item: MyTaskItem }) {
    const isOverdue = item.planned_end && item.planned_end < new Date().toISOString().slice(0, 10);
    const days = daysUntil(item.planned_end);
    const hoursPct = item.estimated_hours > 0 ? Math.round((item.actual_hours / item.estimated_hours) * 100) : 0;

    return (
      <div className="group">
        <div className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-[#eef3f8]/50 transition-colors">
          {/* Left indicator */}
          <div className={`w-1.5 h-10 rounded-full shrink-0 ${
            isOverdue ? 'bg-red-400' : item.task_status === 'in_progress' ? 'bg-amber-400' : 'bg-slate-200'
          }`} />

          {/* Main content */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => goToProject(item)}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-800 group-hover:text-[#2c5372] transition-colors">{item.task_name}</span>
              <InlineStatus status={item.task_status} onChange={async (s) => { try { const today = new Date().toISOString().slice(0, 10); const p: Record<string, unknown> = { status: s }; if (s === 'in_progress') p.actual_start = today; if (s === 'completed') p.actual_end = today; await updateTask(item.task_id, p); toast('success', 'Status atualizado!'); loadData(); } catch { toast('error', 'Erro'); } }} type="task" />
              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${
                item.task_priority === 'high' || item.task_priority === 'critical' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-500 border border-slate-100'
              }`}>
                {PRIORITY_LABELS[item.task_priority] ?? item.task_priority}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="font-medium text-slate-500">{item.project_name}</span>
              <span>{item.stage_name}</span>
              {item.planned_end && (
                <span className={`font-semibold ${isOverdue ? 'text-red-500' : days !== null && days <= 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {isOverdue ? `${Math.abs(days!)}d atrasada` : days === 0 ? 'Vence hoje' : days !== null && days <= 3 ? `${days}d restantes` : formatDateHuman(item.planned_end)}
                </span>
              )}
              {item.estimated_hours > 0 && (
                <span className={`${hoursPct > 100 ? 'text-red-500 font-semibold' : ''}`}>
                  {item.actual_hours.toFixed(1)}h/{item.estimated_hours.toFixed(0)}h
                </span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.task_status === 'pending' && (
              <button onClick={() => changeStatus(item.task_id, 'in_progress')}
                className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Iniciar">
                <Play size={14} />
              </button>
            )}
            {item.task_status === 'in_progress' && (
              <button onClick={() => changeStatus(item.task_id, 'completed')}
                className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Concluir">
                <Check size={14} />
              </button>
            )}
            <button onClick={() => setQuickHoursId(quickHoursId === item.task_id ? null : item.task_id)}
              className="p-1.5 text-[#4a7fa5] hover:bg-[#eef3f8] rounded-lg transition-colors" title="Lançar horas">
              <Timer size={14} />
            </button>
            <button onClick={() => goToProject(item)}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title="Abrir projeto">
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Quick hours inline form */}
        {quickHoursId === item.task_id && (
          <div className="flex items-center gap-2 pl-10 pr-3.5 pb-3 animate-fade-in">
            <input type="date" value={quickHoursDate}
              onChange={(e) => setQuickHoursDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#4a7fa5]/20 outline-none"
              required title="Data *" />
            <HoursInput value={quickHoursVal}
              onChange={v => setQuickHoursVal(v)}
              className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#4a7fa5]/20 outline-none"
              compact />
            <button onClick={() => submitQuickHours(item)}
              disabled={!quickHoursVal || !quickHoursDate}
              className="px-3 py-1.5 bg-[#4a7fa5] text-white rounded-lg text-xs font-semibold hover:bg-[#2c5372] disabled:opacity-50 transition-colors shadow-sm">
              Salvar
            </button>
            <button onClick={() => { setQuickHoursId(null); setQuickHoursVal(0); setQuickHoursDate(new Date().toISOString().slice(0, 10)); }}
              className="px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Meu Trabalho</h1>
          <p className="text-slate-500 mt-1">Suas tarefas, prazos e horas</p>
        </div>
        <div className="flex items-center gap-2">
          <User size={16} className="text-slate-400" />
          <select value={selectedCollab} onChange={e => setSelectedCollab(Number(e.target.value))}
            className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none bg-white min-w-[200px]">
            <option value={0}>Selecione o colaborador...</option>
            {collabs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : !data ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-16 text-center">
          <User size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Selecione um colaborador para ver o resumo</p>
        </div>
      ) : (
        <>
          {/* Daily hours progress */}
          {dailyHours && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-[#4a7fa5]" />
                  <h2 className="text-sm font-bold text-slate-800">Meta Diária — {dailyHours.target_hours}h</h2>
                </div>
                <span className={`text-lg font-black ${dailyHours.pct >= 100 ? 'text-emerald-600' : dailyHours.pct >= 70 ? 'text-[#2c5372]' : 'text-amber-600'}`}>
                  {dailyHours.total_hours}h <span className="text-xs font-medium text-slate-400">/ {dailyHours.target_hours}h</span>
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full transition-all duration-700 ${dailyHours.pct >= 100 ? 'bg-emerald-500' : dailyHours.pct >= 70 ? 'bg-[#4a7fa5]' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(dailyHours.pct, 100)}%` }} />
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Target size={12} className="text-[#4a7fa5]" /> Projetos: <strong>{dailyHours.project_hours}h</strong></span>
                <span className="flex items-center gap-1"><Headset size={12} className="text-amber-500" /> Chamados: <strong>{dailyHours.ticket_hours}h</strong></span>
                {dailyHours.remaining > 0 ? (
                  <span className="ml-auto font-bold text-amber-600">Faltam {dailyHours.remaining}h</span>
                ) : (
                  <span className="ml-auto font-bold text-emerald-600">Meta atingida!</span>
                )}
              </div>
            </div>
          )}

          {/* Stat cards with gradients */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Tarefas Ativas', value: data.tasks.length, icon: Target, gradient: 'from-[#2c5372] to-[#4a7fa5]' },
              { label: 'Chamados (7d)', value: `${recentTicketHours.reduce((s, e) => s + e.hours_worked, 0).toFixed(1)}h`, icon: Headset, gradient: 'from-cyan-500 to-blue-500' },
              { label: 'Horas Hoje', value: `${data.hours_today.toFixed(1)}h`, icon: Clock, gradient: 'from-amber-500 to-orange-500' },
              { label: 'Horas na Semana', value: `${data.hours_this_week.toFixed(1)}h`, icon: TrendingUp, gradient: 'from-emerald-500 to-teal-500' },
              { label: 'Atrasadas', value: data.overdue_tasks.length, icon: Flame, gradient: data.overdue_tasks.length > 0 ? 'from-red-500 to-rose-600' : 'from-slate-400 to-slate-500' },
            ].map((card, i) => (
              <div key={card.label} className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg animate-fade-in group hover:scale-[1.02] transition-transform"
                style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
                <div className="absolute bottom-0 right-0 opacity-[0.08] group-hover:opacity-[0.15] transition-opacity">
                  <card.icon size={56} />
                </div>
                <div className="relative">
                  <card.icon size={20} className="opacity-80 mb-2" />
                  <p className="text-3xl font-black">{card.value}</p>
                  <p className="text-sm opacity-80 mt-1 font-medium">{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Overdue */}
          {data.overdue_tasks.length > 0 && (
            <div className="bg-white rounded-2xl border border-red-200/60 overflow-hidden shadow-sm animate-fade-in">
              <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-red-800">Tarefas Atrasadas</h2>
                  <p className="text-[11px] text-red-500">{data.overdue_tasks.length} tarefa(s) atrasada(s) - ação necessária</p>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {data.overdue_tasks.map(t => <TaskRow key={t.task_id} item={t} />)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming */}
            <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm animate-fade-in">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <CalendarClock size={18} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Prazos Próximos</h2>
                  <p className="text-[11px] text-slate-400">Próximos 3 dias</p>
                </div>
              </div>
              {data.upcoming_deadlines.length === 0 ? (
                <p className="text-slate-300 text-sm text-center py-8">Nenhum prazo próximo</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {data.upcoming_deadlines.map(t => <TaskRow key={t.task_id} item={t} />)}
                </div>
              )}
            </div>

            {/* All active tasks */}
            <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm animate-fade-in">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#eef3f8] flex items-center justify-center">
                  <Target size={18} className="text-[#4a7fa5]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Todas as Tarefas Ativas</h2>
                  <p className="text-[11px] text-slate-400">{data.tasks.length} tarefa(s)</p>
                </div>
              </div>
              {data.tasks.length === 0 ? (
                <p className="text-slate-300 text-sm text-center py-8">Nenhuma tarefa atribuída</p>
              ) : (
                <div className="divide-y divide-slate-50 max-h-[450px] overflow-y-auto">
                  {data.tasks.map(t => <TaskRow key={t.task_id} item={t} />)}
                </div>
              )}
            </div>
          </div>

          {/* Recent ticket hours */}
          {recentTicketHours.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm animate-fade-in">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                  <Headset size={18} className="text-cyan-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Horas de Chamados (últimos 7 dias)</h2>
                  <p className="text-[11px] text-slate-400">{recentTicketHours.length} lançamento(s)</p>
                </div>
                <button onClick={() => navigate('/tickets')} className="ml-auto text-xs text-[#4a7fa5] hover:text-[#1a3550] font-medium flex items-center gap-1">
                  Ver todos <ArrowRight size={12} />
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {recentTicketHours.slice(0, 8).map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[#eef3f8]/30 transition-colors cursor-pointer" onClick={() => navigate('/tickets')}>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Headset size={14} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {e.glpi_ticket_id && <span className="font-mono text-[#2c5372] mr-1">#{e.glpi_ticket_id}</span>}
                        {e.glpi_ticket_title || 'Chamado GLPI'}
                      </p>
                      <p className="text-[11px] text-slate-400">{new Date(e.entry_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{e.hours_worked}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
