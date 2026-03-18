import { useMemo } from 'react';
import type { ProjectDetail, Baseline } from '@/types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const DAY = 86400000;
const WEEK = DAY * 7;

const REPLAN_COLORS = [
  '#c7b475',
  '#f97316',
  '#e83948',
  '#d42d3b',
  '#6d9dc0',
];

function toMs(d: string | null): number | null {
  if (!d) return null;
  return new Date(d + 'T00:00:00').getTime();
}

function fmtWeek(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  dashed: boolean;
}

interface Props { project: ProjectDetail }

function collectEndDates(bl: Baseline): (number | null)[] {
  const ends: (number | null)[] = [];
  for (const s of bl.snapshot.stages ?? []) {
    ends.push(toMs(s.replanned_end ?? s.planned_end));
    for (const t of s.tasks ?? []) {
      ends.push(toMs(t.replanned_end ?? t.planned_end));
    }
  }
  return ends;
}

function collectPlannedOnly(bl: Baseline): (number | null)[] {
  const ends: (number | null)[] = [];
  for (const s of bl.snapshot.stages ?? []) {
    ends.push(toMs(s.planned_end));
    for (const t of s.tasks ?? []) {
      ends.push(toMs(t.planned_end));
    }
  }
  return ends;
}

export default function ScheduleView({ project }: Props) {
  const result = useMemo(() => {
    const baselines = project.baselines ?? [];
    const autoBaselines = baselines.filter(bl => bl.is_auto);
    const hasAutoBaselines = autoBaselines.length > 0;

    const currentItems: { pEnd: number | null; rEnd: number | null; aEnd: number | null }[] = [];
    for (const stage of project.stages) {
      currentItems.push({
        pEnd: toMs(stage.planned_end),
        rEnd: toMs(stage.replanned_end),
        aEnd: toMs(stage.actual_end),
      });
      for (const task of stage.tasks) {
        currentItems.push({
          pEnd: toMs(task.planned_end),
          rEnd: toMs(task.replanned_end),
          aEnd: toMs(task.actual_end),
        });
      }
    }

    if (currentItems.length === 0) return null;

    const total = currentItems.length;
    const allDates: number[] = [];
    for (const it of currentItems) {
      if (it.pEnd) allDates.push(it.pEnd);
      if (it.rEnd) allDates.push(it.rEnd);
      if (it.aEnd) allDates.push(it.aEnd);
    }

    const baselineEndSets: (number | null)[][] = [];
    for (const bl of autoBaselines) {
      const ends = collectEndDates(bl);
      baselineEndSets.push(ends);
      for (const e of ends) {
        if (e) allDates.push(e);
      }
    }

    const now = Date.now();
    allDates.push(now);
    const ps = toMs(project.planned_start);
    if (ps) allDates.push(ps);

    const min = Math.min(...allDates);
    const max = Math.max(...allDates);
    const wkStart = min - (min % WEEK) - WEEK;
    const wkEnd = max - (max % WEEK) + WEEK * 2;
    const numWeeks = Math.max(1, Math.ceil((wkEnd - wkStart) / WEEK));
    const todayWeek = Math.floor((now - wkStart) / WEEK) + 1;

    const seriesConfigs: SeriesConfig[] = [];

    if (hasAutoBaselines) {
      const firstBl = autoBaselines[0];
      seriesConfigs.push({
        key: 'bl_original',
        name: 'Planejado Original',
        color: '#4a7fa5',
        dashed: false,
      });

      autoBaselines.forEach((bl, idx) => {
        seriesConfigs.push({
          key: `replan_${idx}`,
          name: bl.name,
          color: REPLAN_COLORS[idx % REPLAN_COLORS.length],
          dashed: true,
        });
      });

      seriesConfigs.push({ key: 'current', name: 'Planejamento Atual', color: '#4a7fa5', dashed: false });
    } else {
      seriesConfigs.push({ key: 'planned', name: 'Planejado', color: '#4a7fa5', dashed: false });
    }
    seriesConfigs.push({ key: 'actual', name: 'Executado', color: '#10b981', dashed: false });

    const firstBlPlannedEnds = hasAutoBaselines ? collectPlannedOnly(autoBaselines[0]) : [];

    const rows: Record<string, unknown>[] = [];
    for (let w = 0; w <= numWeeks; w++) {
      const cutoff = wkStart + w * WEEK;
      const row: Record<string, unknown> = {
        label: fmtWeek(cutoff),
        semana: w + 1,
        isToday: w + 1 === todayWeek,
      };

      if (hasAutoBaselines) {
        let origCount = 0;
        for (const e of firstBlPlannedEnds) {
          if (e && cutoff >= e) origCount++;
        }
        row.bl_original = Math.round((origCount / total) * 100);

        autoBaselines.forEach((_, idx) => {
          const ends = baselineEndSets[idx];
          let count = 0;
          for (const e of ends) {
            if (e && cutoff >= e) count++;
          }
          row[`replan_${idx}`] = Math.round((count / total) * 100);
        });

        let cur = 0;
        for (const it of currentItems) {
          const ref = it.rEnd ?? it.pEnd;
          if (ref && cutoff >= ref) cur++;
        }
        row.current = Math.round((cur / total) * 100);
      } else {
        let p = 0;
        for (const it of currentItems) {
          const ref = it.rEnd ?? it.pEnd;
          if (ref && cutoff >= ref) p++;
        }
        row.planned = Math.round((p / total) * 100);
      }

      let a = 0;
      for (const it of currentItems) {
        if (it.aEnd && cutoff >= it.aEnd) a++;
      }
      row.actual = Math.round((a / total) * 100);

      rows.push(row);
    }

    const last = rows[rows.length - 1];
    const plannedKey = hasAutoBaselines ? 'current' : 'planned';
    const lastPlanned = (last?.[plannedKey] as number) ?? 0;
    const lastActual = (last?.actual as number) ?? 0;

    return { rows, todayLabel: rows.find(r => r.isToday)?.label as string | undefined, last, lastPlanned, lastActual, seriesConfigs, total };
  }, [project]);

  if (!result) {
    return <div className="text-center py-16 text-slate-400">Nenhum item com datas definidas.</div>;
  }

  const { rows, todayLabel, lastPlanned, lastActual, seriesConfigs } = result;

  const gap = lastPlanned - lastActual;
  const gapLabel = gap > 0
    ? `Executado ${gap}pp abaixo do planejado`
    : gap < 0
      ? `Executado ${Math.abs(gap)}pp acima do planejado`
      : 'Executado no ritmo planejado';
  const gapColor = gap > 10 ? 'text-red-500' : gap > 0 ? 'text-amber-500' : 'text-emerald-500';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
      <div className="px-6 py-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Evolução do Projeto</h3>
          <p className="text-xs text-slate-400 mt-0.5">Progresso geral (%) ao longo das semanas</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-5 text-[11px] font-medium text-slate-500 flex-wrap">
            {seriesConfigs.map(cfg => (
              <span key={cfg.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-5 h-[3px] rounded-full"
                  style={{
                    background: cfg.color,
                    ...(cfg.dashed ? { backgroundImage: `repeating-linear-gradient(90deg,${cfg.color} 0 3px,transparent 3px 6px)` } : {}),
                  }}
                />
                {cfg.name}
              </span>
            ))}
          </div>
          <span className={`text-[11px] font-medium ${gapColor}`}>{gapLabel}</span>
        </div>
      </div>

      <div className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={rows} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <defs>
              {seriesConfigs.map(cfg => (
                <linearGradient key={cfg.key} id={`schGrad_${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cfg.color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={cfg.color} stopOpacity={0.01} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={42}
            />

            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                stroke="#ef4444"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: 'Hoje', position: 'insideTopRight', fill: '#ef4444', fontSize: 10, fontWeight: 700 }}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as Record<string, unknown>;
                if (!row) return null;
                return (
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 px-4 py-3 min-w-[200px]">
                    <p className="text-xs font-bold text-slate-700 mb-2 pb-2 border-b border-slate-100">
                      Semana {row.semana as number} — {row.label as string}
                    </p>
                    <div className="space-y-2">
                      {seriesConfigs.map(cfg => (
                        <div key={cfg.key} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                            {cfg.name}
                          </span>
                          <span className="text-sm font-bold" style={{ color: cfg.color }}>{row[cfg.key] as number}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
              cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
            />

            {seriesConfigs.map(cfg => (
              <Area
                key={cfg.key}
                type="monotone"
                dataKey={cfg.key}
                stroke={cfg.color}
                strokeWidth={2.5}
                strokeDasharray={cfg.dashed ? '6 3' : undefined}
                fill={`url(#schGrad_${cfg.key})`}
                dot={false}
                activeDot={{ r: 4, fill: cfg.color, stroke: 'white', strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
        <div className="flex items-center gap-6 text-xs text-slate-500 flex-wrap">
          {seriesConfigs.map(cfg => {
            const last = rows[rows.length - 1];
            return (
              <span key={cfg.key}>
                {cfg.name} <strong style={{ color: cfg.color }} className="ml-1">{last?.[cfg.key] as number ?? 0}%</strong>
              </span>
            );
          })}
        </div>
        <span className="text-[11px] text-slate-400">{rows.length} semanas</span>
      </div>
    </div>
  );
}
