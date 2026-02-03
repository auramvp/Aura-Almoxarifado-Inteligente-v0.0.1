import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Product, StockMovement, StockBalance, MovementType } from '../types';
import { AiReports } from './AiReports';
import {
  Zap, TrendingUp, TrendingDown, Target, Lightbulb, Sparkles, Loader2, PackageSearch,
  BarChart3, ChevronRight, Eye, EyeOff, PiggyBank
} from 'lucide-react';

const Optimization = ({ user }: any) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('giro');
  const [showCards, setShowCards] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [p, m, b] = await Promise.all([
        db.getProducts(),
        db.getMovements(),
        db.getStockBalances()
      ]);
      setProducts(p);
      setMovements(m);
      setBalances(b);
      setLoading(false);
    };
    loadData();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const optimizationData = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return products.map(p => {
      const balance = balances.filter(b => b.productId === p.id).reduce((s, b) => s + b.quantity, 0);
      const recentOuts = movements
        .filter(m => m.productId === p.id && m.type === MovementType.OUT && new Date(m.movementDate) >= thirtyDaysAgo)
        .reduce((s, m) => s + m.quantity, 0);

      const suggestedMin = Math.ceil(recentOuts * 1.5);
      const giro = balance > 0 ? (recentOuts / balance).toFixed(2) : '0';

      return {
        ...p,
        balance,
        recentOuts,
        suggestedMin,
        giro: parseFloat(giro),
        capitalImobilizado: balance * p.pmed,
        status: suggestedMin > p.minStock ? 'UNDERSIZED' : (suggestedMin < p.minStock * 0.5 ? 'OVERSIZED' : 'BALANCED'),
        estimatedSavings: suggestedMin < p.minStock * 0.5 && balance > suggestedMin
          ? (balance - suggestedMin) * p.pmed
          : 0
      };
    }).sort((a, b) => b.capitalImobilizado - a.capitalImobilizado);
  }, [products, movements, balances]);

  const totalEstimatedSavings = useMemo(() => {
    return optimizationData.reduce((acc, item) => acc + (item.estimatedSavings || 0), 0);
  }, [optimizationData]);

  const totalIdleCapital = useMemo(() => {
    return optimizationData
      .filter(item => item.giro < 0.2)
      .reduce((s, i) => s + i.capitalImobilizado, 0);
  }, [optimizationData]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-sm font-black uppercase tracking-widest text-slate-400">Processando Inteligência de Giro...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 pb-6">
      <div className="flex-none p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/20 z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                <Zap size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Centro de Otimização</h2>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Inteligência preditiva para redução de custos e maximização do giro.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCards(!showCards)}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              title={showCards ? "Ocultar métricas e expandir tabela" : "Mostrar métricas"}
            >
              {showCards ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="hidden sm:inline">{showCards ? "Ocultar Métricas" : "Mostrar Métricas"}</span>
            </button>
            <button
              onClick={() => setActiveTab('giro')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'giro'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-600'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              Análise de Giro
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 ${activeTab === 'ai'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white ring-2 ring-offset-2 ring-blue-600 dark:ring-offset-slate-900'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white opacity-90 hover:opacity-100 hover:scale-105'
                }`}
            >
              <Sparkles size={14} />
              AURA IA
            </button>
          </div>
        </header>

        {activeTab !== 'ai' && showCards && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
                    <TrendingDown size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Risco</span>
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Capital Imobilizado</p>
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100">{formatCurrency(totalIdleCapital)}</h4>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                    <Target size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">Giro</span>
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Giro Médio (30d)</p>
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {(optimizationData.reduce((s, i) => s + i.giro, 0) / products.length).toFixed(2)}x
                </h4>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                    <Lightbulb size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">Ajuste</span>
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Mal Redimensionados</p>
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {optimizationData.filter(i => i.status !== 'BALANCED').length}
                </h4>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                    <PiggyBank size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">Economia</span>
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Economia Estimada</p>
                <h4 className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalEstimatedSavings)}
                </h4>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'ai' ? (
        <div className="px-6">
          <AiReports />
        </div>
      ) : (
        <div className="px-6">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="flex-none p-8 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <BarChart3 className="text-blue-600" size={20} />
                <h3 className="text-lg font-bold">Sugestões de Reestocagem & Giro</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimos 30 dias de operação</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50 dark:bg-slate-800">Produto</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right bg-slate-50 dark:bg-slate-800">Giro (Vezes)</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right bg-slate-50 dark:bg-slate-800">E. Atual vs Sugerido</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right bg-slate-50 dark:bg-slate-800">Sugestão de Compra</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase text-emerald-500 tracking-widest text-right bg-slate-50 dark:bg-slate-800">Economia Estimada</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center bg-slate-50 dark:bg-slate-800">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {optimizationData.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition group">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <PackageSearch size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.description}</p>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">Custo Base: {formatCurrency(item.pmed)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                          <TrendingUp size={12} className={item.giro > 1 ? 'text-emerald-500' : 'text-slate-400'} />
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">{item.giro}x</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{item.balance} <span className="text-[10px] text-slate-400">un</span></p>
                          <p className={`text-[10px] font-bold ${item.status === 'UNDERSIZED' ? 'text-red-500' : item.status === 'OVERSIZED' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            Aura sugere: {item.suggestedMin} un
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                            {item.status === 'UNDERSIZED' ? `Comprar ${item.suggestedMin - item.balance} un` : 'Aguardar'}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-tight">Custo Estimado: {formatCurrency(Math.max(0, (item.suggestedMin - item.balance) * item.pmed))}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {item.estimatedSavings > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(item.estimatedSavings)}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-500/70 uppercase">Reduzir Estoque</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Optimization;
