import { useState, useEffect, useCallback } from 'react';
import {
  Headset, Plus, Clock, Trash2, ExternalLink,
  FolderKanban, Target, ChevronDown, Hash, TrendingUp,
} from 'lucide-react';
import {
  getTicketHours, createTicketHour, deleteTicketHour,
  getCollaborators, getDailyHours, checkTicketDuplicate,
  type DuplicateCheckResult,
} from '@/api/client';
import type { TicketHourEntry, Collaborator, DailyHoursSummary } from '@/types';
import HoursInput from '@/components/HoursInput';
import useGlpiLookup from '@/hooks/useGlpiLookup';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';

export default function Tickets() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TicketHourEntry[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [daily, setDaily] = useState<DailyHoursSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCollab, setFilterCollab] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const { success, error: showErr } = useToast();

  const isAnalyst = user?.system_role === 'analyst';
  const isManager = user?.system_role === 'manager' || user?.system_role === 'admin';

  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    hours_worked: 0,
    glpi_ticket_title: '',
    glpi_link: '',
  });

  const glpi = useGlpiLookup(form.glpi_link);
  const [dupWarning, setDupWarning] = useState<DuplicateCheckResult | null>(null);
  const [dupOverride, setDupOverride] = useState(false);

  const effectiveFilter = isAnalyst ? user?.id ?? 0 : filterCollab;

  const load = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([
        getTicketHours(effectiveFilter ? { collaborator_id: effectiveFilter } : {}),
        isManager ? getCollaborators(true, true) : Promise.resolve([]),
      ]);
      setEntries(e);
      if (isManager) setCollaborators(c);
      if (user?.id) {
        const d = await getDailyHours(user.id).catch(() => null);
        setDaily(d);
      }
    } catch { showErr('Erro ao carregar'); }
    setLoading(false);
  }, [effectiveFilter, user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    getDailyHours(user.id).then(setDaily).catch(() => {});
  }, [user?.id, entries]);

  useEffect(() => {
    if (glpi.info?.title && !form.glpi_ticket_title) {
      setForm(f => ({ ...f, glpi_ticket_title: glpi.info!.title }));
    }
  }, [glpi.info]);

  const handleSubmit = async () => {
    if (!user?.id || !form.hours_worked || !form.entry_date) {
      showErr('Preencha data e horas');
      return;
    }
    const ticketId = form.glpi_link.match(/[?&]id=(\d+)/)?.[1] ?? '';

    if (ticketId && !dupOverride) {
      try {
        const dup = await checkTicketDuplicate(ticketId, user.id, form.entry_date);
        if (dup.exists) {
          setDupWarning(dup);
          return;
        }
      } catch { /* proceed */ }
    }

    try {
      await createTicketHour({
        collaborator_id: user.id,
        entry_date: form.entry_date,
        hours_worked: form.hours_worked,
        glpi_ticket_id: ticketId,
        glpi_ticket_title: form.glpi_ticket_title,
        glpi_link: form.glpi_link,
      });
      setForm({ entry_date: new Date().toISOString().slice(0, 10), hours_worked: 0, glpi_ticket_title: '', glpi_link: '' });
      glpi.reset();
      setDupWarning(null);
      setDupOverride(false);
      setShowForm(false);
      success('Horas lançadas!');
      await load();
    } catch { showErr('Erro ao lançar'); }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(prev => prev === id ? null : prev), 3000);
      return;
    }
    setDeleteConfirm(null);
    try {
      await deleteTicketHour(id);
      success('Apontamento removido!');
      await load();
    } catch (err) {
      showErr('Erro ao excluir apontamento');
    }
  };

  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

  const grouped = entries.reduce<Record<string, TicketHourEntry[]>>((acc, e) => {
    (acc[e.entry_date] ??= []).push(e);
    return acc;
  }, {});

  const totalByDay = (day: TicketHourEntry[]) => day.reduce((s, e) => s + e.hours_worked, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#4a7fa5] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Headset size={22} className="text-[#4a7fa5]" /> Horas de Chamados
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Apontamento de horas trabalhadas em chamados GLPI</p>
        </div>
        <div className="flex items-center gap-3">
          {isManager && (
            <div className="relative">
              <select value={filterCollab} onChange={e => setFilterCollab(Number(e.target.value))}
                className="appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                <option value={0}>Todos os analistas</option>
                {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
          {isAnalyst && (
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#e83948] text-white rounded-lg text-sm font-medium hover:bg-[#d42d3b] transition-colors">
              <Plus size={16} /> Lançar Horas
            </button>
          )}
        </div>
      </div>

      {/* Daily summary */}
      {daily && isAnalyst && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
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
            {daily.remaining > 0
              ? <span className="ml-auto font-bold text-amber-600">Faltam {daily.remaining}h</span>
              : <span className="ml-auto font-bold text-emerald-600">Meta atingida!</span>}
          </div>
        </div>
      )}

      {/* Summary metrics */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const totalHours = entries.reduce((s, e) => s + e.hours_worked, 0);
            const uniqueTickets = new Set(entries.filter(e => e.glpi_ticket_id).map(e => e.glpi_ticket_id)).size;
            const uniqueDays = new Set(entries.map(e => e.entry_date)).size;
            const avgDaily = uniqueDays > 0 ? totalHours / uniqueDays : 0;
            return [
              { label: 'Lançamentos', value: entries.length, icon: TrendingUp, color: 'text-[#2c5372] bg-[#eef3f8]' },
              { label: 'Horas Totais', value: `${totalHours.toFixed(1)}h`, icon: Clock, color: 'text-amber-600 bg-amber-50' },
              { label: 'Chamados Únicos', value: uniqueTickets, icon: Hash, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Média Diária', value: `${avgDaily.toFixed(1)}h`, icon: Target, color: 'text-violet-600 bg-violet-50' },
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
            ));
          })()}
        </div>
      )}

      {/* Quick form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm animate-fade-in">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Novo lançamento de chamado</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">Data *</label>
              <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">Horas *</label>
              <HoursInput value={form.hours_worked} onChange={v => setForm(f => ({ ...f, hours_worked: v }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">Link do Chamado GLPI</label>
            <input value={form.glpi_link} onChange={e => setForm(f => ({ ...f, glpi_link: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="https://central.minervafoods.com/...?id=123" />
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
          <div className="mt-3">
            <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">Título / Descrição do chamado</label>
            <input value={form.glpi_ticket_title} onChange={e => setForm(f => ({ ...f, glpi_ticket_title: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder={glpi.loading ? 'Buscando...' : 'Correção RPA Faturamento'} />
          </div>
          {dupWarning && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in">
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
              <p className="text-[11px] text-amber-600 mb-2">Deseja lançar mesmo assim?</p>
              <div className="flex gap-2">
                <button onClick={() => { setDupOverride(true); setTimeout(() => handleSubmit(), 50); }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
                  Sim, lançar mesmo assim
                </button>
                <button onClick={() => { setDupWarning(null); setDupOverride(false); }}
                  className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setShowForm(false); setDupWarning(null); setDupOverride(false); setForm({ entry_date: new Date().toISOString().slice(0, 10), hours_worked: 0, glpi_ticket_title: '', glpi_link: '' }); glpi.reset(); }} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button onClick={handleSubmit} className="px-5 py-2 text-sm bg-[#e83948] text-white rounded-lg font-medium hover:bg-[#d42d3b] transition-colors">Lançar</button>
          </div>
        </div>
      )}

      {/* Entries grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <Headset size={48} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-medium">Nenhum lançamento de chamado ainda</p>
          <p className="text-xs text-slate-300 mt-1">Clique em "Lançar Horas" para registrar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([dateStr, dayEntries]) => (
            <div key={dateStr} className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
              {/* Day header */}
              <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50/60 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500">{fmtDate(dateStr)}</span>
                <span className="text-xs font-bold text-[#2c5372]">{totalByDay(dayEntries).toFixed(1)}h</span>
              </div>
              {/* Entries */}
              <div className="divide-y divide-slate-50">
                {dayEntries.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#eef3f8]/20 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Headset size={14} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {e.glpi_ticket_id && <span className="text-xs font-mono text-[#2c5372] font-bold">#{e.glpi_ticket_id}</span>}
                        <span className="text-sm text-slate-700 truncate">{e.glpi_ticket_title || 'Chamado GLPI'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px]">
                        {e.glpi_status && <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[10px]">{e.glpi_status}</span>}
                        {e.glpi_type && <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-[10px]">{e.glpi_type}</span>}
                        {e.glpi_priority && <span className="px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium text-[10px]">{e.glpi_priority}</span>}
                        {e.collaborator && <span className="text-slate-400">Lançado por: {e.collaborator.name}</span>}
                        {e.glpi_assigned_to && <span className="text-slate-400">Técnico GLPI: {e.glpi_assigned_to}</span>}
                        {e.glpi_link && (
                          <a href={e.glpi_link} target="_blank" rel="noopener noreferrer"
                            className="text-[#4a7fa5] hover:text-[#2c5372] flex items-center gap-0.5">
                            <ExternalLink size={10} /> GLPI
                          </a>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-700 shrink-0">{e.hours_worked}h</span>
                    {deleteConfirm === e.id ? (
                      <div className="flex items-center gap-1.5 shrink-0 animate-pulse">
                        <button onClick={() => handleDelete(e.id)}
                          className="px-2 py-1 text-[10px] font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
                          Confirmar
                        </button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-[10px] font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                          Não
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleDelete(e.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
