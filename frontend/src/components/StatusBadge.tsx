import { STATUS_LABELS } from '@/types';
import { Circle, Loader, CheckCircle2, XCircle, Clock } from 'lucide-react';

const BADGE_STYLES: Record<string, { bg: string; text: string; icon: typeof Circle }> = {
  planning:    { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   icon: Clock },
  pending:     { bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-600',  icon: Circle },
  in_progress: { bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',  icon: Loader },
  completed:   { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 },
  cancelled:   { bg: 'bg-red-50 border-red-200',     text: 'text-red-600',    icon: XCircle },
};

export default function StatusBadge({ status }: { status: string }) {
  const style = BADGE_STYLES[status] ?? BADGE_STYLES.pending;
  const Icon = style.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${style.bg} ${style.text} transition-colors`}>
      <Icon size={12} className={status === 'in_progress' ? 'animate-spin' : ''} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
