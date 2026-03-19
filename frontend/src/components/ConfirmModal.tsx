import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, RotateCcw, Info } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'reopen';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description?: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

const VARIANT_CONFIG: Record<ConfirmVariant, {
  icon: typeof AlertTriangle;
  iconBg: string;
  iconColor: string;
  confirmBtn: string;
  accentBar: string;
}> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    confirmBtn: 'bg-red-500 hover:bg-red-600 shadow-red-500/20',
    accentBar: 'from-red-500 to-red-400',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    confirmBtn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
    accentBar: 'from-amber-500 to-amber-400',
  },
  info: {
    icon: Info,
    iconBg: 'bg-[#eef3f8]',
    iconColor: 'text-[#2c5372]',
    confirmBtn: 'bg-[#2c5372] hover:bg-[#1a3550] shadow-[#2c5372]/20',
    accentBar: 'from-[#2c5372] to-[#4a7fa5]',
  },
  reopen: {
    icon: RotateCcw,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    confirmBtn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
    accentBar: 'from-amber-500 to-amber-400',
  },
};

export default function ConfirmModal({
  open, onConfirm, onCancel, title, description, details,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'info',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onCancel]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onCancel} />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-2xl shadow-slate-900/20 w-full max-w-sm overflow-hidden animate-slide-up outline-none"
      >
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${cfg.accentBar}`} />

        <div className="px-6 pt-7 pb-5">
          <div className="flex flex-col items-center text-center">
            <div className={`w-14 h-14 rounded-2xl ${cfg.iconBg} flex items-center justify-center mb-4`}>
              <Icon size={26} className={cfg.iconColor} />
            </div>

            <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>

            {description && (
              <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-[280px]">{description}</p>
            )}

            {details && details.length > 0 && (
              <div className="mt-3 w-full bg-slate-50 rounded-xl px-4 py-3 text-left space-y-1">
                {details.map((d, i) => (
                  <p key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    {d}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 text-sm font-bold text-white rounded-xl transition-all shadow-lg ${cfg.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
