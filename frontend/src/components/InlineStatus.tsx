import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_LABELS } from '@/types';
import { Circle, Loader, CheckCircle2, XCircle, Clock, ChevronDown } from 'lucide-react';

const BADGE_STYLES: Record<string, { bg: string; text: string; icon: typeof Circle }> = {
  planning:    { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   icon: Clock },
  pending:     { bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-600',  icon: Circle },
  in_progress: { bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',  icon: Loader },
  completed:   { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 },
  cancelled:   { bg: 'bg-red-50 border-red-200',     text: 'text-red-600',    icon: XCircle },
};

const ALL_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const STAGE_STATUSES = ['pending', 'in_progress', 'completed'];
const PROJECT_STATUSES = ['planning', 'in_progress', 'completed', 'cancelled'];

interface Props {
  status: string;
  onChange: (newStatus: string) => void;
  type?: 'task' | 'stage' | 'project';
}

export default function InlineStatus({ status, onChange, type = 'task' }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  const style = BADGE_STYLES[status] ?? BADGE_STYLES.pending;
  const Icon = style.icon;
  const options = type === 'project' ? PROJECT_STATUSES : type === 'stage' ? STAGE_STATUSES : ALL_STATUSES;

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${style.bg} ${style.text} transition-all hover:shadow-md hover:scale-105 cursor-pointer group`}
      >
        <Icon size={12} className={status === 'in_progress' ? 'animate-spin' : ''} />
        {STATUS_LABELS[status] ?? status}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''} opacity-50 group-hover:opacity-100`} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 py-1.5 min-w-[160px] animate-fade-in"
          style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map(s => {
            const st = BADGE_STYLES[s] ?? BADGE_STYLES.pending;
            const Ic = st.icon;
            const isCurrent = s === status;
            return (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); if (!isCurrent) onChange(s); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors ${isCurrent ? 'bg-slate-50 font-bold' : 'hover:bg-slate-50'}`}
              >
                <Ic size={13} className={`${st.text} ${s === 'in_progress' ? 'animate-spin' : ''}`} />
                <span className={st.text}>{STATUS_LABELS[s] ?? s}</span>
                {isCurrent && <span className="ml-auto text-[10px] text-slate-400">atual</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
