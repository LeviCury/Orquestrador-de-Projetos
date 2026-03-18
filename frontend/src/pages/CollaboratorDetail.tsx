import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Briefcase, FolderKanban, Clock, CheckSquare,
  ArrowRight, AlertTriangle, Building2, MapPin, Phone, Globe,
  User, AtSign, Linkedin, Link2, FileText, ExternalLink,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { STATUS_LABELS } from '@/types';
import { authenticatedUrl, getCollaboratorDetail } from '@/api/client';

interface CollabProject {
  id: number; name: string; status: string;
  estimated_hours: number; actual_hours: number; capacity_share: number;
}
interface CollabTask {
  id: number; name: string; status: string; priority: string;
  planned_end: string | null; stage_name: string; project_name: string; project_id: number | null;
}
interface CollabDetail {
  id: number; name: string; email: string; role: string; active: boolean;
  avatar_url: string; bio: string; personal_phone: string; personal_link: string;
  total_hours: number; project_count: number; active_task_count: number;
  projects: CollabProject[]; tasks: CollabTask[];
  username: string; first_name: string; last_name: string; full_name: string;
  user_principal_name: string; job_title: string; department: string;
  company: string; manager: string; description: string; office: string;
  telephone: string; web_page: string; street: string; postal_code: string;
  city: string; state: string; country: string;
}

const AVATAR_COLORS = [
  'from-[#2c5372] to-[#4a7fa5]', 'from-[#4a7fa5] to-[#6d9dc0]', 'from-[#c7b475] to-[#d9c48e]',
  'from-[#e83948] to-[#f08a94]', 'from-[#2c5372] to-[#c7b475]', 'from-[#4a7fa5] to-[#c7b475]',
];

function formatDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
}

function InfoItem({ icon: Icon, label, value, href }: { icon: typeof Mail; label: string; value: string; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-sm text-[#2c5372] font-medium hover:underline flex items-center gap-1.5 truncate">
            {value} <ExternalLink size={11} className="shrink-0 opacity-50" />
          </a>
        ) : (
          <p className="text-sm text-slate-700 font-medium truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function CollaboratorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<CollabDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getCollaboratorDetail(Number(id));
      setData(r as CollabDetail);
    } catch { toast('error', 'Erro ao carregar colaborador'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-44 w-full rounded-2xl" />
      <div className="skeleton h-64 w-full rounded-2xl" />
    </div>
  );
  if (!data) return <p className="text-slate-400 text-center py-16">Colaborador não encontrado</p>;

  const colorIdx = data.id % AVATAR_COLORS.length;
  const overdueToday = new Date().toISOString().slice(0, 10);
  const overdue = data.tasks.filter(t => t.planned_end && t.planned_end < overdueToday && t.status !== 'completed');

  const location = [data.city, data.state, data.country].filter(Boolean).join(', ');
  const hasOrgInfo = data.job_title || data.department || data.company || data.manager;
  const hasContactInfo = data.telephone || data.office || data.email || data.personal_phone;
  const hasLocationInfo = location || data.street || data.postal_code;
  const managerName = data.manager ? data.manager.replace(/^CN=([^,]+).*$/, '$1') : '';
  const avatarUrl = data.avatar_url && data.avatar_url.length > 1 ? authenticatedUrl(data.avatar_url) : null;
  const isLinkedIn = data.personal_link?.includes('linkedin.com');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <button onClick={() => navigate('/collaborators')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#2c5372] transition-colors">
        <ArrowLeft size={16} /> Colaboradores
      </button>

      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200/60">
        <div className={`h-44 bg-gradient-to-br ${AVATAR_COLORS[colorIdx]}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.1),transparent_60%)]" />
        </div>

        <div className="absolute top-0 left-0 right-0 h-44 flex items-center px-8">
          <div className="flex items-center gap-6">
            {avatarUrl ? (
              <img src={avatarUrl} alt={data.name}
                className="w-28 h-28 rounded-2xl object-cover border-2 border-white/30 shadow-xl shrink-0" />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-5xl font-black text-white border-2 border-white/30 shadow-xl shrink-0">
                {data.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-white drop-shadow-sm truncate">{data.name}</h1>
                {!data.active && <span className="text-[10px] px-2.5 py-1 bg-red-500/80 text-white rounded-lg font-bold backdrop-blur-sm">Inativo</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                {data.job_title && (
                  <span className="flex items-center gap-1.5 text-sm text-white/90 font-medium">
                    <Briefcase size={13} className="text-white/70" /> {data.job_title}
                  </span>
                )}
                {data.department && (
                  <span className="flex items-center gap-1.5 text-sm text-white/90 font-medium">
                    <Building2 size={13} className="text-white/70" /> {data.department}
                  </span>
                )}
                {data.username && (
                  <span className="flex items-center gap-1.5 text-sm text-white/90 font-medium">
                    <AtSign size={13} className="text-white/70" /> {data.username}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2">
                {data.email && <p className="text-xs text-white/60">{data.email}</p>}
                {data.personal_link && (
                  <a href={data.personal_link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    {isLinkedIn ? <Linkedin size={12} /> : <Link2 size={12} />}
                    {isLinkedIn ? 'LinkedIn' : 'Link'}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bio card */}
      {data.bio && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in">
          <div className="px-6 py-4 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#eaeff5] flex items-center justify-center shrink-0">
              <FileText size={18} className="text-[#2c5372]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Sobre</p>
              <p className="text-sm text-slate-700 leading-relaxed">{data.bio}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Horas Totais', value: `${data.total_hours.toFixed(0)}h`, icon: Clock, gradient: 'from-[#2c5372] to-[#4a7fa5]' },
          { label: 'Projetos', value: data.project_count, icon: FolderKanban, gradient: 'from-[#4a7fa5] to-[#6d9dc0]' },
          { label: 'Tarefas Ativas', value: data.active_task_count, icon: CheckSquare, gradient: 'from-[#c7b475] to-[#d9c48e]' },
          { label: 'Atrasadas', value: overdue.length, icon: AlertTriangle, gradient: overdue.length > 0 ? 'from-[#e83948] to-[#f08a94]' : 'from-[#10b981] to-[#34d399]' },
        ].map((c, i) => (
          <div key={c.label} className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
            <div className="relative">
              <c.icon size={20} className="opacity-80 mb-2" />
              <p className="text-3xl font-black">{c.value}</p>
              <p className="text-sm opacity-80 mt-1 font-medium">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Info Cards */}
      {(hasOrgInfo || hasContactInfo || hasLocationInfo) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
          {hasOrgInfo && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eaeff5] flex items-center justify-center">
                  <Building2 size={15} className="text-[#2c5372]" />
                </div>
                <span className="text-sm font-bold text-slate-700">Organização</span>
              </div>
              <div className="px-5 py-2 divide-y divide-slate-50">
                <InfoItem icon={Briefcase} label="Cargo" value={data.job_title} />
                <InfoItem icon={Building2} label="Departamento" value={data.department} />
                <InfoItem icon={Globe} label="Empresa" value={data.company} />
                <InfoItem icon={User} label="Gestor" value={managerName} />
              </div>
            </div>
          )}

          {hasContactInfo && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Phone size={15} className="text-emerald-500" />
                </div>
                <span className="text-sm font-bold text-slate-700">Contato</span>
              </div>
              <div className="px-5 py-2 divide-y divide-slate-50">
                <InfoItem icon={Mail} label="Email" value={data.email} href={`mailto:${data.email}`} />
                {data.telephone && <InfoItem icon={Phone} label="Telefone Corp." value={data.telephone} />}
                {data.personal_phone && <InfoItem icon={Phone} label="Telefone Pessoal" value={data.personal_phone} />}
                {data.office && <InfoItem icon={Building2} label="Escritório" value={data.office} />}
                {data.personal_link && (
                  <InfoItem
                    icon={isLinkedIn ? Linkedin : Link2}
                    label={isLinkedIn ? 'LinkedIn' : 'Link Pessoal'}
                    value={isLinkedIn ? data.personal_link.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '') : data.personal_link}
                    href={data.personal_link}
                  />
                )}
              </div>
            </div>
          )}

          {hasLocationInfo && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <MapPin size={15} className="text-amber-500" />
                </div>
                <span className="text-sm font-bold text-slate-700">Localização</span>
              </div>
              <div className="px-5 py-2 divide-y divide-slate-50">
                {data.street && <InfoItem icon={MapPin} label="Endereço" value={data.street} />}
                {location && <InfoItem icon={MapPin} label="Cidade" value={location} />}
                {data.postal_code && <InfoItem icon={Mail} label="CEP" value={data.postal_code} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projects */}
      {data.projects.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#eaeff5] flex items-center justify-center">
              <FolderKanban size={18} className="text-[#2c5372]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Projetos</h2>
              <p className="text-[11px] text-slate-400">Horas executadas vs capacidade estimada por projeto</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-bold">Projeto</th>
                  <th className="text-center px-3 py-3 font-bold">Status</th>
                  <th className="text-center px-3 py-3 font-bold">Horas</th>
                  <th className="text-center px-3 py-3 font-bold">Carga</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.projects.map(p => {
                  const pct = p.capacity_share > 0 ? Math.round((p.actual_hours / p.capacity_share) * 100) : 0;
                  const barColor = pct > 120 ? '#ef4444' : pct > 90 ? '#f59e0b' : '#10b981';
                  return (
                    <tr key={p.id} className="border-t border-slate-50 hover:bg-[#eaeff5]/30 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/projects/${p.id}`)}>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{p.name}</td>
                      <td className="text-center px-3 py-3.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-medium">
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="text-center px-3 py-3.5">
                        <span className="text-xs font-semibold text-slate-700">{p.actual_hours.toFixed(0)}</span>
                        <span className="text-[10px] text-slate-400"> / {p.capacity_share.toFixed(0)}h</span>
                      </td>
                      <td className="px-3 py-3.5 w-36">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                        </div>
                        <p className="text-[10px] text-slate-400 text-center mt-0.5">{pct}%</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-[#2c5372] transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Tasks */}
      {data.tasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <CheckSquare size={18} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Tarefas Ativas</h2>
              <p className="text-[11px] text-slate-400">{data.tasks.length} tarefas pendentes ou em andamento</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {data.tasks.map(t => {
              const isOverdue = t.planned_end && t.planned_end < new Date().toISOString().slice(0, 10);
              return (
                <div key={t.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => t.project_id ? navigate(`/projects/${t.project_id}`) : undefined}>
                  <div className={`w-2 h-8 rounded-full shrink-0 ${isOverdue ? 'bg-red-400' : t.status === 'in_progress' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                    <p className="text-[11px] text-slate-400">{t.project_name} &middot; {t.stage_name}</p>
                  </div>
                  {t.planned_end && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                      isOverdue ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-500'
                    }`}>{formatDate(t.planned_end)}</span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium shrink-0 ${
                    t.priority === 'critical' ? 'bg-red-50 text-red-600' :
                    t.priority === 'high' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                  }`}>{t.priority === 'critical' ? 'Crítica' : t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
