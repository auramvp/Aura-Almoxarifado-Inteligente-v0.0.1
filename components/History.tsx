
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../services/db';
import { AuditLog } from '../types';
import { Clock, User, Activity, FileJson, Package, Truck, Tags, ArrowLeftRight, MessageSquare } from 'lucide-react';

const History = ({ user }: any) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await db.getAuditLogs();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const getDetailedMessage = (log: AuditLog) => {
    const after = log.afterJson ? JSON.parse(log.afterJson) : null;
    const before = log.beforeJson ? JSON.parse(log.beforeJson) : null;

    if (log.entity === 'stock_movements') {
      const typeLabel = after?.type === 'IN' ? 'ENTRADA' : 'SAÍDA';
      return `Registrou uma ${typeLabel} de ${after?.quantity || '?'} un. para o produto "${after?.product_name || 'Desconhecido'}" com destino a "${after?.destination || 'Almoxarifado'}".`;
    }

    if (log.entity === 'products') {
      if (log.action === 'CREATE') return `Cadastrou o produto "${after?.description || 'Sem Nome'}" (Cód: ${after?.cod || '-'}).`;
      if (log.action === 'UPDATE') return `Atualizou informações do produto "${after?.description || 'Sem Nome'}".`;
      if (log.action === 'DELETE') return `Inativou o produto "${before?.description || 'Desconhecido'}".`;
    }

    if (log.entity === 'suppliers') {
      if (log.action === 'CREATE') return `Cadastrou o fornecedor "${after?.name || 'Sem Nome'}".`;
      if (log.action === 'UPDATE') return `Editou dados do fornecedor "${after?.name || 'Sem Nome'}".`;
      if (log.action === 'DELETE') return `Removeu o fornecedor "${before?.name || 'Desconhecido'}".`;
    }

    if (log.entity === 'categories') {
        return `${log.action === 'CREATE' ? 'Criou' : log.action === 'UPDATE' ? 'Editou' : 'Removeu'} a categoria "${after?.name || before?.name || 'Sem Nome'}".`;
    }

    return `Realizou uma ação de ${log.action} em ${log.entity}.`;
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'products': return <Package size={14} className="text-blue-500" />;
      case 'suppliers': return <Truck size={14} className="text-indigo-500" />;
      case 'categories': return <Tags size={14} className="text-emerald-500" />;
      case 'stock_movements': return <ArrowLeftRight size={14} className="text-amber-500" />;
      default: return <Activity size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Registro de Atividades</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Linha do tempo de todas as ações realizadas no almoxarifado.</p>
        </div>
        <button onClick={loadLogs} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-400">
          <Activity size={20} className={loading ? 'animate-pulse text-blue-500' : ''} />
        </button>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] w-48">Quando</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">O que foi feito</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] text-center w-24">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length > 0 ? logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                      <Clock size={12} className="text-slate-300" />
                      {formatDate(log.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getEntityIcon(log.entity)}</div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed max-w-2xl">
                        {getDetailedMessage(log)}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => {
                        const before = log.beforeJson ? JSON.parse(log.beforeJson) : null;
                        const after = log.afterJson ? JSON.parse(log.afterJson) : null;
                        console.log('Dados da Auditoria:', { antes: before, depois: after });
                        alert(`JSON Completo da Ação disponível no console do navegador (F12).`);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                      title="Ver Dados Técnicos"
                    >
                      <FileJson size={18} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center">
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Activity className="animate-spin text-blue-500" />
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Lendo diário de bordo...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <MessageSquare size={40} className="opacity-10 mb-2" />
                        <span className="text-sm font-medium">Nenhum registro encontrado.</span>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default History;
