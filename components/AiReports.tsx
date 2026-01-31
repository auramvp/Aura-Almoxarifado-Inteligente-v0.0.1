
import React, { useState, useEffect, useRef } from 'react';
import { AiReportService } from '../services/aiReportService';
import { db } from '../services/db';
import { EmailService } from '../services/emailService';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import { 
  Bot, Calendar, FileText, Loader2, 
  Printer, Sparkles, AlertTriangle, FileDown,
  Mail, Send, Plus, X, CheckCircle2
} from 'lucide-react';

export const AiReports = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Email State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailList, setEmailList] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  
  useEffect(() => {
    const loadCompany = async () => {
        try {
            const user = await db.getCurrentUser();
            if (user?.companyId) {
                const comp = await db.getCompanyById(user.companyId);
                if (comp) {
                    setCompanyName(comp.name);
                    if (comp.logo) setCompanyLogo(comp.logo);
                    if (comp.email) setEmailList([comp.email]);
                }
            }
        } catch (e) {
            console.error("Error loading company info", e);
        }
    };
    loadCompany();
  }, []);

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
            <Markdown 
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
                {report}
            </Markdown>
        );

        await EmailService.sendOptimizationReport({
            to: emailList,
            reportHtml,
            companyName: companyName || 'Aura Almoxarife',
            period: `${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`
        });

        setEmailSuccess(true);
        setTimeout(() => {
            setShowEmailModal(false);
            setEmailSuccess(false);
            // Don't clear email list, so user can send again easily
        }, 2000);

    } catch (error: any) {
        console.error("Erro ao enviar email:", error);
        setEmailError(error.message || "Falha ao enviar e-mail. Tente novamente.");
    } finally {
        setIsSendingEmail(false);
    }
  };

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
                    doc.save(`relatorio-otimizacao-aura-${new Date().toISOString().slice(0,10)}.pdf`);
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
  
  // Default to last 30 days
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const markdown = await AiReportService.generateAiReport(startDate, endDate);
      setReport(markdown);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao gerar relatório.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[28px] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Bot size={120} />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
            <Sparkles className="animate-pulse" />
            Relatórios Inteligentes (IA)
          </h2>
          <p className="text-indigo-100 max-w-xl text-lg">
            Gere análises estratégicas, identifique rupturas e receba recomendações de ação baseadas em dados reais do seu estoque.
          </p>
          
          <div className="mt-8 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 inline-flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-indigo-200" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-b border-indigo-300 text-white focus:outline-none focus:border-white px-2 py-1"
              />
            </div>
            <span className="text-indigo-300">até</span>
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-indigo-200" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-b border-indigo-300 text-white focus:outline-none focus:border-white px-2 py-1"
              />
            </div>
            
            <button 
              onClick={handleGenerate}
              disabled={loading}
              className="ml-4 bg-white text-indigo-600 hover:bg-indigo-50 px-6 py-2 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
              {loading ? "Analisando..." : "Gerar Relatório"}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100">
          <TriangleAlert />
          <p>{error}</p>
        </div>
      )}

      {/* Report Display */}
      {report && (
        <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-12 print:shadow-none print:border-none">
          <div className="flex justify-end mb-6 print:hidden gap-2">
            <button 
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 transition-colors bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-lg font-bold text-sm"
            >
              <Mail size={18} />
              Enviar por E-mail
            </button>
            <button 
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              {isPdfGenerating ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
              <span className="font-medium text-sm">{isPdfGenerating ? 'Gerando PDF...' : 'Baixar PDF Profissional'}</span>
            </button>
          </div>
          
          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:text-indigo-600 dark:prose-h2:text-indigo-400 prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-li:text-slate-600 dark:prose-li:text-slate-300">
            <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 uppercase tracking-widest">
            Relatório gerado por Aura IA • {new Date().toLocaleString()}
          </div>
        </div>
      )}

      {!report && !loading && !error && (
        <div className="text-center py-20 opacity-50">
          <FileText size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">Selecione o período e clique em gerar para ver a análise.</p>
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
                <h2 className="text-2xl font-bold" style={{ color: '#000000' }}>Relatório de Otimização de Estoque</h2>
                <div className="flex gap-4 mt-2 text-sm" style={{ color: '#000000' }}>
                    <span>Período: <strong style={{ color: '#000000' }}>{new Date(startDate).toLocaleDateString('pt-BR')}</strong> a <strong style={{ color: '#000000' }}>{new Date(endDate).toLocaleDateString('pt-BR')}</strong></span>
                </div>
            </div>

            <div className="prose max-w-none text-justify leading-relaxed" style={{ color: '#000000' }}>
                 <Markdown 
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
                    {report}
                 </Markdown>
            </div>
            
            <div className="mt-12 pt-6 border-t border-black flex justify-between items-center text-xs" style={{ color: '#000000', borderColor: '#000000' }}>
                <span>Documento gerado automaticamente por Aura IA</span>
                <span>Página 1</span>
            </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
    </div>
  );
};
