import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Building2, User as UserIcon, Mail,
    CheckCircle2, Loader2, ArrowRight, ShieldCheck,
    Building, Fingerprint, Sparkles
} from 'lucide-react';
import { db } from '../services/db';
import { UserRole } from '../types';

const PartnerRegistration: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Pre-filled data from URL
    const [partnerData] = useState({
        email: searchParams.get('email') || '',
        cnpj: searchParams.get('cnpj') || '',
        companyName: searchParams.get('name') || ''
    });

    const [formData, setFormData] = useState({
        userName: ''
    });

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setError(null);

        try {
            await db.registerPartner(
                {
                    name: formData.userName,
                    email: partnerData.email
                },
                {
                    cnpj: partnerData.cnpj,
                    name: partnerData.companyName
                }
            );
            setSuccess(true);
            setTimeout(() => navigate('/'), 3000);
        } catch (err: any) {
            console.error("Erro no registro de parceiro:", err);
            setError(err.message || "Erro ao realizar o cadastro. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-12 rounded-[40px] shadow-2xl max-w-lg w-full text-center animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20 transform rotate-12">
                        <CheckCircle2 size={40} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-4">Conta Criada!</h2>
                    <p className="text-blue-100/80 leading-relaxed mb-6 text-sm">
                        Seu cadastro foi concluído. Acabamos de enviar um <span className="font-bold text-white text-base block my-2 text-blue-400">Link Mágico de Acesso</span> para o seu e-mail corporativo.
                    </p>
                    <p className="text-blue-100/60 text-xs mb-8">
                        Verifique sua caixa de entrada (e spam) e clique no botão para entrar na Aura agora mesmo.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-white/10"
                    >
                        Voltar para o Início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] -z-10" />

            <div className="max-w-3xl w-full grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">

                {/* Left Side: Info */}
                <div className="p-6 lg:p-10 bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex flex-col justify-between text-white relative">
                    <div className="absolute inset-0 bg-blue-600/5 mix-blend-overlay" />

                    <div className="relative z-10">
                        {/* New Logo Implementation */}
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-blue-500 rounded-[18px] flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M18 15L12 9L6 15" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-4xl font-black tracking-tight leading-none text-white">Aura</span>
                                <span className="text-[9px] font-bold tracking-[0.1em] text-blue-400 mt-1 uppercase">Almoxarifado Inteligente</span>
                            </div>
                        </div>

                        <h1 className="text-2xl lg:text-3xl font-black leading-tight mb-4 text-white">
                            Olá <span className="text-blue-400">{partnerData.companyName || 'Parceiro'}</span>,
                        </h1>

                        <p className="text-slate-100 text-base font-medium leading-relaxed mb-4">
                            Você foi selecionado para participar do <span className="font-black text-white px-2 py-0.5 bg-blue-500/20 rounded-md">Partners</span>, nosso programa de parceiros exclusivos.
                        </p>

                        <p className="text-slate-400 text-sm leading-relaxed mb-8">
                            Crie sua conta e acesse agora mesmo a <br /><span className="font-bold text-white">Aura Almoxarifado Inteligente</span>.
                        </p>

                        <div className="space-y-3">
                            {[
                                { icon: ShieldCheck, text: "Segurança de dados Enterprise" },
                                { icon: Building, text: "Gestão multi-unidades" },
                                { icon: Sparkles, text: "IA para Otimização de Estoque" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 group">
                                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center group-hover:bg-white/10 transition-colors border border-white/5">
                                        <item.icon size={16} className="text-blue-400" />
                                    </div>
                                    <span className="font-bold text-xs tracking-wide text-slate-300">{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative z-10 mt-8 pt-4 border-t border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-[2px]">
                        Aura &copy; 2026
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="p-6 lg:p-10 flex flex-col justify-center bg-slate-900/40 backdrop-blur-3xl">
                    <div className="mb-6 text-center lg:text-left">
                        <h2 className="text-xl font-black text-white mb-1 uppercase tracking-widest flex items-center gap-3">
                            Finalizar Cadastro
                            <div className="h-px flex-1 bg-white/10" />
                        </h2>
                        <p className="text-slate-400 font-bold text-[11px]">Crie sua conta administrativa para começar.</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2 animate-in shake-in duration-300">
                            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">!</div>
                            <p className="font-bold">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-blue-400 uppercase tracking-[2px] ml-1">Dados Pré-preenchidos</label>
                            <div className="grid grid-cols-1 gap-2 p-3 bg-white/5 border border-white/10 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <Building2 size={14} className="text-blue-500" />
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">Empresa:</p>
                                        <p className="text-white font-bold text-[11px]">{partnerData.companyName || '---'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Fingerprint size={14} className="text-blue-500" />
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">CNPJ:</p>
                                        <p className="text-white font-mono text-[11px]">{partnerData.cnpj || '---'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Mail size={14} className="text-blue-500" />
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">E-mail:</p>
                                        <p className="text-white font-bold text-[11px] truncate max-w-[150px]">{partnerData.email || '---'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-1">
                            <label className="text-[9px] font-black text-blue-400 uppercase tracking-[2px] ml-1">Informações de Acesso</label>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <UserIcon size={16} className="text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    required
                                    type="text"
                                    placeholder="Seu Nome Completo"
                                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600 font-bold text-xs"
                                    value={formData.userName}
                                    onChange={e => setFormData({ ...formData, userName: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[11px] uppercase tracking-[3px] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>Processando...</span>
                                </>
                            ) : (
                                <>
                                    <span>Criar Minha Conta</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PartnerRegistration;
