import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Product, StockBalance, StockMovement, MovementType } from '../types';
import {
  ShoppingCart, Search, AlertCircle,
  DollarSign, Loader2, Package, TrendingUp
} from 'lucide-react';

const Purchases = ({ user }: any) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [p, b, m] = await Promise.all([
          db.getProducts(),
          db.getStockBalances(),
          db.getMovements()
        ]);
        setProducts(p);
        setBalances(b);
        setMovements(m);
      } catch (error) {
        console.error("Error loading purchase data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getSmartData = (product: Product, balance: number) => {
    // Tenta calcular base real
    const productOuts = movements.filter(m => m.productId === product.id && m.type === MovementType.OUT);
    let monthlyConsumption = 0;

    if (productOuts.length > 0) {
      const totalQty = productOuts.reduce((sum, m) => sum + Number(m.quantity), 0);
      // Assume histórico de 3 meses para média (aproximado)
      monthlyConsumption = totalQty / 3;
    }

    // Fallback: Simulação inteligente se não houver dados suficientes
    if (monthlyConsumption === 0) {
      let hash = 0;
      for (let i = 0; i < product.description.length; i++) hash = product.description.charCodeAt(i) + ((hash << 5) - hash);
      const factor = 0.8 + (Math.abs(hash) % 80) / 100;
      monthlyConsumption = Math.max(1, product.minStock * factor);
    }

    monthlyConsumption = Math.ceil(monthlyConsumption);

    // Cobertura ideal: 45 dias (1.5 meses)
    const idealStock = Math.ceil(monthlyConsumption * 1.5);

    // Sugestão é o que falta para atingir o ideal
    const suggestion = Math.max(0, idealStock - balance);

    return { monthlyConsumption, suggestion, idealStock };
  };

  const purchaseList = products
    .map(product => {
      const balance = balances.find(b => b.productId === product.id)?.quantity || 0;
      const { suggestion } = getSmartData(product, balance);
      return { ...product, balance, suggestion };
    })
    .filter(item => item.balance <= item.minStock) // Mantém critério de alerta do mínimo cadastrado
    .filter(item =>
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cod.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Compras & Reposição</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">
            Sugestão de reposição baseada no estoque mínimo e custo médio.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar item..."
              className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-slate-200 w-64 shadow-sm text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards - Compactos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Itens Críticos</p>
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">{purchaseList.length}</h3>
            <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
              Abaixo do mínimo
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">
            <AlertCircle size={28} className="text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Custo Total Estimado</p>
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {formatCurrency(purchaseList.reduce((acc, item) => acc + (item.suggestion * item.pmed), 0))}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1">Baseado no último preço</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
            <DollarSign size={28} className="text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/30">
          <ShoppingCart className="text-indigo-600" size={20} />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Lista de Reposição</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Produto</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Estoque</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Mínimo</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Sugestão</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Custo Unit. (Médio)</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Total Estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchaseList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-medium text-sm">
                    Estoque regular. Nenhum produto precisando de reposição.
                  </td>
                </tr>
              ) : (
                purchaseList.map((item) => {
                  const buyQuantity = item.suggestion;
                  const totalEstimatedPrice = item.pmed * buyQuantity;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition group">
                      <td className="px-6 py-3">
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{item.description}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{item.cod}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${item.balance === 0 ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30'}`}>
                          {item.balance}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center text-xs font-bold text-slate-500">
                        {item.minStock}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md text-xs font-black border border-indigo-100 dark:border-indigo-800">
                          <TrendingUp size={12} /> +{buyQuantity} {item.unit}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                        {formatCurrency(item.pmed)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(totalEstimatedPrice)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Purchases;
