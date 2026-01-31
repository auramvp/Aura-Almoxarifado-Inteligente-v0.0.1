
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Search, Filter, AlertTriangle } from 'lucide-react';
import { Product, Location, StockBalance } from '../types';

const Inventory = ({ user }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // Fix: db methods return promises, so we use state and useEffect
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [ps, ls, bs] = await Promise.all([
        db.getProducts(),
        db.getLocations(),
        db.getStockBalances()
      ]);
      setProducts(ps);
      setLocations(ls);
      setBalances(bs);
    };
    loadData();
  }, []);

  const tableData = useMemo(() => {
    const grouped: Record<string, { total: number; byLoc: Record<string, number> }> = {};
    balances.forEach(b => {
      if (!grouped[b.productId]) grouped[b.productId] = { total: 0, byLoc: {} };
      grouped[b.productId].total += b.quantity;
      grouped[b.productId].byLoc[b.locationId] = (grouped[b.productId].byLoc[b.locationId] || 0) + b.quantity;
    });

    return products.map(p => {
      const pBal = grouped[p.id] || { total: 0, byLoc: {} };
      const displayQty = selectedLocation === 'all' ? pBal.total : (pBal.byLoc[selectedLocation] || 0);
      return { ...p, currentQty: displayQty, status: displayQty < p.minStock ? 'CRITICAL' : 'OK' };
    });
  }, [products, balances, selectedLocation]);

  const filteredData = tableData.filter(item => 
    (item.description.toLowerCase().includes(searchTerm.toLowerCase()) || item.cod.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      <header className="shrink-0">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Controle de Estoque</h2>
        <p className="text-slate-500 dark:text-slate-400">Acompanhamento de níveis e locais de armazenagem.</p>
      </header>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-4 transition-colors shrink-0">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Filtrar por nome ou código..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-slate-400" />
          <select 
            className="w-full md:w-48 px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition outline-none"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="all">Todos os Locais</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left relative">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Cód</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Item</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Saldo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Mínimo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredData.length > 0 ? filteredData.map(item => (
                <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${item.status === 'CRITICAL' ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                  <td className="px-6 py-4">
                    {item.status === 'CRITICAL' ? (
                      <span className="flex items-center gap-1 text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs font-bold w-fit">
                        <AlertTriangle size={12} />BAIXO
                      </span>
                    ) : (
                      <span className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded text-xs font-bold w-fit uppercase">OK</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-blue-600 dark:text-blue-400">{item.cod}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{item.description}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{item.unit}</p>
                  </td>
                  <td className={`px-6 py-4 text-right font-bold text-lg ${item.status === 'CRITICAL' ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{item.currentQty}</td>
                  <td className="px-6 py-4 text-right text-slate-500 dark:text-slate-400 text-sm">{item.minStock}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-800 dark:text-slate-200">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.currentQty * item.pmed)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600 italic">Nenhum item com saldo registrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
