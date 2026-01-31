import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Category } from '../types';
import { Tags, X, RotateCcw, Smile, Save, Trash2, Edit, Palette } from 'lucide-react';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryChange: (category?: Category) => void; // Called when a category is added/updated/deleted
}

const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ isOpen, onClose, onCategoryChange }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catData, setCatData] = useState({
    name: '',
    color: '#3b82f6',
    emoji: '📁'
  });

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    const cats = await db.getCategories();
    setCategories(cats);
  };

  const handleResetCategoryForm = () => {
    setEditingCategory(null);
    setCatData({ name: '', color: '#3b82f6', emoji: '📁' });
  };

  const handleEditCategory = (e: React.MouseEvent, c: Category) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingCategory(c);
    setCatData({
      name: c.name,
      color: c.color,
      emoji: c.emoji
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    let resultCategory: Category;
    
    if (editingCategory) {
      await db.updateCategory(editingCategory.id, catData);
      resultCategory = { ...editingCategory, ...catData };
    } else {
      resultCategory = await db.addCategory(catData);
    }
    
    await loadCategories();
    handleResetCategoryForm();
    onCategoryChange(resultCategory);
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Excluir esta categoria? Produtos vinculados ficarão sem categoria.')) {
      await db.deleteCategory(id);
      await loadCategories();
      if (editingCategory?.id === id) handleResetCategoryForm();
      onCategoryChange(); // No specific category to select
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Tags size={20} className="text-blue-600" /> Gerenciar Categorias
          </h3>
          <button onClick={() => { onClose(); handleResetCategoryForm(); }} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <form onSubmit={handleSaveCategory} className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h4>
              {editingCategory && (
                <button 
                  type="button" 
                  onClick={handleResetCategoryForm}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Cancelar Edição
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <Smile size={12} /> Emoji
                </label>
                <input 
                  required
                  type="text" 
                  className="w-full px-2 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-center text-xl border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={catData.emoji}
                  onChange={e => setCatData({ ...catData, emoji: e.target.value })}
                  placeholder="📂"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <Tags size={12} /> Nome
                </label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={catData.name}
                  onChange={e => setCatData({ ...catData, name: e.target.value })}
                  placeholder="Ex: Embalagens"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Palette size={12} /> Cor da Etiqueta
              </label>
              <div className="flex gap-2 flex-wrap">
                {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#64748b'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCatData({ ...catData, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${catData.color === color ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition"
            >
              <Save size={16} />
              {editingCategory ? 'Salvar Alterações' : 'Adicionar Categoria'}
            </button>
          </form>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Existentes</h4>
            <div className="max-h-[200px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group hover:border-blue-200 dark:hover:border-blue-800 transition">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c.emoji}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{c.name}</span>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={(e) => handleEditCategory(e, c)} className="p-2 text-slate-400 hover:text-blue-600 transition">
                      <Edit size={16} />
                    </button>
                    <button onClick={(e) => handleDeleteCategory(e, c.id)} className="p-2 text-slate-400 hover:text-red-600 transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-center text-sm text-slate-400 italic py-4">Nenhuma categoria cadastrada.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageCategoriesModal;