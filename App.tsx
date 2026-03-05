import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ArrowLeftRight, BarChart3,
  Warehouse, FileUp, LogOut, Truck, Sun, Moon,
  ChevronLeft, ChevronRight, Building2, User as UserIcon,
  Loader2, AlertCircle, CheckCircle, Sparkles, Eye, EyeOff, Users,
  Mail, Lock, ShoppingCart, KeyRound, LifeBuoy, MapPin
} from 'lucide-react';
import { db, supabase, MODULE_MAPPING } from './services/db.ts';
import { User, UserRole, Company, Subscription } from './types.ts';

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
import PartnerRegistration from './components/PartnerRegistration.tsx';
import WarehouseRegistration from './components/WarehouseRegistration.tsx';
import AuraBackground from './components/ui/AuraBackground.tsx';
import CompanySuspendedModal from './components/CompanySuspendedModal.tsx';
import { SystemModule } from './services/db.ts';

const FeatureGate = ({ module, companyId, children, fallback = null }: { module: SystemModule; companyId: string; children: React.ReactNode; fallback?: React.ReactNode }) => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    db.canAccessModule(companyId, module).then(setHasAccess);
  }, [module, companyId]);

  if (hasAccess === null) return null; // Or a small loader
  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

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

declare global {
  interface Window {
    turnstile: any;
  }
}

const TurnstileWidget = ({ onVerify, onExpire, siteKey }: { onVerify: (token: string) => void, onExpire: () => void, siteKey: string }) => {
  const widgetRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (window.turnstile && widgetRef.current) {
      const widgetId = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': onExpire,
        theme: 'dark',
      });

      return () => {
        if (window.turnstile && widgetId) {
          window.turnstile.remove(widgetId);
        }
      };
    }
  }, [siteKey]);

  return <div ref={widgetRef} className="flex justify-center my-4" />;
};

const AuthScreen = ({ onLogin, initialMode = 'login', onPasswordUpdated }: { onLogin: (user: User) => void, initialMode?: 'login' | 'register' | 'forgotPassword' | 'onboarding' | 'updatePassword', onPasswordUpdated?: () => void }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgotPassword' | 'onboarding' | 'updatePassword'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const TURNSTILE_SITE_KEY = "0x4AAAAAACaSmlBs51Op_RRa";

  const [formData, setFormData] = useState({ name: '', email: '', password: '', accessCode: '' });
  const [registerData, setRegisterData] = useState({ name: '', email: '', password: '', confirmPassword: '', companyName: '', cnpj: '', address: '', phone: '', contactEmail: '' });

  const [emailFromUrl, setEmailFromUrl] = useState(false);
  const [cnpjFromUrl, setCnpjFromUrl] = useState(false);
  const [planFromUrl, setPlanFromUrl] = useState<string | null>(null);
  const [warehouseInvitationId, setWarehouseInvitationId] = useState<string | null>(null);
  const [isWarehouseInvitation, setIsWarehouseInvitation] = useState(false);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Função para buscar dados do CNPJ
  const fetchCNPJData = async (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
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
      } catch (err) { console.error('Erro ao buscar CNPJ:', err); }
    }
  };

  useEffect(() => {
    // 1. Check Search and Hash Params (Query)
    const searchParams = new URL(window.location.href).searchParams;
    const hashParamsFromUrl = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');

    const emailParam = searchParams.get('email') || hashParamsFromUrl.get('email');
    const flowParam = searchParams.get('flow') || hashParamsFromUrl.get('flow');
    const cnpjParam = searchParams.get('cnpj') || hashParamsFromUrl.get('cnpj');
    const nameParam = searchParams.get('name') || hashParamsFromUrl.get('name');
    const planParam = searchParams.get('plan') || hashParamsFromUrl.get('plan');

    if (planParam === 'free') {
      setPlanFromUrl('free');
    }

    if (emailParam) {
      setAuthMode('register');
      setRegisterData(prev => ({
        ...prev,
        email: emailParam,
        name: nameParam || prev.name
      }));
      setEmailFromUrl(true);
      checkSubscription(emailParam);

      // Se CNPJ também foi fornecido, pré-preencher e buscar dados
      if (cnpjParam) {
        const formattedCNPJ = cnpjParam.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        setRegisterData(prev => ({ ...prev, cnpj: formattedCNPJ }));
        setCnpjFromUrl(true);
        fetchCNPJData(cnpjParam);
      }
    } else if (flowParam === 'register') {
      setAuthMode('register');
      setRegisterStep(1); // Forçar etapa 1 se for plano gratuito ou via link direto
    } else if (flowParam === 'onboarding') {
      setAuthMode('onboarding');
      setOnboardingStep(1);

      // Se CNPJ foi fornecido no onboarding, pré-preencher
      if (cnpjParam) {
        const formattedCNPJ = cnpjParam.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        setRegisterData(prev => ({ ...prev, cnpj: formattedCNPJ }));
        setCnpjFromUrl(true);
        fetchCNPJData(cnpjParam);
      }
    }

    // Check for Warehouse Invitation
    const invitationId = searchParams.get('invitationId') || hashParamsFromUrl.get('invitationId');
    const type = searchParams.get('type') || hashParamsFromUrl.get('type');

    if (type === 'warehouse' && invitationId) {
      setAuthMode('onboarding');
      setIsWarehouseInvitation(true);
      setWarehouseInvitationId(invitationId);
      setOnboardingStep(2); // Jump to credentials step
    }

    // 2. Check Auth Errors/Callbacks
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const errorCode = hashParams.get('error_code');
    const errorDesc = hashParams.get('error_description');

    if (errorCode) {
      let friendlyMessage = "Ocorreu um erro na autenticação.";

      if (errorCode === 'otp_expired') {
        friendlyMessage = "O link de acesso expirou. Isso pode acontecer se o link já foi usado ou se seu antivírus de e-mail clicou nele automaticamente. Por favor, solicite um novo link e abra-o imediatamente.";
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
    if (planFromUrl === 'free') {
      if (authMode === 'onboarding') {
        setOnboardingStep(2);
      } else {
        setRegisterStep(1);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await db.validateAsaasSubscription(email);
      if (authMode === 'onboarding') {
        if (result.valid) {
          setOnboardingStep(2);
          if (result.status === 'TRIAL') {
            setSuccessMessage('Período trial de 7 dias ativo!');
          }
        } else {
          setError(result.message || 'Nenhuma assinatura ativa encontrada.');
        }
      } else {
        if (result.valid) {
          setRegisterStep(1);
        } else {
          setError(result.message || 'Nenhuma assinatura ativa encontrada.');
          setRegisterStep(0);
        }
      }
    } catch (err) {
      if (authMode === 'onboarding') setError('Erro ao verificar assinatura.');
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


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authMode === 'onboarding') {
      if (onboardingStep === 1) {
        if (!turnstileToken) { setError("Por favor, complete a verificação de segurança."); return; }
        setLoading(true); setError(null);
        try {
          const { data, error: vError } = await supabase.functions.invoke('verify-turnstile', {
            body: { token: turnstileToken }
          });
          if (vError || !data.success) { setError("Verificação de segurança falhou."); return; }
          checkSubscription(registerData.email);
        } catch (err) { setError("Erro de verificação."); } finally { setLoading(false); }
        return;
      }
      if (onboardingStep === 2) {
        if (registerData.password !== registerData.confirmPassword) { setError("Senhas não coincidem."); return; }
        if (passwordStrength < 3) { setError("Senha muito fraca."); return; }

        if (isWarehouseInvitation) {
          // Finish for warehouse invitation
          setLoading(true); setError(null);
          try {
            await db.registerWarehouseAdmin(
              { name: registerData.name, email: registerData.email, password: registerData.password },
              warehouseInvitationId!
            );
            setAuthMode('login');
            setSuccessMessage("Conta criada com sucesso! Você já pode entrar.");
          } catch (err: any) {
            setError(err.message || "Erro ao criar conta de almoxarifado.");
          } finally { setLoading(false); }
        } else {
          setOnboardingStep(3);
          setError(null);
        }
      } else if (onboardingStep === 3) {
        setOnboardingStep(4);
        setError(null);
      } else if (onboardingStep === 4) {
        setLoading(true); setError(null);
        try {
          await db.register(
            { name: registerData.name, email: registerData.email, password: registerData.password },
            {
              cnpj: registerData.cnpj.replace(/\D/g, ''),
              name: registerData.companyName,
              address: registerData.address,
              email: registerData.contactEmail,
              phone: registerData.phone,
              sectorName: 'Geral',
              sectorResponsible: registerData.name,
              plan_id: planFromUrl === 'free' ? '0637157e-b929-4c3b-8c47-c47502e27c87' : null
            }
          );
          setAuthMode('login');
          setSuccessMessage("Conta criada com sucesso! Faça login para começar.");
        } catch (err: any) {
          console.error('Erro no registro:', err);
          setError(err.message || "Erro ao criar conta.");
        } finally { setLoading(false); }
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
            {
              cnpj: registerData.cnpj.replace(/\D/g, ''),
              name: registerData.companyName,
              address: registerData.address,
              email: registerData.contactEmail,
              phone: registerData.phone,
              sectorName: 'Geral',
              sectorResponsible: registerData.name,
              plan_id: planFromUrl === 'free' ? '0637157e-b929-4c3b-8c47-c47502e27c87' : null
            }
          );
          onLogin(user);
        } catch (err: any) {
          console.error('Erro no registro:', err);
          setError(err.message || "Erro ao criar conta.");
        } finally { setLoading(false); }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) { setError("Por favor, complete a verificação de segurança."); return; }
    setError(null); setLoading(true);
    try {
      const user = await db.login(formData.email, formData.password, turnstileToken);
      if (user) {
        onLogin(user);
      } else {
        setError("Perfil de usuário não encontrado. Verifique seu e-mail ou entre em contato com o suporte.");
        if (window.turnstile) window.turnstile.reset();
        setTurnstileToken(null);
      }
    } catch (err: any) {
      console.error("Erro detalhado no login:", err);
      let msg = "Erro ao conectar. Tente novamente.";

      if (err.message === 'Invalid login credentials') {
        msg = "E-mail ou senha incorretos.";
      } else if (err.message) {
        msg = err.message;
      }

      setError(msg);
      if (window.turnstile) window.turnstile.reset();
      setTurnstileToken(null);
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) { setError("Por favor, complete a verificação de segurança."); return; }
    setError(null); setSuccessMessage(null); setLoading(true);
    try {
      await db.resetPassword(formData.email, turnstileToken);
      setSuccessMessage("Instruções enviadas! Verifique sua caixa de entrada e SPAM.");
      if (window.turnstile) window.turnstile.reset();
      setTurnstileToken(null);
    } catch (err: any) { setError("Erro ao recuperar."); } finally { setLoading(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) { setError("Senhas não coincidem."); return; }
    if (passwordStrength < 3) { setError("Senha muito fraca. Use letras maiúsculas, números e símbolos."); return; }
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: registerData.password });
      if (error) throw error;
      setSuccessMessage("Senha alterada com sucesso! Agora você pode entrar.");
      setAuthMode('login');
      if (onPasswordUpdated) onPasswordUpdated();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar senha.");
    } finally { setLoading(false); }
  };

  const inputClass = "w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <AuraBackground />

      <div className={`w-full ${authMode === 'onboarding' ? 'max-w-4xl' : 'max-w-sm'} space-y-4 relative z-10 animate-in fade-in zoom-in duration-700`}>
        <div className="flex justify-center mb-1"><Logo collapsed={false} size="lg" /></div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {authMode === 'register' ? (
            <div className="p-6">
              {registerStep === 0 ? (
                <div className="text-center py-4 space-y-4">
                  <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto"><Lock size={28} /></div>
                  <h3 className="text-lg font-bold">Acesso Restrito</h3>
                  <p className="text-xs text-slate-500">Cadastro exclusivo para assinantes Aura.</p>
                  <button onClick={() => window.open('https://asaas.com/c/aura-assinar', '_blank')} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-transform active:scale-95">Assinar Agora</button>
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
                          readOnly={emailFromUrl}
                          className={inputClass + (emailFromUrl ? " opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-700" : "")}
                          value={registerData.email}
                          onChange={e => !emailFromUrl && setRegisterData({ ...registerData, email: e.target.value })}
                          onBlur={() => registerData.email && !emailFromUrl && checkSubscription(registerData.email)}
                        />
                      </div>
                      <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="password" placeholder="Senha" className={inputClass} value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} /></div>
                      <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="password" placeholder="Confirmar Senha" className={inputClass} value={registerData.confirmPassword} onChange={e => setRegisterData({ ...registerData, confirmPassword: e.target.value })} /></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input required type="text" placeholder="CNPJ" readOnly={cnpjFromUrl} className={inputClass} value={registerData.cnpj} onChange={e => !cnpjFromUrl && setRegisterData({ ...registerData, cnpj: formatCNPJ(e.target.value) })} onBlur={() => !cnpjFromUrl && handleCNPJBlur()} />
                      </div>
                      <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="text" placeholder="Empresa" className={inputClass} value={registerData.companyName} onChange={e => setRegisterData({ ...registerData, companyName: e.target.value })} /></div>
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
            <div className="flex flex-col lg:flex-row min-h-[500px]">
              {/* Sidebar de Instruções */}
              <div className="lg:w-1/3 bg-blue-600 p-8 text-white hidden lg:flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-2xl font-black uppercase leading-tight mb-6">Comece sua jornada com a Aura</h3>

                  <div className="space-y-6">
                    {[
                      { step: 1, title: 'Validação', desc: 'Verificamos seu e-mail de acesso.' },
                      { step: 2, title: 'Perfil', desc: 'Sua identificação e senha pessoal.' },
                      { step: 3, title: 'Empresa', desc: 'Dados fundamentais do seu almoxarifado.' },
                      { step: 4, title: 'Revisão', desc: 'Confira os dados antes de finalizar.' }
                    ].map((s) => (
                      <div key={s.step} className={`flex gap-4 transition-all duration-500 ${onboardingStep === s.step ? 'opacity-100 scale-105' : 'opacity-40 scale-95'}`}>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-sm shrink-0 ${onboardingStep === s.step ? 'bg-white text-blue-600 border-white' : 'border-white/40 text-white'}`}>
                          {onboardingStep > s.step ? '✓' : s.step}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-xs uppercase tracking-widest leading-none mb-1">{s.title}</p>
                          <p className="text-[10px] font-medium text-blue-100 leading-tight">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/20">
                  <p className="text-[9px] font-bold uppercase tracking-[2px] opacity-60">Passo a passo exclusivo</p>
                </div>
              </div>

              {/* Área do Formulário */}
              <div className="flex-1 p-6 lg:p-10 bg-white dark:bg-slate-900 flex flex-col justify-center">
                <form onSubmit={e => handleRegister(e)} className="space-y-4">
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                      {onboardingStep === 4 ? 'Revisão dos Dados' : 'Configurar Acesso'}
                    </h3>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest leading-none">Etapa {onboardingStep}/4</span>
                  </div>

                  {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 flex items-center gap-2 mb-4 animate-in shake-in duration-300"><AlertCircle size={14} /> {error}</div>}

                  {onboardingStep === 1 ? (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl">
                        <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-300 font-bold">Olá! {planFromUrl === 'free' ? 'Você está iniciando no Plano Gratuito.' : 'Use o e-mail da sua compra para validar seu acesso.'}</p>
                      </div>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input required type="email" placeholder="E-mail de Cadastro" className={inputClass} value={registerData.email} onChange={e => setRegisterData({ ...registerData, email: e.target.value })} />
                      </div>
                      <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
                    </div>
                  ) : onboardingStep === 2 ? (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                      <div className="relative"><UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required type="text" placeholder="Seu Nome Completo" className={inputClass} value={registerData.name} onChange={e => setRegisterData({ ...registerData, name: e.target.value })} /></div>
                      <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required type="password" placeholder="Crie uma Senha Forte" className={inputClass} value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} /></div>
                      <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required type="password" placeholder="Confirme sua Senha" className={inputClass} value={registerData.confirmPassword} onChange={e => setRegisterData({ ...registerData, confirmPassword: e.target.value })} /></div>
                      <div className="flex gap-1.5 px-2">
                        {[1, 2, 3, 4].map((s) => (
                          <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= passwordStrength ? strengthColor : 'bg-slate-100 dark:bg-slate-800'}`} />
                        ))}
                      </div>
                    </div>
                  ) : onboardingStep === 3 ? (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                      <div className="relative"><Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required type="text" placeholder="CNPJ da Empresa" readOnly={cnpjFromUrl} className={inputClass} value={registerData.cnpj} onChange={e => !cnpjFromUrl && setRegisterData({ ...registerData, cnpj: formatCNPJ(e.target.value) })} onBlur={() => !cnpjFromUrl && handleCNPJBlur()} /></div>
                      <div className="relative"><Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required type="text" placeholder="Nome Fantasia / Razão Social" className={inputClass} value={registerData.companyName} onChange={e => setRegisterData({ ...registerData, companyName: e.target.value })} /></div>
                      <div className="relative"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required type="text" placeholder="Endereço (opcional)" className={inputClass} value={registerData.address} onChange={e => setRegisterData({ ...registerData, address: e.target.value })} /></div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{registerData.name}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">E-mail</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{registerData.email}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 col-span-2">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Empresa</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{registerData.companyName}</p>
                          <p className="text-[10px] text-slate-500 mt-1 font-mono">{registerData.cnpj}</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50 col-span-2">
                          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Plano Selecionado</p>
                          <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">{planFromUrl === 'free' ? 'Plano Gratuito' : 'Plano Assinado'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-6">
                    {onboardingStep > 1 && <button type="button" onClick={() => setOnboardingStep(prev => prev - 1)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95">Voltar</button>}
                    <button type="submit" disabled={loading} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                      {loading ? <Loader2 className="animate-spin" size={18} /> : (onboardingStep < 4 ? 'Continuar' : 'Finalizar e Acessar')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : authMode === 'forgotPassword' ? (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><Mail size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold">Recuperar Senha</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Acesso por e-mail</p>
                </div>
              </div>
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 flex items-center gap-2"><AlertCircle size={14} /> {error}</div>}
              {successMessage && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold border border-emerald-100 flex items-center gap-2"><CheckCircle size={14} /> {successMessage}</div>}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="email" placeholder="Seu e-mail" className={inputClass} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 transition-all">{loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Enviar Instruções'}</button>
                <button type="button" onClick={() => setAuthMode('login')} className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest">Voltar ao Login</button>
              </form>
            </div>
          ) : authMode === 'updatePassword' ? (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><KeyRound size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold">Nova Senha</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Defina seu novo acesso</p>
                </div>
              </div>
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 flex items-center gap-2"><AlertCircle size={14} /> {error}</div>}
              {successMessage && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold border border-emerald-100 flex items-center gap-2"><CheckCircle size={14} /> {successMessage}</div>}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="password" placeholder="Nova Senha" className={inputClass} value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} /></div>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="password" placeholder="Confirmar" className={inputClass} value={registerData.confirmPassword} onChange={e => setRegisterData({ ...registerData, confirmPassword: e.target.value })} /></div>
                  <div className="flex gap-1 px-1">
                    {[1, 2, 3, 4].map((s) => (
                      <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-500 ${s <= passwordStrength ? strengthColor : 'bg-slate-100 dark:bg-slate-800'}`} />
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 transition-all">{loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Salvar Senha'}</button>
              </form>
            </div>
          ) : (
            <div className="p-6">
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 flex items-center gap-2"><AlertCircle size={14} /> {error}</div>}
              {successMessage && <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold border border-emerald-100 flex items-center gap-2"><CheckCircle size={14} /> {successMessage}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="email" placeholder="seu@email.com" className={inputClass} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input required type={showPassword ? "text" : "password"} placeholder="Sua senha" className={inputClass} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </div>

                <div className="text-center">
                  <button type="button" onClick={() => setAuthMode('forgotPassword')} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest">Esqueci minha senha</button>
                </div>

                <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />

                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 transition-all">
                  {loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Entrar'}
                </button>
              </form>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => window.open('https://auraalmoxarifado.com.br', '_blank')} className="w-full py-2 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Ainda não tem acesso? Assinar Agora</button>
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
  const [parentName, setParentName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (company.parentId) {
      db.getCompanyById(company.parentId).then(c => setParentName(c?.name || null));
    } else {
      setParentName(null);
    }
  }, [company]);

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
          <h4 className="text-[10px] font-black text-white uppercase tracking-tighter truncate leading-tight">
            {parentName || company.name}
          </h4>
          <div className="flex flex-col mt-0.5">
            {parentName && (
              <span className="text-[9px] font-medium text-blue-100/70 truncate leading-tight italic">
                {company.name}
              </span>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              <span className="text-[8px] font-bold text-blue-100 uppercase tracking-widest opacity-80">
                {parentName ? 'Unidade Ativa' : 'Matriz Ativa'}
              </span>
            </div>
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

  const [access, setAccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user?.companyId) {
      const modules: SystemModule[] = ['inventory', 'reports', 'ai', 'purchases', 'sectors', 'suppliers', 'support', 'units'];
      Promise.all(modules.map(m => db.canAccessModule(user.companyId, m)))
        .then(results => {
          const newAccess: Record<string, boolean> = {};
          modules.forEach((m, i) => { newAccess[m] = results[i]; });
          setAccess(newAccess);
        });
    }
  }, [user]);

  const canAccess = (module: string) => {
    // 1. Permission-based check (Role/Permissions)
    let hasPermission = false;
    if (isAlmoxarife) hasPermission = true;
    else if (user.permissions) {
      // @ts-ignore
      hasPermission = user.permissions[module] && user.permissions[module] !== 'none';
    }

    const planModule = module === 'products' ? 'inventory' : (module as SystemModule);
    return hasPermission && (access[planModule] ?? true);
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
          {canAccess('ai') && <SidebarItem to="/otimizacao" icon={Sparkles} label="Otimização" active={location.pathname === '/otimizacao'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
          <SidebarItem to="/importar" icon={FileUp} label="Planilhas" active={location.pathname === '/importar'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
        </>
      )}
      {canAccess('support') && <SidebarItem to="/suporte" icon={LifeBuoy} label="Suporte" active={location.pathname === '/suporte'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />}
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('aura_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && parsed.companyId) return parsed;
      } catch (e) {
        localStorage.removeItem('aura_user');
      }
    }
    return null;
  });
  const [company, setCompany] = useState<Company | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(!localStorage.getItem('aura_user'));
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    // Timeout de segurança: se o Supabase não responder em 6s, libera a tela
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Safety timeout: auth state did not resolve in 6s. Unblocking UI.");
        setLoading(false);
      }
    }, 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' && session?.user) {
          const isOnPartnerRegisterPage = window.location.hash.includes('/registro-parceiro');
          if (isOnPartnerRegisterPage) {
            setLoading(false);
            return;
          }

          // Se o usuário atual já for o mesmo da sessão (login manual), evitamos buscar de novo
          if (user?.id === session.user.id) {
            setLoading(false);
            return;
          }

          const currentUser = await db.getCurrentUser(session.user);
          if (currentUser) setUser(currentUser);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setCompany(null);
          localStorage.removeItem('aura_user');
        } else if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            const currentUser = await db.getCurrentUser(session.user);
            if (currentUser) setUser(currentUser);
          }
        } else if (event === 'PASSWORD_RECOVERY') {
          // Quando o usuário volta do e-mail de recuperação, o Supabase emite este evento.
          // O usuário está logado temporariamente para mudar a senha.
          setRecoveryMode(true);
          setLoading(false);
          return; // Não queremos processar o perfil agora, forçamos a troca de senha
        }
      } catch (err) {
        console.error("Erro na sincronização de autenticação:", err);
      } finally {
        // Sempre liberar o loading após tentar resolver o estado inicial
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
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
        if (companyStatus && companyStatus.status === 'Suspenso') {
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

  // Verificar se é a rota de registro de parceiro ANTES do loading
  // para não bloquear usuários acessando o link de convite
  const isPartnerRoute = window.location.hash.includes('/registro-parceiro');
  const isWarehouseRoute = window.location.hash.includes('/registro-unidade');

  if (loading && !isPartnerRoute && !isWarehouseRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <span className="font-bold text-slate-500 dark:text-slate-400 animate-pulse">Sincronizando AURA...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {!user || recoveryMode ? (
        <Routes>
          <Route path="/registro-parceiro" element={<PartnerRegistration />} />
          <Route path="/registro-unidade" element={<WarehouseRegistration />} />
          <Route path="*" element={
            <AuthScreen
              onLogin={setUser}
              initialMode={recoveryMode ? 'updatePassword' : 'login'}
              onPasswordUpdated={() => setRecoveryMode(false)}
            />
          } />
        </Routes>
      ) : (
        <div className={`h-screen flex bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-300 font-sans overflow-hidden`}>
          {/* Suspended Modal */}
          {showSuspendedModal && company && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
              <div className="bg-white dark:bg-slate-900 rounded-[32px] p-10 max-w-lg w-full text-center space-y-6 shadow-2xl border border-red-100 dark:border-red-900/30">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto animate-bounce">
                  <AlertCircle size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Acesso Suspenso</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                    O acesso da empresa <span className="text-slate-700 dark:text-slate-300">{company.name}</span> foi temporariamente suspenso.
                  </p>
                </div>
                {company.suspensionReason && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 text-left">
                    <p className="text-sm font-bold text-red-900 dark:text-red-200 mb-1">Motivo da Suspensão:</p>
                    <p className="text-sm text-red-700 dark:text-red-300">{company.suspensionReason}</p>
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Para reativar o acesso, entre em contato com o suporte ou resolva as pendências indicadas. Seus dados estão seguros.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await db.logout();
                    setUser(null);
                    setCompany(null);
                    setShowSuspendedModal(false);
                  }}
                  className="w-full py-5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <LogOut size={20} /> Fazer Logout
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
                  <Route path="/registro-parceiro" element={<PartnerRegistration />} />
                  <Route path="/registro-unidade" element={<WarehouseRegistration />} />
                </Routes>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Modal de empresa suspensa */}
      {showSuspendedModal && company && (
        <CompanySuspendedModal
          companyName={company.name}
          suspensionReason={company.suspensionReason}
          onLogout={() => {
            db.logout();
            setUser(null);
            setCompany(null);
            setShowSuspendedModal(false);
          }}
        />
      )}
    </Router>
  );
};

export default App;