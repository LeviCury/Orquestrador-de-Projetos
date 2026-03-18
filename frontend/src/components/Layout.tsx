import { NavLink, Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, FolderKanban, Users, Clock, Search,
  PanelLeftClose, PanelLeftOpen, Zap, Target, Copy,
  Bell, Check, CheckCheck, X, BarChart3,
  ShieldCheck, LogOut,
} from 'lucide-react';
import QuickHoursWidget from '@/components/QuickHoursWidget';
import CommandPalette from '@/components/CommandPalette';
import { useAuth } from '@/contexts/AuthContext';
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, getCollaborators, authenticatedUrl } from '@/api/client';
import type { NotificationItem, Collaborator } from '@/types';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/my-work', icon: Target, label: 'Meu Trabalho', analystOnly: true },
  { to: '/projects', icon: FolderKanban, label: 'Projetos' },
  { to: '/collaborators', icon: Users, label: 'Colaboradores' },
  { to: '/time-entries', icon: Clock, label: 'Horas', hoursVisible: true },
  { to: '/workload', icon: BarChart3, label: 'Carga', analystOnly: true },
  { to: '/templates', icon: Copy, label: 'Templates' },
] as const;

const BREADCRUMB_MAP: Record<string, string> = {
  '/': 'Dashboard',
  '/my-work': 'Meu Trabalho',
  '/projects': 'Projetos',
  '/collaborators': 'Colaboradores',
  '/time-entries': 'Apontamento de Horas',
  '/workload': 'Carga de Trabalho',
  '/templates': 'Templates',
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [collabId, setCollabId] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCollaborators(true).then(cs => { if (cs.length > 0) setCollabId(cs[0].id); }).catch(() => {});
  }, []);

  const fetchNotifs = useCallback(async () => {
    if (!collabId) return;
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(collabId, false),
        getUnreadCount(collabId),
      ]);
      setNotifications(notifs.slice(0, 20));
      setUnread(count.unread_count);
    } catch {}
  }, [collabId]);

  useEffect(() => { void fetchNotifs(); const i = setInterval(fetchNotifs, 30000); return () => clearInterval(i); }, [fetchNotifs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id: number) => {
    try { await markNotificationRead(id); await fetchNotifs(); } catch {}
  };

  const handleMarkAll = async () => {
    if (!collabId) return;
    try { await markAllNotificationsRead(collabId); await fetchNotifs(); } catch {}
  };

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const typeColors: Record<string, string> = {
    deadline: 'bg-amber-400', overdue: 'bg-[#e83948]', status_change: 'bg-[#4a7fa5]',
    hours_exceeded: 'bg-orange-400', info: 'bg-slate-400',
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-500 hover:text-[#2c5372] hover:bg-[#eaeff5] rounded-xl transition-all">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[9px] font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/50 z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Notificações</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-[10px] text-[#2c5372] hover:text-[#19344d] font-medium flex items-center gap-1">
                  <CheckCheck size={12} /> Marcar todas como lidas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhuma notificação</div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer ${!n.read ? 'bg-[#eaeff5]/40' : ''}`}
                  onClick={() => handleMarkRead(n.id)}>
                  <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${n.read ? 'bg-transparent' : (typeColors[n.type] || 'bg-slate-400')}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${n.read ? 'text-slate-500' : 'text-slate-800 font-semibold'}`}>{n.title}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatTime(n.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserSection({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const avatarUrl = user.avatar_url && user.avatar_url.length > 1 ? authenticatedUrl(user.avatar_url) : null;

  return (
    <div className={`border-t border-white/10 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'} space-y-1`}>
      {user.is_admin && (
        <NavLink to="/admin" className={({ isActive }) =>
          `flex items-center gap-3 ${collapsed ? 'justify-center px-3' : 'px-3.5'} py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
            isActive ? 'bg-[#e83948]/20 text-[#eb7380] border border-[#e83948]/20' : 'text-[#b4c7d8]/70 hover:bg-white/5 hover:text-white'
          }`
        } title={collapsed ? 'Admin' : undefined}>
          <ShieldCheck size={16} className="shrink-0" />
          {!collapsed && <span>Administração</span>}
        </NavLink>
      )}
      {!collapsed ? (
        <div className="flex items-center gap-2.5 px-3 py-2">
          <button onClick={() => navigate('/profile')} className="shrink-0 group" title="Meu Perfil">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-transparent group-hover:ring-[#c7b475]/50 transition-all" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6d9dc0] to-[#c7b475] text-white text-[10px] font-bold flex items-center justify-center group-hover:ring-2 group-hover:ring-[#c7b475]/50 transition-all">
                {user.name.charAt(0)}
              </div>
            )}
          </button>
          <button onClick={() => navigate('/profile')} className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity" title="Meu Perfil">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-[10px] text-[#6d9dc0]/60 truncate">{user.email}</p>
          </button>
          <button onClick={logout} className="p-1.5 text-[#6d9dc0]/40 hover:text-[#e83948] transition-colors" title="Sair">
            <LogOut size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <button onClick={() => navigate('/profile')} className="group" title="Meu Perfil">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-transparent group-hover:ring-[#c7b475]/50 transition-all" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6d9dc0] to-[#c7b475] text-white text-[10px] font-bold flex items-center justify-center group-hover:ring-2 group-hover:ring-[#c7b475]/50 transition-all">
                {user.name.charAt(0)}
              </div>
            )}
          </button>
          <button onClick={logout} className="flex items-center justify-center p-2 text-[#6d9dc0]/40 hover:text-[#e83948] rounded-xl transition-colors" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const triggerSearch = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  };

  const pathSegments = location.pathname.split('/').filter(Boolean);

  const resolveBreadcrumbLabel = (seg: string, idx: number): string => {
    if (idx === 0) return BREADCRUMB_MAP[`/${seg}`] ?? seg;
    return `#${seg}`;
  };

  const breadcrumbs = [
    { label: 'Início', path: '/' },
    ...(pathSegments.map((seg, idx) => ({
      label: resolveBreadcrumbLabel(seg, idx),
      path: '/' + pathSegments.slice(0, idx + 1).join('/'),
    }))),
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-[72px]' : 'w-64'} h-screen sticky top-0 bg-gradient-to-b from-[#0c1a2a] via-[#1a3550] to-[#0c1a2a] text-white flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-y-auto overflow-x-hidden`}>
        <div className="h-1 bg-gradient-to-r from-[#e83948] via-[#c7b475] to-[#2c5372] shrink-0" />
        {/* Logo */}
        <div className={`p-4 ${collapsed ? 'px-3' : 'px-5'} border-b border-white/10`}>
          {!collapsed ? (
            <div className="animate-fade-in">
              <img src="/minerva-logo-white.svg" alt="Minerva Foods" className="h-6 mb-2 opacity-90" />
              <p className="text-[10px] font-bold text-[#c7b475]/70 uppercase tracking-[0.15em]">Orquestrador de Projetos</p>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-9 h-9 bg-gradient-to-br from-[#c7b475] to-[#e83948] rounded-xl flex items-center justify-center shadow-lg shadow-[#e83948]/20">
                <Zap size={18} className="text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        {!collapsed && (
          <button
            onClick={triggerSearch}
            className="mx-3 mt-4 flex items-center gap-2.5 px-3 py-2.5 bg-white/5 rounded-xl text-[#b4c7d8] text-sm hover:bg-white/10 transition-all duration-200 border border-white/5"
          >
            <Search size={15} />
            <span className="flex-1 text-left text-xs">Buscar...</span>
            <kbd className="text-[9px] px-1.5 py-0.5 bg-white/10 rounded-md font-mono">Ctrl+K</kbd>
          </button>
        )}
        {collapsed && (
          <button onClick={triggerSearch} className="mx-auto mt-4 p-2.5 bg-white/5 rounded-xl text-[#b4c7d8] hover:bg-white/10 transition-all">
            <Search size={16} />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.filter(item => {
            if (user?.system_role === 'viewer') {
              const viewerPages = ['/', '/projects', '/collaborators'];
              return viewerPages.includes(item.to);
            }
            if ('analystOnly' in item && item.analystOnly) return user?.system_role === 'analyst';
            if ('hoursVisible' in item && item.hoursVisible) return user?.system_role === 'analyst' || user?.system_role === 'manager' || user?.system_role === 'admin';
            return true;
          }).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 ${collapsed ? 'justify-center px-3' : 'px-3.5'} py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/10 text-white border-l-[3px] border-l-[#e83948] border-y-0 border-r-0 shadow-lg shadow-black/5'
                    : 'text-[#6d9dc0] hover:bg-white/5 hover:text-white border-l-[3px] border-l-transparent'
                }`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <UserSection collapsed={collapsed} />

        {/* Brand phrase */}
        {!collapsed && (
          <div className="mx-4 mb-2 px-3 py-2">
            <p className="text-[9px] text-white/15 font-bold leading-relaxed tracking-wide italic">
              &ldquo;Levamos todo mundo pra mesa.&rdquo;
            </p>
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-3 mb-4 flex items-center justify-center gap-2 px-3 py-2 text-[#6d9dc0]/50 hover:text-white hover:bg-white/5 rounded-xl transition-all text-xs"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /><span>Recolher</span></>}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.path + i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-slate-300">/</span>}
                  <span className={i === breadcrumbs.length - 1 ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                    {crumb.label}
                  </span>
                </span>
              ))}
            </div>
            <NotificationBell />
          </div>
        </div>

        <div className="p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>

      {user?.system_role !== 'viewer' && <QuickHoursWidget />}
      <CommandPalette />
    </div>
  );
}
