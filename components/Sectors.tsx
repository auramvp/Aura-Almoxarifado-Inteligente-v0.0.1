
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Sector, SectorPerson } from '../types';
import {
  Plus, Edit, Trash2, X, Save, Users, Building2,
  Palette, UserPlus, UserMinus, Hash, User
} from 'lucide-react';

const Sectors = ({ user }: any) => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
    people: [] as SectorPerson[]
  });

  const [newPerson, setNewPerson] = useState({ name: '', matricula: '' });

  const canEdit = user.role === 'ALMOXARIFE' || user.permissions?.sectors === 'full';

  const loadSectors = async () => {
    const data = await db.getSectors();
    setSectors(data);
  };

  useEffect(() => {
    loadSectors();
  }, []);

  const filteredSectors = useMemo(() => {
    return sectors.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.people.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [sectors, searchTerm]);

  // handle functions ...
  const handleOpenModal = (s: Sector | null = null) => {
    if (s) {
      setEditingSector(s);
      setFormData({
        name: s.name,
        color: s.color,
        people: s.people || []
      });
    } else {
      setEditingSector(null);
      setFormData({ name: '', color: '#3b82f6', people: [] });
    }
    setIsModalOpen(true);
  };

  const handleAddPerson = () => {
    if (!newPerson.name.trim() || !newPerson.matricula.trim()) return;
    setFormData({
      ...formData,
      people: [...formData.people, { ...newPerson }]
    });
    setNewPerson({ name: '', matricula: '' });
  };

  const handleRemovePerson = (idx: number) => {
    setFormData({
      ...formData,
      people: formData.people.filter((_, i) => i !== idx)
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSector) {
      await db.updateSector(editingSector.id, formData);
    } else {
      await db.saveSector(formData);
    }
    await loadSectors();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Excluir este setor e todos os vínculos de pessoas?')) {
      await db.deleteSector(id);
      await loadSectors();
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Gestão de Setores</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Organize o almoxarifado por centros de custo e colaboradores.</p>
        </div>
        {canEdit && (
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:scale-95">
            <Plus size={20} /> Novo Setor
          </button>
        )}
      </header>

      {/* Toolbar: Search and View Mode */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar setor ou colaborador..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Plus size={18} className="rotate-45" /> {/* Using Plus rotated for grid-like feel if LayoutGrid not available or preferred */}
            {/* Actually I'll use simple icons for Grid and List */}
            <Building2 size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={18} />
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSectors.map(s => (
            <div key={s.id} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                <button onClick={() => handleOpenModal(s)} className="p-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm text-slate-400 hover:text-blue-600 rounded-lg transition-all"><Edit size={14} /></button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm text-slate-400 hover:text-red-500 rounded-lg transition-all"><Trash2 size={14} /></button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-slate-50 dark:bg-slate-800 shrink-0" style={{ borderLeft: `3px solid ${s.color}` }}>
                  <Building2 className="text-slate-400" size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{s.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{s.people.length} Pessoas</span>
                  </div>
                </div>
              </div>

              <div className="flex -space-x-2 overflow-hidden mb-2">
                {s.people.slice(0, 5).map((p, i) => (
                  <div key={i} title={p.name} className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black text-white uppercase shadow-sm">
                    {p.name.charAt(0)}
                  </div>
                ))}
                {s.people.length > 5 && (
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-slate-500">
                    +{s.people.length - 5}
                  </div>
                )}
                {s.people.length === 0 && <span className="text-[10px] text-slate-400 italic font-medium ml-2">Nenhum colaborador</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Setor</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Colaboradores</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSectors.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-bold text-slate-700 dark:text-slate-200">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {s.people.map((p, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenModal(s)} className="p-2 text-slate-400 hover:text-blue-600 transition-all hover:bg-white dark:hover:bg-slate-700 rounded-xl shadow-sm"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-red-600 transition-all hover:bg-white dark:hover:bg-slate-700 rounded-xl shadow-sm"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
                <Building2 className="text-blue-600" /> {editingSector ? 'Editar Setor' : 'Novo Setor'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 transition"><X size={24} /></button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Identificação do Setor</label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <input required type="text" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome do Setor (Ex: Manutenção)" />
                    </div>
                    <div className="w-20 shrink-0">
                      <input type="color" className="w-full h-full p-2 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl cursor-pointer" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 block">Colaboradores do Setor</label>

                  <div className="flex gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                    <div className="flex-1 space-y-2">
                      <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl text-sm font-bold outline-none" placeholder="Nome do Colaborador" value={newPerson.name} onChange={e => setNewPerson({ ...newPerson, name: e.target.value })} />
                      </div>
                      <div className="relative">
                        <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl text-sm font-black outline-none" placeholder="Matrícula / ID" value={newPerson.matricula} onChange={e => setNewPerson({ ...newPerson, matricula: e.target.value })} />
                      </div>
                    </div>
                    <button type="button" onClick={handleAddPerson} className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition flex items-center justify-center">
                      <UserPlus size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    {formData.people.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-sm">
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold truncate">{p.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{p.matricula}</p>
                        </div>
                        <button type="button" onClick={() => handleRemovePerson(i)} className="p-2 text-slate-300 hover:text-red-500 transition">
                          <UserMinus size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t dark:border-slate-800 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20">Gravar Setor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sectors;
