import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { MovementType, StockMovement, Category, Product, Supplier, Sector } from '../types';
import { 
  ArrowUpCircle, ArrowDownCircle, Filter, X, Search, Tag, 
  Package, Truck, FilterX, Hash, Navigation, DollarSign, 
  CheckCircle2, AlertCircle, ChevronLeft, User as UserIcon, 
  Building2, Loader2, Users, Plus, Eye 
} from 'lucide-react';
import Sectors from './Sectors';

const Movements = ({ user }: any) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSectorsViewOpen, setIsSectorsViewOpen] = useState(false);
  
  const [movementType, setMovementType] = useState<MovementType>(MovementType.IN);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSector, setFilterSector] = useState('all');
  const [isSaving, setIsSaving] = useState(false);

  // New states for product search
  const [productSearch, setProductSearch] = useState('');
  const [isProductListOpen, setIsProductListOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const canEdit = user.role === 'ALMOXARIFE' || user.permissions?.movements === 'full';

  useEffect(() => {
    const loadData = async () => {
      const [ms, ps, cs, ss, sec] = await Promise.all([
        db.getMovements(),
        db.getProducts(),
        db.getCategories(),
        db.getSuppliers(),
        db.getSectors()
      ]);
      setMovements(ms.sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
      setProducts(ps);
      setCategories(cs);
      setSuppliers(ss);
      setSectors(sec);
    };
    loadData();
  }, [isSectorsViewOpen]);

  const [formData, setFormData] = useState({
    productId: '', 
    supplierId: '',
    sectorId: '', 
    personName: '', 
    quantity: 1, 
    totalValue: 0, 
    destination: '', 
    invoiceNumber: '',
    invoiceDate: '',
    invoiceValue: 0,
    movementDate: new Date().toISOString().split('T')[0], 
    notes: '', 
    originId: 'SISTEMA'
  });

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === formData.productId);
  }, [products, formData.productId]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const lower = productSearch.toLowerCase();
    return products.filter(p => 
      (p.name && p.name.toLowerCase().includes(lower)) || 
      p.description.toLowerCase().includes(lower) ||
      p.cod.toLowerCase().includes(lower)
    );
  }, [products, productSearch]);

  const selectedSector = useMemo(() => {
    return sectors.find(s => s.id === formData.sectorId);
  }, [sectors, formData.sectorId]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === formData.supplierId);
  }, [suppliers, formData.supplierId]);

  const [displayTotalValue, setDisplayTotalValue] = useState('');
  const [displayInvoiceValue, setDisplayInvoiceValue] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);

  // Auto-fill total value for OUT movements based on PMED
  useEffect(() => {
    if (movementType === MovementType.OUT && selectedProduct) {
      const val = prev => prev.quantity * selectedProduct.pmed;
      setFormData(prev => {
        const newVal = prev.quantity * selectedProduct.pmed;
        setDisplayTotalValue(formatCurrency(newVal));
        return { ...prev, totalValue: newVal };
      });
    }
  }, [movementType, selectedProduct, formData.quantity]);

  const handleOpenModal = (type: MovementType) => {
    setMovementType(type);
    setIsConfirming(false);
    setProductSearch('');
    setShowInvoice(false);
    setDisplayTotalValue(formatCurrency(0));
    setDisplayInvoiceValue(formatCurrency(0));
    setFormData({
      productId: '', 
      supplierId: '',
      sectorId: '',
      personName: '',
      quantity: 1, 
      totalValue: 0, 
      destination: '', 
      invoiceNumber: '',
      invoiceDate: '',
      invoiceValue: 0,
      movementDate: new Date().toISOString().split('T')[0], 
      notes: '', 
      originId: type === MovementType.IN ? 'ENTRADA' : 'SAÍDA'
    });
    setIsModalOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const parseCurrencyToNumber = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    return Number(cleanValue) / 100;
  };

  const handleTotalValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseCurrencyToNumber(value);
    setFormData({ ...formData, totalValue: numericValue });
    setDisplayTotalValue(formatCurrency(numericValue));
  };

  const handleInvoiceValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseCurrencyToNumber(value);
    setFormData({ ...formData, invoiceValue: numericValue });
    setDisplayInvoiceValue(formatCurrency(numericValue));
  };

  const handleViewDetails = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setIsDetailsOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // For IN movements, use the manually entered totalValue
      // For OUT movements, we might want to ensure it uses the current PMED (or the calculated one)
      const finalValue = Number(formData.totalValue);
      const destinationLabel = selectedSector ? selectedSector.name : formData.destination;

      await db.createMovement({ 
        ...formData, 
        type: movementType, 
        quantity: Number(formData.quantity), 
        totalValue: finalValue,
        destination: destinationLabel
      });
      const ms = await db.getMovements();
      setMovements(ms.sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
      setIsModalOpen(false);
      setIsConfirming(false);
    } catch (err: any) { 
      alert(err.message); 
    } finally {
      setIsSaving(false);
    }
  };



  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const prod = products.find(p => p.id === m.productId);
      const matchesSearch = searchTerm === '' || 
        prod?.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        prod?.cod.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.personName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || prod?.categoryId === filterCategory;
      const matchesSector = filterSector === 'all' || m.sectorId === filterSector;
      return matchesSearch && matchesCategory && matchesSector;
    });
  }, [movements, products, searchTerm, filterCategory, filterSector]);

  if (isSectorsViewOpen) {
    return (
      <div className="space-y-6">
        <button onClick={() => setIsSectorsViewOpen(false)} className="flex items-center gap-2 text-slate-400 hover:text-blue-600 font-black uppercase text-[10px] tracking-widest transition">
          <ChevronLeft size={16} /> Voltar para Movimentações
        </button>
        <Sectors user={user} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Diário de Movimentações</h2>
          <p className="text-slate-500 dark:text-slate-400">Gestão de entradas e saídas por setor e requisitante.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsSectorsViewOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition font-bold border border-slate-200 dark:border-slate-700 shadow-sm"><Users size={18} /> Setores</button>
          {canEdit && (
            <>
              <button onClick={() => handleOpenModal(MovementType.IN)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-bold shadow-md shadow-emerald-500/10"><ArrowUpCircle size={18} /> Nova Entrada</button>
              <button onClick={() => handleOpenModal(MovementType.OUT)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-bold shadow-md shadow-amber-500/10"><ArrowDownCircle size={18} /> Nova Saída</button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold"><Filter size={18} className="text-blue-600 dark:text-blue-500" /><h3>Filtros de Pesquisa</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="NF, Produto, Setor ou Colaborador..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className="px-3 py-2 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="all">Categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <select className="px-3 py-2 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none" value={filterSector} onChange={e => setFilterSector(e.target.value)}>
            <option value="all">Todos os Setores</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={() => {setSearchTerm(''); setFilterCategory('all'); setFilterSector('all');}} className="flex items-center justify-center gap-2 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-medium"><FilterX size={16} /> Limpar</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Produto / Código</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Setor / Requisitante</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Qtd</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">V. Total</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredMovements.length > 0 ? filteredMovements.map(m => {
                const prod = products.find(p => p.id === m.productId);
                return (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{new Date(m.movementDate).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{prod?.description}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold tracking-widest">{prod?.cod}</p>
                    </td>
                    <td className="px-6 py-4">
                      {m.type === MovementType.IN ? 
                        <span className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">ENTRADA</span> : 
                        <span className="text-amber-600 dark:text-amber-400 font-black text-[10px] bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">SAÍDA</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          <Navigation size={12} className="text-blue-500" />
                          <span>{m.destination}</span>
                        </div>
                        {m.personName && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                            <UserIcon size={10} />
                            <span>{m.personName}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-slate-100 text-sm">
                      {m.type === MovementType.IN ? '+' : '-'}{m.quantity}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(m.totalValue)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => handleViewDetails(m)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Ver Detalhes">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600 italic">Nenhuma movimentação registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            <div className={`shrink-0 px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between text-white ${movementType === MovementType.IN ? 'bg-emerald-600' : 'bg-amber-600'}`}>
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest">
                  {isConfirming ? 'Conferir Lançamento' : (movementType === MovementType.IN ? 'Nova Entrada' : 'Nova Saída')}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><X size={20} /></button>
            </div>

            {isConfirming ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"> <Package size={20} /> </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</p>
                          <p className="text-lg font-black text-slate-800 dark:text-slate-100">{selectedProduct?.name || selectedProduct?.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantidade</p>
                         <p className={`text-2xl font-black ${movementType === MovementType.IN ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {movementType === MovementType.IN ? '+' : '-'}{formData.quantity}
                         </p>
                      </div>
                    </div>

                    <hr className="border-slate-200 dark:border-slate-700" />

                    <div className="grid grid-cols-2 gap-6">
                      {movementType === MovementType.IN && (
                        <>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fornecedor</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              {selectedSupplier?.name || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total Compra</p>
                            <p className="text-sm font-black text-emerald-600">{formatCurrency(Number(formData.totalValue))}</p>
                          </div>
                           <div className="col-span-2 grid grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NF Número</p>
                                  <p className="text-sm font-bold">{formData.invoiceNumber || '-'}</p>
                              </div>
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data Emissão</p>
                                  <p className="text-sm font-bold">{formData.invoiceDate ? new Date(formData.invoiceDate).toLocaleDateString('pt-BR') : '-'}</p>
                              </div>
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Nota</p>
                                  <p className="text-sm font-bold">{formData.invoiceValue ? formatCurrency(Number(formData.invoiceValue)) : '-'}</p>
                              </div>
                           </div>
                        </>
                      )}
                      
                      {movementType === MovementType.OUT && (
                          <>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Setor Destino</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                  {selectedSector?.name}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                  <UserIcon size={14} className="text-blue-500" /> {formData.personName}
                                </p>
                              </div>
                          </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 p-6 border-t dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-4">
                  <button onClick={() => setIsConfirming(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"><ChevronLeft size={16} /> Ajustar</button>
                  <button onClick={handleSave} disabled={isSaving} className={`flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${movementType === MovementType.IN ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-amber-600 shadow-amber-500/20'}`}>
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Confirmar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setIsConfirming(true); }} className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  
                  {/* Product Search Field */}
                  <div className="space-y-2 relative">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto (Pesquise por nome ou código)</label>
                      <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                              type="text" 
                              required 
                              placeholder="Digite para buscar..." 
                              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                              value={productSearch}
                              onChange={(e) => {
                                  setProductSearch(e.target.value);
                                  setIsProductListOpen(true);
                                  if (!e.target.value) setFormData({...formData, productId: ''});
                              }}
                              onFocus={() => setIsProductListOpen(true)}
                          />
                          {formData.productId && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                  <CheckCircle2 size={20} />
                              </div>
                          )}
                      </div>
                      
                      {isProductListOpen && filteredProducts.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border dark:border-slate-700 max-h-60 overflow-y-auto">
                              {filteredProducts.map(p => (
                                  <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                          setFormData({...formData, productId: p.id});
                                          setProductSearch(`${p.cod} - ${p.name || p.description}`);
                                          setIsProductListOpen(false);
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition border-b dark:border-slate-700/50 last:border-0"
                                  >
                                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.name || p.description}</p>
                                      <p className="text-xs text-slate-400 font-mono">{p.cod}</p>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quantidade</label>
                          <input required type="number" min="1" className="w-full px-5 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-xl" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                      </div>
                      <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                               {movementType === MovementType.IN ? 'Valor Total da Compra (R$)' : 'Valor Estimado (R$)'}
                           </label>
                           <input 
                              required={movementType === MovementType.IN}
                              readOnly={movementType === MovementType.OUT}
                              type="text" 
                              className={`w-full px-5 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-xl ${movementType === MovementType.OUT ? 'opacity-60 bg-slate-100' : ''}`}
                              value={displayTotalValue} 
                              onChange={handleTotalValueChange} 
                           />
                      </div>
                  </div>

                  {movementType === MovementType.IN && (
                      <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fornecedor</label>
                              <select required className="w-full px-5 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.supplierId} onChange={e => setFormData({ ...formData, supplierId: e.target.value })}>
                                  <option value="">Selecione o Fornecedor...</option>
                                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                          </div>

                          <div className="space-y-4">
                              {!showInvoice ? (
                                  <button type="button" onClick={() => setShowInvoice(true)} className="flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-600 transition p-2 hover:bg-blue-50 rounded-lg">
                                      <Tag size={16} /> Adicionar Nota Fiscal (Opcional)
                                  </button>
                              ) : (
                                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                      <div className="flex items-center justify-between mb-2">
                                         <div className="flex items-center gap-2">
                                             <Tag size={16} className="text-slate-400" />
                                             <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Dados da Nota Fiscal</span>
                                         </div>
                                         <button type="button" onClick={() => setShowInvoice(false)} className="text-slate-400 hover:text-red-500 transition"><X size={16} /></button>
                                      </div>
                                      <div className="grid grid-cols-3 gap-4">
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Número NF</label>
                                              <input type="text" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.invoiceNumber} onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })} />
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Data Emissão</label>
                                              <input type="date" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.invoiceDate} onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })} />
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Valor Total Nota</label>
                                              <input type="text" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={displayInvoiceValue} onChange={handleInvoiceValueChange} />
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {movementType === MovementType.OUT && (
                      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Setor Solicitante</label>
                              <select required className="w-full px-5 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.sectorId} onChange={e => setFormData({ ...formData, sectorId: e.target.value, personName: '' })}>
                                  <option value="">Selecione...</option>
                                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                          </div>
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quem retirou?</label>
                              <select required disabled={!formData.sectorId} className="w-full px-5 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold disabled:opacity-50" value={formData.personName} onChange={e => setFormData({ ...formData, personName: e.target.value })}>
                                  <option value="">Quem requisitou?</option>
                                  {selectedSector?.people?.map((p: any, i: number) => <option key={i} value={p.name}>{p.name} ({p.matricula})</option>)}
                              </select>
                          </div>
                      </div>
                  )}
                </div>

                <div className="shrink-0 p-6 border-t dark:border-slate-800 bg-white dark:bg-slate-900">
                     <button type="submit" className={`w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${movementType === MovementType.IN ? 'bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700' : 'bg-amber-600 shadow-amber-500/20 hover:bg-amber-700'}`}>
                        Continuar <Navigation size={16} />
                    </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isDetailsOpen && selectedMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden border dark:border-slate-800 animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Detalhes da Movimentação</h3>
              <button onClick={() => setIsDetailsOpen(false)} className="bg-slate-200 dark:bg-slate-700 p-2 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition text-slate-500 dark:text-slate-400"><X size={18} /></button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-4 mb-6">
                 <div className={`p-3 rounded-2xl ${selectedMovement.type === MovementType.IN ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {selectedMovement.type === MovementType.IN ? <ArrowUpCircle size={32} /> : <ArrowDownCircle size={32} />}
                 </div>
                 <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Produto</p>
                    <p className="text-xl font-black text-slate-800 dark:text-slate-100">{products.find(p => p.id === selectedMovement.productId)?.name || products.find(p => p.id === selectedMovement.productId)?.description}</p>
                    <p className="text-sm font-bold text-slate-500">{products.find(p => p.id === selectedMovement.productId)?.cod}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data e Hora</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                       {new Date(selectedMovement.createdAt).toLocaleString('pt-BR')}
                    </p>
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantidade</p>
                    <p className={`text-sm font-black ${selectedMovement.type === MovementType.IN ? 'text-emerald-600' : 'text-amber-600'}`}>
                       {selectedMovement.type === MovementType.IN ? '+' : '-'}{selectedMovement.quantity}
                    </p>
                 </div>
                 
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(selectedMovement.totalValue)}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Unitário</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(selectedMovement.totalValue / selectedMovement.quantity)}</p>
                 </div>
              </div>

              {selectedMovement.type === MovementType.IN && (
                 <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4 border border-slate-100 dark:border-slate-800">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fornecedor</p>
                       <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400" />
                          {suppliers.find(s => s.id === selectedMovement.supplierId)?.name || '-'}
                       </p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NF</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedMovement.invoiceNumber || '-'}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Emissão</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedMovement.invoiceDate ? new Date(selectedMovement.invoiceDate).toLocaleDateString('pt-BR') : '-'}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor NF</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedMovement.invoiceValue ? formatCurrency(selectedMovement.invoiceValue) : '-'}</p>
                       </div>
                    </div>
                 </div>
              )}

              {selectedMovement.type === MovementType.OUT && (
                 <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4 border border-slate-100 dark:border-slate-800">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destino / Setor</p>
                       <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Navigation size={14} className="text-blue-500" />
                          {selectedMovement.destination}
                       </p>
                    </div>
                    {selectedMovement.personName && (
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                             <UserIcon size={14} className="text-slate-400" />
                             {selectedMovement.personName}
                          </p>
                       </div>
                    )}
                 </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Movements;