
import React, { useState, useEffect } from 'react';
import {
    HelpCircle, MessageSquare, Ticket, History,
    ChevronDown, ChevronUp, ChevronRight, Send, User, Bot,
    Sparkles, Loader2, LifeBuoy, ExternalLink, X
} from 'lucide-react';
import { db } from '../services/db';
import { SupportTicket } from '../types';

const FAQ_DATA = [
    {
        question: "Como faço para importar dados de uma planilha?",
        answer: "Vá ao menu 'Planilhas', selecione 'Importar Dados' e carregue seu arquivo .xlsx ou .csv. Certifique-se de que as colunas correspondem ao modelo da Aura."
    },
    {
        question: "Como a Aura calcula a sugestão de reestocagem?",
        answer: "O cálculo é baseado no consumo médio dos últimos 30 dias multiplicado por um fator de segurança (1.5x) para evitar rupturas de estoque."
    },
    {
        question: "O que é o indicador de 'Capital Imobilizado'?",
        answer: "Representa o valor total em dinheiro parado em produtos que possuem um giro muito baixo (< 0.2x nos últimos 30 dias)."
    },
    {
        question: "Como configurar o estoque mínimo manualmente?",
        answer: "Na aba 'Produtos', clique para editar um item e ajuste o campo 'Estoque Mínimo'. A Aura usará esse valor como base para alertas se for maior que a sugestão da IA."
    }
];

const Support = ({ user }: any) => {
    const [activeTab, setActiveTab] = useState<'faq' | 'chat' | 'tickets' | 'history'>('faq');
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    // Chat State
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'bot', text: string }>>([
        { role: 'bot', text: `Olá ${user?.name.split(' ')[0]}, eu sou a AURA IA! Como posso ajudar você hoje com a gestão do seu almoxarifado?` }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Tickets State
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoadingTickets, setIsLoadingTickets] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [messageInput, setMessageInput] = useState('');

    useEffect(() => {
        loadTickets();
    }, []);

    const loadTickets = async () => {
        setIsLoadingTickets(true);
        try {
            const data = await db.getSupportTickets();
            setTickets(data);
        } catch (err) {
            console.error("Erro ao carregar tickets:", err);
        } finally {
            setIsLoadingTickets(false);
        }
    };

    const handleSubmitTicket = async () => {
        if (!messageInput.trim()) return;

        setIsSubmitting(true);
        try {
            await db.createSupportTicket(messageInput);
            setMessageInput('');
            setActiveTab('history');
            await loadTickets();
        } catch (err) {
            console.error("Erro ao enviar ticket:", err);
            alert("Erro ao enviar chamado. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsTyping(true);

        // Simulate AI response logic
        setTimeout(() => {
            let response = "Entendi sua dúvida. Estou analisando seus dados de estoque para te dar a melhor resposta...";
            if (userMsg.toLowerCase().includes('estoque')) {
                response = "Para ver seu estoque atual, vá ao menu 'Estoque'. Lá você pode filtrar por setor ou categoria.";
            } else if (userMsg.toLowerCase().includes('ajuda') || userMsg.toLowerCase().includes('suporte')) {
                response = "Você pode abrir um ticket de suporte clicando na aba 'Pedir Suporte' aqui em cima, ou falar comigo sobre funcionalidades específicas.";
            }

            setMessages(prev => [...prev, { role: 'bot', text: response }]);
            setIsTyping(false);
        }, 1500);
    };

    return (
        <div className="flex flex-col space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                        <LifeBuoy size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Central de Suporte</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Olá, como podemos ajudar você hoje?</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('faq')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'faq' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <HelpCircle size={16} /> FAQ
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Sparkles size={16} /> Falar com AURA IA
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'tickets' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Ticket size={16} /> Pedir Suporte
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={16} /> Histórico
                    </button>
                </div>
            </header>

            <main className="min-h-[500px]">
                {activeTab === 'faq' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 px-2">Dúvidas Frequentes</h3>
                            {FAQ_DATA.map((item, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{item.question}</span>
                                        {openFaq === idx ? <ChevronUp size={20} className="text-indigo-600" /> : <ChevronDown size={20} className="text-slate-400" />}
                                    </button>
                                    {openFaq === idx && (
                                        <div className="p-5 pt-0 text-sm text-slate-600 dark:text-slate-400 leading-relaxed animate-in slide-in-from-top-2">
                                            {item.answer}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-6">
                            <div className="bg-indigo-600 rounded-[28px] p-6 text-white shadow-xl shadow-indigo-500/20">
                                <h4 className="font-bold text-lg mb-2">Ainda com dúvida?</h4>
                                <p className="text-indigo-100 text-sm mb-6 leading-relaxed">Nossa equipe de especialistas está pronta para ajudar você a tirar o máximo da Aura.</p>
                                <button
                                    onClick={() => setActiveTab('tickets')}
                                    className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all shadow-lg"
                                >
                                    <Ticket size={18} /> Abrir Ticket Agora
                                </button>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                    <ExternalLink size={18} className="text-indigo-600" /> Links Úteis
                                </h4>
                                <div className="space-y-3">
                                    <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-600 dark:text-slate-400 border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                        Documentação Completa <ChevronRight size={14} />
                                    </a>
                                    <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-600 dark:text-slate-400 border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                        Tutoriais em Vídeo <ChevronRight size={14} />
                                    </a>
                                    <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-600 dark:text-slate-400 border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                        Comunidade Aura <ChevronRight size={14} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-[600px] animate-in zoom-in-95 duration-500">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                    <Bot size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100">AURA IA - Assistente Virtual</h3>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> online agora
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveTab('faq')}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title="Fechar Chat"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-${msg.role === 'user' ? 'right' : 'left'}-4 duration-300`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-200/50 dark:border-slate-700/50'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start animate-in fade-in duration-300">
                                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200/50 dark:border-slate-700/50 flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Digite sua dúvida aqui..."
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!input.trim()}
                                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tickets' && (
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm p-8 max-w-2xl mx-auto animate-in zoom-in-95 duration-500 relative">
                        <button
                            onClick={() => setActiveTab('faq')}
                            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title="Fechar Suporte"
                        >
                            <X size={20} />
                        </button>
                        <div className="text-center mb-8">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Precisa de suporte especializado?</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Abra um chamado e nossa equipe retornará em até 24h úteis.</p>
                        </div>

                        <form className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Seu Nome</label>
                                <input type="text" readOnly value={user?.name} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-500 focus:outline-none" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Mensagem de Suporte</label>
                                <textarea
                                    rows={6}
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder="Descreva como podemos ajudar você hoje..."
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                ></textarea>
                            </div>

                            <button
                                type="button"
                                onClick={handleSubmitTicket}
                                disabled={isSubmitting || !messageInput.trim()}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" /> Enviando...
                                    </>
                                ) : (
                                    'Enviar Chamado para Análise'
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-500">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Protocolo</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Mensagem</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Data</th>
                                    <th className="px-6 py-4 text-center"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {isLoadingTickets ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                                            Carregando seus chamados...
                                        </td>
                                    </tr>
                                ) : tickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            Nenhum chamado encontrado.
                                        </td>
                                    </tr>
                                ) : tickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group">
                                        <td className="px-6 py-4 text-xs font-black text-slate-800 dark:text-slate-100 uppercase truncate max-w-[100px]">{ticket.id.split('-')[0]}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 truncate max-w-[300px]">{ticket.description}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${ticket.status === 'Resolvido'
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
                                                : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 animate-pulse'
                                                }`}>
                                                {ticket.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-xs font-bold text-slate-400">
                                            {new Date(ticket.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                                                <ChevronRight size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Support;
