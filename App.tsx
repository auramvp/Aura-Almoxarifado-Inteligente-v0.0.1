import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ArrowLeftRight, BarChart3,
  Warehouse, FileUp, LogOut, Truck, Sun, Moon,
  ChevronLeft, ChevronRight, Building2, User as UserIcon,
  Loader2, AlertCircle, CheckCircle, Sparkles, Eye, EyeOff, Users,
  Mail, Lock, ShoppingCart, KeyRound, LifeBuoy, MapPin
} from 'lucide-react';
import { db } from './services/db.ts';
import { User, UserRole, Company } from './types.ts';

// Views
import Dashboard from './components/Dashboard.tsx';
import Products from './components/Products.tsx';
import Suppliers from './components/Suppliers.tsx';
import Inventory from './components/Inventory.tsx';
import Movements from './components/Movements.tsx';
import Sectors from './components/Sectors.tsx';
import Reports from './components/Reports.tsx';
import Optimization from './components/Optimization.tsx';
import ImportData from './components/ImportExport.tsx';
import Support from './components/Support.tsx';
import Purchases from './components/Purchases.tsx';
import Settings from './components/Settings.tsx';
import AuraBackground from './components/ui/AuraBackground.tsx';

const Logo = ({ collapsed, size = 'md' }: { collapsed: boolean; size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: { icon: 14, text: 'text-base', box: 'p-1 rounded-lg', sub: 'text-[6px]' },
    md: { icon: 32, text: 'text-5xl', box: 'p-3 rounded-[24px]', sub: 'text-[6.5px]' },
    lg: { icon: 36, text: 'text-6xl', box: 'p-4 rounded-[28px]', sub: 'text-[9.5px]' }
  };

  return (
    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center w-full' : ''}`}>
      {/* Icon with specific requested gradient and shadow */}
      <div className={`bg-gradient-to-br from-[#4F9EFF] to-[#3B82F6] shadow-md shadow-blue-500/20 flex items-center justify-center shrink-0 ${sizes[size].box}`}>
        <svg
          width={sizes[size].icon}
          height={sizes[size].icon}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 21.3333L16 10.6667L24 21.3333"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {!collapsed && (
        <div className="flex flex-col items-start leading-none">
          <span className={`font-black tracking-tight text-white ${sizes[size].text}`}>
            Aura
          </span>
          <span className={`font-bold uppercase tracking-tighter text-[#94A3B8] ${sizes[size].sub} mt-1 whitespace-nowrap`}>
            Almoxarifado Inteligente
          </span>
        </div>
      )}
    </div>
  );
};

const AuthScreen = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgotPassword' | 'onboarding'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);
  const [onboardingStep, setOnboardingStep] = useState(1);

  const [formData, setFormData] = useState({ name: '', email: '', password: '', accessCode: '', magicEmail: '' });
  const [registerData, setRegisterData] = useState({ name: '', email: '', password: '', confirmPassword: '', companyName: '', cnpj: '', address: '', phone: '', contactEmail: '' });

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    // 1. Check Search and Hash Params (Query)
    const searchParams = new URL(window.location.href).searchParams;
    const hashParamsFromUrl = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');

    const emailParam = searchParams.get('email') || hashParamsFromUrl.get('email');
    const flowParam = searchParams.get('flow');

    if (emailParam) {
      setAuthMode('register');
      setRegisterData(prev => ({ ...prev, email: emailParam }));
      checkSubscription(emailParam);
    } else if (flowParam === 'onboarding') {
      setAuthMode('onboarding');
      setOnboardingStep(1);
    }

    // 2. Check Auth Errors/Callbacks
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const errorCode = hashParams.get('error_code');
    const errorDesc = hashParams.get('error_description');

    if (errorCode) {
      let friendlyMessage = "Ocorreu um erro na autenticação.";

      if (errorCode === 'otp_expired') {
        friendlyMessage = "O link de acesso expirou. Por favor, solicite um novo link.";
      } else if (errorCode === 'access_denied') {
        friendlyMessage = "Acesso negado ou link inválido.";
      } else if (errorDesc) {
        friendlyMessage = errorDesc.replace(/\+/g, ' ');
      }

      setError(friendlyMessage);

      // Clean up URL hash to avoid showing the error again on refresh
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const checkSubscription = async (email: string) => {
    setLoading(true);
    try {
      const hasSub = await db.hasActiveSubscription(email);
      if (authMode === 'onboarding') {
        if (hasSub) setOnboardingStep(2);
        else setError("Nenhuma assinatura ativa encontrada para este e-mail.");
      } else {
        setRegisterStep(hasSub ? 1 : 0);
      }
    } catch (err) {
      if (authMode === 'onboarding') setError("Erro ao verificar assinatura.");
      else setRegisterStep(0);
    } finally { setLoading(false); }
  };

  const passwordStrength = useMemo(() => {
    const p = registerData.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  }, [registerData.password]);

  const strengthColor = useMemo(() => {
    if (passwordStrength <= 1) return 'bg-red-500';
    if (passwordStrength === 2) return 'bg-amber-500';
    if (passwordStrength === 3) return 'bg-blue-500';
    return 'bg-emerald-500';
  }, [passwordStrength]);

  const strengthText = useMemo(() => {
    if (passwordStrength <= 1) return 'Fraca';
    if (passwordStrength === 2) return 'Razoável';
    if (passwordStrength === 3) return 'Boa';
    return 'Forte';
  }, [passwordStrength]);

  const formatCNPJ = (v: string) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length <= 14) return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").replace(/\.-$/, '');
    return clean.slice(0, 14);
  };

  const handleCNPJBlur = async () => {
    const cleanCNPJ = registerData.cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
      setLoading(true);
      try {
        const response = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCNPJ}`);
        const data = await response.json();
        if (data && data.estabelecimento) {
          setRegisterData(prev => ({
            ...prev,
            companyName: data.razao_social || data.estabelecimento.nome_fantasia || '',
            address: `${data.estabelecimento.tipo_logradouro} ${data.estabelecimento.logradouro}, ${data.estabelecimento.numero} - ${data.estabelecimento.bairro}, ${data.estabelecimento.cidade.nome} - ${data.estabelecimento.estado.sigla}`,
            phone: data.estabelecimento.ddd1 && data.estabelecimento.telefone1 ? `(${data.estabelecimento.ddd1}) ${data.estabelecimento.telefone1}` : '',
            contactEmail: data.estabelecimento.email || ''
          }));
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMessage(null);
    try {
      await db.sendMagicLink(formData.magicEmail);
      setSuccessMessage(`Link enviado para ${formData.magicEmail}! Verifique sua caixa de entrada.`);
      setFormData(prev => ({ ...prev, magicEmail: '' }));
    } catch (err: any) { setError("Erro ao enviar link."); } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authMode === 'onboarding') {
      if (onboardingStep === 2) {
        if (registerData.password !== registerData.confirmPassword) { setError("Senhas não coincidem."); return; }
        if (passwordStrength < 3) { setError("Senha muito fraca."); return; }
        setOnboardingStep(3); setError(null);
      } else if (onboardingStep === 3) {
        setLoading(true); setError(null);
        try {
          const user = await db.register(
            { name: registerData.name, email: registerData.email, password: registerData.password },
            { cnpj: registerData.cnpj.replace(/\D/g, ''), name: registerData.companyName, address: registerData.address, email: registerData.contactEmail, phone: registerData.phone, sectorName: 'Geral', sectorResponsible: registerData.name }
          );
          onLogin(user);
        } catch (err: any) { setError("Erro ao criar conta."); } finally { setLoading(false); }
      }
    } else {
      if (registerStep === 0) return;
      if (registerStep === 1) {
        if (registerData.password !== registerData.confirmPassword) { setError("Senhas não coincidem."); return; }
        if (passwordStrength < 3) { setError("Senha muito fraca."); return; }
        setRegisterStep(2); setError(null);
      } else {
        setLoading(true); setError(null);
        try {
          const user = await db.register(
            { name: registerData.name, email: registerData.email, password: registerData.password },
            { cnpj: registerData.cnpj.replace(/\D/g, ''), name: registerData.companyName, address: registerData.address, email: registerData.contactEmail, phone: registerData.phone, sectorName: 'Geral', sectorResponsible: registerData.name }
          );
          onLogin(user);
        } catch (err: any) { setError("Erro ao criar conta."); } finally { setLoading(false); }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const user = await db.login(formData.email, formData.password);
      if (user) onLogin(user);
      else setError("Credenciais inválidas.");
    } catch (err: any) { setError("Erro ao conectar."); } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccessMessage(null); setLoading(true);
    try {
      await db.resetPassword(formData.email);
      setSuccessMessage("Instruções enviadas!");
    } catch (err: any) { setError("Erro ao recuperar."); } finally { setLoading(false); }
  };

  const inputClass = "w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <AuraBackground />

      <div className="w-full max-w-sm space-y-4 relative z-10 animate-in fade-in zoom-in duration-700">
        <div className="flex justify-center mb-1"><Logo collapsed={false} size="lg" /></div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {authMode === 'register' ? (
            <div className="p-6">
              {registerStep === 0 ? (
                <div className="text-center py-4 space-y-4">
                  <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto"><Lock size={28} /></div>
                  <h3 className="text-lg font-bold">Acesso Restrito</h3>
                  <p className="text-xs text-slate-500">Cadastro exclusivo para assinantes Aura.</p>
                  <button onClick={() => window.open('https://cakto.com.br/aura/assinar', '_blank')} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-transform active:scale-95">Assinar Agora</button>
                  <button onClick={() => setAuthMode('login')} className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest">Voltar ao Login</button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="flex justify-between items-end">
                    <h3 className="text-lg font-bold">Criar Conta</h3>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase tracking-widest">Etapa {registerStep}/2</span>
                  </div>
                  {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 flex items-center gap-2"><AlertCircle size={14} /> {error}</div>}

                  {registerStep === 1 ? (
                    <div className="space-y-3">
                      <div className="relative"><UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="Nome Completo" className={inputClass} value={registerData.name} onChange={e => setRegisterData({ ...registerData, name: e.target.value })} /></div>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          required
                          type="email"
                          placeholder="E-mail da Compra"
                          className={inputClass + (registerData.email ? " opacity-60 cursor-not-allowed" : "")}
                          value={registerData.email}
                          onChange={e => !registerData.email && setRegisterData({ ...registerData, email: e.target.value })}
                          onBlur={() => registerData.email && checkSubscription(registerData.email)}
                        />
                      </div>
                      <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="password" placeholder="Senha" className={inputClass} value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} /></div>
                      <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="password" placeholder="Confirmar Senha" className={inputClass} value={registerData.confirmPassword} onChange={e => setRegisterData({ ...registerData, confirmPassword: e.target.value })} /></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="CNPJ" className={inputClass} value={registerData.cnpj} onChange={e => setRegisterData({ ...registerData, cnpj: formatCNPJ(e.target.value) })} onBlur={handleCNPJBlur} />{loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600" size={16} />}</div>
                      <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="Empresa" className={inputClass} value={registerData.companyName} onChange={e => setRegisterData({ ...registerData, companyName: e.target.value })} /></div>
                      <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="Endereço" className={inputClass} value={registerData.address} onChange={e => setRegisterData({ ...registerData, address: e.target.value })} /></div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {registerStep === 2 && <button type="button" onClick={() => setRegisterStep(1)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all">Voltar</button>}
                    <button type="submit" disabled={loading} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">{loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : registerStep === 1 ? 'Próximo' : 'Concluir'}</button>
                  </div>
                </form>
              )}
            </div>
          ) : authMode === 'onboarding' ? (
            <div className="p-6">
              <form onSubmit={e => { e.preventDefault(); if (onboardingStep === 1) checkSubscription(registerData.email); else handleRegister(e); }} className="space-y-4">
                <div className="flex justify-between items-end">
                  <h3 className="text-lg font-bold">Configurar Acesso</h3>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase tracking-widest">Etapa {onboardingStep}/3</span>
                </div>

                {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-1"><AlertCircle size={14} /> {error}</div>}

                {onboardingStep === 1 ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl">
                      <p className="text-[10px] leading-relaxed text-blue-700 dark:text-blue-300 font-medium">
                        <span className="font-black uppercase block mb-1">Aviso Importante</span>
                        Insira o e-mail que você utilizou no momento da compra na <strong>Cakto Pay</strong>. Precisamos dele para validar sua assinatura ativa.
                      </p>
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        required
                        type="email"
                        placeholder="E-mail da Compra"
                        className={inputClass}
                        value={registerData.email}
                        onChange={e => setRegisterData({ ...registerData, email: e.target.value })}
                      />
                    </div>
                  </div>
                ) : onboardingStep === 2 ? (
                  <div className="space-y-3">
                    <div className="relative"><UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="Seu Nome Completo" className={inputClass} value={registerData.name} onChange={e => setRegisterData({ ...registerData, name: e.target.value })} /></div>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="password" placeholder="Criar Senia" className={inputClass} value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} /></div>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="password" placeholder="Confirmar Senha" className={inputClass} value={registerData.confirmPassword} onChange={e => setRegisterData({ ...registerData, confirmPassword: e.target.value })} /></div>
                    <div className="flex gap-1 px-1">
                      {[1, 2, 3, 4].map((s) => (
                        <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-500 ${s <= passwordStrength ? strengthColor : 'bg-slate-100 dark:bg-slate-800'}`} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="CNPJ da Empresa" className={inputClass} value={registerData.cnpj} onChange={e => setRegisterData({ ...registerData, cnpj: formatCNPJ(e.target.value) })} onBlur={handleCNPJBlur} />{loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600" size={16} />}</div>
                    <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="Nome Fantasia" className={inputClass} value={registerData.companyName} onChange={e => setRegisterData({ ...registerData, companyName: e.target.value })} /></div>
                    <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="Endereço Completo" className={inputClass} value={registerData.address} onChange={e => setRegisterData({ ...registerData, address: e.target.value })} /></div>
                  </div>
                )}

                <div className="flex gap-2">
                  {onboardingStep > 1 && <button type="button" onClick={() => setOnboardingStep(prev => prev - 1)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all">Voltar</button>}
                  <button type="submit" disabled={loading} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">{loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : onboardingStep < 3 ? 'Continuar' : 'Finalizar Cadastro'}</button>
                </div>
                {onboardingStep === 1 && <button type="button" onClick={() => setAuthMode('login')} className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest">Já tenho conta? Entrar</button>}
              </form>
            </div>
          ) : authMode === 'forgotPassword' ? (
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold">Recuperar Senha</h3>
              <p className="text-xs text-slate-500">Digite seu e-mail para receber o acesso.</p>
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100">{error}</div>}
              {successMessage && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold border border-emerald-100">{successMessage}</div>}
              <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="email" placeholder="Seu e-mail" className={inputClass} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              <button onClick={handleForgotPassword} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all">{loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Enviar Instruções'}</button>
              <button onClick={() => setAuthMode('login')} className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest">Voltar ao Login</button>
            </div>
          ) : (
            <div className="p-6">
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300"><AlertCircle size={14} /> {error}</div>}
              {successMessage && <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold border border-emerald-100 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300"><CheckCircle size={14} /> {successMessage}</div>}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Login Sem Senha</label>
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="email" placeholder="seu@email.com" className={inputClass} value={formData.magicEmail} onChange={e => setFormData({ ...formData, magicEmail: e.target.value })} /></div>
                </div>
                <button onClick={handleMagicLinkLogin} disabled={loading || !formData.magicEmail} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">{loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Link Mágico'}</button>

                <div className="relative py-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800" /></div><div className="relative flex justify-center text-[9px] uppercase"><span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-black tracking-widest">Ou use senha</span></div></div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="email" placeholder="E-mail" className={inputClass} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type={showPassword ? "text" : "password"} placeholder="Senha" className={inputClass} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                  <button type="submit" disabled={loading} className="w-full py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all">Entrar</button>
                </form>
              </div>

              <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setAuthMode('register')} className="w-full py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all hover:bg-blue-100">Já sou assinante: Criar Conta</button>
                <div className="flex items-center justify-between">
                  <button onClick={() => setAuthMode('forgotPassword')} className="text-slate-400 hover:text-blue-600 text-[9px] font-black uppercase tracking-widest transition-colors">Esqueci Senha</button>
                  <button onClick={() => window.open('https://auraalmoxarifado.com.br', '_blank')} className="text-slate-400 hover:text-blue-600 text-[9px] font-black uppercase tracking-widest transition-colors">Assinar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SidebarItem = ({ to, icon: Icon, label, active, onClick, collapsed }: any) => (
  <Link to={to} onClick={onClick} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600'} ${collapsed ? 'justify-center px-0' : ''}`}>
    <Icon size={18} className="shrink-0" />
    {!collapsed && <span className="font-bold text-xs tracking-tight">{label}</span>}
  </Link>
);

const CompanyCard = ({ company, collapsed, user }: { company: Company; collapsed: boolean; user: User }) => {
  const isAlmoxarife = user.role === UserRole.ALMOXARIFE;
  const content = (
    <>
      {/* Decorative background icon */}
      <div className="absolute -right-2 -bottom-1 opacity-10 rotate-12 transition-transform group-hover:scale-110 duration-500">
        <Building2 size={64} className="text-white" />
      </div>

      <div className={`w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 relative z-10`}>
        <Building2 className="text-white" size={18} />
      </div>

      {!collapsed && (
        <div className="min-w-0 flex-1 relative z-10">
          <h4 className="text-[10px] font-black text-white uppercase tracking-tighter truncate leading-tight">{company.name}</h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <span className="text-[9px] font-bold text-blue-100 uppercase tracking-widest opacity-80">Unidade Ativa</span>
          </div>
        </div>
      )}
    </>
  );

  const containerClass = `mb-4 p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-[20px] shadow-lg shadow-blue-500/20 group transition-all flex items-center gap-3 relative overflow-hidden ${collapsed ? 'justify-center p-2' : ''} ${isAlmoxarife ? 'hover:scale-[1.02] active:scale-95 cursor-pointer' : 'cursor-default'}`;

  if (isAlmoxarife) {
    return <Link to="/configuracoes" className={containerClass}>
      {content}
      {!collapsed && <ChevronRight className="text-white/60 group-hover:text-white transition-colors relative z-10" size={16} />}
    </Link>;
  }

  return <div className={containerClass}>{content}</div>;
};

const UserCard = ({ user, isDarkMode, toggleTheme, collapsed, onLogout }: any) => {
  const displayName = user.name.split(' ').slice(0, 2).join(' ');
  const displayRole = user.role === UserRole.ALMOXARIFE ? 'ALMOXARIFE' : 'AUXILIAR';

  return (
    <div className={`mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/50 space-y-4`}>
      <div className={`p-2.5 bg-slate-100/50 dark:bg-slate-800/40 rounded-[16px] border border-slate-200/50 dark:border-slate-700/30 flex items-center gap-2.5 ${collapsed ? 'justify-center p-2' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-blue-500/20 text-xs">
          {user.name.charAt(0)}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate leading-tight">
              {displayName}
            </h4>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {displayRole}
            </p>
          </div>
        )}
        {!collapsed && (
          <div className="flex items-center gap-0.5">
            <button onClick={toggleTheme} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-all">
              {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
            </button>
            <button onClick={onLogout} className="p-1 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-all">
              <LogOut size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SidebarNavigation = ({ user, setSidebarOpen, collapsed }: any) => {
  const location = useLocation();
  const isAlmoxarife = user.role === UserRole.ALMOXARIFE;

  const canAccess = (module: string) => {
    if (isAlmoxarife) return true;
    if (!user.permissions) return false;
    // @ts-ignore
    return user.permissions[module] && user.permissions[module] !== 'none';
  };

  return (
    <div className="space-y-1">
      <SidebarItem to="/" icon={LayoutDashboard} label="Visão Geral" active={location.pathname === '/'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
      {canAccess('products') && <SidebarItem to="/produtos" icon={Package} label="Produtos" active={location.pathname === '/produtos'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
      {canAccess('suppliers') && <SidebarItem to="/fornecedores" icon={Truck} label="Fornecedores" active={location.pathname === '/fornecedores'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
      {canAccess('inventory') && <SidebarItem to="/estoque" icon={Warehouse} label="Estoque" active={location.pathname === '/estoque'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
      {canAccess('movements') && <SidebarItem to="/movimentacoes" icon={ArrowLeftRight} label="Movimentações" active={location.pathname === '/movimentacoes'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
      {canAccess('sectors') && <SidebarItem to="/setores" icon={Users} label="Setores" active={location.pathname === '/setores'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
      {canAccess('purchases') && <SidebarItem to="/compras" icon={ShoppingCart} label="Compras" active={location.pathname === '/compras'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
      {canAccess('reports') && <SidebarItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
      {isAlmoxarife && (
        <>
          <SidebarItem to="/otimizacao" icon={Sparkles} label="Otimização" active={location.pathname === '/otimizacao'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
          <SidebarItem to="/importar" icon={FileUp} label="Planilhas" active={location.pathname === '/importar'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
        </>
      )}
      <SidebarItem to="/suporte" icon={LifeBuoy} label="Suporte" active={location.pathname === '/suporte'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);

  useEffect(() => {
    db.getCurrentUser().then(setUser).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.companyId) {
      db.getCompanyById(user.companyId).then(setCompany);
    }
  }, [user]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Verificação de status da empresa
  useEffect(() => {
    if (!user?.companyId || !company) return;

    const checkCompanyStatus = async () => {
      try {
        const companyStatus = await db.getCompanyById(user.companyId!);
        if (companyStatus && companyStatus.status === 'suspended') {
          setShowSuspendedModal(true);
        } else {
          setShowSuspendedModal(false);
        }
      } catch (error) {
        console.error("Erro ao verificar status da empresa:", error);
      }
    };

    checkCompanyStatus();
    const interval = setInterval(checkCompanyStatus, 60000); // Verifica a cada minuto
    return () => clearInterval(interval);
  }, [user, company]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <span className="font-bold text-slate-500 dark:text-slate-400 animate-pulse">Sincronizando AURA...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Router><AuthScreen onLogin={setUser} /></Router>;

  return (
    <Router>
      <div className={`h-screen flex bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-300 font-sans overflow-hidden`}>
        {/* Suspended Modal */}
        {showSuspendedModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-10 max-w-lg w-full text-center space-y-6 shadow-2xl border border-red-100 dark:border-red-900/30">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto animate-bounce">
                <AlertCircle size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Sistema Suspenso</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                  Ops! Identificamos uma pendência na sua assinatura. Para continuar otimizando seu almoxarifado, regularize seu acesso.
                </p>
              </div>
              <button
                onClick={() => window.open('https://cakto.com.br/aura/fatura', '_blank')}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                Regularizar Agora <ChevronRight size={20} />
              </button>
              <button
                onClick={async () => {
                  await db.logout();
                  setUser(null);
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold mx-auto text-sm transition-colors"
              >
                Sair da conta
              </button>
            </div>
          </div>
        )}

        {/* Sidebar Overlay (Mobile) */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[60] lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`fixed lg:sticky top-0 h-screen z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isCollapsed ? 'w-24' : 'w-72'} flex-shrink-0`}>
          <div className="h-full flex flex-col p-6 overflow-hidden">
            <div className={`mb-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
              <Logo collapsed={isCollapsed} />
              {!isCollapsed && (
                <button onClick={() => setIsCollapsed(true)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"><ChevronLeft size={20} /></button>
              )}
              {isCollapsed && (
                <button onClick={() => setIsCollapsed(false)} className="absolute -right-3 top-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-full text-slate-400 hover:text-blue-600 shadow-sm z-10"><ChevronRight size={14} /></button>
              )}
            </div>

            {company && <CompanyCard company={company} collapsed={isCollapsed} user={user!} />}

            <nav className="flex-1 overflow-y-auto no-scrollbar py-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <SidebarNavigation user={user} setSidebarOpen={setSidebarOpen} collapsed={isCollapsed} />
            </nav>

            <UserCard
              user={user}
              isDarkMode={isDarkMode}
              toggleTheme={() => setIsDarkMode(!isDarkMode)}
              collapsed={isCollapsed}
              onLogout={async () => { await db.logout(); setUser(null); }}
            />
          </div>
        </aside>

        {/* Mobile menu button */}
        {!isSidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg text-slate-500 hover:text-blue-600 transition-all active:scale-95"
          >
            <LayoutDashboard size={20} />
          </button>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">

          <div className="flex-1 p-8 overflow-y-auto bg-[#F8FAFC] dark:bg-slate-950">
            <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/produtos" element={<Products user={user} />} />
                <Route path="/fornecedores" element={<Suppliers user={user} />} />
                <Route path="/estoque" element={<Inventory user={user} />} />
                <Route path="/movimentacoes" element={<Movements user={user} />} />
                <Route path="/setores" element={<Sectors user={user} />} />
                <Route path="/compras" element={<Purchases user={user} />} />
                <Route path="/relatorios" element={<Reports user={user} />} />
                <Route path="/otimizacao" element={<Optimization user={user} />} />
                <Route path="/importar" element={<ImportData user={user} />} />
                <Route path="/suporte" element={<Support user={user} />} />
                <Route path="/configuracoes" element={user?.role === UserRole.ALMOXARIFE ? <Settings user={user} company={company!} /> : <Dashboard user={user} />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;