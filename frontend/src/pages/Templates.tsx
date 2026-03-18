import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectTemplate, Project } from '@/types';
import {
  getTemplates, deleteTemplate, getProjects, createTemplate,
  createProjectFromTemplate,
} from '@/api/client';
import Modal from '@/components/Modal';
import { SkeletonCard } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import {
  Plus, Trash2, Copy, Layers, FolderKanban, ChevronDown, ChevronRight,
  FileText, Rocket,
} from 'lucide-react';

function formatDate(d: string): string {
  try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
}

export default function Templates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveModal, setSaveModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [saveForm, setSaveForm] = useState({ projectId: 0, name: '', description: '' });
  const [createForm, setCreateForm] = useState({ templateId: 0, name: '', description: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, projs] = await Promise.all([getTemplates(), getProjects()]);
      setTemplates(tpls); setProjects(projs);
    } catch { toast('error', 'Erro ao carregar templates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveForm.projectId || !saveForm.name) { toast('error', 'Preencha todos os campos'); return; }
    try {
      await createTemplate(saveForm.projectId, saveForm.name, saveForm.description);
      toast('success', 'Template salvo!');
      setSaveModal(false); setSaveForm({ projectId: 0, name: '', description: '' });
      await fetchAll();
    } catch { toast('error', 'Erro ao salvar template'); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.templateId || !createForm.name) { toast('error', 'Preencha todos os campos'); return; }
    try {
      const result = await createProjectFromTemplate(createForm.templateId, createForm.name, createForm.description);
      toast('success', 'Projeto criado a partir do template!');
      setCreateModal(false); setCreateForm({ templateId: 0, name: '', description: '' });
      navigate(`/projects/${result.id}`);
    } catch { toast('error', 'Erro ao criar projeto'); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteTemplate(id); setDeleteConfirmId(null); toast('success', 'Template excluído.'); await fetchAll(); }
    catch { toast('error', 'Erro ao excluir template'); }
  };

  const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4a7fa5]/20 focus:border-[#4a7fa5] outline-none transition-all bg-white';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Templates</h1>
          <p className="text-slate-500 mt-1">{templates.length} template(s) disponível(is)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all font-medium shadow-lg shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98]">
            <Rocket size={18} /> Criar Projeto de Template
          </button>
          <button onClick={() => setSaveModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#e83948] text-white rounded-xl hover:bg-[#d42d3b] transition-all font-bold shadow-lg shadow-[#e83948]/25 hover:scale-[1.02] active:scale-[0.98]">
            <Plus size={18} /> Salvar Projeto como Template
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-16 text-center">
          <Copy size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhum template cadastrado</p>
          <p className="text-slate-400 text-sm mt-1">Salve um projeto existente como template para reutilizar</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t, i) => {
            const stages = Array.isArray(t.stages_json) ? t.stages_json : [];
            const taskCount = stages.reduce((acc: number, s: any) => acc + (s.tasks?.length ?? 0), 0);
            const isExpanded = expandedId === t.id;

            return (
              <div key={t.id} className="rounded-2xl bg-white border border-slate-200/60 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-300 overflow-hidden animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-500" />
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-violet-50 to-purple-100/50 rounded-xl shrink-0">
                      <FileText size={20} className="text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 truncate">{t.name}</h3>
                      <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">{t.description || 'Sem descrição'}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Layers size={12} /> {stages.length} etapas</span>
                    <span className="flex items-center gap-1"><FolderKanban size={12} /> {taskCount} tarefas</span>
                    <span>{formatDate(t.created_at)}</span>
                  </div>

                  {/* Expand to see stages */}
                  <button onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    className="mt-3 flex items-center gap-1 text-xs text-[#4a7fa5] hover:text-[#1a3550] font-medium transition-colors">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {isExpanded ? 'Ocultar etapas' : 'Ver etapas'}
                  </button>

                  {isExpanded && stages.length > 0 && (
                    <div className="mt-3 space-y-1.5 animate-fade-in">
                      {stages.map((s: any, si: number) => (
                        <div key={si} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-1.5">
                          <span className="w-5 h-5 rounded-md bg-[#dce7f0] text-[#2c5372] flex items-center justify-center font-bold text-[10px]">{si + 1}</span>
                          <span className="truncate">{s.name}</span>
                          {s.tasks?.length > 0 && <span className="text-slate-400 ml-auto shrink-0">({s.tasks.length} tarefas)</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => { setCreateForm({ templateId: t.id, name: '', description: '' }); setCreateModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg font-medium transition-colors">
                      <Rocket size={13} /> Usar
                    </button>
                    {deleteConfirmId === t.id ? (
                      <div className="flex gap-1 items-center animate-fade-in">
                        <button onClick={() => handleDelete(t.id)} className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg font-semibold">Confirmar</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(t.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors">
                        <Trash2 size={13} /> Excluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save project as template modal */}
      <Modal open={saveModal} onClose={() => setSaveModal(false)} title="Salvar Projeto como Template" wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Projeto de Origem</label>
            <select value={saveForm.projectId} onChange={(e) => setSaveForm(f => ({ ...f, projectId: parseInt(e.target.value) || 0 }))} className={inputCls} required>
              <option value={0}>Selecione um projeto...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome do Template</label>
            <input type="text" value={saveForm.name} onChange={(e) => setSaveForm(f => ({ ...f, name: e.target.value }))} className={inputCls} required placeholder="Ex: Template RPA Padrão" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição</label>
            <textarea value={saveForm.description} onChange={(e) => setSaveForm(f => ({ ...f, description: e.target.value }))} rows={3} className={inputCls} placeholder="Opcional..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="px-5 py-2.5 bg-[#e83948] text-white rounded-xl hover:bg-[#d42d3b] font-bold shadow-lg shadow-[#e83948]/25 transition-all">Salvar</button>
            <button type="button" onClick={() => setSaveModal(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all">Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Create project from template modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Criar Projeto a partir de Template" wide>
        <form onSubmit={handleCreate} className="space-y-4">
          {!createForm.templateId && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Template</label>
              <select value={createForm.templateId} onChange={(e) => setCreateForm(f => ({ ...f, templateId: parseInt(e.target.value) || 0 }))} className={inputCls} required>
                <option value={0}>Selecione um template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {createForm.templateId > 0 && (
            <div className="p-3 bg-violet-50 rounded-xl text-sm text-violet-700 flex items-center gap-2">
              <FileText size={16} />
              Template: <strong>{templates.find(t => t.id === createForm.templateId)?.name}</strong>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome do Novo Projeto</label>
            <input type="text" value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} className={inputCls} required placeholder="Ex: Implantação Bot Contas a Pagar" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição</label>
            <textarea value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={3} className={inputCls} placeholder="Opcional..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 font-medium shadow-lg shadow-emerald-500/25 transition-all">Criar Projeto</button>
            <button type="button" onClick={() => setCreateModal(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all">Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
