import { useState, useRef, type ReactNode } from 'react';
import { STATUS_LABELS } from '@/types';
import { Calendar, Clock, Users, AlertTriangle } from 'lucide-react';

interface TooltipData {
  name: string;
  status: string;
  planned_start?: string | null;
  planned_end?: string | null;
  estimated_hours?: number;
  actual_hours?: number;
  collaborators?: { name: string }[];
  extra?: { label: string; value: string }[];
}

interface Props {
  data: TooltipData;
  children: ReactNode;
}

function fmt(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
  catch { return d; }
}

export default function RichTooltip({ data, children }: Props) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = (e: React.MouseEvent) => {
    clearTimeout(timeoutRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    timeoutRef.current = setTimeout(() => setShow(true), 400);
  };

  const handleLeave = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShow(false), 150);
  };

  const overBudget = (data.estimated_hours ?? 0) > 0 && (data.actual_hours ?? 0) > (data.estimated_hours ?? 0);
  const isOverdue = data.planned_end && data.planned_end < new Date().toISOString().slice(0, 10) && data.status !== 'completed' && data.status !== 'cancelled';

  return (
    <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="relative inline-block">
      {children}
      {show && (
        <div
          className="fixed z-[200] pointer-events-none animate-fade-in"
          style={{ left: `${pos.x}px`, top: `${pos.y}px`, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-slate-900 text-white rounded-xl px-4 py-3 shadow-2xl text-xs max-w-[280px] pointer-events-auto"
            onMouseEnter={() => clearTimeout(timeoutRef.current)}
            onMouseLeave={handleLeave}>
            <p className="font-bold text-sm mb-2 truncate">{data.name}</p>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : data.status === 'in_progress' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-300'}`}>
                  {STATUS_LABELS[data.status] ?? data.status}
                </span>
                {isOverdue && <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> Atrasado</span>}
                {overBudget && <span className="text-red-400 flex items-center gap-1"><Clock size={10} /> Acima</span>}
              </div>

              {(data.planned_start || data.planned_end) && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Calendar size={10} className="text-slate-500" />
                  {fmt(data.planned_start)} → {fmt(data.planned_end)}
                </div>
              )}

              {((data.estimated_hours ?? 0) > 0 || (data.actual_hours ?? 0) > 0) && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Clock size={10} className="text-slate-500" />
                  <span className={overBudget ? 'text-red-400 font-bold' : ''}>{(data.actual_hours ?? 0).toFixed(1)}h</span>
                  <span className="text-slate-500">/</span>
                  <span>{(data.estimated_hours ?? 0).toFixed(1)}h</span>
                </div>
              )}

              {data.collaborators && data.collaborators.length > 0 && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Users size={10} className="text-slate-500" />
                  {data.collaborators.slice(0, 3).map(c => c.name).join(', ')}
                  {data.collaborators.length > 3 && ` +${data.collaborators.length - 3}`}
                </div>
              )}

              {data.extra?.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-slate-400">
                  <span>{e.label}</span>
                  <span className="text-slate-200 font-medium">{e.value}</span>
                </div>
              ))}
            </div>

            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}
