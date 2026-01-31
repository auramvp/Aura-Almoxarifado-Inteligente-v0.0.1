
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Product, UserRole, Category, Supplier, StockBalance } from '../types';
import { Search, Plus, Edit, Trash2, X, Save, Tags, Palette, Smile, RotateCcw, Box, Hash, Tag, Truck, DollarSign, Warehouse, Ruler, AlertTriangle, Filter, FilterX, FileText, Eye } from 'lucide-react';
import ManageCategoriesModal from './ManageCategoriesModal';

const UNIT_OPTIONS = ['U', 'FD', 'KG', 'LT', 'M', 'PAR', 'CX', 'BD', 'RL', 'TN'];

const Products = ({ user }: any) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  
  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Form states Product
  const [formData, setFormData] = useState({
    cod: '',
    description: '',
    unit: 'U',
    minStock: 0,
    categoryId: '',
    defaultSupplierId: '',
    storageLocation: '',
    observations: '',
    pmed: 0
  });

  // Display value for currency mask
  const [displayPmed, setDisplayPmed] = useState('');

  const canEdit = user.role === UserRole.ALMOXARIFE || user.permissions?.products === 'full';

  const refreshData = async () => {
    const [ps, cs, ss, bs] = await Promise.all([
      db.getProducts(),
      db.getCategories(),
      db.getSuppliers(),
      db.getStockBalances()
    ]);
    setProducts(ps);
    setCategories(cs);
    setSuppliers(ss);
    setBalances(bs);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const parseCurrencyToNumber = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    return Number(cleanValue) / 100;
  };

  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    balances.forEach(b => {
      map[b.productId] = (map[b.productId] || 0) + b.quantity;
    });
    return map;
  }, [balances]);

  const uniqueLocations = useMemo(() => {
    const locs = products
      .map(p => p.storageLocation)
      .filter((loc): loc is string => !!loc && loc.trim() !== '');
    return Array.from(new Set(locs)).sort();
  }, [products]);

  const handleOpenModal = (p: Product | null = null) => {
    if (p) {
      setEditingProduct(p);
      setFormData({
        cod: p.cod,
        description: p.description,
        unit: p.unit,
        minStock: p.minStock,
        categoryId: p.categoryId || '',
        defaultSupplierId: p.defaultSupplierId || '',
        storageLocation: p.storageLocation || '',
        observations: p.observations || '',
        pmed: p.pmed
      });
      setDisplayPmed(formatBRL(p.pmed));
    } else {
      setEditingProduct(null);
      setFormData({ 
        cod: '', 
        description: '', 
        unit: 'U', 
        minStock: 0, 
        categoryId: '', 
        defaultSupplierId: '', 
        storageLocation: '',
        observations: '',
        pmed: 0 
      });
      setDisplayPmed(formatBRL(0));
    }
    setIsModalOpen(true);
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseCurrencyToNumber(value);
    setFormData({ ...formData, pmed: numericValue });
    setDisplayPmed(formatBRL(numericValue));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await db.updateProduct(editingProduct.id, formData);
      } else {
        await db.saveProduct(formData);
      }
      await refreshData();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Erro ao salvar produto:", error);
      alert(`Erro ao salvar produto: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleViewDetails = (p: Product) => {
    setViewingProduct(p);
    setIsDetailsModalOpen(true);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedSupplier('all');
    setSelectedLocation('all');
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.cod.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesSupplier = selectedSupplier === 'all' || p.defaultSupplierId === selectedSupplier;
    const matchesLocation = selectedLocation === 'all' || p.storageLocation === selectedLocation;
    
    return matchesSearch && matchesCategory && matchesSupplier && matchesLocation;
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Catálogo de Produtos</h2>
          <p className="text-slate-500 dark:text-slate-400">Gerencie o cadastro completo de itens do estoque.</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <button 
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition font-medium border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <Tags size={18} />
                Categorias
              </button>
              <button 
                onClick={() => handleOpenModal()}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-md shadow-blue-100"
              >
                <Plus size={20} />
                Novo Produto
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors shrink-0">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold mb-2">
          <Filter size={18} className="text-blue-600 dark:text-blue-500" />
          <h3>Filtros de Busca</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Pesquisar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Nome ou código..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Categoria</label>
            <select 
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm outline-none"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Todas as categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Fornecedor</label>
            <select 
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm outline-none"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
            >
              <option value="all">Todos os fornecedores</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Local de Armazenamento</label>
            <select 
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm outline-none"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="all">Todos os locais</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        {(searchTerm !== '' || selectedCategory !== 'all' || selectedSupplier !== 'all' || selectedLocation !== 'all') && (
          <div className="flex justify-end pt-2">
            <button 
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs font-bold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition uppercase tracking-wider"
            >
              <FilterX size={14} />
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left relative">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Cód</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Descrição</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Categoria</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Local</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Saldo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Estoque Mínimo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredProducts.length > 0 ? filteredProducts.map(p => {
                const category = categories.find(c => c.id === p.categoryId);
                const currentBalance = balanceMap[p.id] || 0;
                const isBelowMin = currentBalance < p.minStock;

                return (
                  <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${isBelowMin ? 'bg-red-50/20 dark:bg-red-900/5' : ''}`}>
                    <td className="px-6 py-4 font-mono text-sm text-blue-600 dark:text-blue-400">{p.cod}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        {isBelowMin && (
                          <span title="Abaixo do estoque mínimo">
                            <AlertTriangle size={14} className="text-red-500 shrink-0" />
                          </span>
                        )}
                        <p className={`font-medium ${isBelowMin ? 'text-red-700 dark:text-red-400' : ''}`}>{p.description}</p>
                      </div>
                      {p.observations && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic line-clamp-1 max-w-[200px]" title={p.observations}>
                          Obs: {p.observations}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {category ? (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{category.emoji}</span>
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-medium text-white shadow-sm"
                            style={{ backgroundColor: category.color }}
                          >
                            {category.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">Sem categoria</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Warehouse size={12} className="text-slate-400 dark:text-slate-500" />
                        <span className="truncate max-w-[120px]" title={p.storageLocation}>{p.storageLocation || '-'}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-sm text-right font-bold ${isBelowMin ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {currentBalance}
                    </td>
                    <td className={`px-6 py-4 text-sm text-right font-medium ${isBelowMin ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {p.minStock}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleViewDetails(p)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition" title="Ver Detalhes"
                        >
                          <Eye size={18} />
                        </button>
                        {canEdit && (
                          <button 
                            onClick={() => handleOpenModal(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition" title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum produto encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ManageCategoriesModal 
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoryChange={() => refreshData()}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Box size={20} className="text-blue-600" />
                {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition outline-none">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Box size={14} /> Nome do Produto
                  </label>
                  <input 
                    required
                    placeholder="Ex: Caixa de Papelão Reforçada"
                    type="text" 
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition outline-none"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Hash size={14} /> Código
                  </label>
                  <input 
                    required
                    placeholder="EMB-001"
                    type="text" 
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition font-mono outline-none"
                    value={formData.cod}
                    onChange={e => setFormData({ ...formData, cod: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Tag size={14} /> Categoria
                  </label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition outline-none"
                    value={formData.categoryId}
                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Truck size={14} /> Fornecedor Padrão
                  </label>
                  <select 
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition outline-none"
                    value={formData.defaultSupplierId}
                    onChange={e => setFormData({ ...formData, defaultSupplierId: e.target.value })}
                  >
                    <option value="">Nenhum</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Warehouse size={14} /> Local de Armazenamento
                  </label>
                  <input 
                    required
                    placeholder="Ex: Prateleira A1, Corredor 2"
                    type="text" 
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition outline-none"
                    value={formData.storageLocation}
                    onChange={e => setFormData({ ...formData, storageLocation: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Ruler size={14} /> Unidade de Medida
                  </label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition outline-none"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  >
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <AlertTriangle size={14} /> Estoque Mínimo
                  </label>
                  <input 
                    required
                    type="number" min="0"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition outline-none"
                    value={formData.minStock}
                    onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <FileText size={14} /> Observações Adicionais
                  </label>
                  <textarea 
                    placeholder="Informações extras..."
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition min-h-[100px] resize-none outline-none"
                    value={formData.observations}
                    onChange={e => setFormData({ ...formData, observations: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-3 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition outline-none"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-100 dark:shadow-none outline-none"
                >
                  <Save size={20} />
                  {editingProduct ? 'Salvar Alterações' : 'Concluir Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailsModalOpen && viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Eye size={20} className="text-blue-600" />
                Detalhes do Produto
              </h3>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition outline-none">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Descrição</p>
                   <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{viewingProduct.description}</p>
                </div>

                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Código</p>
                   <p className="font-mono text-slate-700 dark:text-slate-300">{viewingProduct.cod}</p>
                </div>

                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Categoria</p>
                   {categories.find(c => c.id === viewingProduct.categoryId) ? (
                     <div className="flex items-center gap-2">
                       <span>{categories.find(c => c.id === viewingProduct.categoryId)?.emoji}</span>
                       <span className="font-medium">{categories.find(c => c.id === viewingProduct.categoryId)?.name}</span>
                     </div>
                   ) : <span className="text-slate-400 italic">Sem categoria</span>}
                </div>

                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Fornecedor Padrão</p>
                   <p className="font-medium text-slate-700 dark:text-slate-300">
                     {suppliers.find(s => s.id === viewingProduct.defaultSupplierId)?.name || <span className="text-slate-400 italic">Não definido</span>}
                   </p>
                </div>

                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Local de Armazenamento</p>
                   <p className="font-medium text-slate-700 dark:text-slate-300">{viewingProduct.storageLocation || '-'}</p>
                </div>

                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Unidade</p>
                   <p className="font-medium text-slate-700 dark:text-slate-300">{viewingProduct.unit}</p>
                </div>

                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Estoque Mínimo</p>
                   <p className="font-medium text-slate-700 dark:text-slate-300">{viewingProduct.minStock}</p>
                </div>
                
                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Saldo Atual</p>
                   <p className={`font-bold text-lg ${(balanceMap[viewingProduct.id] || 0) < viewingProduct.minStock ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'}`}>
                     {balanceMap[viewingProduct.id] || 0}
                   </p>
                </div>

                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Custo (Preço Médio)</p>
                   <p className="font-bold text-slate-800 dark:text-slate-200">
                     {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProduct.pmed)}
                   </p>
                </div>

                {viewingProduct.observations && (
                  <div className="md:col-span-2">
                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Observações</p>
                     <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                       {viewingProduct.observations}
                     </p>
                  </div>
                )}
              </div>

              <div className="pt-6 flex justify-end border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="py-2 px-6 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition outline-none"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
