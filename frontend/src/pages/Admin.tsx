import { useState, useEffect } from 'react';
import type { Collaborator } from '@/types';
import { getAuthUsers, getPendingUsers, approveUser, rejectUser, updateUserRole } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { Shield, ShieldCheck, Users, Eye, UserCog, Crown, CheckCircle2, XCircle, Clock, UserPlus, Loader2, Star, Briefcase } from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Eye; desc: string }> = {
  viewer:  { label: 'Visualizador',  color: 'bg-slate-100 text-slate-700',  icon: Eye,       desc: 'Somente leitura. Pode visualizar projetos, dashboards e colaboradores. Não pode criar, editar, excluir ou lançar horas' },
  analyst: { label: 'Analista',      color: 'bg-[#eef3f8] text-[#2c5372]', icon: Briefcase, desc: 'Cria projetos, etapas e tarefas. Único perfil que lança horas (projetos e chamados)' },
  manager: { label: 'Gerente',       color: 'bg-[#fdf9f1] text-[#9a8750]', icon: UserCog,   desc: 'Visão de todos os projetos e dashboards de equipe. Não lança horas' },
  admin:   { label: 'Administrador', color: 'bg-[#fef2f3] text-[#e83948]', icon: Crown,     desc: 'Acesso total. Gerencia usuários, aprovações e permissões. Não lança horas' },
};

export default function Admin() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Collaborator[]>([]);
  const [pending, setPending] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const isOwner = currentUser?.is_owner ?? false;

  const load = async () => {
    try {
      const [u, p] = await Promise.all([getAuthUsers(), getPendingUsers()]);
      setUsers(u);
      setPending(p);
    } catch { toast('error', 'Erro ao carregar usuários'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (userId: number) => {
    setActionLoading(userId);
    try {
      await approveUser(userId);
      toast('success', 'Usuário aprovado com sucesso!');
      load();
    } catch { toast('error', 'Erro ao aprovar usuário'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (userId: number) => {
    setActionLoading(userId);
    try {
      await rejectUser(userId);
      toast('success', 'Solicitação rejeitada.');
      load();
    } catch { toast('error', 'Erro ao rejeitar usuário'); }
    finally { setActionLoading(null); }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    const newIsAdmin = newRole === 'admin';
    try {
      await updateUserRole(userId, newRole, newIsAdmin);
      toast('success', 'Permissão atualizada!');
      load();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast('error', typeof detail === 'string' ? detail : 'Erro ao atualizar permissão');
    }
  };

  if (!currentUser?.is_admin) {
    return (
      <div className="text-center py-20">
        <Shield size={48} className="text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-semibold">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const canEditRole = (target: Collaborator): boolean => {
    if (target.is_owner) return false;
    if (target.id === currentUser.id) return false;
    if (target.is_admin && !isOwner) return false;
    return true;
  };

  const availableRolesFor = (target: Collaborator): string[] => {
    if (!isOwner && target.is_admin) return [];
    if (isOwner) return Object.keys(ROLE_CONFIG);
    return Object.keys(ROLE_CONFIG).filter(r => r !== 'admin');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#e83948] to-[#f08a94] flex items-center justify-center shadow-lg shadow-[#e83948]/20">
          <ShieldCheck size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Administração</h1>
          <p className="text-sm text-slate-400">Gerencie usuários, aprovações e permissões</p>
        </div>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center">
              <UserPlus size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-amber-800">Aguardando aprovação</span>
              <span className="ml-2 text-xs font-bold bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">{pending.length}</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {pending.map(u => (
              <div key={u.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-white text-sm font-bold flex items-center justify-center">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                    {(u.department || u.job_title) && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {[u.job_title, u.department].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 text-amber-500">
                    <Clock size={12} />
                    <span className="text-[10px] font-bold uppercase">Pendente</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(u.id)}
                    disabled={actionLoading === u.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {actionLoading === u.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleReject(u.id)}
                    disabled={actionLoading === u.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All users */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <Users size={16} className="text-[#2c5372]" />
          <span className="font-bold text-slate-700">Usuários ({users.length})</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Usuário</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Departamento</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Permissão</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const role = ROLE_CONFIG[u.system_role] ?? ROLE_CONFIG.viewer;
                const isSelf = u.id === currentUser.id;
                const editable = canEditRole(u);
                const roleOptions = availableRolesFor(u);
                return (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center ${
                          u.is_owner ? 'bg-gradient-to-br from-[#c7b475] to-[#d9c48e]' : 'bg-gradient-to-br from-[#4a7fa5] to-[#6d9dc0]'
                        }`}>
                          {u.name.charAt(0)}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-700 text-sm">{u.name}</span>
                          {u.is_owner && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold uppercase">
                              <Star size={8} /> Proprietário
                            </span>
                          )}
                          {u.is_admin && !u.is_owner && <span className="text-[9px] bg-[#fef2f3] text-[#e83948] px-1.5 py-0.5 rounded-md font-bold uppercase">Admin</span>}
                          {isSelf && <span className="text-[9px] bg-[#eaeff5] text-[#2c5372] px-1.5 py-0.5 rounded-md font-bold">Você</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.department || u.job_title ? (
                        <div>
                          {u.department && <div className="text-sm text-slate-700 font-medium">{u.department}</div>}
                          {u.job_title && <div className="text-[11px] text-slate-400">{u.job_title}</div>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {!u.approved ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                          <Clock size={10} /> Pendente
                        </span>
                      ) : !u.active ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500">Inativo</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">Ativo</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.is_owner ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 border border-amber-200">
                          <Star size={12} /> Proprietário
                        </span>
                      ) : editable ? (
                        <select
                          value={u.system_role}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${role.color} hover:shadow-md`}
                        >
                          {roleOptions.map(k => (
                            <option key={k} value={k}>{ROLE_CONFIG[k].label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${role.color} opacity-60`}>
                          {role.label}
                          {isSelf && <span className="text-[9px] ml-1.5 opacity-70">(você)</span>}
                          {!isSelf && u.is_admin && !isOwner && <span className="text-[9px] ml-1.5 opacity-70">(Protegido)</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm">Níveis de Permissão</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(ROLE_CONFIG).map(([, v]) => {
            const RIcon = v.icon;
            return (
              <div key={v.label} className={`flex items-center gap-3 p-3 rounded-xl ${v.color} border border-current/10`}>
                <RIcon size={18} />
                <div>
                  <span className="text-sm font-bold">{v.label}</span>
                  <p className="text-[10px] opacity-70">{v.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
