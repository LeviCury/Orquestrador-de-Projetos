import { useState, useEffect } from 'react';
import type { Project, WorkloadWeek } from '@/types';
import { getProjects, getProjectWorkload } from '@/api/client';
import { Users, AlertTriangle, Calendar, BarChart3 } from 'lucide-react';

export default function Workload() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number>(0);
  const [data, setData] = useState<WorkloadWeek[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProjects().then(p => {
      setProjects(p);
      if (p.length > 0) setSelectedProject(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    getProjectWorkload(selectedProject).then(setData).finally(() => setLoading(false));
  }, [selectedProject]);

  const collaborators = [...new Set(data.map(d => d.collaborator_id))].map(id => {
    const row = data.find(d => d.collaborator_id === id);
    return { id, name: row?.collaborator_name ?? '' };
  });

  const weeks = [...new Set(data.map(d => d.week_start))].sort();

  const getWeekData = (collabId: number, week: string) =>
    data.find(d => d.collaborator_id === collabId && d.week_start === week);

  const formatWeek = (w: string) => {
    try {
      const d = new Date(w + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch { return w; }
  };

  const getBarStyle = (hours: number, capacity: number) => {
    const pct = Math.min((hours / capacity) * 100, 150);
    if (pct > 100) return { width: `${Math.min(pct, 150)}%`, bg: 'bg-red-500', text: 'text-red-700' };
    if (pct > 80) return { width: `${pct}%`, bg: 'bg-amber-500', text: 'text-amber-700' };
    return { width: `${pct}%`, bg: 'bg-emerald-500', text: 'text-emerald-700' };
  };

  const today = new Date().toISOString().slice(0, 10);
  const currentWeekIdx = weeks.findIndex(w => w <= today && (weeks[weeks.indexOf(w) + 1] ?? '9999') > today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Carga de Trabalho</h1>
          <p className="text-sm text-slate-400 mt-1">Alocação vs capacidade por colaborador por semana</p>
        </div>
        <select
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#4a7fa5]/20 outline-none"
          value={selectedProject}
          onChange={e => setSelectedProject(Number(e.target.value))}
        >
          <option value={0}>Selecionar projeto...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selectedProject ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">Selecione um projeto para visualizar a carga de trabalho</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4a7fa5] to-[#c7b475] animate-spin" style={{ animationDuration: '0.8s' }} />
        </div>
      ) : collaborators.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">Nenhum colaborador vinculado a este projeto</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(() => {
              const currentWeek = weeks[currentWeekIdx >= 0 ? currentWeekIdx : 0];
              const weekData = currentWeek ? data.filter(d => d.week_start === currentWeek) : [];
              const overloaded = weekData.filter(d => d.allocated_hours > d.capacity_hours).length;
              const avgLoad = weekData.length > 0 ? Math.round(weekData.reduce((s, d) => s + (d.allocated_hours / d.capacity_hours) * 100, 0) / weekData.length) : 0;
              const totalAllocated = weekData.reduce((s, d) => s + d.allocated_hours, 0);

              return [
                { icon: Users, bg: 'from-[#2c5372] to-[#4a7fa5]', label: 'Carga média', value: `${avgLoad}%`, sub: 'esta semana' },
                { icon: AlertTriangle, bg: 'from-red-500 to-rose-500', label: 'Sobrecarregados', value: String(overloaded), sub: `de ${collaborators.length} colaboradores` },
                { icon: BarChart3, bg: 'from-emerald-500 to-teal-500', label: 'Horas alocadas', value: `${totalAllocated.toFixed(0)}h`, sub: 'esta semana' },
              ].map((c, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.bg} flex items-center justify-center`}>
                      <c.icon size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{c.label}</p>
                      <p className="text-xl font-black text-slate-900">{c.value}</p>
                      <p className="text-[10px] text-slate-400">{c.sub}</p>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Workload table */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#eef3f8] flex items-center justify-center"><Calendar size={16} className="text-[#4a7fa5]" /></div>
              <h3 className="font-bold text-slate-800">Horas por semana</h3>
              <div className="ml-auto flex items-center gap-4 text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-500" /> Abaixo 80%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-amber-500" /> 80-100%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500" /> Sobrecarregado</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-5 py-3 font-bold text-slate-600 sticky left-0 bg-slate-50/50 z-10 w-48">Colaborador</th>
                    {weeks.map((w, i) => (
                      <th key={w} className={`px-3 py-3 text-center font-medium text-slate-500 min-w-[100px] ${i === currentWeekIdx ? 'bg-[#eef3f8]/50' : ''}`}>
                        {formatWeek(w)}
                        {i === currentWeekIdx && <span className="block text-[9px] text-[#4a7fa5] font-bold">ATUAL</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {collaborators.map(c => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-700 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4a7fa5] to-[#c7b475] text-white text-[10px] font-bold flex items-center justify-center">
                            {c.name.charAt(0)}
                          </div>
                          <span className="truncate max-w-[140px]">{c.name}</span>
                        </div>
                      </td>
                      {weeks.map((w, i) => {
                        const wd = getWeekData(c.id, w);
                        const alloc = wd?.allocated_hours ?? 0;
                        const logged = wd?.logged_hours ?? 0;
                        const cap = wd?.capacity_hours ?? 40;
                        const style = getBarStyle(alloc, cap);
                        return (
                          <td key={w} className={`px-3 py-3 ${i === currentWeekIdx ? 'bg-[#eef3f8]/30' : ''}`}>
                            <div className="space-y-1">
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden" style={{ maxWidth: '100px' }}>
                                <div className={`h-full rounded-full ${style.bg} transition-all`} style={{ width: style.width, maxWidth: '150%' }} />
                              </div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={`font-bold ${style.text}`}>{alloc.toFixed(0)}h</span>
                                {logged > 0 && <span className="text-slate-400">{logged.toFixed(0)}h log</span>}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
