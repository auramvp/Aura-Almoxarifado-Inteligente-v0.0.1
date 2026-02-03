import React, { useMemo, useState } from 'react';
import { StockMovement, MovementType, Product } from '../types';
import {
    ArrowUpCircle, ArrowDownCircle, Wallet, Calendar,
    TrendingUp, TrendingDown, Package, Filter, BarChart3
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface AnalysisDashboardProps {
    movements: StockMovement[];
    products: Product[];
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ movements, products }) => {
    const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

    const filteredMovements = useMemo(() => {
        const now = new Date();
        const cutoff = new Date();

        if (period === 'week') cutoff.setDate(now.getDate() - 7);
        if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
        if (period === 'quarter') cutoff.setMonth(now.getMonth() - 3);
        if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);

        return movements.filter(m => new Date(m.movementDate) >= cutoff);
    }, [movements, period]);

    const stats = useMemo(() => {
        const entries = filteredMovements.filter(m => m.type === MovementType.IN);
        const exits = filteredMovements.filter(m => m.type === MovementType.OUT);

        const entriesQty = entries.reduce((acc, m) => acc + m.quantity, 0);
        const exitsQty = exits.reduce((acc, m) => acc + m.quantity, 0);

        const entriesValue = entries.reduce((acc, m) => acc + (m.totalValue || 0), 0);
        const exitsValue = exits.reduce((acc, m) => acc + (m.totalValue || 0), 0);

        return {
            entriesQty,
            exitsQty,
            entriesValue,
            exitsValue,
            balanceQty: entriesQty - exitsQty,
            balanceValue: entriesValue - exitsValue
        };
    }, [filteredMovements]);

    const chartData = useMemo(() => {
        const grouped: any = {};

        filteredMovements.forEach(m => {
            const date = new Date(m.movementDate).toLocaleDateString('pt-BR');
            if (!grouped[date]) grouped[date] = { date, entries: 0, exits: 0 };

            if (m.type === MovementType.IN) {
                grouped[date].entries += m.quantity;
            } else {
                grouped[date].exits += m.quantity;
            }
        });

        return Object.values(grouped).sort((a: any, b: any) => {
            const [da, ma, ya] = a.date.split('/');
            const [db, mb, yb] = b.date.split('/');
            return new Date(`${ya}-${ma}-${da}`).getTime() - new Date(`${yb}-${mb}-${db}`).getTime();
        });
    }, [filteredMovements]);

    const topProducts = useMemo(() => {
        const counts: any = {};

        filteredMovements.forEach(m => {
            if (!counts[m.productId]) counts[m.productId] = { id: m.productId, qty: 0, value: 0 };
            counts[m.productId].qty += m.quantity;
            counts[m.productId].value += m.totalValue || 0;
        });

        return Object.values(counts)
            .map((c: any) => {
                const prod = products.find(p => p.id === c.id);
                return {
                    name: prod?.description || 'Desconhecido',
                    qty: c.qty,
                    value: c.value
                };
            })
            .sort((a: any, b: any) => b.qty - a.qty)
            .slice(0, 5);
    }, [filteredMovements, products]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Análise de Movimentações</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Visão detalhada de fluxo de estoque</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${period === p
                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {p === 'week' && '7 Dias'}
                            {p === 'month' && '30 Dias'}
                            {p === 'quarter' && '3 Meses'}
                            {p === 'year' && 'Ano'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5"><ArrowUpCircle size={60} /></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Entradas</p>
                    <div className="flex items-end gap-2">
                        <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.entriesQty}</h4>
                        <span className="text-xs text-slate-400 mb-1">itens</span>
                    </div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-2">{formatCurrency(stats.entriesValue)}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5"><ArrowDownCircle size={60} /></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Saídas</p>
                    <div className="flex items-end gap-2">
                        <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.exitsQty}</h4>
                        <span className="text-xs text-slate-400 mb-1">itens</span>
                    </div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-2">{formatCurrency(stats.exitsValue)}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5"><Wallet size={60} /></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Saldo Financeiro</p>
                    <div className="flex items-end gap-2">
                        <h4 className={`text-2xl font-black ${stats.balanceValue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                            {formatCurrency(stats.balanceValue)}
                        </h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">No período selecionado</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5"><Package size={60} /></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Movimentações</p>
                    <div className="flex items-end gap-2">
                        <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{filteredMovements.length}</h4>
                        <span className="text-xs text-slate-400 mb-1">registros</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Total de operações</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-600" />
                        Fluxo de Estoque (Qtd)
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickMargin={10} minTickGap={30} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#f8fafc' }}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Legend />
                                <Bar dataKey="entries" name="Entradas" fill="#059669" fillOpacity={0.6} stroke="#059669" strokeWidth={2} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="exits" name="Saídas" fill="#d97706" fillOpacity={0.6} stroke="#d97706" strokeWidth={2} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <Package size={18} className="text-indigo-600" />
                        Top Produtos (Qtd)
                    </h3>
                    <div className="space-y-4">
                        {topProducts.map((p, i) => (
                            <div key={i} className="relative">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px]" title={p.name}>{p.name}</span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.qty}</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                    <div
                                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${(p.qty / topProducts[0].qty) * 100}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 text-right">{formatCurrency(p.value)}</p>
                            </div>
                        ))}
                        {topProducts.length === 0 && (
                            <div className="h-40 flex items-center justify-center text-slate-400 italic text-sm">
                                Sem dados no período.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisDashboard;
