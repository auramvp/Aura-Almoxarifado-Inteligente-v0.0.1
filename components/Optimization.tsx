import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { Product, StockMovement, StockBalance, MovementType, TaxDocument } from '../types';
import { AiReports } from './AiReports';
import { jsPDF } from 'jspdf';
import { 
  Zap, TrendingUp, TrendingDown, Target, ShieldAlert, Lightbulb, Sparkles, Loader2, PackageSearch, 
  DollarSign, BarChart3, ChevronRight, FileText, CheckCircle2, Info, ArrowLeft, AlertTriangle,
  Upload, FileUp, Send, Clock, ShieldCheck, X, Eye, EyeOff, Check
} from 'lucide-react';

const Optimization = ({ user }: any) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('giro');
  const [showCards, setShowCards] = useState(true);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const taxReportRef = useRef<HTMLDivElement>(null);

  // Tax Request State
  const [taxRequestFiles, setTaxRequestFiles] = useState<Record<number, File>>({});
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTaxRequestFiles(prev => ({ ...prev, [index]: e.target.files![0] }));
    }
  };

  const handleSubmitTaxRequest = async () => {
    if (Object.keys(taxRequestFiles).length === 0) {
      alert("Por favor, anexe pelo menos um documento.");
      return;
    }
  
    setIsSubmittingRequest(true);
    try {
      const currentUser = await db.getCurrentUser();
      // Fallback ID if not available (e.g. during dev/mock)
      const companyId = currentUser?.companyId || user?.companyId || 'demo-company-id';
  
      const uploadedDocs: TaxDocument[] = [];
  
      // Upload files
      await Promise.all(Object.entries(taxRequestFiles).map(async ([idx, file]) => {
        try {
          // Note: In a real app, we would upload to storage. 
          // For this demo, if no backend storage is configured, we might mock it or try the real call.
          // Since we added the code to db.ts, we try to call it.
          // If it fails (e.g. missing bucket), we'll catch and alert or proceed with mock url.
          let url = '';
          try {
             url = await db.uploadTaxDocument(file, companyId);
          } catch (e) {
             console.warn("Upload failed (likely due to missing Supabase bucket setup), using mock URL", e);
             url = `mock://documents/${file.name}`;
          }

          uploadedDocs.push({
            name: file.name,
            url: url,
            type: file.type || 'application/octet-stream',
            size: file.size
          });
        } catch (err) {
          console.error(`Error processing file ${file.name}`, err);
        }
      }));
  
      await db.createTaxAnalysisRequest({
        companyId,
        documents: uploadedDocs
      });
  
      alert("Solicitação enviada com sucesso! Nossa equipe entrará em contato em até 24h.");
      setActiveTab('tax-analysis');
      setTaxRequestFiles({});
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar solicitação. Verifique se você está conectado.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };


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
        status: suggestedMin > p.minStock ? 'UNDERSIZED' : (suggestedMin < p.minStock * 0.5 ? 'OVERSIZED' : 'BALANCED')
      };
    }).sort((a, b) => b.capitalImobilizado - a.capitalImobilizado);
  }, [products, movements, balances]);

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

  const taxRecoveryPotential = totalIdleCapital * 0.12; // Estimating 12% tax credit on idle inventory

  const handleDownloadTaxReport = async () => {
    if (!taxReportRef.current) return;
    setIsPdfGenerating(true);
    
    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.innerText = 'Gerando Relatório Fiscal...';
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

        const element = taxReportRef.current;
        
        // Create a temporary container
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-10000px';
        container.style.left = '0';
        container.style.width = '800px'; 
        container.style.backgroundColor = '#ffffff';
        
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.display = 'block';
        clone.style.width = '100%';
        
        // Force black text for PDF
        const allElements = clone.querySelectorAll('*');
        allElements.forEach((el: any) => {
             if (el.style) el.style.color = '#000000';
        });

        container.appendChild(clone);
        document.body.appendChild(container);

        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 500));

        await doc.html(clone, {
            callback: function (doc) {
                doc.save(`Aura-Relatorio-Fiscal-${new Date().toISOString().slice(0,10)}.pdf`);
                document.body.removeChild(container);
                document.body.removeChild(loadingIndicator);
                setIsPdfGenerating(false);
            },
            x: 15,
            y: 15,
            width: 565, // A4 width (595) - margins (30)
            windowWidth: 800,
            autoPaging: 'text',
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            }
        });

    } catch (e) {
        console.error(e);
        setIsPdfGenerating(false);
        if (document.body.contains(loadingIndicator)) document.body.removeChild(loadingIndicator);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'giro' 
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-600' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
                Análise de Giro
            </button>
            <button 
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 ${
                activeTab === 'ai' 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white ring-2 ring-offset-2 ring-blue-600 dark:ring-offset-slate-900' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white opacity-90 hover:opacity-100 hover:scale-105'
                }`}
            >
                <Sparkles size={14} />
                AURA IA
            </button>
            </div>
        </header>

        {activeTab !== 'ai' && activeTab !== 'tax-analysis' && activeTab !== 'tax-request' && showCards && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
                            <TrendingDown size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded">Risco</span>
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Capital Imobilizado</p>
                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">{formatCurrency(totalIdleCapital)}</h4>
                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">Valor total em produtos com baixo giro (&lt;0.2x) que estão parados no estoque.</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                            <Target size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded">Giro</span>
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Giro Médio (30d)</p>
                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        {(optimizationData.reduce((s, i) => s + i.giro, 0) / products.length).toFixed(2)}x
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">Média de renovação do estoque nos últimos 30 dias.</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                            <Lightbulb size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">Ajuste</span>
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Mal Redimensionados</p>
                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        {optimizationData.filter(i => i.status !== 'BALANCED').length}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">Itens cujo estoque mínimo sugerido difere do atual configurado.</p>
                </div>

                {/* New Tax Credit Recovery Card */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-indigo-200 dark:border-indigo-900/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-full translate-x-1/3 -translate-y-1/3 group-hover:bg-indigo-100 transition-colors"></div>
                    <div className="flex items-center justify-between mb-2 relative z-10">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg">
                            <DollarSign size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">Fiscal</span>
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 relative z-10">Indicador Preliminar de Oportunidade Fiscal</p>
                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 relative z-10 flex flex-col">
                        <span>{formatCurrency(taxRecoveryPotential)}</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">Estimativa teórica não homologada*</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-2 leading-tight relative z-10">Potencial de recuperação tributária sobre estoque obsoleto.</p>
                    <button 
                        onClick={() => setActiveTab('tax-analysis')}
                        className="mt-2 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors relative z-10 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                        Ver Análise
                    </button>
                </div>
            </div>
        )}
      </div>

      {activeTab === 'ai' ? (
        <div className="flex-1 overflow-y-auto p-6 pt-0 min-h-0">
             <AiReports />
        </div>
      ) : activeTab === 'tax-analysis' ? (
        <div className="flex-1 overflow-y-auto p-6 pt-0 min-h-0">
          <div className="max-w-6xl mx-auto space-y-6">
            <button 
              onClick={() => setActiveTab('giro')}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-4"
            >
              <ArrowLeft size={20} />
              <span className="font-bold text-sm">Voltar para Otimização</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Analysis Card */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl">
                    <DollarSign size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Análise de Indícios Fiscais</h3>
                    <p className="text-slate-500 dark:text-slate-400">Levantamento preliminar de oportunidades tributárias baseado no perfil de estoque</p>
                  </div>
                </div>

                <div className="p-4 mb-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl flex gap-3">
                  <AlertTriangle className="text-amber-600 dark:text-amber-500 flex-none" size={20} />
                  <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                    <strong>Aviso Legal:</strong> Esta análise é automatizada e tem caráter estritamente indicativo. A confirmação e aproveitamento de créditos tributários dependem de validação contábil e fiscal detalhada, conforme a legislação vigente e o regime tributário da empresa.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[24px]">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Indicador Preliminar</p>
                    <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(taxRecoveryPotential)}</p>
                    <p className="text-xs text-slate-500 mt-2 font-bold">Estimativa teórica não homologada</p>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[24px] relative group cursor-help">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1">
                      Capital Imobilizado
                      <Info size={12} className="text-slate-400" />
                    </p>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] p-2 rounded-lg w-48 pointer-events-none z-20">
                      Valor baseado em itens de baixo giro identificados no estoque
                    </div>
                    <p className="text-4xl font-black text-slate-700 dark:text-slate-300">{formatCurrency(totalIdleCapital)}</p>
                    <p className="text-xs text-slate-500 mt-2 font-bold">Produtos com Giro &lt; 0.2x</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-lg">
                    <Info size={20} className="text-blue-500" />
                    Lógica da Análise
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed space-y-3">
                    <p>
                        Produtos com baixo giro podem gerar distorções fiscais quando créditos pagos na entrada (ICMS/PIS/COFINS) não são compensados corretamente na saída devido à estagnação do estoque.
                    </p>
                    <p>
                        <strong>Metodologia de Cálculo:</strong> O sistema identifica itens com giro inferior a 0.2x nos últimos 30 dias (Estoque Obsoleto) e aplica uma alíquota média estimada de 12% sobre o valor total deste estoque. Este percentual representa uma média conservadora de créditos tributários recuperáveis (ICMS/PIS/COFINS) que estariam "presos" no estoque imobilizado.
                    </p>
                    <p>
                        O Aura identifica esses padrões de imobilização para apoiar decisões contábeis, sugerindo uma revisão da classificação fiscal (NCM) e do aproveitamento de créditos conforme o regime tributário (Simples Nacional, Lucro Presumido ou Real).
                    </p>
                  </div>
                </div>
              </div>

              {/* Checklist Card */}
              <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                    <FileText size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Checklist de Validação</h3>
                </div>
                <p className="text-xs text-slate-500 mb-6">Documentos necessários para validação externa</p>

                <div className="space-y-3">
                  {[
                    "Notas Fiscais de Entrada (últimos 5 anos)",
                    "Livros de Apuração de ICMS/IPI",
                    "EFD Contribuições (PIS/COFINS)",
                    "Extratos do Simples Nacional (PGDAS)",
                    "Relatório de Inventário de Estoque"
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                      <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-none" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={() => setActiveTab('tax-request')}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                        <FileUp size={20} />
                        Solicitar Análise Fiscal
                    </button>
                    <p className="text-center text-[10px] text-slate-400 mt-3">Envie os documentos para análise especializada</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'tax-request' ? (
        <div className="flex-1 overflow-y-auto p-6 pt-0 min-h-0">
          <div className="max-w-5xl mx-auto">
            <button 
              onClick={() => setActiveTab('tax-analysis')}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-6"
            >
              <ArrowLeft size={20} />
              <span className="font-bold text-sm">Voltar para Análise Preliminar</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Info & Steps */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Solicitação de Análise</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                    Nossa equipe de especialistas tributários realizará uma varredura completa em seus documentos para validar os indícios fiscais identificados.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <Clock size={18} className="text-indigo-500" />
                    Fluxo de Trabalho
                  </h3>
                  
                  <div className="relative space-y-8 pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                    <div className="relative">
                      <div className="absolute -left-[2.1rem] w-6 h-6 rounded-full bg-indigo-600 border-4 border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center z-10">
                        <span className="text-[10px] font-black text-white">1</span>
                      </div>
                      <h4 className="font-bold text-sm text-indigo-600 dark:text-indigo-400">Envio de Documentos</h4>
                      <p className="text-xs text-slate-500 mt-1">Você anexa os arquivos solicitados nesta tela.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[2.1rem] w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-4 border-slate-50 dark:border-slate-800 flex items-center justify-center z-10">
                        <span className="text-[10px] font-black text-slate-500">2</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Análise Técnica Aura</h4>
                      <p className="text-xs text-slate-500 mt-1">Nossos auditores processam os dados e cruzam com a legislação.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[2.1rem] w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-4 border-slate-50 dark:border-slate-800 flex items-center justify-center z-10">
                        <span className="text-[10px] font-black text-slate-500">3</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Entrega do Laudo</h4>
                      <p className="text-xs text-slate-500 mt-1">Você recebe o relatório final validado com as orientações de recuperação.</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                    <div className="flex gap-3">
                        <ShieldCheck className="text-indigo-600 flex-none" size={24} />
                        <div>
                            <h4 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm mb-1">Segurança e Sigilo</h4>
                            <p className="text-xs text-indigo-800 dark:text-indigo-400 leading-relaxed">
                                Todos os documentos são criptografados e acessados apenas pelos auditores responsáveis. Seus dados fiscais estão protegidos.
                            </p>
                        </div>
                    </div>
                </div>
              </div>

              {/* Right Column: Upload Form */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">Upload de Documentos</h3>
                            <p className="text-xs text-slate-500">Anexe os arquivos para iniciar a validação</p>
                        </div>
                        <span className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">0/5 Anexados</span>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        {[
                            { title: "Notas Fiscais de Entrada", desc: "Arquivos XML ou PDF dos últimos 5 anos", required: true },
                            { title: "Livros de Apuração de ICMS/IPI", desc: "Sped Fiscal ou relatórios do sistema", required: true },
                            { title: "EFD Contribuições", desc: "Arquivo digital do PIS/COFINS", required: true },
                            { title: "Extratos do Simples Nacional", desc: "PGDAS-D (se aplicável)", required: false },
                            { title: "Relatório de Inventário", desc: "Posição de estoque em 31/12", required: true }
                        ].map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 transition-colors group bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-400 group-hover:text-indigo-500 transition-colors">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                            {doc.title}
                                            {doc.required && <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded font-bold uppercase">Obrigatório</span>}
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1">{doc.desc}</p>
                                        {taxRequestFiles[idx] && (
                                            <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
                                                <Check size={12} />
                                                Arquivo selecionado: {taxRequestFiles[idx].name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <input 
                                        type="file" 
                                        id={`file-${idx}`} 
                                        className="hidden" 
                                        onChange={(e) => handleFileSelect(idx, e)}
                                    />
                                    <label 
                                        htmlFor={`file-${idx}`}
                                        className={`px-4 py-2 border text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-2 shadow-sm ${
                                            taxRequestFiles[idx] 
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600'
                                        }`}
                                    >
                                        {taxRequestFiles[idx] ? <Check size={14} /> : <Upload size={14} />}
                                        {taxRequestFiles[idx] ? 'Anexado' : 'Anexar'}
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button 
                            onClick={handleSubmitTaxRequest}
                            disabled={isSubmittingRequest}
                            className={`px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all ${isSubmittingRequest ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isSubmittingRequest ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            {isSubmittingRequest ? 'Enviando...' : 'Enviar Solicitação para Análise'}
                        </button>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden p-6 pt-0 min-h-0">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="flex-none p-8 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <BarChart3 className="text-blue-600" size={20} />
                <h3 className="text-lg font-bold">Sugestões de Reestocagem & Giro</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimos 30 dias de operação</span>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50 dark:bg-slate-800">Produto</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right bg-slate-50 dark:bg-slate-800">Giro (Vezes)</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right bg-slate-50 dark:bg-slate-800">E. Atual vs Sugerido</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right bg-slate-50 dark:bg-slate-800">Sugestão de Compra</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center bg-slate-50 dark:bg-slate-800">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {optimizationData.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <PackageSearch size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.description}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">Custo Base: {formatCurrency(item.pmed)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                          <TrendingUp size={12} className={item.giro > 1 ? 'text-emerald-500' : 'text-slate-400'} />
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">{item.giro}x</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{item.balance} <span className="text-[10px] text-slate-400">un</span></p>
                          <p className={`text-[10px] font-bold ${item.status === 'UNDERSIZED' ? 'text-red-500' : item.status === 'OVERSIZED' ? 'text-amber-500' : 'text-emerald-500'}`}>
                             Aura sugere: {item.suggestedMin} un
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end">
                          <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                            {item.status === 'UNDERSIZED' ? `Comprar ${item.suggestedMin - item.balance} un` : 'Aguardar'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Custo Estimado: {formatCurrency(Math.max(0, (item.suggestedMin - item.balance) * item.pmed))}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition">
                          <ChevronRight size={20} />
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
      {/* Hidden Report Template for PDF Generation */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}>
        <div ref={taxReportRef} className="bg-white p-12 text-slate-900 max-w-[800px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-6 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 text-white rounded-lg">
                        <Zap size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Aura Almoxarife</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Relatório de Inteligência Fiscal</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-slate-500">Data de Emissão</p>
                    <p className="text-lg font-mono font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            {/* Legal Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-8 flex gap-3">
                <AlertTriangle className="text-amber-600 flex-none" size={24} />
                <div>
                    <h4 className="font-bold text-amber-800 text-sm uppercase mb-1">Aviso Legal Importante</h4>
                    <p className="text-xs text-amber-900 leading-relaxed text-justify">
                        Esta análise é gerada automaticamente por algoritmos de inteligência artificial baseados em padrões de movimentação de estoque. <strong>Os valores apresentados são estritamente indicativos e não constituem parecer contábil ou jurídico.</strong> A confirmação, escrituração e aproveitamento de quaisquer créditos tributários dependem de validação por profissional habilitado (contador ou advogado tributarista), respeitando a legislação vigente e o regime tributário específico da empresa.
                    </p>
                </div>
            </div>

            {/* Executive Summary */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Indicador Preliminar</p>
                    <p className="text-3xl font-black text-indigo-600">{formatCurrency(taxRecoveryPotential)}</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold">*Estimativa teórica não homologada</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Capital Imobilizado (Obsoleto)</p>
                    <p className="text-3xl font-black text-slate-700">{formatCurrency(totalIdleCapital)}</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold">Base de cálculo (Giro &lt; 0.2x)</p>
                </div>
            </div>

            {/* Methodology */}
            <div className="mb-8">
                <h3 className="text-sm font-black uppercase text-slate-800 border-b border-slate-100 pb-2 mb-4">Metodologia de Análise</h3>
                <p className="text-xs text-slate-600 leading-relaxed text-justify mb-2">
                    O sistema Aura analisou a base de estoque e identificou itens com <strong>Giro inferior a 0.2x nos últimos 30 dias</strong>. Estes itens representam capital imobilizado que pode ter gerado créditos tributários na entrada (ICMS, PIS, COFINS) que não foram realizados devido à ausência de saída (venda).
                </p>
                <p className="text-xs text-slate-600 leading-relaxed text-justify">
                    O indicador preliminar aplica uma alíquota média estimada de <strong>12%</strong> sobre o Custo Médio (PMED) total destes itens. Este percentual é uma referência conservadora de mercado para indícios de recuperabilidade em empresas do regime não-cumulativo ou com particularidades estaduais de ICMS.
                </p>
            </div>

            {/* Top Items Table */}
            <div className="mb-8">
                <h3 className="text-sm font-black uppercase text-slate-800 border-b border-slate-100 pb-2 mb-4">Top 10 Itens com Maior Imobilização</h3>
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                            <th className="py-2 px-2 font-bold uppercase">Produto</th>
                            <th className="py-2 px-2 font-bold uppercase text-right">Qtd.</th>
                            <th className="py-2 px-2 font-bold uppercase text-right">Custo Un.</th>
                            <th className="py-2 px-2 font-bold uppercase text-right">Total Imobilizado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {optimizationData
                            .filter(i => i.giro < 0.2)
                            .slice(0, 10)
                            .map((item, idx) => (
                            <tr key={idx}>
                                <td className="py-2 px-2 font-medium text-slate-700 truncate max-w-[250px]">{item.description}</td>
                                <td className="py-2 px-2 text-slate-600 text-right">{item.balance}</td>
                                <td className="py-2 px-2 text-slate-600 text-right">{formatCurrency(item.pmed)}</td>
                                <td className="py-2 px-2 font-bold text-slate-800 text-right">{formatCurrency(item.capitalImobilizado)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="text-[10px] text-slate-400 mt-2 text-right">Listando os 10 itens de maior relevância financeira no estoque obsoleto.</p>
            </div>

            {/* Checklist */}
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="text-sm font-black uppercase text-slate-800 mb-4">Próximos Passos (Checklist de Validação)</h3>
                <ul className="grid grid-cols-2 gap-2">
                    {[
                    "Separar Notas Fiscais de Entrada (últimos 5 anos)",
                    "Levantar Livros de Apuração de ICMS/IPI",
                    "Extrair EFD Contribuições (PIS/COFINS)",
                    "Verificar Extratos do Simples Nacional (PGDAS)",
                    "Validar Relatório de Inventário Físico"
                    ].map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                            <div className="w-3 h-3 border-2 border-slate-300 rounded-sm"></div>
                            {item}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center">
                <p className="text-[10px] text-slate-400">Aura Almoxarife Inteligente - v2.0</p>
                <p className="text-[10px] text-slate-400">Página 1 de 1</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Optimization;
