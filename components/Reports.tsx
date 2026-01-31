import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../services/db';
import { MovementType, StockMovement, Product, StockBalance, Category } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileDown, Bot, Sparkles, X, Send, Loader2, Mail, Plus, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import { AiReportService } from '../services/aiReportService';
import { EmailService } from '../services/emailService';
import { renderToStaticMarkup } from 'react-dom/server';

const Reports = ({ user }: any) => {
  const [reportType, setReportType] = useState('summary');
  const reportRef = React.useRef<HTMLDivElement>(null);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

  // AI Report State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStartDate, setAiStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10));
  const [aiEndDate, setAiEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Email State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailList, setEmailList] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const canEdit = user.role === 'ALMOXARIFE' || user.permissions?.reports === 'full';

  useEffect(() => {
    const loadData = async () => {
      const [ms, ps, bs, cs] = await Promise.all([
        db.getMovements(),
        db.getProducts(),
        db.getStockBalances(),
        db.getCategories()
      ]);
      setMovements(ms);
      setProducts(ps);
      setBalances(bs);
      setCategories(cs);

      if (user?.companyId) {
        const comp = await db.getCompanyById(user.companyId);
        if (comp) {
            setCompanyName(comp.name);
            if (comp.logo) setCompanyLogo(comp.logo);
            if (comp.email) setEmailList([comp.email]);
        }
      }
    };
    loadData();
  }, [user]);

  const handleAddEmail = () => {
    if (!currentEmail) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(currentEmail)) {
        setEmailError('E-mail inválido');
        return;
    }
    if (emailList.includes(currentEmail)) {
        setEmailError('E-mail já adicionado');
        return;
    }
    setEmailList([...emailList, currentEmail]);
    setCurrentEmail('');
    setEmailError('');
  };

  const handleRemoveEmail = (email: string) => {
    setEmailList(emailList.filter(e => e !== email));
  };

  const handleSendEmail = async () => {
    if (emailList.length === 0) {
        setEmailError('Adicione pelo menos um destinatário');
        return;
    }

    setIsSendingEmail(true);
    try {
        // Generate HTML from Markdown
        const reportHtml = renderToStaticMarkup(
            <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({node, ...props}) => <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '20px 0 10px', color: '#1f2937' }} {...props} />,
                    h2: ({node, ...props}) => <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '16px 0 8px', color: '#1f2937' }} {...props} />,
                    h3: ({node, ...props}) => <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '14px 0 6px', color: '#374151' }} {...props} />,
                    p: ({node, ...props}) => <p style={{ fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px', color: '#4b5563' }} {...props} />,
                    ul: ({node, ...props}) => <ul style={{ margin: '0 0 16px', paddingLeft: '20px', color: '#4b5563' }} {...props} />,
                    ol: ({node, ...props}) => <ol style={{ margin: '0 0 16px', paddingLeft: '20px', color: '#4b5563' }} {...props} />,
                    li: ({node, ...props}) => <li style={{ marginBottom: '4px' }} {...props} />,
                    strong: ({node, ...props}) => <strong style={{ fontWeight: 'bold', color: '#1f2937' }} {...props} />,
                }}
            >
                {aiResponse}
            </ReactMarkdown>
        );

        await EmailService.sendOptimizationReport({
            to: emailList,
            reportHtml,
            companyName: companyName || 'Aura Almoxarife',
            period: `${new Date(aiStartDate).toLocaleDateString('pt-BR')} a ${new Date(aiEndDate).toLocaleDateString('pt-BR')}`
        });

        setEmailSuccess(true);
        setTimeout(() => {
            setShowEmailModal(false);
            setEmailSuccess(false);
            // Don't clear email list
        }, 2000);

    } catch (error: any) {
        console.error("Erro ao enviar email:", error);
        setEmailError(error.message || "Falha ao enviar e-mail. Tente novamente.");
    } finally {
        setIsSendingEmail(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; in: number; out: number }> = {};
    for(let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().substring(0, 7);
      data[key] = { month: key, in: 0, out: 0 };
    }
    movements.forEach(m => {
      if (data[m.monthRef]) {
        if (m.type === MovementType.IN) data[m.monthRef].in += m.totalValue;
        if (m.type === MovementType.OUT) data[m.monthRef].out += m.totalValue;
      }
    });
    return Object.values(data);
  }, [movements]);

  const abcData = useMemo(() => {
    const data = products.map(p => {
      const bal = balances.filter(b => b.productId === p.id).reduce((s, b) => s + b.quantity, 0);
      const val = bal * p.pmed;
      return { name: p.description, value: val };
    }).sort((a, b) => b.value - a.value);

    const totalVal = data.reduce((s, i) => s + i.value, 0);
    let cumulative = 0;
    
    return data.map(item => {
      cumulative += item.value;
      const pct = (cumulative / totalVal) * 100;
      let cat = 'C';
      if (pct <= 70) cat = 'A';
      else if (pct <= 90) cat = 'B';
      return { ...item, category: cat, percentage: totalVal > 0 ? (item.value / totalVal) * 100 : 0 };
    });
  }, [products, balances]);

  const handleGenerateAiReport = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsAiLoading(true);
    setAiResponse('');
    
    try {
      const response = await AiReportService.generateAiReport(aiStartDate, aiEndDate, aiPrompt);
      setAiResponse(response);
    } catch (error: any) {
      console.error(error);
      setAiResponse(`Erro ao gerar relatório: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

    const handleDownloadPdf = async () => {
        if (!reportRef.current) return;
        setIsPdfGenerating(true);

        // Scroll to top to ensure html2canvas captures correctly
        window.scrollTo(0, 0);

        // Create a temporary container that takes over the screen
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.backgroundColor = '#ffffff';
        container.style.zIndex = '999999'; // Highest priority
        container.style.overflow = 'auto'; // Allow scrolling if needed (though we want to capture it all)
        container.style.padding = '0';
        container.style.margin = '0';
        
        // Create a visual indicator that something is happening
        const loadingIndicator = document.createElement('div');
        loadingIndicator.innerText = 'Gerando PDF... Por favor aguarde.';
        loadingIndicator.style.position = 'fixed';
        loadingIndicator.style.top = '20px';
        loadingIndicator.style.left = '50%';
        loadingIndicator.style.transform = 'translateX(-50%)';
        loadingIndicator.style.backgroundColor = 'rgba(0,0,0,0.8)';
        loadingIndicator.style.color = 'white';
        loadingIndicator.style.padding = '10px 20px';
        loadingIndicator.style.borderRadius = '5px';
        loadingIndicator.style.zIndex = '1000000';
        document.body.appendChild(loadingIndicator);

        try {
            const doc = new jsPDF({
                unit: 'pt',
                format: 'a4',
                orientation: 'portrait'
            });

            // Create a clone of the report element
            const originalElement = reportRef.current;
            const clone = originalElement.cloneNode(true) as HTMLElement;

            // Clean up the clone's styles for the PDF container
            clone.style.position = 'relative'; // Reset position
            clone.style.top = 'auto';
            clone.style.left = 'auto';
            clone.style.zIndex = 'auto';
            clone.style.width = '800px'; // Fixed width for A4
            clone.style.margin = '0 auto'; // Center it
            clone.style.backgroundColor = '#ffffff';
            clone.style.display = 'block';
            clone.style.color = '#000000'; // Base color
            
            // Force ALL text elements to be black
            const allElements = clone.querySelectorAll('*');
            allElements.forEach((el: any) => {
                if (el.style) {
                    el.style.color = '#000000';
                    // Ensure headings and bold text are black
                    if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'P', 'SPAN', 'LI', 'TD', 'TH'].includes(el.tagName)) {
                        el.style.color = '#000000';
                    }
                }
            });

            // Append clone to our fullscreen container
            container.appendChild(clone);
            document.body.appendChild(container);

            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 1000));

            // A4 width is 595.28 pt
            const margin = 30; // Slightly smaller margin
            const contentWidth = 595.28 - (margin * 2);

            await doc.html(clone, {
                callback: function (doc) {
                    doc.save(`relatorio-geral-aura-${new Date().toISOString().slice(0,10)}.pdf`);
                    // Cleanup
                    document.body.removeChild(container);
                    document.body.removeChild(loadingIndicator);
                    setIsPdfGenerating(false);
                },
                x: margin,
                y: margin,
                width: contentWidth,
                windowWidth: 800, 
                autoPaging: 'text',
                margin: [30, 30, 30, 30],
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    windowWidth: 800
                }
            });
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar o PDF. Tente novamente.');
            setIsPdfGenerating(false);
            if (document.body.contains(container)) document.body.removeChild(container);
            if (document.body.contains(loadingIndicator)) document.body.removeChild(loadingIndicator);
        }
    };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Relatórios Gerenciais</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Análise financeira e operacional do almoxarifado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button 
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700 transition font-bold shadow-md shadow-indigo-500/20"
            >
              <Sparkles size={18} /> AURA IA
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 summary-report-content">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Fluxo Financeiro Mensal</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" hide={false} />
                <YAxis hide={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area name="Entradas" type="monotone" dataKey="in" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                <Area name="Saídas" type="monotone" dataKey="out" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Curva ABC (Valorização)</h3>
                <div className="space-y-4">
                    {abcData.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black text-white ${item.category === 'A' ? 'bg-red-500' : 'bg-amber-500'}`}>{item.category}</span>
                                <span className="text-sm font-bold truncate max-w-[150px]">{item.name}</span>
                            </div>
                            <span className="text-sm font-mono font-bold text-slate-500">{formatCurrency(item.value)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Resumo Financeiro</h3>
                <div className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800">
                        <span className="text-sm font-medium text-slate-500">Patrimônio em Estoque</span>
                        <span className="text-sm font-black text-blue-600">{formatCurrency(abcData.reduce((s, i) => s + i.value, 0))}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800">
                        <span className="text-sm font-medium text-slate-500">Total Compras (Entradas)</span>
                        <span className="text-sm font-black text-emerald-600">{formatCurrency(movements.filter(m => m.type === MovementType.IN).reduce((s, m) => s + m.totalValue, 0))}</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="text-sm font-medium text-slate-500">Total Consumo (Saídas)</span>
                        <span className="text-sm font-black text-amber-600">{formatCurrency(movements.filter(m => m.type === MovementType.OUT).reduce((s, m) => s + m.totalValue, 0))}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/50">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles size={20} className="text-violet-600" />
                Relatório Inteligente AURA IA
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition outline-none">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!aiResponse ? (
                <div className="space-y-6">
                   <div className="bg-violet-50 dark:bg-violet-900/10 p-4 rounded-lg border border-violet-100 dark:border-violet-900/30 text-violet-800 dark:text-violet-300 text-sm">
                     <p className="font-bold mb-1 flex items-center gap-2"><Bot size={16}/> Como posso ajudar?</p>
                     <p>Descreva que tipo de análise você precisa. A IA analisará todos os dados do período selecionado.</p>
                     <ul className="list-disc list-inside mt-2 space-y-1 opacity-80">
                       <li>"Identifique os produtos com maior custo de reposição e sugira cortes."</li>
                       <li>"Quais itens tiveram queda brusca de consumo nos últimos 30 dias?"</li>
                       <li>"Faça uma projeção de compras baseada na média de consumo do mês passado."</li>
                     </ul>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Inicial</label>
                       <input 
                         type="date" 
                         value={aiStartDate} 
                         onChange={(e) => setAiStartDate(e.target.value)}
                         className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                       />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Final</label>
                       <input 
                         type="date" 
                         value={aiEndDate} 
                         onChange={(e) => setAiEndDate(e.target.value)}
                         className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                       />
                     </div>
                   </div>

                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">O que você deseja saber?</label>
                     <textarea 
                       value={aiPrompt}
                       onChange={(e) => setAiPrompt(e.target.value)}
                       placeholder="Ex: Crie um resumo executivo focando apenas nos itens da curva A e sugira ações para reduzir o estoque parado..."
                       className="w-full h-32 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                     />
                   </div>
                </div>
              ) : (
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
              {aiResponse ? (
                <>
                  <button 
                    onClick={() => setAiResponse('')}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold transition"
                  >
                    Nova Análise
                  </button>
                  <button 
                    onClick={() => setShowEmailModal(true)}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 transition-colors bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-lg font-bold"
                  >
                    <Mail size={18} />
                    Enviar por E-mail
                  </button>
                  <button 
                    onClick={handleDownloadPdf}
                    disabled={isPdfGenerating}
                    className="px-4 py-2 bg-slate-800 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold hover:bg-slate-900 dark:hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {isPdfGenerating ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                    {isPdfGenerating ? 'Gerando PDF...' : 'Baixar PDF Profissional'}
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleGenerateAiReport}
                  disabled={isAiLoading || !aiPrompt.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-indigo-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  {isAiLoading ? (
                    <><Loader2 size={18} className="animate-spin" /> Gerando Análise...</>
                  ) : (
                    <><Send size={18} /> Gerar Relatório</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Mail size={20} className="text-indigo-600" />
                        Enviar Relatório
                    </h3>
                    <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        O relatório será enviado em formato digital para os destinatários abaixo.
                    </p>

                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Destinatários</label>
                        
                        <div className="flex flex-wrap gap-2 mb-2">
                            {emailList.map((email, index) => (
                                <div key={index} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-medium animate-in zoom-in-50 duration-200">
                                    <span>{email}</span>
                                    <button 
                                        onClick={() => handleRemoveEmail(email)}
                                        className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full transition-colors"
                                        title="Remover email"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input 
                                type="email" 
                                placeholder="adicionar@email.com" 
                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={currentEmail}
                                onChange={(e) => setCurrentEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                            />
                            <button 
                                onClick={handleAddEmail}
                                className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        {emailError && <p className="text-xs text-red-500 font-medium animate-pulse">{emailError}</p>}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button 
                        onClick={() => setShowEmailModal(false)}
                        className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSendEmail}
                        disabled={isSendingEmail || emailSuccess}
                        className={`px-6 py-2 rounded-lg font-bold text-white text-sm shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all ${
                            emailSuccess 
                                ? 'bg-emerald-500 hover:bg-emerald-600' 
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        } ${isSendingEmail ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isSendingEmail ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Enviando...
                            </>
                        ) : emailSuccess ? (
                            <>
                                <CheckCircle2 size={16} />
                                Enviado!
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Enviar Relatório
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Hidden PDF Template */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        <div 
            ref={reportRef} 
            className="w-[800px] p-16 bg-white"
            style={{ 
                fontFamily: 'Arial, Helvetica, sans-serif',
                color: '#000000',
                backgroundColor: '#ffffff'
            }}
        >
            <div className="flex items-start justify-between border-b-2 border-black pb-8 mb-8" style={{ borderColor: '#000000' }}>
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm overflow-hidden" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                        {companyLogo ? (
                            <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 16L12 8L20 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        )}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight leading-none" style={{ color: '#000000' }}>Aura</h1>
                        <p className="text-xs font-black uppercase tracking-[0.2em] mt-1" style={{ color: '#000000' }}>Almoxarife Inteligente</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: '#000000' }}>{companyName || 'Empresa Principal'}</p>
                    <p className="text-sm mt-1" style={{ color: '#000000' }}>Relatório Gerado em</p>
                    <p className="text-sm font-medium" style={{ color: '#000000' }}>{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-2xl font-bold" style={{ color: '#000000' }}>Relatório Inteligente AURA IA</h2>
                <div className="flex gap-4 mt-2 text-sm" style={{ color: '#000000' }}>
                    <span>Período: <strong style={{ color: '#000000' }}>{new Date(aiStartDate).toLocaleDateString('pt-BR')}</strong> a <strong style={{ color: '#000000' }}>{new Date(aiEndDate).toLocaleDateString('pt-BR')}</strong></span>
                </div>
            </div>

            <div className="prose max-w-none text-justify leading-relaxed" style={{ color: '#000000' }}>
                 <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h1: ({node, ...props}) => <h1 style={{ color: '#000000', fontWeight: 'bold', fontSize: '1.875rem', marginTop: '2rem', marginBottom: '1rem' }} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{ color: '#000000', fontWeight: 'bold', fontSize: '1.5rem', marginTop: '1.5rem', marginBottom: '0.75rem' }} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{ color: '#000000', fontWeight: 'bold', fontSize: '1.25rem', marginTop: '1.25rem', marginBottom: '0.5rem' }} {...props} />,
                        p: ({node, ...props}) => <p style={{ color: '#000000', marginBottom: '1rem' }} {...props} />,
                        strong: ({node, ...props}) => <strong style={{ color: '#000000', fontWeight: 'bold' }} {...props} />,
                        li: ({node, ...props}) => <li style={{ color: '#000000' }} {...props} />,
                        ul: ({node, ...props}) => <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1rem', color: '#000000' }} {...props} />,
                        ol: ({node, ...props}) => <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5rem', marginBottom: '1rem', color: '#000000' }} {...props} />,
                    }}
                 >
                    {aiResponse || 'Nenhuma análise gerada.'}
                 </ReactMarkdown>
            </div>
            
            <div className="mt-12 pt-6 border-t border-black flex justify-between items-center text-xs" style={{ color: '#000000', borderColor: '#000000' }}>
                <span>Documento gerado automaticamente por Aura IA</span>
                <span>Página 1</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
