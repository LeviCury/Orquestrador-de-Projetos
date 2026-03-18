import { type ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, subtitle, icon, children, wide }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className={`relative bg-white rounded-3xl shadow-2xl shadow-slate-900/20 w-full max-h-[90vh] overflow-hidden animate-slide-up ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        {/* Header with gradient accent */}
        <div className="relative px-7 pt-6 pb-4 border-b border-slate-100">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e83948] via-[#c7b475] to-[#2c5372] rounded-t-3xl" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#eef3f8] to-[#fdf9f1] flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <h2 className="text-lg font-black text-slate-900">{title}</h2>
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-400 hover:text-slate-600 shrink-0 mt-0.5">
              <X size={18} />
            </button>
          </div>
        </div>
        <div ref={contentRef} className="p-7 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
