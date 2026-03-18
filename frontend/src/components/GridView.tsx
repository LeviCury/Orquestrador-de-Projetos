import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import type { Stage, Task, Collaborator } from '@/types';
import { STATUS_LABELS, PRIORITY_LABELS } from '@/types';
import { updateTask } from '@/api/client';
import StatusBadge from './StatusBadge';
import { useToast } from './Toast';
import { Check, X, GripVertical, ChevronRight } from 'lucide-react';

interface Props {
  stages: Stage[];
  collabs: Collaborator[];
  onReload: () => void;
}

interface EditCell {
  taskId: number;
  field: string;
  value: string;
}

const STAGE_COLORS = [
  { bg: 'bg-[#4a7fa5]', light: 'bg-[#eef3f8]', text: 'text-[#1a3550]', border: 'border-[#b4cde0]' },
  { bg: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
];

export default function GridView({ stages, collabs, onReload }: Props) {
  const { toast } = useToast();
  const [editCell, setEditCell] = useState<EditCell | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (editCell && inputRef.current) inputRef.current.focus();
  }, [editCell]);

  const allTasks = stages.flatMap(s => s.tasks);

  const startEdit = (taskId: number, field: string, value: string) => {
    setEditCell({ taskId, field, value });
  };

  const saveEdit = useCallback(async () => {
    if (!editCell) return;
    try {
      const payload: Record<string, unknown> = {};
      const { field, value, taskId } = editCell;

      if (field === 'name') payload.name = value;
      else if (field === 'status') payload.status = value;
      else if (field === 'priority') payload.priority = value;
      else if (field === 'estimated_hours') payload.estimated_hours = parseFloat(value) || 0;
      else if (field === 'planned_start') payload.planned_start = value || null;
      else if (field === 'planned_end') payload.planned_end = value || null;

      await updateTask(taskId, payload);
      setEditCell(null);
      onReload();
    } catch {
      toast('error', 'Erro ao salvar');
    }
  }, [editCell, onReload, toast]);

  const cancelEdit = () => setEditCell(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const cellCls = 'px-3 py-2.5 border-b border-slate-100 text-sm';
  const headerCls = 'px-3 py-2.5 border-b-2 border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/80 sticky top-0 z-10';

  const renderEditInput = (task: Task, field: string) => {
    const isSelect = field === 'status' || field === 'priority';
    const isDate = field === 'planned_start' || field === 'planned_end';
    const isNumber = field === 'estimated_hours';

    return (
      <div className="flex items-center gap-1">
        {isSelect ? (
          <select
            ref={el => { inputRef.current = el; }}
            className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#4a7fa5]/20 outline-none"
            value={editCell!.value}
            onChange={e => setEditCell({ ...editCell!, value: e.target.value })}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
          >
            {field === 'status' && Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            {field === 'priority' && Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : (
          <input
            ref={el => { inputRef.current = el; }}
            type={isDate ? 'date' : isNumber ? 'number' : 'text'}
            className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#4a7fa5]/20 outline-none"
            value={editCell!.value}
            onChange={e => setEditCell({ ...editCell!, value: e.target.value })}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            step={isNumber ? '0.5' : undefined}
          />
        )}
        <button onClick={saveEdit} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><Check size={12} /></button>
        <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={12} /></button>
      </div>
    );
  };

  const renderCell = (task: Task, field: string, display: React.ReactNode, editable = true) => {
    const isEditing = editCell?.taskId === task.id && editCell?.field === field;

    if (isEditing) {
      return <td className={cellCls + ' bg-[#eef3f8]/50'}>{renderEditInput(task, field)}</td>;
    }

    const rawValue = field === 'estimated_hours' ? String(task.estimated_hours) : (task as Record<string, unknown>)[field] as string ?? '';

    return (
      <td
        className={`${cellCls} ${editable ? 'cursor-pointer hover:bg-[#eef3f8]/30' : ''} transition-colors`}
        onDoubleClick={() => editable && startEdit(task.id, field, rawValue)}
      >
        {display}
      </td>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#eef3f8] flex items-center justify-center"><GripVertical size={16} className="text-[#4a7fa5]" /></div>
        <div>
          <h3 className="font-bold text-slate-800">Visão em Grade</h3>
          <p className="text-xs text-slate-400">Clique duplo em qualquer célula para editar</p>
        </div>
        <span className="ml-auto text-xs text-slate-400 font-medium">{allTasks.length} tarefa(s) em {stages.length} etapa(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className={headerCls + ' sticky left-0 z-20 bg-slate-50 min-w-[220px] text-left'}>Tarefa</th>
              <th className={headerCls + ' min-w-[100px] text-left'}>Status</th>
              <th className={headerCls + ' min-w-[100px] text-left'}>Prioridade</th>
              <th className={headerCls + ' min-w-[110px] text-left'}>Início Prev.</th>
              <th className={headerCls + ' min-w-[110px] text-left'}>Fim Prev.</th>
              <th className={headerCls + ' min-w-[80px] text-right'}>Estimada</th>
              <th className={headerCls + ' min-w-[80px] text-right'}>Realizada</th>
              <th className={headerCls + ' min-w-[130px] text-left'}>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, si) => {
              const color = STAGE_COLORS[si % STAGE_COLORS.length];
              const completed = stage.tasks.filter(t => t.status === 'completed').length;
              const total = stage.tasks.length;

              return (
                <Fragment key={stage.id}>
                  <tr>
                    <td colSpan={8} className={`px-0 py-0 border-b-2 ${color.border}`}>
                      <div className={`flex items-center gap-3 px-4 py-3 ${color.light}`}>
                        <div className={`w-1.5 h-8 rounded-full ${color.bg}`} />
                        <ChevronRight size={14} className={color.text} />
                        <span className={`text-xs font-black uppercase tracking-wider ${color.text}`}>{stage.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{completed}/{total} concluída(s)</span>
                        {stage.estimated_hours > 0 && (
                          <span className="text-[10px] text-slate-400 ml-auto font-medium">{stage.estimated_hours}h estimadas &middot; {stage.actual_hours.toFixed(1)}h realizadas</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {stage.tasks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 text-center text-xs text-slate-300 border-b border-slate-100">
                        Nenhuma tarefa nesta etapa
                      </td>
                    </tr>
                  )}
                  {stage.tasks.map(task => (
                    <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className={cellCls + ' sticky left-0 bg-white z-10 group-hover:bg-slate-50/50'}>
                        {editCell?.taskId === task.id && editCell?.field === 'name' ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={el => { inputRef.current = el; }}
                              className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-xs bg-white outline-none"
                              value={editCell.value}
                              onChange={e => setEditCell({ ...editCell, value: e.target.value })}
                              onBlur={saveEdit}
                              onKeyDown={handleKeyDown}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className={`w-1 h-4 rounded-full ${color.bg} opacity-40`} />
                            <span className="font-semibold text-slate-700 cursor-pointer hover:text-[#2c5372]" onDoubleClick={() => startEdit(task.id, 'name', task.name)}>
                              {task.name}
                            </span>
                          </div>
                        )}
                      </td>
                      {renderCell(task, 'status', <StatusBadge status={task.status} />)}
                      {renderCell(task, 'priority', <span className="text-xs text-slate-600">{PRIORITY_LABELS[task.priority] ?? task.priority}</span>)}
                      {renderCell(task, 'planned_start', <span className="text-xs text-slate-500">{task.planned_start ?? '—'}</span>)}
                      {renderCell(task, 'planned_end', <span className="text-xs text-slate-500">{task.planned_end ?? '—'}</span>)}
                      {renderCell(task, 'estimated_hours', <span className="text-xs text-slate-600 text-right block">{task.estimated_hours}h</span>)}
                      <td className={cellCls + ' text-right'}>
                        <span className={`text-xs ${task.actual_hours > task.estimated_hours && task.estimated_hours > 0 ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                          {task.actual_hours.toFixed(1)}h
                        </span>
                      </td>
                      <td className={cellCls}>
                        <div className="flex items-center gap-1.5">
                          {task.collaborators.slice(0, 3).map(c => (
                            <div key={c.id} className="flex items-center gap-1">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#4a7fa5] to-[#c7b475] text-white text-[8px] font-bold flex items-center justify-center border border-white" title={c.name}>
                                {c.name.charAt(0)}
                              </div>
                              <span className="text-[10px] text-slate-500">{c.name.split(' ')[0]}</span>
                            </div>
                          ))}
                          {task.collaborators.length > 3 && <span className="text-[10px] text-slate-400">+{task.collaborators.length - 3}</span>}
                          {task.collaborators.length === 0 && <span className="text-[10px] text-slate-300">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

