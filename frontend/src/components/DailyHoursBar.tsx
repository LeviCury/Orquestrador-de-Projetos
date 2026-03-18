import { useState, useEffect } from 'react';
import { Clock, FolderKanban, Headset, CheckCircle2 } from 'lucide-react';
import { getDailyHours, getCollaborators } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import type { DailyHoursSummary } from '@/types';

export default function DailyHoursBar() {
  const { user } = useAuth();
  const [data, setData] = useState<DailyHoursSummary | null>(null);
  const [collabId, setCollabId] = useState<number | null>(null);

  const role = user?.system_role ?? 'viewer';
  const canSee = role === 'analyst';
  const canLog = role === 'analyst';

  useEffect(() => {
    if (!canSee) return;
    getCollaborators(true).then(cs => { if (cs.length) setCollabId(cs[0].id); }).catch(() => {});
  }, [canSee]);

  useEffect(() => {
    if (!collabId || !canSee) return;
    const load = () => getDailyHours(collabId).then(setData).catch(() => {});
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, [collabId, canSee]);

  if (!canSee || !data) return null;

  const pct = Math.min(data.pct, 100);
  const done = data.pct >= 100;

  return (
    <div className="mx-3 mb-3">
      <div className="rounded-xl bg-white/[0.06] border border-white/[0.08] p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={10} />
            {canLog ? 'Horas Hoje' : 'Equipe Hoje'}
          </span>
          {done ? (
            <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
              <CheckCircle2 size={10} /> Meta
            </span>
          ) : (
            <span className="text-[10px] font-bold text-white/70">
              {data.total_hours}h <span className="text-white/30">/ {data.target_hours}h</span>
            </span>
          )}
        </div>

        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              done ? 'bg-emerald-400' : pct >= 60 ? 'bg-[#c7b475]' : 'bg-[#e83948]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span className="flex items-center gap-1">
            <FolderKanban size={9} className="text-[#6d9dc0]" />
            <span className="text-white/60">{data.project_hours}h</span>
          </span>
          <span className="flex items-center gap-1">
            <Headset size={9} className="text-[#c7b475]" />
            <span className="text-white/60">{data.ticket_hours}h</span>
          </span>
          {!done && data.remaining > 0 && (
            <span className="text-[#e83948] font-semibold">-{data.remaining}h</span>
          )}
        </div>
      </div>
    </div>
  );
}
