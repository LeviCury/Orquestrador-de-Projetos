import { useMemo } from 'react';
import { differenceInDays, parseISO, format, addDays, startOfWeek, eachWeekOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Stage, Baseline } from '@/types';
import { STATUS_LABELS } from '@/types';
import { BarChart3 } from 'lucide-react';

interface Props {
  stages: Stage[];
  projectStart: string | null;
  projectEnd: string | null;
  baselines: Baseline[];
}

const STATUS_BAR_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  planning: '#4a7fa5',
  in_progress: '#c7b475',
  completed: '#34d399',
  cancelled: '#e83948',
};

const BASELINE_COLORS = [
  '#2c5372',
  '#c7b475',
  '#f97316',
  '#e83948',
  '#d42d3b',
  '#6d9dc0',
];

type GanttItem = {
  id: string;
  name: string;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  replanned_start: string | null;
  replanned_end: string | null;
  indent: boolean;
  baselineDates: { start: string | null; end: string | null }[];
};

function findBaselineDates(
  baselines: Baseline[],
  itemType: 'stage' | 'task',
  itemId: number,
): { start: string | null; end: string | null }[] {
  return baselines.map(bl => {
    for (const s of bl.snapshot.stages ?? []) {
      if (itemType === 'stage' && s.id === itemId) {
        return {
          start: s.replanned_start ?? s.planned_start,
          end: s.replanned_end ?? s.planned_end,
        };
      }
      if (itemType === 'task') {
        for (const t of s.tasks ?? []) {
          if (t.id === itemId) {
            return {
              start: t.replanned_start ?? t.planned_start,
              end: t.replanned_end ?? t.planned_end,
            };
          }
        }
      }
    }
    return { start: null, end: null };
  });
}

export default function GanttChart({ stages, projectStart, projectEnd, baselines }: Props) {
  const { items, minDate, maxDate, totalDays, weeks, baselineNames } = useMemo(() => {
    const items: GanttItem[] = [];
    const allDates: Date[] = [];

    if (projectStart) allDates.push(parseISO(projectStart));
    if (projectEnd) allDates.push(parseISO(projectEnd));

    for (const stage of stages) {
      const stageBL = findBaselineDates(baselines, 'stage', stage.id);
      items.push({
        id: `s-${stage.id}`, name: stage.name, status: stage.status,
        planned_start: stage.planned_start, planned_end: stage.planned_end,
        actual_start: stage.actual_start, actual_end: stage.actual_end,
        replanned_start: stage.replanned_start, replanned_end: stage.replanned_end,
        indent: false, baselineDates: stageBL,
      });

      if (stage.planned_start) allDates.push(parseISO(stage.planned_start));
      if (stage.planned_end) allDates.push(parseISO(stage.planned_end));
      if (stage.actual_start) allDates.push(parseISO(stage.actual_start));
      if (stage.actual_end) allDates.push(parseISO(stage.actual_end));
      if (stage.replanned_start) allDates.push(parseISO(stage.replanned_start));
      if (stage.replanned_end) allDates.push(parseISO(stage.replanned_end));

      for (const task of stage.tasks) {
        const taskBL = findBaselineDates(baselines, 'task', task.id);
        items.push({
          id: `t-${task.id}`, name: task.name, status: task.status,
          planned_start: task.planned_start, planned_end: task.planned_end,
          actual_start: task.actual_start, actual_end: task.actual_end,
          replanned_start: task.replanned_start, replanned_end: task.replanned_end,
          indent: true, baselineDates: taskBL,
        });

        if (task.planned_start) allDates.push(parseISO(task.planned_start));
        if (task.planned_end) allDates.push(parseISO(task.planned_end));
        if (task.actual_start) allDates.push(parseISO(task.actual_start));
        if (task.actual_end) allDates.push(parseISO(task.actual_end));
        if (task.replanned_start) allDates.push(parseISO(task.replanned_start));
        if (task.replanned_end) allDates.push(parseISO(task.replanned_end));
      }
    }

    for (const bl of baselines) {
      for (const s of bl.snapshot.stages ?? []) {
        if (s.planned_start) allDates.push(parseISO(s.planned_start));
        if (s.planned_end) allDates.push(parseISO(s.planned_end));
        for (const t of s.tasks ?? []) {
          if (t.planned_start) allDates.push(parseISO(t.planned_start));
          if (t.planned_end) allDates.push(parseISO(t.planned_end));
        }
      }
    }

    if (allDates.length === 0) {
      const today = new Date();
      allDates.push(today, addDays(today, 30));
    }

    const timestamps = allDates.map(d => d.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = addDays(new Date(Math.max(...timestamps)), 7);
    const totalDays = Math.max(differenceInDays(maxDate, minDate), 1);
    const weeks = eachWeekOfInterval({ start: startOfWeek(minDate), end: maxDate }, { weekStartsOn: 1 });

    const baselineNames = baselines.map(bl => bl.name);

    return { items, minDate, maxDate, totalDays, weeks, baselineNames };
  }, [stages, projectStart, projectEnd, baselines]);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
        <BarChart3 size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-400">Nenhuma etapa com datas definidas</p>
      </div>
    );
  }

  const dayToPercent = (d: Date) => (differenceInDays(d, minDate) / totalDays) * 100;
  const hasBaselines = baselines.length > 0;
  const rowHeight = hasBaselines ? 14 + baselines.length * 10 + 20 : 40;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#eef3f8] flex items-center justify-center"><BarChart3 size={16} className="text-[#4a7fa5]" /></div>
        <div>
          <h3 className="font-bold text-slate-800">Gráfico de Gantt</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {hasBaselines
              ? 'Compare linhas de base, replanejamentos e execução real'
              : 'Barras escuras = previsto · Barras claras = real'}
          </p>
        </div>
      </div>
      <div className="flex overflow-x-auto">
        <div className="shrink-0 w-64 border-r border-slate-100 bg-slate-50/50">
          <div className="h-10 border-b border-slate-100 px-4 flex items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Item</div>
          {items.map(item => (
            <div key={item.id} className="border-b border-slate-50 px-4 flex items-center text-sm" style={{ height: rowHeight, paddingLeft: item.indent ? '2rem' : '1rem' }}>
              <span className={`truncate ${item.indent ? 'text-slate-500' : 'font-semibold text-slate-700'}`}>{item.name}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-[600px]">
          <div className="h-10 border-b border-slate-100 flex relative">
            {weeks.map((w, i) => {
              const left = dayToPercent(w);
              const nextW = weeks[i + 1] ?? maxDate;
              const width = dayToPercent(nextW) - left;
              if (left >= 100) return null;
              return (
                <div key={w.toISOString()} className="absolute top-0 h-full border-r border-slate-100 flex items-center px-2 text-xs text-slate-400 font-medium"
                  style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}>
                  {format(w, 'dd MMM', { locale: ptBR })}
                </div>
              );
            })}
          </div>

          {items.map(item => {
            const color = STATUS_BAR_COLORS[item.status] ?? '#94a3b8';

            const bars: React.ReactNode[] = [];
            let yOffset = 4;
            const barH = item.indent ? 7 : 8;
            const gap = 3;

            if (hasBaselines) {
              item.baselineDates.forEach((bd, idx) => {
                if (bd.start && bd.end) {
                  const left = dayToPercent(parseISO(bd.start));
                  const right = dayToPercent(parseISO(bd.end));
                  const width = Math.max(right - left, 0.5);
                  const blColor = BASELINE_COLORS[idx % BASELINE_COLORS.length];
                  bars.push(
                    <div key={`bl-${idx}`} className="absolute rounded-sm" style={{
                      left: `${left}%`, width: `${width}%`, top: yOffset,
                      height: barH, backgroundColor: blColor, opacity: 0.5,
                    }} title={`${baselineNames[idx]}: ${bd.start} → ${bd.end}`} />
                  );
                }
                yOffset += barH + gap;
              });

              const effStart = item.replanned_start ?? item.planned_start;
              const effEnd = item.replanned_end ?? item.planned_end;
              if (effStart && effEnd) {
                const left = dayToPercent(parseISO(effStart));
                const right = dayToPercent(parseISO(effEnd));
                const width = Math.max(right - left, 0.5);
                bars.push(
                  <div key="current" className="absolute rounded-sm" style={{
                    left: `${left}%`, width: `${width}%`, top: yOffset,
                    height: barH, backgroundColor: color, opacity: 0.9,
                  }} title={`Atual: ${effStart} → ${effEnd}`} />
                );
              }
              yOffset += barH + gap;

              if (item.actual_start) {
                const endDate = item.actual_end ?? format(new Date(), 'yyyy-MM-dd');
                const left = dayToPercent(parseISO(item.actual_start));
                const right = dayToPercent(parseISO(endDate));
                const width = Math.max(right - left, 0.5);
                bars.push(
                  <div key="actual" className="absolute rounded-sm border-2 border-dashed" style={{
                    left: `${left}%`, width: `${width}%`, top: yOffset,
                    height: barH, backgroundColor: '#10b981', opacity: 0.4, borderColor: '#10b981',
                  }} title={`Real: ${item.actual_start} → ${item.actual_end ?? 'em andamento'}`} />
                );
              }
            } else {
              if (item.planned_start && item.planned_end) {
                const left = dayToPercent(parseISO(item.planned_start));
                const right = dayToPercent(parseISO(item.planned_end));
                const width = Math.max(right - left, 0.5);
                bars.push(
                  <div key="planned" className="absolute rounded-md" style={{
                    left: `${left}%`, width: `${width}%`,
                    top: item.indent ? 12 : 8, height: item.indent ? 8 : 10,
                    backgroundColor: color, opacity: 0.9,
                  }} title={`Previsto: ${item.planned_start} → ${item.planned_end}`} />
                );
              }
              if (item.actual_start) {
                const endDate = item.actual_end ?? format(new Date(), 'yyyy-MM-dd');
                const left = dayToPercent(parseISO(item.actual_start));
                const right = dayToPercent(parseISO(endDate));
                const width = Math.max(right - left, 0.5);
                bars.push(
                  <div key="actual" className="absolute rounded-md border-2 border-dashed" style={{
                    left: `${left}%`, width: `${width}%`,
                    top: item.indent ? 24 : 22, height: item.indent ? 8 : 10,
                    backgroundColor: color, opacity: 0.35, borderColor: color,
                  }} title={`Real: ${item.actual_start} → ${item.actual_end ?? 'em andamento'}`} />
                );
              }
            }

            return (
              <div key={item.id} className="border-b border-slate-50 relative" style={{ height: rowHeight }}>
                {weeks.map(w => { const left = dayToPercent(w); if (left >= 100) return null; return <div key={w.toISOString()} className="absolute top-0 h-full border-r border-slate-50" style={{ left: `${left}%` }} />; })}
                {(() => { const todayPct = dayToPercent(new Date()); if (todayPct >= 0 && todayPct <= 100) return <div className="absolute top-0 h-full w-px bg-red-400/60 z-10" style={{ left: `${todayPct}%` }} />; return null; })()}
                {bars}
              </div>
            );
          })}
        </div>
      </div>
      <div className="p-4 border-t border-slate-100 flex items-center gap-5 text-xs text-slate-400 flex-wrap">
        {hasBaselines ? (
          <>
            {baselines.map((bl, idx) => (
              <div key={bl.id} className="flex items-center gap-1.5">
                <div className="w-5 h-2 rounded" style={{ backgroundColor: BASELINE_COLORS[idx % BASELINE_COLORS.length], opacity: 0.5 }} />
                {bl.name}
              </div>
            ))}
            <div className="flex items-center gap-1.5"><div className="w-5 h-2 bg-slate-400 rounded" /> Atual</div>
            <div className="flex items-center gap-1.5"><div className="w-5 h-2 bg-emerald-500/40 rounded border border-dashed border-emerald-500" /> Real</div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5"><div className="w-5 h-2 bg-slate-400 rounded" /> Previsto</div>
            <div className="flex items-center gap-1.5"><div className="w-5 h-2 bg-slate-400/35 rounded border border-dashed border-slate-400" /> Real</div>
          </>
        )}
        <div className="flex items-center gap-1.5"><div className="w-px h-3.5 bg-red-400" /> Hoje</div>
        {Object.entries(STATUS_BAR_COLORS).map(([status, clr]) => (
          <div key={status} className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: clr }} /><span>{STATUS_LABELS[status] ?? status}</span></div>
        ))}
      </div>
    </div>
  );
}
