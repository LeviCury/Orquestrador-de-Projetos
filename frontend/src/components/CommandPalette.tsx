import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, Layers, CheckSquare, User, X } from 'lucide-react';
import { globalSearch } from '@/api/client';
import type { SearchResult } from '@/types';
import { STATUS_LABELS } from '@/types';

const TYPE_ICONS: Record<string, typeof FolderKanban> = {
  project: FolderKanban, stage: Layers, task: CheckSquare, collaborator: User,
};
const TYPE_LABELS: Record<string, string> = {
  project: 'Projeto', stage: 'Etapa', task: 'Tarefa', collaborator: 'Colaborador',
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(prev => !prev); }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 100); setQuery(''); setResults([]); setSelected(0); }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); return; }
    setLoading(true);
    try { setResults(await globalSearch(q)); setSelected(0); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  const navigateTo = (result: SearchResult) => {
    setOpen(false);
    if (result.type === 'project') navigate(`/projects/${result.id}`);
    else if (result.type === 'stage' && result.project_id) navigate(`/projects/${result.project_id}`);
    else if (result.type === 'task' && result.project_id) navigate(`/projects/${result.project_id}`);
    else if (result.type === 'collaborator') navigate('/collaborators');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && results[selected]) navigateTo(results[selected]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up border border-slate-200/60" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input ref={inputRef} type="text" placeholder="Buscar projetos, etapas, tarefas, colaboradores..." className="flex-1 outline-none text-sm text-slate-800 placeholder-slate-400 bg-transparent" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} />
          <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"><X size={14} className="text-slate-400" /></button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && <div className="px-5 py-8 text-center"><div className="w-6 h-6 mx-auto rounded-lg bg-gradient-to-br from-[#e83948] to-[#c7b475] animate-spin" /></div>}
          {!loading && query && results.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">Nenhum resultado encontrado</div>
          )}
          {!loading && results.map((r, i) => {
            const Icon = TYPE_ICONS[r.type] ?? CheckSquare;
            return (
              <button key={`${r.type}-${r.id}`} onClick={() => navigateTo(r)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-all ${i === selected ? 'bg-[#eef3f8] border-l-2 border-l-[#e83948]' : 'hover:bg-slate-50 border-l-2 border-l-transparent'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i === selected ? 'bg-[#dce7f0] text-[#2c5372]' : 'bg-slate-100 text-slate-400'}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate text-slate-800">{r.name}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-lg text-slate-500 font-medium">{TYPE_LABELS[r.type]}</span>
                    {r.status && <span className="text-[10px] px-2 py-0.5 bg-[#eef3f8] rounded-lg text-[#2c5372] font-medium">{STATUS_LABELS[r.status] ?? r.status}</span>}
                  </div>
                  {r.description && <p className="text-xs text-slate-400 truncate mt-0.5">{r.description}</p>}
                  {r.project_name && <p className="text-xs text-slate-400">em <span className="font-medium">{r.project_name}</span></p>}
                </div>
              </button>
            );
          })}
        </div>
        {!query && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-center gap-5">
            <span><kbd className="px-1.5 py-0.5 bg-slate-100 rounded-md text-[10px] font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="px-1.5 py-0.5 bg-slate-100 rounded-md text-[10px] font-mono">Enter</kbd> abrir</span>
            <span><kbd className="px-1.5 py-0.5 bg-slate-100 rounded-md text-[10px] font-mono">Esc</kbd> fechar</span>
          </div>
        )}
      </div>
    </div>
  );
}
