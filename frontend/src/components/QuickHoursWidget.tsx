import { useState, useEffect, useCallback } from 'react';
import {
  Clock, X, Check, Zap, FolderKanban, Headset, CheckCircle2, ChevronUp,
} from 'lucide-react';
import type { Project, Stage, DailyHoursSummary } from '@/types';
import HoursInput from '@/components/HoursInput';
import {
  getProjects, getStages, quickTimeEntry, createTicketHour, getDailyHours,
  checkTicketDuplicate, type DuplicateCheckResult,
} from '@/api/client';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import useGlpiLookup from '@/hooks/useGlpiLookup';

type EntryMode = 'project' | 'ticket';

export default function QuickHoursWidget() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('project');
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [daily, setDaily] = useState<DailyHoursSummary | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const [projectForm, setProjectForm] = useState({
    project_id: 0, stage_id: 0, task_id: 0, hours: 0, desc: '', entry_date: new Date().toISOString().slice(0, 10),
  });
  const [ticketForm, setTicketForm] = useState({
    hours: 0, entry_date: new Date().toISOString().slice(0, 10), glpi_ticket_title: '', glpi_link: '',
  });

  const glpi = useGlpiLookup(ticketForm.glpi_link);
  const [dupWarning, setDupWarning] = useState<DuplicateCheckResult | null>(null);
  const [dupOverride, setDupOverride] = useState(false);

  const isAnalyst = user?.system_role === 'analyst';

  const loadDaily = useCallback(() => {
    if (!user?.id || !isAnalyst) return;
    getDailyHours(user.id).then(setDaily).catch(() => {});
  }, [user?.id, isAnalyst]);

  useEffect(() => {
    loadDaily();
    const i = setInterval(loadDaily, 60000);
    const handler = () => loadDaily();
    window.addEventListener('hours-updated', handler);
    return () => { clearInterval(i); window.removeEventListener('hours-updated', handler); };
  }, [loadDaily]);

  useEffect(() => {
    if (!showForm || !isAnalyst) return;
    getProjects().then(setProjects);
  }, [showForm, isAnalyst]);

  useEffect(() => {
    if (projectForm.project_id) getStages(projectForm.project_id).then(setStages).catch(() => setStages([]));
    else setStages([]);
    setProjectForm(f => ({ ...f, stage_id: 0, task_id: 0 }));
  }, [projectForm.project_id]);

  const selectedStage = stages.find(s => s.id === projectForm.stage_id);
  const tasks = selectedStage?.tasks ?? [];

  useEffect(() => {
    if (glpi.info?.title && !ticketForm.glpi_ticket_title) {
      setTicketForm(f => ({ ...f, glpi_ticket_title: glpi.info!.title }));
    }
  }, [glpi.info]);

  const resetForms = () => {
    setProjectForm({ project_id: 0, stage_id: 0, task_id: 0, hours: 0, desc: '', entry_date: new Date().toISOString().slice(0, 10) });
    setTicketForm({ hours: 0, entry_date: new Date().toISOString().slice(0, 10), glpi_ticket_title: '', glpi_link: '' });
    glpi.reset();
    setDupWarning(null);
    setDupOverride(false);
  };

  const handleProjectSubmit = async () => {
    if (!user?.id || !projectForm.hours || !projectForm.project_id || !projectForm.entry_date) return;
    const hrs = projectForm.hours;
    setSaving(true);
    try {
      await quickTimeEntry({
        collaborator_id: user.id, project_id: projectForm.project_id,
        stage_id: projectForm.stage_id || null, task_id: projectForm.task_id || null,
        hours_worked: projectForm.hours, description: projectForm.desc,
        entry_date: projectForm.entry_date,
      });
      setSuccess(true);
      toast('success', `${hrs}h registradas em projeto!`);
      window.dispatchEvent(new CustomEvent('hours-updated'));
      setTimeout(() => { setSuccess(false); resetForms(); setShowForm(false); loadDaily(); }, 1200);
    } catch { toast('error', 'Erro ao registrar horas'); }
    finally { setSaving(false); }
  };

  const handleTicketSubmit = async () => {
    if (!user?.id || !ticketForm.hours || !ticketForm.entry_date) return;
    const ticketId = ticketForm.glpi_link.match(/[?&]id=(\d+)/)?.[1] ?? '';

    if (ticketId && !dupOverride) {
      try {
        const dup = await checkTicketDuplicate(ticketId, user.id, ticketForm.entry_date);
        if (dup.exists) {
          setDupWarning(dup);
          return;
        }
      } catch { /* proceed */ }
    }

    setSaving(true);
    try {
      await createTicketHour({
        collaborator_id: user.id, entry_date: ticketForm.entry_date,
        hours_worked: ticketForm.hours, glpi_ticket_id: ticketId,
        glpi_ticket_title: ticketForm.glpi_ticket_title, glpi_link: ticketForm.glpi_link,
      });
      setSuccess(true);
      toast('success', `Horas registradas em chamado!`);
      window.dispatchEvent(new CustomEvent('hours-updated'));
      setTimeout(() => { setSuccess(false); resetForms(); setShowForm(false); loadDaily(); }, 1200);
    } catch { toast('error', 'Erro ao registrar horas'); }
    finally { setSaving(false); }
  };

  if (!isAnalyst) return null;

  const pct = daily ? Math.min(daily.pct, 100) : 0;
  const done = daily ? daily.pct >= 100 : false;
  const selectCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none bg-white transition-all';

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => { setExpanded(!expanded); if (expanded) { setShowForm(false); resetForms(); } }}
        className={`fixed bottom-6 right-6 z-50 shadow-2xl transition-all duration-300 text-white ${
          expanded
            ? 'w-11 h-11 rounded-xl bg-slate-700 hover:bg-slate-800 p-0 flex items-center justify-center'
            : 'rounded-2xl p-3.5 bg-gradient-to-br from-[#1a3550] to-[#2c5372] hover:from-[#0c1a2a] hover:to-[#1a3550] hover:scale-105 shadow-[#1a3550]/40'
        }`}
        title="Horas"
      >
        {expanded ? <X size={18} /> : (
          <div className="flex items-center gap-2">
            <Clock size={18} />
            {daily && (
              <span className={`text-xs font-bold ${done ? 'text-emerald-400' : 'text-white/90'}`}>
                {daily.total_hours}h
              </span>
            )}
          </div>
        )}
      </button>

      {/* Panel */}
      {expanded && (
        <div className="fixed bottom-20 right-6 z-50 w-[340px] bg-white rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200/60 overflow-hidden animate-slide-up">

          {/* Daily Summary Header */}
          {daily && (
            <div className="bg-gradient-to-r from-[#0c1a2a] via-[#1a3550] to-[#2c5372] text-white px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={11} /> Horas Hoje
                </span>
                {done ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                    <CheckCircle2 size={12} /> Meta atingida
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-white/80">
                    {daily.total_hours}h <span className="text-white/40">/ {daily.target_hours}h</span>
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    done ? 'bg-emerald-400' : pct >= 60 ? 'bg-[#c7b475]' : 'bg-[#e83948]'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Breakdown */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-white/60">
                  <FolderKanban size={11} className="text-[#6d9dc0]" />
                  <span className="font-semibold text-white/80">{daily.project_hours}h</span>
                  <span className="text-white/30">projetos</span>
                </span>
                <span className="flex items-center gap-1.5 text-white/60">
                  <Headset size={11} className="text-[#c7b475]" />
                  <span className="font-semibold text-white/80">{daily.ticket_hours}h</span>
                  <span className="text-white/30">chamados</span>
                </span>
                {!done && daily.remaining > 0 && (
                  <span className="text-[#e83948] font-bold text-[10px]">-{daily.remaining}h</span>
                )}
              </div>
            </div>
          )}

          {/* Form toggle */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-[#2c5372] hover:bg-[#eef3f8] transition-colors"
            >
              <Zap size={16} className="text-[#e83948]" /> Lançamento Rápido
              <ChevronUp size={14} className="text-slate-400 ml-auto" />
            </button>
          ) : success ? (
            <div className="p-8 text-center">
              <div className="inline-flex p-3 bg-emerald-50 rounded-2xl mb-2"><Check size={28} className="text-emerald-500" /></div>
              <p className="font-bold text-emerald-700 text-sm">Registrado!</p>
            </div>
          ) : (
            <div className="p-4">
              {/* Type tabs */}
              <div className="flex bg-slate-100 rounded-lg p-0.5 mb-3">
                <button onClick={() => setEntryMode('project')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${entryMode === 'project' ? 'bg-white text-[#2c5372] shadow-sm' : 'text-slate-500'}`}>
                  <FolderKanban size={13} /> Projeto
                </button>
                <button onClick={() => setEntryMode('ticket')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${entryMode === 'ticket' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'}`}>
                  <Headset size={13} /> Chamado
                </button>
              </div>

              {entryMode === 'project' ? (
                <div className="space-y-2.5">
                  <select className={selectCls} value={projectForm.project_id} onChange={e => setProjectForm(f => ({ ...f, project_id: Number(e.target.value) }))}>
                    <option value={0}>Projeto *</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {projectForm.project_id > 0 && stages.length > 0 && (
                    <select className={selectCls} value={projectForm.stage_id} onChange={e => setProjectForm(f => ({ ...f, stage_id: Number(e.target.value), task_id: 0 }))}>
                      <option value={0}>Etapa (opcional)</option>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  {projectForm.stage_id > 0 && tasks.length > 0 && (
                    <select className={selectCls} value={projectForm.task_id} onChange={e => setProjectForm(f => ({ ...f, task_id: Number(e.target.value) }))}>
                      <option value={0}>Tarefa (opcional)</option>
                      {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 pl-0.5">Data *</label>
                      <input type="date" className={selectCls} value={projectForm.entry_date} onChange={e => setProjectForm(f => ({ ...f, entry_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 pl-0.5">Horas *</label>
                      <HoursInput value={projectForm.hours} onChange={v => setProjectForm(f => ({ ...f, hours: v }))} className={selectCls} compact />
                    </div>
                  </div>
                  <input type="text" placeholder="Descrição breve (opcional)" className={selectCls} value={projectForm.desc} onChange={e => setProjectForm(f => ({ ...f, desc: e.target.value }))} />
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleProjectSubmit} disabled={saving || !projectForm.hours || !projectForm.project_id || !projectForm.entry_date}
                      className="flex-1 py-2.5 bg-[#e83948] text-white rounded-lg font-semibold text-sm hover:bg-[#d42d3b] disabled:opacity-50 transition-all shadow-lg shadow-[#e83948]/20">
                      {saving ? 'Salvando...' : 'Registrar'}
                    </button>
                    <button onClick={() => { setShowForm(false); resetForms(); }} className="px-3 py-2.5 text-slate-400 hover:bg-slate-100 rounded-lg text-sm transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 pl-0.5">Data *</label>
                      <input type="date" className={selectCls} value={ticketForm.entry_date} onChange={e => setTicketForm(f => ({ ...f, entry_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 pl-0.5">Horas *</label>
                      <HoursInput value={ticketForm.hours} onChange={v => setTicketForm(f => ({ ...f, hours: v }))} className={selectCls} compact />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 pl-0.5">Link do Chamado GLPI</label>
                    <input placeholder="https://central.minervafoods.com/...?id=123" className={selectCls} value={ticketForm.glpi_link} onChange={e => setTicketForm(f => ({ ...f, glpi_link: e.target.value }))} />
                    {glpi.loading && <span className="text-[10px] text-slate-400 mt-0.5 block pl-0.5 animate-pulse">Buscando chamado...</span>}
                    {glpi.info && (
                      <div className="mt-1 px-2 py-1.5 bg-[#eef3f8] rounded-lg border border-[#4a7fa5]/20">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-[#2c5372]">#{glpi.info.id}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${glpi.info.status_id <= 3 ? 'bg-amber-100 text-amber-700' : glpi.info.status_id <= 4 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{glpi.info.status}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{glpi.info.type}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5 leading-tight truncate">{glpi.info.title}</p>
                        {glpi.info.assigned_to && (
                          <p className="text-[9px] text-slate-500 mt-0.5"><span className="font-semibold text-slate-600">Técnico GLPI:</span> {glpi.info.assigned_to}</p>
                        )}
                        {glpi.info.assigned_to && user?.name && !glpi.info.assigned_to.toLowerCase().includes(user.name.split(' ')[0].toLowerCase()) && (
                          <div className="mt-1 px-1.5 py-1 bg-amber-50 border border-amber-200 rounded text-[9px] text-amber-700 font-medium">
                            ⚠ Você ({user.name}) não é o técnico atribuído neste chamado
                          </div>
                        )}
                      </div>
                    )}
                    {!glpi.loading && !glpi.info && glpi.ticketId && (
                      <span className="text-[10px] text-red-400 mt-0.5 block pl-0.5">Chamado #{glpi.ticketId} não encontrado</span>
                    )}
                  </div>
                  <input placeholder="Título / descrição do chamado" className={selectCls} value={ticketForm.glpi_ticket_title} onChange={e => setTicketForm(f => ({ ...f, glpi_ticket_title: e.target.value }))} />
                  {dupWarning && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-[10px] font-bold text-amber-700 mb-1">
                        ⚠ Já {dupWarning.count === 1 ? 'existe 1 apontamento' : `existem ${dupWarning.count} apontamentos`} para este chamado nesta data
                      </p>
                      {dupWarning.entries.map(e => (
                        <div key={e.id} className="text-[10px] text-amber-800 bg-amber-100/50 px-2 py-0.5 rounded mt-0.5">
                          {new Date(e.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')} — <strong>{e.hours_worked}h</strong>
                        </div>
                      ))}
                      <div className="flex gap-1.5 mt-2">
                        <button onClick={() => { setDupOverride(true); setTimeout(() => handleTicketSubmit(), 50); }}
                          className="px-2.5 py-1 text-[10px] font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600">
                          Lançar mesmo assim
                        </button>
                        <button onClick={() => { setDupWarning(null); setDupOverride(false); }}
                          className="px-2.5 py-1 text-[10px] text-amber-600 bg-amber-100 rounded-lg hover:bg-amber-200">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleTicketSubmit} disabled={saving || !ticketForm.hours || !ticketForm.entry_date}
                      className="flex-1 py-2.5 bg-[#e83948] text-white rounded-lg font-semibold text-sm hover:bg-[#d42d3b] disabled:opacity-50 transition-all shadow-lg shadow-[#e83948]/20">
                      {saving ? 'Salvando...' : 'Registrar'}
                    </button>
                    <button onClick={() => { setShowForm(false); resetForms(); }} className="px-3 py-2.5 text-slate-400 hover:bg-slate-100 rounded-lg text-sm transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
