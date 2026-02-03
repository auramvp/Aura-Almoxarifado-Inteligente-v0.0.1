
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../services/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  AlertTriangle, TrendingDown, PackageCheck, Building2, Loader2, Sparkles, History, ArrowUpRight, ArrowDownRight, Package, Wallet, TrendingUp
} from 'lucide-react';
import { User, DashboardStats, Company, Product, MovementType } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard = ({ user }: { user: User }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsData, compData, productsData] = await Promise.all([
          db.getDashboardStats(),
          user.companyId ? db.getCompanyById(user.companyId) : Promise.resolve(null),
          db.getProducts()
        ]);

        // Trigger daily digest check in background
        db.checkDailyDigest().catch(e => console.error("Digest check failed", e));

        setStats(statsData);
        setCompany(compData);
        setProducts(productsData);
      } catch (err) {
        console.error("Erro ao carregar dashboard", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.companyId]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (loading || !stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Atualizando informações do sistema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Painel de Gestão</h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Acompanhe a saúde operacional do seu almoxarifado.</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-all hover:shadow-md">
          <div className="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg shrink-0"> <AlertTriangle size={20} /> </div>
          <div className="min-w-0"> <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate">Itens em Alerta</p> <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none mt-0.5">{stats.belowMinCount}</p> </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-all hover:shadow-md">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shrink-0"> <Wallet size={20} /> </div>
          <div className="min-w-0"> <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate">Patrimônio</p> <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none mt-0.5 truncate">{formatCurrency(stats.totalInventoryValue)}</p> </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-all hover:shadow-md">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0"> <Package size={20} /> </div>
          <div className="min-w-0"> <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate">Itens Ativos</p> <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none mt-0.5">{stats.totalProducts}</p> </div>
        </div>

        {/* Economy Card (Green) */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl shadow-md flex items-center gap-3 transition-all hover:shadow-lg hover:scale-[1.02] text-white">
          <div className="p-2.5 bg-white/20 rounded-lg shrink-0 backdrop-blur-sm"> <TrendingDown size={20} className="text-white" /> </div>
          <div className="min-w-0">
            <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider truncate">Economia (Mensal)</p>
            <p className="text-xl font-black text-white leading-none mt-0.5 truncate">
              {stats.previousMonthExits > 0
                ? formatCurrency(Math.max(0, stats.previousMonthExits - stats.totalExitsMonth))
                : formatCurrency(0)}
            </p>
            {stats.previousMonthExits > 0 && (
              <p className="text-[10px] text-emerald-100 mt-1 flex items-center gap-1">
                {stats.totalExitsMonth < stats.previousMonthExits
                  ? <span className="flex items-center gap-0.5"><ArrowDownRight size={10} /> {Math.abs(((stats.totalExitsMonth - stats.previousMonthExits) / stats.previousMonthExits) * 100).toFixed(1)}% vs mês anterior</span>
                  : <span className="flex items-center gap-0.5 text-emerald-200"><ArrowUpRight size={10} /> Gastos aumentaram</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* New Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consolidated Consumption Highlights */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
            <TrendingUp size={18} className="text-slate-400" />
            Destaques de Consumo
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            <div className="relative p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="absolute -top-3 left-4 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded text-[10px] font-bold uppercase text-slate-400 tracking-wider shadow-sm">
                Produto Mais Consumido
              </div>
              {stats.mostConsumedProduct ? (
                <div className="mt-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight mb-2 h-10">{stats.mostConsumedProduct.name}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-black text-slate-700 dark:text-slate-200">{stats.mostConsumedProduct.quantity}</span>
                      <span className="text-xs text-slate-500 ml-1">{stats.mostConsumedProduct.unit}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Custo Total</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.mostConsumedProduct.value)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Sem dados.</div>
              )}
            </div>

            <div className="relative p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="absolute -top-3 left-4 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded text-[10px] font-bold uppercase text-slate-400 tracking-wider shadow-sm">
                Setor com Maior Demanda
              </div>
              {stats.topConsumerSector ? (
                <div className="mt-2">
                  <div className="flex items-center gap-3 mb-3 h-10">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {stats.topConsumerSector.name.charAt(0)}
                    </div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">{stats.topConsumerSector.name}</p>
                  </div>
                  <div className="flex items-end justify-between border-t border-slate-200 dark:border-slate-700/50 pt-2">
                    <span className="text-xs text-slate-500">Representatividade</span>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Valor Total</p>
                      <p className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(stats.topConsumerSector.value)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Sem dados.</div>
              )}
            </div>
          </div>
        </div>

        {/* AI Insight */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-xl shadow-lg text-white flex flex-col relative overflow-hidden group min-h-[200px]">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Sparkles size={120} />
          </div>

          <div className="relative z-10 flex items-center gap-2 mb-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Sparkles size={20} className="text-yellow-300" />
            </div>
            <h3 className="font-bold tracking-tight">Aura AI Insights</h3>
          </div>

          <div className="relative z-10 flex-1 flex flex-col justify-center">
            {stats.aiInsight ? (
              <>
                <h4 className="font-bold text-xl mb-3">{stats.aiInsight.title}</h4>
                <p className="text-indigo-100 text-sm leading-relaxed opacity-90 max-w-md">{stats.aiInsight.content}</p>
              </>
            ) : (
              <p className="text-indigo-100 text-sm">Analisando dados para gerar insights...</p>
            )}
          </div>

          <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-indigo-200">
            <span>Atualizado agora</span>
            <span className="bg-white/10 px-2 py-1 rounded">BETA</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Top 10 Itens por Custo</h3>
            <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded tracking-widest">Valorização</span>
          </div>
          <div className="h-80 w-full">
            {stats.topItemsByCost && stats.topItemsByCost.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topItemsByCost} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={180}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    tickFormatter={(value) => value.length > 25 ? value.substring(0, 25) + '...' : value}
                  />
                  <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#f8fafc' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}> {stats.topItemsByCost.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))} </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-2">
                <PackageCheck size={40} className="opacity-10" />
                <p className="text-sm font-medium">Nenhum item com movimentação registrada.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History size={20} className="text-blue-600" />
              Últimas Atividades
            </h3>
            <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Diário Recente</span>
          </div>

          <div className="flex-1 space-y-4">
            {stats.recentMovements && stats.recentMovements.length > 0 ? stats.recentMovements.map((m) => {
              const product = products.find(p => p.id === m.productId);
              const displayValue = (m.totalValue > 0) ? m.totalValue : (m.quantity * (product?.pmed || 0));

              return (
                <div key={m.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 group hover:border-blue-100 dark:hover:border-blue-900 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${m.type === MovementType.IN ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                      {m.type === MovementType.IN ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[180px]">{product?.description || 'Item não localizado'}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{new Date(m.movementDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${m.type === MovementType.IN ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {m.type === MovementType.IN ? '+' : '-'}{m.quantity} {product?.unit || ''}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-300 font-bold">{formatCurrency(displayValue)}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-2 py-12">
                <History size={40} className="opacity-10" />
                <p className="text-sm font-medium">Seu diário de movimentações está vazio.</p>
              </div>
            )}
          </div>

          <div className="mt-8"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
