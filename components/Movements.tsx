import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { EmailService } from '../services/emailService';
import { MovementType, StockMovement, Category, Product, Supplier, Sector, ProductType, ExitType, ReturnStatus, Company } from '../types';
import {
  ArrowUpCircle, ArrowDownCircle, Filter, X, Search, Tag,
  Package, Truck, FilterX, Hash, Navigation, DollarSign,
  Calendar, User as UserIcon, Plus, CheckCircle2, ChevronLeft,
  Loader2, CreditCard, Receipt, FileText, AlertCircle, Trash2,
  Download, RotateCcw, PackageCheck, BarChart3, Eye, Upload,
  Paperclip, Building2, Users, ArrowRightLeft, Clock, Check, XCircle
} from 'lucide-react';
import Sectors from './Sectors';
import AnalysisDashboard from './AnalysisDashboard';

const Movements = ({ user }: any) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<'movements' | 'invoices' | 'transfers'>('movements');
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  // Transfer state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferStep, setTransferStep] = useState<1 | 2 | 3>(1);
  const [transferItems, setTransferItems] = useState<{ productId: string; description: string; cod: string; quantity: number; pmed: number }[]>([]);
  const [transferDestCompanyId, setTransferDestCompanyId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [siblingCompanies, setSiblingCompanies] = useState<Company[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  const [transferProductSearch, setTransferProductSearch] = useState('');
  const [transferProductListOpen, setTransferProductListOpen] = useState(false);
  const [selectedTransferProduct, setSelectedTransferProduct] = useState<Product | null>(null);
  const [transferItemQty, setTransferItemQty] = useState(1);

  const [movementType, setMovementType] = useState<MovementType>(MovementType.IN);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSector, setFilterSector] = useState('all');
  const [filterType, setFilterType] = useState<'all' | MovementType | 'RETURN'>('all');
  const [filterProductType, setFilterProductType] = useState<'all' | ProductType>('all');
  const [isSaving, setIsSaving] = useState(false);

  // New states for product search
  const [productSearch, setProductSearch] = useState('');
  const [isProductListOpen, setIsProductListOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const canEdit = user.role === 'ALMOXARIFE' || user.permissions?.movements === 'full';

  const loadData = async () => {
    const [ms, ps, cs, ss, sec] = await Promise.all([
      db.getMovements(),
      db.getProducts(),
      db.getCategories(),
      db.getSuppliers(),
      db.getSectors()
    ]);
    setMovements(ms.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setProducts(ps);
    setCategories(cs);
    setSuppliers(ss);
    setSectors(sec);

    if (user?.companyId) {
      const company = await db.getCompanyById(user.companyId);
      const rootId = company?.parentId || user.companyId;
      const warehouses = await db.getCompanyWarehouses(rootId);
      const siblings = warehouses.filter((w: Company) => w.id !== user.companyId);
      if (company?.parentId) {
        const root = await db.getCompanyById(rootId);
        if (root && root.id !== user.companyId) siblings.unshift(root);
      }
      setSiblingCompanies(siblings);
      const ts = await db.getTransfers(user.companyId);
      setTransfers(ts);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

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
    invoiceUrl: '',
    movementDate: new Date().toISOString().split('T')[0],
    notes: '',
    originId: 'SISTEMA',
    exitType: ExitType.CONSUMABLE,
    returnedQuantity: 0,
    returnStatus: ReturnStatus.OK
  });

  const [displayTotalValue, setDisplayTotalValue] = useState('');
  const [displayInvoiceValue, setDisplayInvoiceValue] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === formData.productId);
  }, [products, formData.productId]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter by Exit Type if strictly in OUT mode and RETURNABLE is selected
    if (movementType === MovementType.OUT && formData.exitType === ExitType.RETURNABLE) {
      filtered = filtered.filter(p => p.type === ProductType.RETURNABLE);
    }

    if (!productSearch) return filtered;

    const lower = productSearch.toLowerCase();
    return filtered.filter(p =>
      p.description.toLowerCase().includes(lower) ||
      p.cod.toLowerCase().includes(lower)
    );
  }, [products, productSearch, movementType, formData.exitType]);

  const selectedSector = useMemo(() => {
    return sectors.find(s => s.id === formData.sectorId);
  }, [sectors, formData.sectorId]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === formData.supplierId);
  }, [suppliers, formData.supplierId]);



  // Auto-fill total value for OUT movements based on PMED
  useEffect(() => {
    if (formData.productId && movementType === MovementType.OUT) {
      const product = products.find(p => p.id === formData.productId);
      if (product) {
        const estimatedValue = product.pmed * formData.quantity;
        setFormData(prev => ({
          ...prev,
          totalValue: estimatedValue,
          exitType: product.type === ProductType.RETURNABLE ? ExitType.RETURNABLE : ExitType.CONSUMABLE,
          returnStatus: product.type === ProductType.RETURNABLE ? ReturnStatus.PENDING : ReturnStatus.OK
        }));
        setDisplayTotalValue(formatCurrency(estimatedValue));
      }
    }
  }, [movementType, formData.productId, formData.quantity, products]);

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
      invoiceUrl: '',
      movementDate: new Date().toISOString().split('T')[0],
      notes: '',
      originId: type === MovementType.IN ? 'ENTRADA' : 'SAÍDA',
      exitType: ExitType.CONSUMABLE,
      returnedQuantity: 0,
      returnStatus: ReturnStatus.OK
    });
    setInvoiceFile(null);
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
      let currentInvoiceUrl = formData.invoiceUrl || '';

      if (invoiceFile) {
        if (!user?.companyId) throw new Error('Company ID not found');
        currentInvoiceUrl = await db.uploadTaxDocument(invoiceFile, user.companyId);
      }

      const finalValue = Number(formData.totalValue);
      const destinationLabel = selectedSector ? selectedSector.name : formData.destination;

      await db.createMovement({
        ...formData,
        type: movementType,
        quantity: Number(formData.quantity),
        totalValue: finalValue,
        destination: destinationLabel,
        invoiceUrl: currentInvoiceUrl
      });
      const ms = await db.getMovements();
      setMovements(ms.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setIsModalOpen(false);
      setIsConfirming(false);
      setInvoiceFile(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao realizar movimentação');
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
      const matchesType = filterType === 'all' ||
        (filterType === 'RETURN' ? (m.originId === 'DEV_RETORNO' || m.destination?.toUpperCase().includes('RETORNO')) : m.type === filterType);
      const matchesProductType = filterProductType === 'all' || prod?.type === filterProductType;

      return matchesSearch && matchesCategory && matchesSector && matchesType && matchesProductType;
    });
  }, [movements, products, searchTerm, filterCategory, filterSector, filterType, filterProductType]);

  const invoiceMovements = useMemo(() => {
    return movements.filter(m => m.type === MovementType.IN && (m.invoiceNumber || m.invoiceUrl));
  }, [movements]);

  const pendingReturns = useMemo(() => {
    return movements.filter(m => m.type === MovementType.OUT && m.exitType === ExitType.RETURNABLE && (m.returnStatus === ReturnStatus.PENDING || m.returnStatus === ReturnStatus.PARTIAL));
  }, [movements]);
  const [returnProcessing, setReturnProcessing] = useState<{
    movementId: string;
    quantity: number;
    action: 'RETURN' | 'LOSS';
    observation: string;
    returnPerson: string;
  } | null>(null);

  const handleProcessReturn = async () => {
    if (!returnProcessing) return;
    setIsSaving(true);
    try {
      const originalMovement = movements.find(m => m.id === returnProcessing.movementId);
      if (!originalMovement) throw new Error("Movimentação original não encontrada");

      const product = products.find(p => p.id === originalMovement.productId);
      if (!product) throw new Error("Produto não encontrado");

      // 1. Create a new movement record for the return/loss
      await db.createMovement({
        productId: originalMovement.productId,
        type: returnProcessing.action === 'RETURN' ? MovementType.IN : MovementType.OUT,
        quantity: returnProcessing.quantity,
        totalValue: 0,
        sectorId: originalMovement.sectorId,
        personName: returnProcessing.returnPerson || originalMovement.personName,
        destination: `RETORNO DE ${originalMovement.id.substring(0, 8)}`,
        notes: `${returnProcessing.action === 'RETURN' ? 'Devolução' : 'Perda registrada'}: ${returnProcessing.observation}`,
        originId: 'DEV_RETORNO'
      });

      // 2. Update the original movement status and quantity
      const newReturnedQty = originalMovement.returnedQuantity + returnProcessing.quantity;
      let newStatus = ReturnStatus.PENDING;

      if (newReturnedQty >= originalMovement.quantity) {
        newStatus = returnProcessing.action === 'RETURN' ? ReturnStatus.RETURNED : ReturnStatus.LOST;
      } else {
        newStatus = ReturnStatus.PARTIAL;
      }

      await db.updateMovement(originalMovement.id, {
        returnedQuantity: newReturnedQty,
        returnStatus: newStatus,
        returnObservation: returnProcessing.observation
      });

      await loadData();
      setReturnProcessing(null);
      await loadData();
      setReturnProcessing(null);
      setIsSuccessModalOpen(true);
    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenTransferModal = () => {
    setTransferStep(1);
    setTransferItems([]);
    setTransferDestCompanyId('');
    setTransferReason('');
    setTransferProductSearch('');
    setSelectedTransferProduct(null);
    setTransferItemQty(1);
    setIsTransferModalOpen(true);
  };

  const handleAddTransferItem = () => {
    if (!selectedTransferProduct) return;
    setTransferItems(prev => {
      const exists = prev.find(i => i.productId === selectedTransferProduct.id);
      if (exists) return prev.map(i => i.productId === selectedTransferProduct.id ? { ...i, quantity: i.quantity + transferItemQty } : i);
      return [...prev, { productId: selectedTransferProduct.id, description: selectedTransferProduct.description, cod: selectedTransferProduct.cod, quantity: transferItemQty, pmed: selectedTransferProduct.pmed }];
    });
    setSelectedTransferProduct(null);
    setTransferProductSearch('');
    setTransferItemQty(1);
  };

  const handleSendTransfer = async () => {
    if (!user?.companyId || !user?.id) return;
    setIsSavingTransfer(true);
    try {
      const fromCompany = await db.getCompanyById(user.companyId);
      const toCompany = await db.getCompanyById(transferDestCompanyId);
      if (!toCompany) throw new Error('Unidade de destino não encontrada');
      const { id: transferId } = await db.createTransfer({
        fromCompanyId: user.companyId,
        toCompanyId: transferDestCompanyId,
        items: transferItems,
        reason: transferReason,
        createdBy: user.id
      });
      const toEmail = toCompany.sectorEmail || toCompany.email;
      if (toEmail) {
        try {
          await EmailService.sendTransferNotification(toEmail, fromCompany?.name || 'Unidade', toCompany.name, transferItems, transferReason, transferId);
        } catch (emailErr) { console.warn('Falha ao enviar e-mail de transferência:', emailErr); }
      }
      await loadData();
      setIsTransferModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar transferência');
    } finally {
      setIsSavingTransfer(false);
    }
  };

  const handleConfirmTransfer = async (transferId: string) => {
    if (!user?.id) return;
    try { await db.confirmTransfer(transferId, user.id); await loadData(); }
    catch (err: any) { alert(err.message || 'Erro ao confirmar transferência'); }
  };

  const handleRejectTransfer = async (transferId: string) => {
    if (!confirm('Rejeitar esta transferência?')) return;
    try { await db.rejectTransfer(transferId); await loadData(); }
    catch (err: any) { alert(err.message || 'Erro ao rejeitar transferência'); }
  };

  const modalTitle = isConfirming
    ? 'Conferir Lançamento'
    : (movementType === MovementType.IN ? 'Nova Entrada' : 'Nova Saída');

  const modalColor = movementType === MovementType.IN ? 'bg-emerald-600' : 'bg-amber-600';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <ArrowUpCircle className="text-blue-600" /> Movimentações de Estoque
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Controle de entradas, saídas e transferências</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition font-bold border shadow-sm text-xs ${isAnalysisOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}`}
          >
            <BarChart3 size={15} /> Análise
          </button>

          {!isAnalysisOpen && (
            <button
              onClick={() => setActiveTab(activeTab === 'invoices' ? 'movements' : 'invoices')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition font-bold border shadow-sm text-xs ${activeTab === 'invoices' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}`}
            >
              <FileText size={15} /> Notas Fiscais
            </button>
          )}

          {!isAnalysisOpen && (
            <button
              onClick={() => setActiveTab(activeTab === 'transfers' ? 'movements' : 'transfers')}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg transition font-bold border shadow-sm text-xs ${activeTab === 'transfers' ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}`}
            >
              <ArrowRightLeft size={15} /> Transferências
              {transfers.filter((t: any) => t.to_company_id === user?.companyId && t.status === 'pending').length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {transfers.filter((t: any) => t.to_company_id === user?.companyId && t.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {canEdit && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleOpenModal(MovementType.IN)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition font-bold shadow-lg shadow-emerald-600/20 active:scale-95 text-xs">
                <Plus size={15} /> Entrada
              </button>
              <button onClick={() => handleOpenModal(MovementType.OUT)} disabled={!canEdit} className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50">
                <ArrowDownCircle size={15} /> Saída
              </button>
              <button onClick={() => setIsReturnModalOpen(true)} disabled={!canEdit} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold text-xs shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                <RotateCcw size={15} /> Devolução
              </button>
              <button onClick={handleOpenTransferModal} disabled={!canEdit} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition font-bold text-xs shadow-lg shadow-violet-500/20 disabled:opacity-50">
                <ArrowRightLeft size={15} /> Transferir
              </button>
            </div>
          )}
        </div>
      </div>

      {!isAnalysisOpen && activeTab === 'movements' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Entradas</span>
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                <ArrowUpCircle size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-slate-800 dark:text-white">
              {movements.filter(m => m.type === MovementType.IN).length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Saídas</span>
              <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
                <ArrowDownCircle size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-slate-800 dark:text-white">
              {movements.filter(m => m.type === MovementType.OUT).length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor em Entradas</span>
              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                <DollarSign size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-slate-800 dark:text-white">
              {formatCurrency(movements.filter(m => m.type === MovementType.IN).reduce((acc, m) => acc + m.totalValue, 0))}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produtos Movimentados</span>
              <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg">
                <Package size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-slate-800 dark:text-white">
              {new Set(movements.map(m => m.productId)).size}
            </p>
          </div>
        </div>
      )}

      {isAnalysisOpen ? (
        <AnalysisDashboard movements={movements} products={products} />
      ) : activeTab === 'invoices' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="px-6 py-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" /> Gestão de Notas Fiscais
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-bold">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500">Número da Nota</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500">Data e Hora</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500">Produto</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 text-right">Qtd</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 text-right">Valor Total</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {invoiceMovements.map(m => {
                  const prod = products.find(p => p.id === m.productId);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4">{m.invoiceNumber || 'Não informado'}</td>
                      <td className="px-6 py-4 font-normal text-slate-500 text-xs text-slate-600 dark:text-slate-400">
                        {new Date(m.movementDate).toLocaleDateString('pt-BR')} {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm truncate max-w-[200px] text-slate-900 dark:text-slate-100">{prod?.description}</p>
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-600">+{m.quantity}</td>
                      <td className="px-6 py-4 text-right text-slate-900 dark:text-slate-100">{formatCurrency(m.totalValue)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          {m.invoiceUrl && (
                            <a
                              href={m.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                              title="Ver/Baixar Nota"
                            >
                              <Download size={16} />
                            </a>
                          )}
                          <button onClick={() => handleViewDetails(m)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition">
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {invoiceMovements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhuma nota fiscal encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
                <Filter size={16} className="text-blue-600 dark:text-blue-500" />
                Filtros
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="NF, Produto, Setor ou Colaborador..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <select className="px-3 py-2 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none font-bold" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                <option value="all">Todas</option>
                <option value={MovementType.IN}>Entradas</option>
                <option value={MovementType.OUT}>Saídas</option>
                <option value="RETURN">Devoluções</option>
              </select>
              <select className="px-3 py-2 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none min-w-[140px]" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="all">Categorias</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
              <select className="px-3 py-2 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none min-w-[140px]" value={filterSector} onChange={e => setFilterSector(e.target.value)}>
                <option value="all">Todos os Setores</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="px-3 py-2 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none font-bold" value={filterProductType} onChange={e => setFilterProductType(e.target.value as any)}>
                <option value="all">Tipos (Todos)</option>
                <option value={ProductType.CONSUMABLE}>Consumíveis</option>
                <option value={ProductType.RETURNABLE}>Retornáveis</option>
              </select>
              <button onClick={() => { setSearchTerm(''); setFilterCategory('all'); setFilterSector('all'); setFilterType('all'); setFilterProductType('all'); }} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-medium"><FilterX size={14} /> Limpar</button>
            </div>
          </div>
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
                  const isReturn = m.originId === 'DEV_RETORNO' || m.destination?.toUpperCase().includes('RETORNO');
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{new Date(m.movementDate).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{prod?.description}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold tracking-widest">{prod?.cod}</p>
                      </td>
                      <td className="px-6 py-4">
                        {isReturn ? (
                          <span className="text-purple-600 dark:text-purple-400 font-black text-[10px] bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">DEVOLUÇÃO</span>
                        ) : m.type === MovementType.IN ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">ENTRADA</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-black text-[10px] bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">SAÍDA</span>
                        )}
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
      )}

      {/* Transfers Tab */}
      {!isAnalysisOpen && activeTab === 'transfers' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {transfers.filter((t: any) => t.to_company_id === user?.companyId && t.status === 'pending').length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-amber-200 flex items-center gap-2">
                <Clock size={16} className="text-amber-600" />
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Pendentes de Confirmação</h3>
              </div>
              <div className="divide-y divide-amber-100 dark:divide-amber-900/20">
                {transfers.filter((t: any) => t.to_company_id === user?.companyId && t.status === 'pending').map((t: any) => (
                  <div key={t.id} className="p-6 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">Recebida de</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Building2 size={14} className="text-violet-500" /> {siblingCompanies.find((s: any) => s.id === t.from_company_id)?.name || 'Outra Unidade'}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleConfirmTransfer(t.id)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition shadow-md">
                          <Check size={14} /> Confirmar
                        </button>
                        <button onClick={() => handleRejectTransfer(t.id)} className="flex items-center gap-1.5 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 text-xs font-black rounded-xl hover:bg-red-200 transition">
                          <XCircle size={14} /> Rejeitar
                        </button>
                      </div>
                    </div>
                    {t.reason && <div className="bg-amber-100/60 dark:bg-amber-900/20 rounded-xl px-4 py-2 text-sm text-amber-900 dark:text-amber-200"><span className="font-black">Motivo:</span> {t.reason}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(t.items as any[]).map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-2">
                            <Package size={13} className="text-violet-500 shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.description}</p>
                              <p className="text-[10px] font-mono text-slate-400">{item.cod}</p>
                            </div>
                          </div>
                          <span className="text-violet-600 font-black text-xl ml-4">{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-violet-600" /> Histórico de Transferências
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {transfers.length === 0 && <div className="py-12 text-center text-slate-400 italic">Nenhuma transferência registrada.</div>}
              {transfers.map((t: any) => {
                const isReceived = t.to_company_id === user?.companyId;
                const otherId = isReceived ? t.from_company_id : t.to_company_id;
                const other = siblingCompanies.find((s: any) => s.id === otherId);
                const stMap: any = { pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' }, confirmed: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700' }, rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-700' } };
                const st = stMap[t.status] || stMap.pending;
                return (
                  <div key={t.id} className="p-6">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isReceived ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}><ArrowRightLeft size={14} /></div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">{isReceived ? 'Recebida de' : 'Enviada para'}</p>
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{other?.name || 'Outra Unidade'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                        <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    {t.reason && <p className="text-xs text-slate-500 italic mb-3">"{t.reason}"</p>}
                    <div className="flex flex-wrap gap-2">
                      {(t.items as any[]).map((item: any, i: number) => (
                        <span key={i} className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl">
                          {item.description} <span className="text-violet-600 ml-1">×{item.quantity}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-2xl border dark:border-slate-800 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="shrink-0 px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between bg-violet-600 text-white rounded-t-[28px]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Passo {transferStep} de 3</p>
                <h3 className="text-xl font-black uppercase tracking-widest">
                  {transferStep === 1 ? 'Destino e Motivo' : transferStep === 2 ? 'Adicionar Itens' : 'Confirmar Transferência'}
                </h3>
              </div>
              <button onClick={() => setIsTransferModalOpen(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><X size={20} /></button>
            </div>
            <div className="shrink-0 px-8 pt-4 flex items-center gap-2">
              {[1, 2, 3].map(s => <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= transferStep ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'}`} />)}
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
              {transferStep === 1 && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unidade de Destino</label>
                    {siblingCompanies.length === 0
                      ? <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700 font-bold">Nenhuma unidade/filial encontrada. Cadastre em Configurações → Almoxarifados.</div>
                      : <div className="grid grid-cols-1 gap-2">{siblingCompanies.map((c: Company) => (
                        <button key={c.id} type="button" onClick={() => setTransferDestCompanyId(c.id)}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition ${transferDestCompanyId === c.id ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300'}`}
                        >
                          <div className={`p-2 rounded-xl ${transferDestCompanyId === c.id ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><Building2 size={18} /></div>
                          <div className="flex-1"><p className="font-black text-slate-800 dark:text-slate-100">{c.name}</p><p className="text-xs text-slate-400">{c.email || c.sectorEmail}</p></div>
                          {transferDestCompanyId === c.id && <CheckCircle2 className="text-violet-600" size={20} />}
                        </button>
                      ))}</div>
                    }
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo (Opcional)</label>
                    <textarea rows={3} placeholder="Descreva o motivo..." className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 resize-none font-medium text-slate-900 dark:text-slate-100" value={transferReason} onChange={e => setTransferReason(e.target.value)} />
                  </div>
                </>
              )}

              {transferStep === 2 && (
                <>
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Buscar Produto</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="text" placeholder="Nome ou código..." className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 font-bold text-slate-900 dark:text-slate-100"
                        value={transferProductSearch} onChange={e => { setTransferProductSearch(e.target.value); setTransferProductListOpen(true); }} onFocus={() => setTransferProductListOpen(true)} />
                      {selectedTransferProduct && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-500" size={17} />}
                    </div>
                    {transferProductListOpen && transferProductSearch && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border dark:border-slate-700 max-h-52 overflow-y-auto">
                        {products.filter(p => p.description.toLowerCase().includes(transferProductSearch.toLowerCase()) || p.cod.toLowerCase().includes(transferProductSearch.toLowerCase())).slice(0, 10).map(p => (
                          <button key={p.id} type="button" onClick={() => { setSelectedTransferProduct(p); setTransferProductSearch(`${p.cod} – ${p.description}`); setTransferProductListOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition border-b dark:border-slate-700/50 last:border-0">
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.description}</p><p className="text-xs text-slate-400 font-mono">{p.cod}</p>
                          </button>
                        ))}
                        {products.filter(p => p.description.toLowerCase().includes(transferProductSearch.toLowerCase()) || p.cod.toLowerCase().includes(transferProductSearch.toLowerCase())).length === 0 && <p className="px-4 py-3 text-sm text-slate-400 italic">Nenhum produto encontrado.</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quantidade</label>
                      <input type="number" min="1" className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 font-black text-xl text-slate-900 dark:text-slate-100" value={transferItemQty} onChange={e => setTransferItemQty(Math.max(1, Number(e.target.value)))} />
                    </div>
                    <button type="button" onClick={handleAddTransferItem} disabled={!selectedTransferProduct} className="px-5 py-3 bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-violet-700 transition disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shadow-lg shadow-violet-500/20">
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                  {transferItems.length > 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {transferItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3">
                          <div><p className="font-bold text-sm text-slate-800 dark:text-slate-100">{item.description}</p><p className="text-[10px] font-mono text-slate-400">{item.cod}</p></div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-violet-600 text-xl">{item.quantity}</span>
                            <button type="button" onClick={() => setTransferItems(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"><X size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-center py-8 text-slate-400 italic text-sm">Adicione pelo menos um item para continuar.</div>}
                </>
              )}

              {transferStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-2xl p-5">
                    <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1">Destino</p>
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Building2 size={18} className="text-violet-600" />{siblingCompanies.find((c: Company) => c.id === transferDestCompanyId)?.name}</p>
                    {transferReason && <p className="mt-2 text-sm text-slate-500 italic">"{transferReason}"</p>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{transferItems.length} {transferItems.length === 1 ? 'Item' : 'Itens'}</p>
                    {transferItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div><p className="font-bold text-slate-800 dark:text-slate-100">{item.description}</p><p className="text-[10px] font-mono text-slate-400">{item.cod}</p></div>
                        <span className="text-violet-600 font-black text-2xl">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Um e-mail será enviado à unidade de destino. O estoque será ajustado somente após a confirmação.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="shrink-0 p-6 border-t dark:border-slate-800 flex gap-3">
              {transferStep > 1 && <button onClick={() => setTransferStep(prev => (prev - 1) as 1 | 2 | 3)} className="flex items-center gap-2 px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition"><ChevronLeft size={16} /> Voltar</button>}
              {transferStep < 3 ? (
                <button onClick={() => { if (transferStep === 1 && !transferDestCompanyId) { alert('Selecione a unidade de destino.'); return; } if (transferStep === 2 && transferItems.length === 0) { alert('Adicione pelo menos um item.'); return; } setTransferStep(prev => (prev + 1) as 1 | 2 | 3); }} className="flex-1 py-3.5 bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-violet-700 transition flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20">
                  Continuar <ArrowRightLeft size={16} />
                </button>
              ) : (
                <button onClick={handleSendTransfer} disabled={isSavingTransfer} className="flex-1 py-3.5 bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-violet-700 transition flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 disabled:opacity-60">
                  {isSavingTransfer ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Enviar Transferência
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {
        isModalOpen && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">

              <div className={"shrink-0 px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between text-white " + modalColor}>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-widest">
                    {modalTitle}
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
                            <p className="text-lg font-black text-slate-800 dark:text-slate-100">{selectedProduct?.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantidade</p>
                          <p className={"text-2xl font-black " + (movementType === MovementType.IN ? 'text-emerald-600' : 'text-amber-600')}>
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
                    <button onClick={handleSave} disabled={isSaving} className={"flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 " + (movementType === MovementType.IN ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-amber-600 shadow-amber-500/20')}>
                      {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Confirmar
                    </button>
                  </div>
                </div >
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
                            if (!e.target.value) setFormData({ ...formData, productId: '' });
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
                                setFormData({ ...formData, productId: p.id });
                                setProductSearch(p.cod + " - " + p.description);
                                setIsProductListOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition border-b dark:border-slate-700/50 last:border-0"
                            >
                              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.description}</p>
                              <p className="text-xs text-slate-400 font-mono">{p.cod}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Tipo de Saída</label>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 h-[60px]">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, exitType: ExitType.CONSUMABLE, returnStatus: ReturnStatus.OK })}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-xl transition font-black text-[10px] uppercase tracking-wider ${formData.exitType === ExitType.CONSUMABLE ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            Consumível
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, exitType: ExitType.RETURNABLE, returnStatus: ReturnStatus.PENDING })}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-xl transition font-black text-[10px] uppercase tracking-wider ${formData.exitType === ExitType.RETURNABLE ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            <RotateCcw size={14} /> Retornável
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quantidade</label>
                        <input required type="number" min="1" className="w-full px-5 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-xl h-[60px]" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                      </div>
                    </div>

                    {formData.exitType === ExitType.CONSUMABLE && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                          {movementType === MovementType.IN ? 'Valor Total da Compra (R$)' : 'Valor Estimado (R$)'}
                        </label>
                        <input
                          required={movementType === MovementType.IN}
                          readOnly={movementType === MovementType.OUT}
                          type="text"
                          className={"w-full px-5 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-xl " + (movementType === MovementType.OUT ? 'opacity-60 bg-slate-100' : '')}
                          value={displayTotalValue}
                          onChange={handleTotalValueChange}
                        />
                      </div>
                    )}

                    {
                      movementType === MovementType.IN && (
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

                                <div className="pt-2">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Paperclip size={12} /> Anexo da Nota Fiscal (PDF ou Imagem)
                                  </label>
                                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                      {invoiceFile ? (
                                        <div className="flex flex-col items-center gap-2">
                                          <FileText className="text-blue-500" size={32} />
                                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{invoiceFile.name}</p>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); setInvoiceFile(null); }}
                                            className="text-[10px] text-red-500 hover:underline font-bold"
                                          >
                                            Remover
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <Upload className="text-slate-400 group-hover:text-blue-500 transition-colors mb-2" size={24} />
                                          <p className="text-xs font-bold text-slate-500">Clique para selecionar ou arraste o arquivo</p>
                                          <p className="text-[10px] text-slate-400 mt-1">PDF, PNG, JPG (Max. 10MB)</p>
                                        </>
                                      )}
                                    </div>
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,image/*"
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          setInvoiceFile(e.target.files[0]);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }

                    {
                      movementType === MovementType.OUT && (
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
                      )
                    }
                  </div >

                  <div className="shrink-0 p-6 border-t dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button type="submit" className={"w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 " + (movementType === MovementType.IN ? 'bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700' : 'bg-amber-600 shadow-amber-500/20 hover:bg-amber-700')}>
                      Continuar <Navigation size={16} />
                    </button>
                  </div>
                </form >
              )}
            </div >
          </div >
        )
      }

      {
        isDetailsOpen && selectedMovement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden border dark:border-slate-800 animate-in zoom-in duration-200">
              <div className="px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-lg font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Detalhes da Movimentação</h3>
                <button onClick={() => setIsDetailsOpen(false)} className="bg-slate-200 dark:bg-slate-700 p-2 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition text-slate-500 dark:text-slate-400"><X size={18} /></button>
              </div>

              <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-4 mb-6">
                  <div className={"p-3 rounded-2xl " + (selectedMovement.type === MovementType.IN ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600')}>
                    {selectedMovement.type === MovementType.IN ? <ArrowUpCircle size={32} /> : <ArrowDownCircle size={32} />}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Produto</p>
                    <p className="text-xl font-black text-slate-800 dark:text-slate-100">{products.find(p => p.id === selectedMovement.productId)?.description}</p>
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
                    <p className={"text-sm font-black " + (selectedMovement.type === MovementType.IN ? 'text-emerald-600' : 'text-amber-600')}>
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
        )
      }

      {/* Return Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="shrink-0 px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between text-white bg-indigo-600">
              <div className="flex items-center gap-3">
                <RotateCcw size={24} />
                <h3 className="text-xl font-black uppercase tracking-widest">Itens para Devolução</h3>
              </div>
              <button onClick={() => { setIsReturnModalOpen(false); setReturnProcessing(null); }} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {pendingReturns.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <PackageCheck size={48} className="opacity-20" />
                  <p className="font-bold uppercase tracking-widest text-xs">Nenhuma devolução pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingReturns.map(m => {
                    const product = products.find(p => p.id === m.productId);
                    const sector = sectors.find(s => s.id === m.sectorId);
                    const isProcessingThis = returnProcessing?.movementId === m.id;

                    return (
                      <div key={m.id} className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isProcessingThis ? 'border-indigo-500 bg-white dark:bg-slate-800 shadow-lg ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-slate-700'}`}>
                        <div className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                Retornável
                              </span>
                              <h4 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                                {product?.description}
                              </h4>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                <Navigation size={12} className="text-blue-500" />
                                {sector?.name}
                              </span>
                              <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                <UserIcon size={12} className="text-slate-400" />
                                {m.personName}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Calendar size={12} />
                                {new Date(m.movementDate).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 w-full md:w-auto mt-2 md:mt-0">
                            <div className="text-right hidden md:block">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendente</p>
                              <p className="text-xl font-black text-slate-800 dark:text-slate-100">
                                {m.quantity - m.returnedQuantity} <span className="text-sm text-slate-400 font-bold">/ {m.quantity}</span>
                              </p>
                            </div>

                            {!isProcessingThis ? (
                              <button
                                onClick={() => setReturnProcessing({ movementId: m.id, quantity: m.quantity - m.returnedQuantity, action: 'RETURN', observation: '', returnPerson: m.personName || '' })}
                                className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                              >
                                Processar <RotateCcw size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setReturnProcessing(null)}
                                className="flex-1 md:flex-none px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest transition hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Processing Form Area - Expands Down */}
                        {isProcessingThis && (
                          <div className="border-t border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10 p-5 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Selecione a Ação</label>
                                <div className="grid grid-cols-2 gap-3">
                                  <button
                                    onClick={() => setReturnProcessing({ ...returnProcessing!, action: 'RETURN' })}
                                    className={`py-4 rounded-xl font-black text-xs uppercase tracking-widest transition flex flex-col items-center justify-center gap-2 border-2 ${returnProcessing!.action === 'RETURN' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'border-transparent bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-50'}`}
                                  >
                                    <PackageCheck size={20} /> Devolução
                                  </button>
                                  <button
                                    onClick={() => setReturnProcessing({ ...returnProcessing!, action: 'LOSS' })}
                                    className={`py-4 rounded-xl font-black text-xs uppercase tracking-widest transition flex flex-col items-center justify-center gap-2 border-2 ${returnProcessing!.action === 'LOSS' ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-600' : 'border-transparent bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-50'}`}
                                  >
                                    <AlertCircle size={20} /> Perda / Avaria
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Qtd. Processada</label>
                                    <input
                                      type="number"
                                      max={m.quantity - m.returnedQuantity}
                                      min="1"
                                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-lg text-slate-800 dark:text-white"
                                      value={returnProcessing!.quantity}
                                      onChange={e => {
                                        const val = Number(e.target.value);
                                        const max = m.quantity - m.returnedQuantity;
                                        if (val > max) setReturnProcessing({ ...returnProcessing!, quantity: max });
                                        else if (val < 1) setReturnProcessing({ ...returnProcessing!, quantity: 1 });
                                        else setReturnProcessing({ ...returnProcessing!, quantity: val });
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Responsável</label>
                                    <select
                                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-slate-800 dark:text-white"
                                      value={returnProcessing!.returnPerson}
                                      onChange={e => setReturnProcessing({ ...returnProcessing!, returnPerson: e.target.value })}
                                    >
                                      <option value="">Selecione...</option>
                                      {sector?.people?.map((p: any, i: number) => (
                                        <option key={i} value={p.name}>{p.name} {p.matricula ? `(${p.matricula})` : ''}</option>
                                      ))}
                                      {/* Fallback if original person is not in the list */}
                                      {returnProcessing!.returnPerson && !sector?.people?.some((p: any) => p.name === returnProcessing!.returnPerson) && (
                                        <option value={returnProcessing!.returnPerson}>{returnProcessing!.returnPerson}</option>
                                      )}
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Observação</label>
                                  <input
                                    type="text"
                                    placeholder="Detalhes sobre a devolução ou perda..."
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm text-slate-800 dark:text-white"
                                    value={returnProcessing!.observation}
                                    onChange={e => setReturnProcessing({ ...returnProcessing!, observation: e.target.value })}
                                  />
                                </div>
                                <button
                                  onClick={handleProcessReturn}
                                  disabled={isSaving}
                                  className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition active:scale-95 flex items-center justify-center gap-2"
                                >
                                  {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                                  Confirmar Processamento
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )
      }

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 border border-white/20">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Sucesso!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
              A devolução/perda foi processada e o estoque atualizado corretamente.
            </p>
            <button
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition active:scale-95 shadow-lg"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Movements;