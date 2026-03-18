import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Collaborator } from '@/types';
import { getCollaborators, updateCollaborator, deleteCollaborator, authenticatedUrl } from '@/api/client';
import { SkeletonCard } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Trash2, UserCircle, Mail, Briefcase, ArrowRight, Search,
  Power, Building2, Linkedin, Link2,
} from 'lucide-react';

const AVATAR_COLORS = [
  'from-[#2c5372] to-[#4a7fa5]', 'from-[#4a7fa5] to-[#6d9dc0]', 'from-[#c7b475] to-[#d9c48e]',
  'from-[#e83948] to-[#f08a94]', 'from-[#2c5372] to-[#c7b475]', 'from-[#4a7fa5] to-[#c7b475]',
];

export default function Collaborators() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.is_admin ?? false;

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    try { setCollaborators(await getCollaborators()); } catch { toast('error', 'Erro ao carregar colaboradores'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchCollaborators(); }, [fetchCollaborators]);

  const handleToggleActive = async (c: Collaborator) => {
    setTogglingId(c.id);
    try {
      await updateCollaborator(c.id, { active: !c.active });
      toast('success', c.active ? `${c.name} desativado` : `${c.name} ativado`);
      await fetchCollaborators();
    } catch { toast('error', 'Erro ao alterar status'); }
    finally { setTogglingId(null); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCollaborator(id);
      setDeleteConfirmId(null);
      toast('success', 'Colaborador excluído.');
      await fetchCollaborators();
    } catch { toast('error', 'Erro ao excluir'); }
  };

  const filtered = collaborators
    .filter(c =>
      !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase()) ||
      (c.department || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aIsMe = a.id === currentUser?.id ? 0 : 1;
      const bIsMe = b.id === currentUser?.id ? 0 : 1;
      return aIsMe - bIsMe || a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Colaboradores</h1>
        <p className="text-slate-500 mt-1">{collaborators.length} colaborador(es)</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email, função ou departamento..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2c5372]/20 focus:border-[#6d9dc0] outline-none transition-all bg-white" />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-16 text-center">
          <UserCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => {
            const isMe = c.id === currentUser?.id;
            const avatarUrl = c.avatar_url && c.avatar_url.length > 1 ? authenticatedUrl(c.avatar_url) : null;
            const hasLinkedIn = c.personal_link?.includes('linkedin.com');

            return (
              <div key={c.id}
                className={`group rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden animate-fade-in cursor-pointer ${
                  isMe
                    ? 'bg-white border-[#4a7fa5] ring-2 ring-[#6d9dc0]/20'
                    : c.active
                      ? 'bg-white border-slate-200/60 hover:border-[#b4cde0]'
                      : 'bg-white border-slate-200/40 opacity-60'
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => navigate(`/collaborators/${c.id}`)}>

                {/* Banner + avatar */}
                <div className={`h-20 bg-gradient-to-r ${isMe ? 'from-[#2c5372] to-[#6d9dc0]' : AVATAR_COLORS[c.id % AVATAR_COLORS.length]} relative ${!c.active && !isMe ? 'grayscale' : ''}`}>
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
                  <div className="absolute -bottom-7 left-5">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={c.name}
                        className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-lg" />
                    ) : (
                      <div className={`w-14 h-14 rounded-xl shadow-lg flex items-center justify-center text-xl font-bold border-2 border-white ${
                        isMe ? 'bg-[#2c5372] text-white' : 'bg-white text-slate-600'
                      }`}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {isMe && (
                    <div className="absolute top-2.5 right-3 px-2.5 py-0.5 bg-white/90 text-[#2c5372] text-[10px] rounded-lg font-bold backdrop-blur-sm shadow-sm">
                      Você
                    </div>
                  )}
                  {!c.active && !isMe && (
                    <div className="absolute top-2.5 right-3 px-2 py-0.5 bg-black/30 text-white text-[10px] rounded-lg font-medium backdrop-blur-sm">
                      Inativo
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="pt-10 px-5 pb-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className={`font-bold text-[15px] truncate transition-colors ${
                        isMe ? 'text-[#2c5372]' : c.active ? 'text-slate-800 group-hover:text-[#2c5372]' : 'text-slate-500'
                      }`}>
                        {c.name}
                      </h3>
                      {c.job_title && (
                        <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{c.job_title}</p>
                      )}
                    </div>
                    {c.personal_link && (
                      <a href={c.personal_link} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 w-7 h-7 rounded-lg bg-slate-50 hover:bg-[#0077B5]/10 flex items-center justify-center transition-colors"
                        title={hasLinkedIn ? 'LinkedIn' : 'Link pessoal'}>
                        {hasLinkedIn
                          ? <Linkedin size={13} className="text-[#0077B5]" />
                          : <Link2 size={13} className="text-slate-400" />
                        }
                      </a>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[13px] text-slate-500">
                      <Mail size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                    {c.department && (
                      <div className="flex items-center gap-2 text-[13px] text-slate-500">
                        <Building2 size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{c.department}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[13px] text-slate-500">
                      <Briefcase size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{c.role || '—'}</span>
                    </div>
                  </div>

                  {/* Admin actions or "Ver perfil" */}
                  {isAdmin ? (
                    <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-slate-100">
                      {c.id !== currentUser?.id && !c.is_owner && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(c); }}
                          disabled={togglingId === c.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg font-semibold transition-colors ${
                            c.active
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          } disabled:opacity-50`}
                        >
                          <Power size={12} />
                          {togglingId === c.id ? '...' : c.active ? 'Desativar' : 'Ativar'}
                        </button>
                      )}

                      {!c.active && c.id !== currentUser?.id && !c.is_owner && (
                        deleteConfirmId === c.id ? (
                          <div className="flex gap-1 items-center animate-fade-in" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleDelete(c.id)} className="px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded-lg font-semibold">Confirmar</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.id); }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-red-500 hover:bg-red-50 rounded-lg font-semibold transition-colors">
                            <Trash2 size={12} /> Excluir
                          </button>
                        )
                      )}

                      <span className="flex items-center gap-1 text-[11px] text-[#6d9dc0] opacity-0 group-hover:opacity-100 transition-opacity font-semibold ml-auto">
                        Ver perfil <ArrowRight size={11} />
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end mt-4 pt-3.5 border-t border-slate-100">
                      <span className="flex items-center gap-1 text-[11px] text-[#6d9dc0] opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                        Ver perfil <ArrowRight size={11} />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
