import { useState, useMemo, useRef, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Layers, CheckSquare, FolderKanban,
  Clock, CalendarDays, Timer, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import type { ProjectTimeline, TimelineBar } from '@/types';
import { STATUS_LABELS } from '@/types';

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateFull(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

type Health = 'ok' | 'warn' | 'late' | 'neutral';

function getHealth(bar: TimelineBar): Health {
  if (bar.status === 'cancelled') return 'neutral';
  if (bar.days_delta > 0) return 'late';
  if (bar.hours_delta > 0) return 'warn';
  const pe = parseDate(bar.planned_end);
  if (pe && pe < new Date() && bar.status !== 'completed') return 'late';
  if (bar.status === 'completed' && bar.days_delta <= 0 && bar.hours_delta <= 0) return 'ok';
  return 'ok';
}

const HEALTH_STYLES: Record<Health, { bg: string; text: string; border: string; label: string }> = {
  ok:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'No prazo' },
  warn:    { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Atenção' },
  late:    { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Atrasado' },
  neutral: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', label: 'Cancelado' },
};

const PLANNED_BG = '#b4cde0';
const ACTUAL_COLORS: Record<Health, string> = {
  ok: '#22c55e', warn: '#c7b475', late: '#e83948', neutral: '#94a3b8',
};

interface Props {
  data: ProjectTimeline[];
  singleProject?: boolean;
}

interface FlatRow {
  bar: TimelineBar;
  depth: number;
  projectId: number;
}

const LEVEL_ICONS = { project: FolderKanban, stage: Layers, task: CheckSquare };

export default function TimelineChart({ data, singleProject = false }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ bar: TimelineBar; x: number; y: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((key: string) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }, []);

  const { rows, totalDays, origin, months, weeks } = useMemo(() => {
    const allDates: Date[] = [];
    const flat: FlatRow[] = [];

    for (const proj of data) {
      const stages: TimelineBar[] = [];
      const taskMap = new Map<number, TimelineBar[]>();

      for (const b of proj.bars) {
        for (const d of [b.planned_start, b.planned_end, b.actual_start, b.actual_end]) {
          const pd = parseDate(d);
          if (pd) allDates.push(pd);
        }
        if (b.level === 'project') flat.push({ bar: b, depth: 0, projectId: proj.project_id });
        else if (b.level === 'stage') stages.push(b);
        else if (b.level === 'task' && b.parent_id != null) {
          const a = taskMap.get(b.parent_id) ?? [];
          a.push(b);
          taskMap.set(b.parent_id, a);
        }
      }

      if (!collapsed.has(`project-${proj.project_id}`)) {
        for (const s of stages) {
          flat.push({ bar: s, depth: 1, projectId: proj.project_id });
          if (!collapsed.has(`stage-${s.id}`)) {
            for (const t of taskMap.get(s.id) ?? [])
              flat.push({ bar: t, depth: 2, projectId: proj.project_id });
          }
        }
      }
    }

    if (!allDates.length) {
      const t = new Date();
      allDates.push(new Date(t.getTime() - 7 * 86_400_000), new Date(t.getTime() + 30 * 86_400_000));
    }

    const min = new Date(Math.min(...allDates.map(d => d.getTime())));
    const max = new Date(Math.max(...allDates.map(d => d.getTime())));
    min.setDate(min.getDate() - 4);
    max.setDate(max.getDate() + 8);
    const td = Math.max(daysBetween(min, max), 21);

    const ms: { label: string; off: number }[] = [];
    const c = new Date(min); c.setDate(1);
    if (c < min) c.setMonth(c.getMonth() + 1);
    while (c <= max) {
      ms.push({ label: c.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), off: daysBetween(min, c) });
      c.setMonth(c.getMonth() + 1);
    }

    const ws: number[] = [];
    const wc = new Date(min);
    const dow = wc.getDay();
    wc.setDate(wc.getDate() + (dow === 0 ? 1 : 8 - dow));
    while (wc <= max) { ws.push(daysBetween(min, wc)); wc.setDate(wc.getDate() + 7); }

    return { rows: flat, totalDays: td, origin: min, months: ms, weeks: ws };
  }, [data, collapsed]);

  const todayOff = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return daysBetween(origin, t);
  }, [origin]);

  const pct = useCallback((d: number) => (d / totalDays) * 100, [totalDays]);

  const getPos = useCallback((s: string | null, e: string | null) => {
    const sd = parseDate(s), ed = parseDate(e);
    if (!sd) return null;
    return { l: daysBetween(origin, sd), w: ed ? Math.max(daysBetween(sd, ed), 1) : 1 };
  }, [origin]);

  const showTip = useCallback((bar: TimelineBar, e: React.MouseEvent) => {
    const r = chartRef.current?.getBoundingClientRect();
    if (r) setTooltip({ bar, x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);

  if (!data.length || !rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Clock size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">Nenhum dado de timeline</p>
        <p className="text-xs mt-1">Defina datas planejadas para visualizar</p>
      </div>
    );
  }

  const LABEL_W = singleProject ? 220 : 240;
  const BAR_H_PROJECT = 20;
  const BAR_H_STAGE = 16;
  const BAR_H_TASK = 12;
  const ROW_H = 44;

  return (
    <div className="relative" ref={chartRef} onMouseLeave={() => setTooltip(null)}>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-[11px] text-slate-500 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-3 rounded-sm" style={{ backgroundColor: PLANNED_BG }} /> Planejado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-3 rounded-sm" style={{ backgroundColor: ACTUAL_COLORS.ok }} /> No prazo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-3 rounded-sm" style={{ backgroundColor: ACTUAL_COLORS.warn }} /> Horas excedidas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-3 rounded-sm" style={{ backgroundColor: ACTUAL_COLORS.late }} /> Prazo excedido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-4 bg-rose-500 rounded-full" /> Hoje
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        <div style={{ minWidth: LABEL_W + totalDays * 7 + 16 }}>

          {/* Header */}
          <div className="flex sticky top-0 z-30 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200" style={{ height: 30 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W }}
              className="shrink-0 px-3 flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-200">
              Item
            </div>
            <div className="flex-1 relative overflow-hidden">
              {months.map((m, i) => (
                <div key={i} className="absolute top-0 h-full flex items-center text-[10px] font-semibold text-slate-400 pl-2 border-l border-slate-200/60"
                  style={{ left: `${pct(m.off)}%` }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {rows.map((row, idx) => {
            const { bar, depth } = row;
            const key = `${bar.level}-${bar.id}`;
            const canCollapse = bar.level !== 'task' && (bar.children_ids?.length ?? 0) > 0;
            const isCol = collapsed.has(key);
            const Icon = LEVEL_ICONS[bar.level];
            const health = getHealth(bar);
            const hs = HEALTH_STYLES[health];
            const actualCol = ACTUAL_COLORS[health];

            const pl = getPos(bar.planned_start, bar.planned_end);
            const ac = getPos(bar.actual_start, bar.actual_end);

            const isPrj = bar.level === 'project';
            const isStg = bar.level === 'stage';
            const barH = isPrj ? BAR_H_PROJECT : isStg ? BAR_H_STAGE : BAR_H_TASK;
            const barY = (ROW_H - barH) / 2;

            const hasDaysData = bar.planned_days > 0 || bar.actual_days > 0;
            const hasHoursData = bar.estimated_hours > 0 || bar.actual_hours > 0;

            return (
              <div key={key}
                className={`flex group/row transition-colors duration-75 border-b hover:bg-indigo-50/30 ${
                  isPrj ? 'bg-slate-50/60 border-slate-200' :
                  isStg ? 'border-slate-100' :
                  idx % 2 === 0 ? 'border-slate-50' : 'bg-slate-50/20 border-slate-50'
                }`}
                style={{ height: ROW_H }}>

                {/* Label */}
                <div style={{ width: LABEL_W, minWidth: LABEL_W, paddingLeft: 6 + depth * 16 }}
                  className="shrink-0 flex items-center gap-1 pr-2 border-r border-slate-200/50 overflow-hidden">
                  {canCollapse ? (
                    <button onClick={() => toggle(key)}
                      className="p-0.5 rounded hover:bg-slate-200/60 text-slate-400 shrink-0 transition-colors">
                      {isCol ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </button>
                  ) : <span className="w-4 shrink-0" />}

                  <Icon size={12} className={`shrink-0 ${
                    isPrj ? 'text-[#4a7fa5]' : isStg ? 'text-amber-500' : 'text-slate-400'
                  }`} />

                  <span className={`truncate ${
                    isPrj ? 'text-[11px] font-bold text-slate-800' :
                    isStg ? 'text-[11px] font-semibold text-slate-700' :
                    'text-[11px] text-slate-600'
                  }`}>{bar.name}</span>

                  {/* Compact status badges */}
                  {(hasDaysData || hasHoursData) && (
                    <div className="ml-auto flex items-center gap-1 shrink-0 opacity-80 group-hover/row:opacity-100 transition-opacity">
                      {hasDaysData && bar.days_delta !== 0 && (
                        <span className={`text-[9px] font-bold px-1 py-px rounded ${
                          bar.days_delta > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {bar.days_delta > 0 ? '+' : ''}{bar.days_delta}d
                        </span>
                      )}
                      {hasHoursData && bar.hours_delta !== 0 && (
                        <span className={`text-[9px] font-bold px-1 py-px rounded ${
                          bar.hours_delta > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {bar.hours_delta > 0 ? '+' : ''}{bar.hours_delta.toFixed(0)}h
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Gantt */}
                <div className="flex-1 relative">
                  {/* Week grid */}
                  {weeks.map((w, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l border-dashed border-slate-100"
                      style={{ left: `${pct(w)}%` }} />
                  ))}

                  {/* Today */}
                  {todayOff >= 0 && todayOff <= totalDays && (
                    <div className="absolute top-0 bottom-0 z-20" style={{ left: `${pct(todayOff)}%` }}>
                      <div className="w-[2px] h-full bg-rose-500/50 rounded-full" />
                    </div>
                  )}

                  {/* Planned bar (background track) */}
                  {pl && (
                    <div className="absolute rounded-md cursor-pointer"
                      style={{
                        left: `${pct(pl.l)}%`, width: `${pct(pl.w)}%`,
                        top: barY, height: barH,
                        backgroundColor: PLANNED_BG, minWidth: 8,
                      }}
                      onMouseMove={e => showTip(bar, e)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )}

                  {/* Actual bar (overlaid on top of planned) */}
                  {ac && (
                    <div className="absolute rounded-md cursor-pointer shadow-sm"
                      style={{
                        left: `${pct(ac.l)}%`, width: `${pct(ac.w)}%`,
                        top: barY + 2, height: barH - 4,
                        backgroundColor: actualCol, minWidth: 6,
                        opacity: 0.9,
                      }}
                      onMouseMove={e => showTip(bar, e)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )}

                  {/* In-progress pulse */}
                  {bar.actual_start && !bar.actual_end && bar.status === 'in_progress' && (() => {
                    const off = daysBetween(origin, new Date());
                    return (
                      <div className="absolute z-10 animate-pulse"
                        style={{ left: `${pct(off)}%`, top: barY + barH / 2 - 4 }}>
                        <div className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-300/50" />
                      </div>
                    );
                  })()}

                  {/* Overflow stripe: red zone past planned end */}
                  {pl && ac && (ac.l + ac.w) > (pl.l + pl.w) && (
                    <div className="absolute rounded-r-md pointer-events-none"
                      style={{
                        left: `${pct(pl.l + pl.w)}%`,
                        width: `${pct((ac.l + ac.w) - (pl.l + pl.w))}%`,
                        top: barY - 1, height: barH + 2,
                        background: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(239,68,68,0.12) 3px, rgba(239,68,68,0.12) 6px)',
                        borderRight: '2px solid rgba(239,68,68,0.5)',
                        minWidth: 4,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (() => {
        const b = tooltip.bar;
        const h = getHealth(b);
        const hs = HEALTH_STYLES[h];
        const chartW = chartRef.current?.offsetWidth ?? 700;

        const insightText = (() => {
          if (b.estimated_hours <= 0 && b.planned_days <= 0) return null;
          if (b.actual_hours <= 0 && b.actual_days <= 0) return null;
          const hOk = b.hours_delta <= 0;
          const dOk = b.days_delta <= 0;
          if (hOk && dOk) return 'Dentro do prazo e das horas estimadas';
          if (hOk && !dOk) return `Horas OK, mas ${b.days_delta}d além do prazo`;
          if (!hOk && dOk) return `No prazo, mas ${Math.abs(b.hours_delta).toFixed(0)}h a mais que o estimado`;
          return `${b.days_delta}d além do prazo e ${b.hours_delta.toFixed(0)}h acima do estimado`;
        })();

        const DeltaIcon = h === 'ok' ? TrendingDown : h === 'late' ? TrendingUp : Minus;

        return (
          <div className={`absolute z-50 pointer-events-none w-[300px] rounded-2xl shadow-2xl overflow-hidden border-2 ${hs.border}`}
            style={{
              left: Math.min(tooltip.x + 20, chartW - 320),
              top: Math.max(tooltip.y - 60, 4),
              backgroundColor: 'white',
            }}>
            {/* Header */}
            <div className={`px-4 py-3 ${hs.bg}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-[13px] text-slate-800 truncate">{b.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {b.level === 'project' ? 'Projeto' : b.level === 'stage' ? 'Etapa' : 'Tarefa'}
                    {' · '}
                    {STATUS_LABELS[b.status] ?? b.status}
                  </p>
                </div>
                <span className={`shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${hs.bg} ${hs.text} border ${hs.border}`}>
                  <DeltaIcon size={10} />
                  {hs.label}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* Dates grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-indigo-50/50 px-2.5 py-1.5">
                  <p className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider mb-0.5">Planejado</p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    {fmtDateFull(b.planned_start)}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    {fmtDateFull(b.planned_end)}
                  </p>
                </div>
                <div className={`rounded-lg px-2.5 py-1.5 ${
                  b.actual_start ? (h === 'late' ? 'bg-red-50/60' : h === 'warn' ? 'bg-amber-50/60' : 'bg-emerald-50/60') : 'bg-slate-50'
                }`}>
                  <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${
                    !b.actual_start ? 'text-slate-300' : h === 'late' ? 'text-red-400' : h === 'warn' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>Executado</p>
                  <p className="text-[11px] font-semibold text-slate-700">{fmtDateFull(b.actual_start)}</p>
                  <p className="text-[11px] font-semibold text-slate-700">{fmtDateFull(b.actual_end)}</p>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                  <CalendarDays size={14} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase">Dias</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[13px] font-bold text-slate-700">{b.planned_days}</span>
                      <span className="text-[10px] text-slate-400">plan.</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className={`text-[13px] font-bold ${b.days_delta <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {b.actual_days}
                      </span>
                      <span className="text-[10px] text-slate-400">real</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                  <Timer size={14} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase">Horas</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[13px] font-bold text-slate-700">{b.estimated_hours.toFixed(0)}</span>
                      <span className="text-[10px] text-slate-400">plan.</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className={`text-[13px] font-bold ${b.hours_delta <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {b.actual_hours.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-slate-400">real</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Insight */}
              {insightText && (
                <div className={`text-[11px] font-semibold rounded-lg px-3 py-2 border ${hs.bg} ${hs.text} ${hs.border}`}>
                  {insightText}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
