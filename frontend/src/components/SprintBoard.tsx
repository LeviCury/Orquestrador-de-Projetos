import { useState, useEffect } from 'react';
import type { Sprint, Stage } from '@/types';
import { PRIORITY_LABELS } from '@/types';
import { getSprints, createSprint, updateSprint, deleteSprint, assignTaskToSprint, unassignTaskFromSprint } from '@/api/client';
import { Plus, Trash2, Check, Target, ChevronDown, ChevronRight, Play, Pencil, X } from 'lucide-react';
import StatusBadge from './StatusBadge';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import { useToast } from './Toast';

interface Props {
  projectId: number;
  stages: Stage[];
  onReload: () => void;
}

export default function SprintBoard({ projectId, stages, onReload }: Props) {
  const { toast } = useToast();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [form, setForm] = useState({ name: '', goal: '', start_date: '', end_date: '', status: 'planning' });
  const [assigning, setAssigning] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; id: number }>({ open: false, id: 0 });

  const allTasks = stages.flatMap(s => s.tasks.map(t => ({ ...t, stageName: s.name })));

  const load = () => { getSprints(projectId).then(setSprints); };
  useEffect(load, [projectId]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const openNew = () => {
    setForm({ name: '', goal: '', start_date: '', end_date: '', status: 'planning' });
    setEditingSprint(null);
    setModalOpen(true);
  };

  const openEdit = (s: Sprint) => {
    setForm({ name: s.name, goal: s.goal, start_date: s.start_date ?? '', end_date: s.end_date ?? '', status: s.status });
    setEditingSprint(s);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const payload: Record<string, unknown> = { ...form };
    if (!payload.start_date) payload.start_date = null;
    if (!payload.end_date) payload.end_date = null;
    if (editingSprint) {
      await updateSprint(editingSprint.id, payload);
      toast('success', 'Sprint atualizada!');
    } else {
      payload.order_index = sprints.length;
      await createSprint(projectId, payload);
      toast('success', 'Sprint criada!');
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = (id: number) => {
    setConfirmDel({ open: true, id });
  };
  const execDelete = async () => {
    const id = confirmDel.id;
    setConfirmDel({ open: false, id: 0 });
    await deleteSprint(id);
    toast('success', 'Sprint excluída.');
    load();
    onReload();
  };

  const handleAssign = async (sprintId: number, taskId: number) => {
    await assignTaskToSprint(sprintId, taskId);
    toast('success', 'Tarefa vinculada à sprint!');
    setAssigning(null);
    load();
    onReload();
  };

  const handleUnassign = async (sprintId: number, taskId: number) => {
    await unassignTaskFromSprint(sprintId, taskId);
    toast('success', 'Tarefa desvinculada.');
    load();
    onReload();
  };

  const handleStatusChange = async (sprint: Sprint, newStatus: string) => {
    await updateSprint(sprint.id, { status: newStatus });
    toast('success', `Sprint ${newStatus === 'active' ? 'iniciada' : newStatus === 'completed' ? 'concluída' : 'atualizada'}!`);
    load();
  };

  const getSprintTasks = (sprintId: number) => allTasks.filter(t => t.sprint_id === sprintId);
  const unassignedTasks = allTasks.filter(t => !t.sprint_id);

  const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none transition-all bg-white';
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';

  const sprintStatusColor = (s: string) => {
    if (s === 'active') return 'border-l-emerald-500';
    if (s === 'completed') return 'border-l-slate-400';
    return 'border-l-amber-400';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800">Sprints ({sprints.length})</h2>
        <button onClick={openNew} className="px-4 py-2 bg-[#e83948] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#e83948]/25 flex items-center gap-2 hover:bg-[#d42d3b] transition-all">
          <Plus size={16} /> Nova Sprint
        </button>
      </div>

      {sprints.map(sprint => {
        const tasks = getSprintTasks(sprint.id);
        const completed = tasks.filter(t => t.status === 'completed').length;
        const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

        return (
          <div key={sprint.id} className={`bg-white rounded-2xl border border-slate-200/60 border-l-4 ${sprintStatusColor(sprint.status)} shadow-sm overflow-hidden`}>
            <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => toggleExpand(sprint.id)}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0">
                <Target size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{sprint.name}</span>
                  <StatusBadge status={sprint.status} />
                  <span className="text-xs text-slate-400 font-medium">{tasks.length} tarefa(s)</span>
                  {progress > 0 && <span className="text-[10px] font-bold text-[#4a7fa5] bg-[#eef3f8] px-2 py-0.5 rounded-full">{progress}%</span>}
                </div>
                {sprint.goal && <p className="text-xs text-slate-400 mt-0.5 truncate">{sprint.goal}</p>}
                {sprint.start_date && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {sprint.start_date} → {sprint.end_date ?? '—'}
                  </p>
                )}
                {tasks.length > 0 && (
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-xs">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {sprint.status === 'planning' && (
                  <button onClick={() => handleStatusChange(sprint, 'active')} className="p-2 hover:bg-emerald-50 rounded-xl text-emerald-400 hover:text-emerald-600 transition-all" title="Iniciar sprint"><Play size={15} /></button>
                )}
                {sprint.status === 'active' && (
                  <button onClick={() => handleStatusChange(sprint, 'completed')} className="p-2 hover:bg-emerald-50 rounded-xl text-emerald-400 hover:text-emerald-600 transition-all" title="Concluir sprint"><Check size={15} /></button>
                )}
                <button onClick={() => setAssigning(assigning === sprint.id ? null : sprint.id)} className="p-2 hover:bg-[#eef3f8] rounded-xl text-slate-300 hover:text-[#2c5372] transition-all" title="Vincular tarefa"><Plus size={15} /></button>
                <button onClick={() => openEdit(sprint)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-slate-600 transition-all"><Pencil size={15} /></button>
                <button onClick={() => handleDelete(sprint.id)} className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-all"><Trash2 size={15} /></button>
              </div>
              <div className="w-6 flex items-center justify-center">
                {expanded.has(sprint.id) ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </div>
            </div>

            {assigning === sprint.id && (
              <div className="border-t bg-[#eef3f8]/50 px-5 py-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-bold text-[#2c5372] mb-2">Vincular tarefa a esta sprint:</p>
                {unassignedTasks.length === 0 ? (
                  <p className="text-xs text-slate-400">Todas as tarefas já estão vinculadas</p>
                ) : (
                  <div className="space-y-1">
                    {unassignedTasks.map(t => (
                      <button key={t.id} onClick={() => handleAssign(sprint.id, t.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white text-xs transition-colors flex items-center gap-2">
                        <Plus size={12} className="text-[#4a7fa5]" />
                        <span className="font-medium text-slate-700">{t.name}</span>
                        <span className="text-slate-400 ml-auto">{t.stageName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {expanded.has(sprint.id) && (
              <div className="border-t border-slate-100">
                {tasks.length === 0 ? (
                  <div className="px-5 py-6 text-center text-sm text-slate-400">
                    Nenhuma tarefa nesta sprint.
                    <button onClick={() => setAssigning(sprint.id)} className="ml-2 text-[#4a7fa5] font-semibold hover:underline">Vincular tarefa</button>
                  </div>
                ) : (
                  tasks.map(t => (
                    <div key={t.id} className="px-5 py-3 pl-14 flex items-center gap-3 border-b border-slate-50 last:border-b-0 hover:bg-violet-50/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">{t.name}</span>
                          <StatusBadge status={t.status} />
                          <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${t.priority === 'high' || t.priority === 'critical' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                            {PRIORITY_LABELS[t.priority] ?? t.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{t.stageName}</p>
                      </div>
                      <button onClick={() => handleUnassign(sprint.id, t.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-all" title="Desvincular">
                        <X size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {sprints.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-12 text-center">
          <Target size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">Nenhuma sprint cadastrada</p>
          <button onClick={openNew} className="text-[#4a7fa5] font-medium text-sm mt-2 hover:underline">Criar primeira sprint</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingSprint ? 'Editar Sprint' : 'Nova Sprint'}
        subtitle={editingSprint?.name ?? 'Definir ciclo iterativo'} icon={<Target size={18} className="text-violet-500" />}>
        <div className="space-y-4">
          <div><label className={labelCls}>Nome</label><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className={labelCls}>Objetivo</label><textarea className={inputCls} rows={2} value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Início</label><input type="date" className={inputCls} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className={labelCls}>Fim</label><input type="date" className={inputCls} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          {editingSprint && (
            <div><label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="planning">Planejamento</option><option value="active">Ativa</option><option value="completed">Concluída</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-all">Cancelar</button>
            <button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-violet-500/25 transition-all hover:from-violet-600 hover:to-purple-700">
              {editingSprint ? 'Salvar' : 'Criar Sprint'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDel.open}
        onConfirm={execDelete}
        onCancel={() => setConfirmDel({ open: false, id: 0 })}
        title="Excluir sprint"
        description="Esta sprint será removida permanentemente."
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  );
}
