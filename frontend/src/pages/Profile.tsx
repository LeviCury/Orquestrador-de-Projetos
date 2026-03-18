import { useState, useRef } from 'react';
import {
  Camera, Save, Mail, Briefcase, Building2, Phone, Globe, MapPin,
  User, AtSign, Lock, Link2, FileText, Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { updateMyAvatar, updateMyProfile, authenticatedUrl } from '@/api/client';
import { useToast } from '@/components/Toast';

const AVATAR_GRADIENT = 'from-[#2c5372] to-[#4a7fa5]';

function ReadonlyField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
          {label}
          <Lock size={9} className="text-slate-300" />
        </p>
        <p className="text-sm text-slate-600 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [bio, setBio] = useState(user?.bio || '');
  const [personalPhone, setPersonalPhone] = useState(user?.personal_phone || '');
  const [personalLink, setPersonalLink] = useState(user?.personal_link || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!user) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast('error', 'Arquivo muito grande. Máximo 2 MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      await updateMyAvatar(file);
      await refresh();
      toast('success', 'Foto atualizada!');
    } catch {
      toast('error', 'Erro ao atualizar foto.');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateMyProfile({ bio, personal_phone: personalPhone, personal_link: personalLink });
      await refresh();
      toast('success', 'Perfil salvo!');
    } catch {
      toast('error', 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const managerName = user.manager ? user.manager.replace(/^CN=([^,]+).*$/, '$1') : '';
  const location = [user.city, user.state, user.country].filter(Boolean).join(', ');

  const hasOrgInfo = user.job_title || user.department || user.company || managerName;
  const hasContactInfo = user.telephone || user.office || user.email;
  const hasLocationInfo = location || user.street || user.postal_code;
  const avatarUrl = user.avatar_url && user.avatar_url.length > 1 ? authenticatedUrl(user.avatar_url) : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header with avatar */}
      <div className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200/60">
        <div className={`h-44 bg-gradient-to-br ${AVATAR_GRADIENT}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.1),transparent_60%)]" />
        </div>

        <div className="absolute top-0 left-0 right-0 h-44 flex items-center px-8">
          <div className="flex items-center gap-6">
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="w-28 h-28 rounded-2xl object-cover border-2 border-white/30 shadow-xl shrink-0"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-5xl font-black text-white border-2 border-white/30 shadow-xl">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 size={24} className="text-white animate-spin" />
                ) : (
                  <Camera size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-black text-white drop-shadow-sm truncate">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                {user.job_title && (
                  <span className="flex items-center gap-1.5 text-sm text-white/90 font-medium">
                    <Briefcase size={13} className="text-white/70" /> {user.job_title}
                  </span>
                )}
                {user.department && (
                  <span className="flex items-center gap-1.5 text-sm text-white/90 font-medium">
                    <Building2 size={13} className="text-white/70" /> {user.department}
                  </span>
                )}
                {user.username && (
                  <span className="flex items-center gap-1.5 text-sm text-white/90 font-medium">
                    <AtSign size={13} className="text-white/70" /> {user.username}
                  </span>
                )}
              </div>
              {user.email && (
                <p className="text-xs text-white/60 mt-1.5">{user.email}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editable section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#eaeff5] flex items-center justify-center">
            <FileText size={18} className="text-[#2c5372]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Informações Pessoais</h2>
            <p className="text-[11px] text-slate-400">Campos editáveis por você</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Conte um pouco sobre você..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-[#4a7fa5] focus:ring-2 focus:ring-[#4a7fa5]/20 outline-none resize-none transition-all"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
                <Phone size={11} /> Telefone Pessoal
              </label>
              <input
                type="text"
                value={personalPhone}
                onChange={e => setPersonalPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-[#4a7fa5] focus:ring-2 focus:ring-[#4a7fa5]/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
                <Link2 size={11} /> Link Pessoal
              </label>
              <input
                type="url"
                value={personalLink}
                onChange={e => setPersonalLink(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-[#4a7fa5] focus:ring-2 focus:ring-[#4a7fa5]/20 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2c5372] to-[#4a7fa5] text-white text-sm font-semibold shadow-lg shadow-[#2c5372]/20 hover:shadow-xl hover:shadow-[#2c5372]/30 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Salvar
            </button>
          </div>
        </div>
      </div>

      {/* AD Profile - Read only */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
        {/* Organization */}
        {hasOrgInfo && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#eaeff5] flex items-center justify-center">
                <Building2 size={15} className="text-[#2c5372]" />
              </div>
              <span className="text-sm font-bold text-slate-700 flex-1">Organização</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-semibold flex items-center gap-1">
                <Lock size={8} /> AD
              </span>
            </div>
            <div className="px-5 py-2 divide-y divide-slate-50">
              <ReadonlyField icon={Briefcase} label="Cargo" value={user.job_title || ''} />
              <ReadonlyField icon={Building2} label="Departamento" value={user.department || ''} />
              <ReadonlyField icon={Globe} label="Empresa" value={user.company || ''} />
              <ReadonlyField icon={User} label="Gestor" value={managerName} />
            </div>
          </div>
        )}

        {/* Contact */}
        {hasContactInfo && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Phone size={15} className="text-emerald-500" />
              </div>
              <span className="text-sm font-bold text-slate-700 flex-1">Contato Corporativo</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-semibold flex items-center gap-1">
                <Lock size={8} /> AD
              </span>
            </div>
            <div className="px-5 py-2 divide-y divide-slate-50">
              <ReadonlyField icon={Mail} label="Email" value={user.email} />
              <ReadonlyField icon={AtSign} label="Usuário" value={user.username || ''} />
              <ReadonlyField icon={Phone} label="Telefone" value={user.telephone || ''} />
              <ReadonlyField icon={Building2} label="Escritório" value={user.office || ''} />
            </div>
          </div>
        )}

        {/* Location */}
        {hasLocationInfo && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <MapPin size={15} className="text-amber-500" />
              </div>
              <span className="text-sm font-bold text-slate-700 flex-1">Localização</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-semibold flex items-center gap-1">
                <Lock size={8} /> AD
              </span>
            </div>
            <div className="px-5 py-2 divide-y divide-slate-50">
              {user.street && <ReadonlyField icon={MapPin} label="Endereço" value={user.street} />}
              {location && <ReadonlyField icon={MapPin} label="Cidade" value={location} />}
              {user.postal_code && <ReadonlyField icon={Mail} label="CEP" value={user.postal_code} />}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
