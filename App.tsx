import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ArrowLeftRight, BarChart3, 
  Warehouse, FileUp, LogOut, Truck, Sun, Moon, 
  ChevronLeft, ChevronRight, Building2, User as UserIcon, 
  Loader2, AlertCircle, Sparkles, Eye, EyeOff, Users,
  Mail, Lock, ShoppingCart, KeyRound
} from 'lucide-react';
import { db } from './services/db.ts';
import { User, UserRole, Company } from './types.ts';

// Views
import Dashboard from './components/Dashboard.tsx';
import Products from './components/Products.tsx';
import Inventory from './components/Inventory.tsx';
import Movements from './components/Movements.tsx';
import Reports from './components/Reports.tsx';
import ImportExport from './components/ImportExport.tsx';
import Optimization from './components/Optimization.tsx';
import Suppliers from './components/Suppliers.tsx';
import Sectors from './components/Sectors.tsx';
import Purchases from './components/Purchases.tsx';
import Settings from './components/Settings.tsx';
import DebugPanel from './components/DebugPanel.tsx';

const Logo = ({ collapsed, size = "md" }: { collapsed: boolean; size?: "sm" | "md" | "lg" }) => {
  const iconSize = size === "lg" ? "w-16 h-16" : size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const svgSize = size === "lg" ? 36 : size === "sm" ? 18 : 22;
  const auraSize = size === "lg" ? "text-6xl" : size === "sm" ? "text-xl" : "text-3xl";
  const subSize = size === "lg" ? "text-[6.5px] tracking-[0.27em]" : size === "sm" ? "text-[2.5px] tracking-[0.2em]" : "text-[4px] tracking-[0.22em]";

  return (
    <div className={`flex items-center gap-3 transition-all duration-300 ${collapsed ? 'justify-center' : ''}`}>
      <div className={`${iconSize} bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-xl shadow-blue-500/20`}>
        <svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 16L12 8L20 16" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {!collapsed && (
        <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-500">
          <span className={`${auraSize} font-bold tracking-tighter leading-[0.85] text-slate-900 dark:text-white`}>Aura</span>
          <span className={`${subSize} font-black uppercase text-slate-400 dark:text-slate-500 whitespace-nowrap opacity-80 mt-1`}>ALMOXARIFADO INTELIGENTE</span>
        </div>
      )}
    </div>
  );
};



const AuthScreen = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [loginMethod, setLoginMethod] = useState<'almoxarife' | 'auxiliar'>('almoxarife');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgotPassword'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Login Form Data
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    accessCode: ''
  });

  // Register Form Data
  const [registerStep, setRegisterStep] = useState(1);
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    cnpj: '',
    companyName: '',
    address: '',
    phone: '',
    contactEmail: ''
  });

  // Password Strength Logic
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const passwordStrength = useMemo(() => getPasswordStrength(registerData.password), [registerData.password]);
  const strengthColor = ['bg-slate-200', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'][passwordStrength];
  const strengthText = ['Vazia', 'Fraca', 'Média', 'Boa', 'Forte'][passwordStrength];

  const formatCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  const handleCNPJBlur = async () => {
    const cleanCNPJ = registerData.cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
      setLoading(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
        if (response.ok) {
          const data = await response.json();
          setRegisterData(prev => ({
            ...prev,
            companyName: data.nome_fantasia || data.razao_social,
            address: `${data.logradouro}, ${data.bairro}, ${data.municipio} - ${data.uf}, ${data.cep}`,
            phone: data.ddd_telefone_1 || '',
            contactEmail: data.email || ''
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar CNPJ", e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerStep === 1) {
      if (registerData.password !== registerData.confirmPassword) {
        setError("As senhas não coincidem.");
        return;
      }
      if (passwordStrength < 3) {
        setError("A senha precisa ser mais forte.");
        return;
      }
      setRegisterStep(2);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
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
            sectorResponsible: registerData.name
          }
        );
        onLogin(user);
      } catch (err: any) {
        setError("Erro ao criar conta. " + (err.message || ""));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let user;
      if (loginMethod === 'almoxarife') {
        user = await db.login(formData.email, formData.password);
      } else {
        user = await db.loginWithAccessCode(formData.name, formData.accessCode);
      }
      
      if (user) onLogin(user);
      else setError(loginMethod === 'almoxarife' ? "Credenciais inválidas." : "Nome ou código incorretos.");
    } catch (err: any) { setError("Erro ao conectar."); } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await db.resetPassword(formData.email);
      setSuccessMessage("Instruções de recuperação enviadas para seu e-mail.");
    } catch (err: any) {
      setError("Erro ao enviar email de recuperação. Verifique se o email está correto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-[40%] h-[40%] bg-blue-400 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[35%] h-[35%] bg-indigo-400 blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-2xl space-y-4 relative z-10 animate-in fade-in zoom-in duration-700">
        <div className="flex justify-center"><Logo collapsed={false} size="lg" /></div>
        
        <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {authMode === 'register' ? (
            <div className="p-5">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-0">Criar Conta - Etapa {registerStep}/2</h3>
              <p className="text-slate-500 text-xs mb-2">{registerStep === 1 ? "Dados Pessoais (Administrador)" : "Dados da Empresa"}</p>
              
              {error && <div className="mb-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100"><AlertCircle size={16} /> {error}</div>}

              <form onSubmit={handleRegister} className="space-y-2">
                {registerStep === 1 ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Completo</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input required type="text" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.name} onChange={e => setRegisterData({...registerData, name: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input required type="email" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.email} onChange={e => setRegisterData({...registerData, email: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Senha</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input required type="password" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} />
                      </div>
                      <div className="flex gap-1 h-1 mt-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`flex-1 rounded-full transition-colors duration-300 ${i <= passwordStrength ? strengthColor : 'bg-slate-100 dark:bg-slate-800'}`} />
                        ))}
                      </div>
                      <span className={`text-[10px] font-bold ${passwordStrength > 2 ? 'text-emerald-500' : 'text-slate-400'}`}>{strengthText}</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Confirmar Senha</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input required type="password" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.confirmPassword} onChange={e => setRegisterData({...registerData, confirmPassword: e.target.value})} />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm mt-2">
                      Continuar <ChevronRight size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">CNPJ</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input required type="text" maxLength={18} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.cnpj} 
                          onChange={e => setRegisterData({...registerData, cnpj: formatCNPJ(e.target.value)})} 
                          onBlur={handleCNPJBlur}
                          placeholder="00.000.000/0000-00"
                        />
                        {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-blue-600" size={16} /></div>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Fantasia</label>
                      <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.companyName} onChange={e => setRegisterData({...registerData, companyName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Endereço Completo</label>
                      <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.address} onChange={e => setRegisterData({...registerData, address: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Telefone</label>
                        <input required type="tel" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.phone} onChange={e => setRegisterData({...registerData, phone: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail Comercial</label>
                        <input required type="email" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={registerData.contactEmail} onChange={e => setRegisterData({...registerData, contactEmail: e.target.value})} />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-2">
                      <button type="button" onClick={() => setRegisterStep(1)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all text-xs">
                        Voltar
                      </button>
                      <button type="submit" className="flex-[2] py-3.5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all text-xs">
                        {loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Finalizar'}
                      </button>
                    </div>
                  </>
                )}

                <button type="button" onClick={() => { setAuthMode('login'); setError(null); setRegisterStep(1); }} className="w-full py-2 text-slate-500 hover:text-blue-600 font-bold text-xs transition-colors">
                  Já tenho uma conta
                </button>
              </form>
            </div>
          ) : authMode === 'forgotPassword' ? (
            <div className="p-10">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Recuperar Senha</h3>
              <p className="text-slate-500 text-sm mb-6">Digite seu e-mail para receber as instruções de recuperação.</p>
              
              {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100"><AlertCircle size={18} /> {error}</div>}
              {successMessage && <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-emerald-100"><Sparkles size={18} /> {successMessage}</div>}

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input required type="email" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                </div>

                <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Enviar Instruções'}
                </button>
                
                <button type="button" onClick={() => { setAuthMode('login'); setError(null); setSuccessMessage(null); }} className="w-full py-4 text-slate-500 hover:text-blue-600 font-bold text-sm transition-colors">
                  Voltar ao Login
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex border-b border-slate-100 dark:border-slate-800">
                <button onClick={() => setLoginMethod('almoxarife')} className={`flex-1 py-5 text-sm font-black uppercase tracking-widest ${loginMethod === 'almoxarife' ? 'text-blue-600 bg-blue-50/30 border-b-2 border-blue-600' : 'text-slate-400'}`}>ALMOXARIFE</button>
                <button onClick={() => setLoginMethod('auxiliar')} className={`flex-1 py-5 text-sm font-black uppercase tracking-widest ${loginMethod === 'auxiliar' ? 'text-blue-600 bg-blue-50/30 border-b-2 border-blue-600' : 'text-slate-400'}`}>AUXILIAR</button>
              </div>

              <form onSubmit={handleSubmit} className="p-10">
                {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100"><AlertCircle size={18} /> {error}</div>}
                
                <div className="space-y-6">
                  {loginMethod === 'almoxarife' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail Corporativo</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input required type="email" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Senha</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input required type={showPassword ? "text" : "password"} className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Completo</label>
                        <div className="relative">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input required type="text" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Código de Acesso (4 Dígitos)</label>
                        <div className="relative">
                          <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input required type="text" maxLength={4} pattern="\d{4}" placeholder="0000" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold tracking-[0.5em]" value={formData.accessCode} onChange={e => setFormData({...formData, accessCode: e.target.value.replace(/\D/g, '').slice(0, 4)})} />
                        </div>
                      </div>
                    </>
                  )}
                  
                  <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 mt-4 active:scale-95 transition-all">
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Acessar Aura'}
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    {loginMethod === 'almoxarife' && (
                      <button type="button" onClick={() => setAuthMode('forgotPassword')} className="text-slate-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest transition-colors">
                        Esqueci minha senha
                      </button>
                    )}
                    <button type="button" onClick={() => setAuthMode('register')} className="text-slate-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest transition-colors ml-auto">
                      Criar Conta
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SidebarItem = ({ to, icon: Icon, label, active, onClick, collapsed }: any) => (
  <Link to={to} onClick={onClick} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'} ${collapsed ? 'justify-center px-0' : ''}`}>
    <Icon size={18} className="shrink-0" />
    {!collapsed && <span className="font-bold text-xs tracking-tight">{label}</span>}
  </Link>
);

const SidebarNavigation = ({ user, setSidebarOpen, toggleTheme, isDarkMode, collapsed }: any) => {
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
      
      {canAccess('products') && (
        <SidebarItem to="/produtos" icon={Package} label="Produtos" active={location.pathname === '/produtos'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
      )}
      
      {canAccess('suppliers') && (
        <SidebarItem to="/fornecedores" icon={Truck} label="Fornecedores" active={location.pathname === '/fornecedores'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
      )}
      
      {canAccess('inventory') && (
        <SidebarItem to="/estoque" icon={Warehouse} label="Estoque" active={location.pathname === '/estoque'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
      )}
      
      {canAccess('movements') && (
        <SidebarItem to="/movimentacoes" icon={ArrowLeftRight} label="Movimentações" active={location.pathname === '/movimentacoes'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
      )}
      
      {canAccess('sectors') && (
        <SidebarItem to="/setores" icon={Users} label="Setores" active={location.pathname === '/setores'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
      )}
      
      {canAccess('purchases') && (
        <SidebarItem to="/compras" icon={ShoppingCart} label="Compras" active={location.pathname === '/compras'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
      )}
      
      {canAccess('reports') && (
        <SidebarItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
      )}

      {isAlmoxarife && (
        <>
          <SidebarItem to="/otimizacao" icon={Sparkles} label="Otimização" active={location.pathname === '/otimizacao'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
          <SidebarItem to="/importar" icon={FileUp} label="Planilhas" active={location.pathname === '/importar'} onClick={() => setSidebarOpen(false)} collapsed={collapsed} />
        </>
      )}
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;
  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        <aside className={`flex-shrink-0 z-40 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all ${isCollapsed ? 'w-20' : 'w-64'}`}>
          <div className="flex flex-col h-full p-4 relative">
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex absolute -right-3 top-16 w-6 h-6 bg-white dark:bg-slate-800 border rounded-full items-center justify-center shadow-sm"> {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />} </button>
            <div className="mb-8 mt-4"><Logo collapsed={isCollapsed} /></div>
            {!isCollapsed && company && (
              user.role === UserRole.ALMOXARIFE ? (
                <Link to="/configuracoes" className="block mb-8 p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 relative overflow-hidden group animate-in zoom-in duration-500 hover:scale-[1.02] transition-transform">
                  <div className="absolute -top-2 -right-2 p-2 opacity-10 rotate-12 group-hover:rotate-0 transition-all duration-500">
                    <Building2 size={48} />
                  </div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-bold text-xs leading-tight mb-1 truncate">{company.name}</h3>
                      <p className="text-[9px] font-mono opacity-80 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {company.cnpj}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-white/50 group-hover:text-white transition-colors" />
                  </div>
                </Link>
              ) : (
                <div className="mb-8 p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 relative overflow-hidden animate-in zoom-in duration-500">
                  <div className="absolute -top-2 -right-2 p-2 opacity-10 rotate-12 transition-all duration-500">
                    <Building2 size={48} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-xs leading-tight mb-1 truncate pr-2">{company.name}</h3>
                    <p className="text-[9px] font-mono opacity-80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {company.cnpj}
                    </p>
                  </div>
                </div>
              )
            )}
            <nav className="flex-1 overflow-y-auto custom-scrollbar">
              <SidebarNavigation user={user} setSidebarOpen={setSidebarOpen} toggleTheme={() => setIsDarkMode(!isDarkMode)} isDarkMode={isDarkMode} collapsed={isCollapsed} />
            </nav>
            <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 mb-6">
              <div className={`flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 transition-all ${isCollapsed ? 'flex-col justify-center p-1' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-blue-500/20 shrink-0">
                  {user.name.charAt(0)}
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate leading-tight">
                      {user.name.split(' ').slice(0, 2).join(' ')}
                    </p>
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider truncate">
                      {user.role}
                    </p>
                  </div>
                )}
                
                <div className={`flex items-center gap-1 ${isCollapsed ? 'flex-col w-full pt-1 border-t border-slate-200 dark:border-slate-700 mt-1' : ''}`}>
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)} 
                    className={`p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all ${isDarkMode ? 'text-yellow-400' : 'text-slate-400 hover:text-blue-600'} ${isCollapsed ? 'w-full' : ''}`}
                    title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
                  >
                    {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                  <button 
                    onClick={() => { db.logout(); setUser(null); }} 
                    className={`p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-all ${isCollapsed ? 'w-full' : ''}`}
                    title="Sair"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main className="flex-1 p-6 lg:p-12 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            
            {(user.role === UserRole.ALMOXARIFE || user.permissions?.products !== 'none') && (
              <Route path="/produtos" element={<Products user={user} />} />
            )}
            {(user.role === UserRole.ALMOXARIFE || user.permissions?.suppliers !== 'none') && (
              <Route path="/fornecedores" element={<Suppliers user={user} />} />
            )}
            {(user.role === UserRole.ALMOXARIFE || user.permissions?.inventory !== 'none') && (
              <Route path="/estoque" element={<Inventory user={user} />} />
            )}
            {(user.role === UserRole.ALMOXARIFE || user.permissions?.movements !== 'none') && (
              <Route path="/movimentacoes" element={<Movements user={user} />} />
            )}
            
            {(user.role === UserRole.ALMOXARIFE || user.permissions?.sectors !== 'none') && (
              <Route path="/setores" element={<Sectors user={user} />} />
            )}
            {(user.role === UserRole.ALMOXARIFE || user.permissions?.purchases !== 'none') && (
              <Route path="/compras" element={<Purchases user={user} />} />
            )}
            {(user.role === UserRole.ALMOXARIFE || user.permissions?.reports !== 'none') && (
              <Route path="/relatorios" element={<Reports user={user} />} />
            )}

            {user.role === UserRole.ALMOXARIFE && (
              <>
                <Route path="/configuracoes" element={<Settings user={user} company={company} />} />
                <Route path="/importar" element={<ImportExport user={user} />} />
                <Route path="/otimizacao" element={<Optimization user={user} />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;