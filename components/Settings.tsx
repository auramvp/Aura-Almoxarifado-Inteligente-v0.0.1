import React, { useState } from 'react';
import { 
  Building2, Users, CreditCard, Clock, 
  Plus, Mail, Shield, CheckCircle2, AlertCircle,
  ChevronRight, Calendar, DollarSign, Phone, Loader2,
  Edit2, Save, X, Trash2, Copy,
  Package, Truck, Warehouse, ArrowLeftRight, BarChart3, ShoppingCart, Bell, TrendingUp, AlertTriangle
} from 'lucide-react';
import { User, Company, UserRole, UserPermissions, PermissionLevel, Subscription, Plan, Invoice } from '../types';
import { db } from '../services/db';

interface SettingsProps {
  user: User;
  company: Company | null;
}

const Settings: React.FC<SettingsProps> = ({ user, company }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'billing' | 'company' | 'alerts'>('company');
  const [showAddUser, setShowAddUser] = useState(false);
  
  // Alert Settings State
  const [alertSettings, setAlertSettings] = useState({
    minStock: true,
    minStockFrequency: 'daily',
    unusualConsumption: false,
    consumptionThreshold: 20,
    alertEmails: ''
  });

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const defaultPermissions: UserPermissions = {
    products: 'view',
    suppliers: 'view',
    inventory: 'view',
    movements: 'view',
    reports: 'none',
    purchases: 'none',
    sectors: 'none'
  };

  const [newUser, setNewUser] = useState<{
    name: string;
    role: UserRole;
    permissions: UserPermissions;
  }>({ 
    name: '', 
    role: UserRole.AUX_ALMOXARIFE,
    permissions: defaultPermissions
  });
  const [generatedCode, setGeneratedCode] = useState<string>('');

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Company>>({});
  const [loading, setLoading] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{name: string, code: string} | null>(null);

  const [editingPermissionsUser, setEditingPermissionsUser] = useState<{user: User, permissions: UserPermissions} | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const handleOpenPermissionsModal = (user: User) => {
    let permissions = user.permissions || defaultPermissions;
    // Se as permissões estiverem vazias (ex: usuário antigo ou admin), usar padrão
    if (Object.keys(permissions).length === 0) {
      permissions = defaultPermissions;
    }
    setEditingPermissionsUser({
      user,
      permissions
    });
    setShowPermissionModal(true);
  };

  const handleSavePermissions = async () => {
    if (!editingPermissionsUser) return;
    try {
      await db.updateUserPermissions(editingPermissionsUser.user.id, editingPermissionsUser.permissions);
      setUsers(users.map(u => u.id === editingPermissionsUser.user.id ? { ...u, permissions: editingPermissionsUser.permissions } : u));
      setShowPermissionModal(false);
      setEditingPermissionsUser(null);
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Erro ao atualizar permissões.');
    }
  };

  React.useEffect(() => {
    if (showAddUser && !generatedCode) {
      // Gera código de 4 dígitos (1000-9999)
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedCode(code);
    }
  }, [showAddUser]);

  React.useEffect(() => {
    if (company) {
      setEditForm(company);
    }
  }, [company]);

  React.useEffect(() => {
    if (activeTab === 'users' && company) {
      loadUsers();
    }
  }, [activeTab, company]);

  const loadUsers = async () => {
    if (!company) return;
    setLoadingUsers(true);
    try {
      const companyUsers = await db.getCompanyUsers(company.id);
      setUsers(companyUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'billing' && company) {
      loadSubscription();
    }
  }, [activeTab, company]);

  const loadSubscription = async () => {
      if (!company) return;
      setLoadingSubscription(true);
      try {
          const sub = await db.getSubscription(company.id);
          const invs = await db.getInvoices(company.id);
          setSubscription(sub);
          setInvoices(invs);
      } catch (error) {
          console.error('Error loading subscription:', error);
      } finally {
          setLoadingSubscription(false);
      }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await db.updateUserRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Erro ao atualizar permissão do usuário.');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;
    try {
      await db.removeUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error removing user:', error);
      alert('Erro ao remover usuário.');
    }
  };

  const handleSaveCompany = async () => {
    if (!company) return;
    setLoading(true);
    try {
      await db.updateCompany(company.id, editForm);
      window.location.reload();
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Erro ao atualizar dados da empresa.');
    } finally {
      setLoading(false);
      setIsEditing(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    
    try {
      const addedUser = await db.addUser({
        name: newUser.name,
        role: newUser.role,
        companyId: company.id,
        accessCode: generatedCode,
        permissions: newUser.role === UserRole.AUX_ALMOXARIFE ? newUser.permissions : undefined
      });

      setUsers([...users, addedUser]);
      
      setSuccessModalData({ name: addedUser.name, code: generatedCode });
      setShowSuccessModal(true);
      
      setShowAddUser(false);
      setNewUser({ name: '', role: UserRole.AUX_ALMOXARIFE, permissions: defaultPermissions });
      setGeneratedCode('');
    } catch (error: any) {
      console.error('Error adding user:', error);
      if (error.message && error.message.includes('access_code')) {
        alert('Erro de Banco de Dados: A coluna "access_code" não existe.\n\nPor favor, acesse o painel do Supabase, vá em SQL Editor e execute o comando:\n\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_code VARCHAR(4);');
      } else if (error.message && error.message.includes('profiles_role_check')) {
        alert('Erro de Banco de Dados: O papel do usuário (Role) não é permitido pela regra atual.\n\nPor favor, execute o comando SQL abaixo no Supabase para atualizar as regras:\n\nALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;\nALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (\'ALMOXARIFE\', \'AUX_ALMOXARIFE\', \'ADMIN\'));');
      } else if (error.message && (error.message.includes('permissions') || error.message.includes('Could not find the \'permissions\' column'))) {
        alert('Erro de Banco de Dados: A coluna "permissions" não existe na tabela de perfis.\n\nPor favor, acesse o painel do Supabase, vá em SQL Editor e execute o conteúdo do arquivo "update_db_permissions.sql" que foi criado na raiz do projeto.\n\nComando: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT \'{}\'::jsonb;');
      } else {
        alert(`Erro ao criar usuário: ${error.message || JSON.stringify(error)}`);
      }
    }
  };

  const [emailError, setEmailError] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Helper to get emails array
  const getEmailsArray = () => {
    if (!alertSettings.alertEmails) return [];
    return alertSettings.alertEmails.split(',').map(e => e.trim()).filter(e => e !== '');
  };

  const handleAddEmail = () => {
    if (!newEmail) return;
    
    // Basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailError('E-mail inválido');
      return;
    }
    
    const currentEmails = getEmailsArray();
    if (currentEmails.includes(newEmail)) {
      setEmailError('E-mail já adicionado');
      return;
    }
    
    const updatedEmails = [...currentEmails, newEmail].join(',');
    setAlertSettings({...alertSettings, alertEmails: updatedEmails});
    setNewEmail('');
    setEmailError('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    const currentEmails = getEmailsArray();
    const updatedEmails = currentEmails.filter(e => e !== emailToRemove).join(',');
    setAlertSettings({...alertSettings, alertEmails: updatedEmails});
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  // Load alert settings when company data is available
  React.useEffect(() => {
    if (company?.settings?.alerts) {
      setAlertSettings(company.settings.alerts);
    }
  }, [company]);

  const validateEmails = (emails: string) => {
    if (!emails) return true;
    const emailList = emails.split(',').map(e => e.trim());
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emailList.find(e => e !== '' && !emailRegex.test(e));
    return !invalid;
  };

  const handleSaveAlerts = async () => {
    if (!company) return;
    
    // Validate emails
    if (alertSettings.alertEmails && !validateEmails(alertSettings.alertEmails)) {
      setEmailError('Um ou mais e-mails são inválidos. Verifique a formatação.');
      return;
    }
    setEmailError('');

    const btn = document.getElementById('save-alerts-btn');
    const originalText = btn ? btn.innerHTML : '';
    
    if (btn) btn.innerHTML = '<span class="animate-spin mr-2">⏳</span> Salvando...';
    
    try {
      await db.updateCompany(company.id, {
        settings: {
          ...company.settings,
          alerts: alertSettings
        }
      });
      
      if (btn) btn.innerHTML = '<span class="mr-2">✅</span> Salvo!';
      setTimeout(() => {
        if (btn) btn.innerHTML = originalText;
      }, 2000);
      
    } catch (error: any) {
      console.error('Error saving alerts:', error);
      if (error.message?.includes('settings')) {
         alert('Erro: A coluna "settings" não existe no banco de dados. Por favor, adicione-a via SQL Editor: ALTER TABLE companies ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT \'{}\'::jsonb;');
      } else {
         alert('Erro ao salvar configurações de alerta.');
      }
      if (btn) btn.innerHTML = originalText;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configurações da Empresa</h2>
        <p className="text-slate-500 dark:text-slate-400">Gerencie usuários, assinaturas e detalhes da sua conta.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar de Navegação */}
        <div className="lg:col-span-1 space-y-2">
          <button 
            onClick={() => setActiveTab('company')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'company' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Building2 size={18} />
            <span className="font-bold text-sm">Dados da Empresa</span>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Users size={18} />
            <span className="font-bold text-sm">Usuários</span>
          </button>
          <button 
            onClick={() => setActiveTab('billing')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'billing' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <CreditCard size={18} />
            <span className="font-bold text-sm">Assinatura e Faturas</span>
          </button>
          <button 
            onClick={() => setActiveTab('alerts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'alerts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Bell size={18} />
            <span className="font-bold text-sm">Alertas e Notificações</span>
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'company' && (
            !company ? (
              <div className="bg-white dark:bg-slate-900 rounded-[32px] p-12 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center">
                <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Carregando informações...</h3>
                <p className="text-slate-500 mt-2">Estamos buscando os dados da sua empresa.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      {company.logo ? (
                        <img src={company.logo} alt={company.name} className="w-16 h-16 rounded-2xl object-contain bg-slate-50 dark:bg-slate-800 p-2 border border-slate-100 dark:border-slate-700" />
                      ) : (
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
                          <Building2 size={32} />
                        </div>
                      )}
                      <div>
                        {isEditing ? (
                          <input 
                            value={editForm.name || ''}
                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                            className="text-xl font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none w-full"
                            placeholder="Nome da Empresa"
                          />
                        ) : (
                          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{company.name || 'Empresa sem nome'}</h3>
                        )}
                        <p className="text-sm text-slate-500 font-mono">{company.cnpj || 'CNPJ não informado'}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button 
                            onClick={() => setIsEditing(false)}
                            className="p-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                            disabled={loading}
                          >
                            <X size={20} />
                          </button>
                          <button 
                            onClick={handleSaveCompany}
                            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/20"
                            disabled={loading}
                          >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="p-3 text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
                        >
                          <Edit2 size={16} /> Editar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Informações de Contato</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <Mail size={18} className="text-blue-500 shrink-0" />
                          {isEditing ? (
                            <input 
                              value={editForm.email || ''}
                              onChange={e => setEditForm({...editForm, email: e.target.value})}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Email"
                            />
                          ) : (
                            <span>{company.email || 'Não informado'}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <Phone size={18} className="text-blue-500 shrink-0" />
                          {isEditing ? (
                            <input 
                              value={editForm.phone || ''}
                              onChange={e => setEditForm({...editForm, phone: e.target.value})}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Telefone"
                            />
                          ) : (
                            <span>{company.phone || 'Não informado'}</span>
                          )}
                        </div>
                        <div className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                          <Building2 size={18} className="text-blue-500 mt-1 shrink-0" />
                          {isEditing ? (
                            <input 
                              value={editForm.address || ''}
                              onChange={e => setEditForm({...editForm, address: e.target.value})}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Endereço"
                            />
                          ) : (
                            <span>{company.address || 'Não informado'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Responsável pelo Almoxarifado</h4>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0">
                            {(editForm.sectorResponsible || company.sectorResponsible || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div className="w-full">
                            {isEditing ? (
                              <>
                                <input 
                                  value={editForm.sectorResponsible || ''}
                                  onChange={e => setEditForm({...editForm, sectorResponsible: e.target.value})}
                                  className="w-full font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-slate-300 focus:border-emerald-500 outline-none mb-1"
                                  placeholder="Nome do Responsável"
                                />
                                <p className="text-xs text-slate-500">Gestor Responsável</p>
                              </>
                            ) : (
                              <>
                                <p className="font-bold text-slate-800 dark:text-slate-100">{company.sectorResponsible || 'Não definido'}</p>
                                <p className="text-xs text-slate-500">Gestor Responsável</p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Mail size={14} className="shrink-0" /> 
                            {isEditing ? (
                              <input 
                                value={editForm.sectorEmail || ''}
                                onChange={e => setEditForm({...editForm, sectorEmail: e.target.value})}
                                className="flex-1 bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                                placeholder="Email do Setor"
                              />
                            ) : (
                              company.sectorEmail || 'Não informado'
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <CheckCircle2 size={14} className="shrink-0" /> 
                            {isEditing ? (
                              <input 
                                value={editForm.sectorWhatsApp || ''}
                                onChange={e => setEditForm({...editForm, sectorWhatsApp: e.target.value})}
                                className="flex-1 bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                                placeholder="WhatsApp"
                              />
                            ) : (
                              company.sectorWhatsApp || 'Não informado'
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {company.contactExtra || isEditing ? (
                    <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Observações Adicionais</h4>
                      {isEditing ? (
                        <textarea 
                          value={editForm.contactExtra || ''}
                          onChange={e => setEditForm({...editForm, contactExtra: e.target.value})}
                          className="w-full text-slate-600 dark:text-slate-300 text-sm leading-relaxed bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                          placeholder="Informações adicionais..."
                        />
                      ) : (
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl">
                          {company.contactExtra}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          )}

          {activeTab === 'users' && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Gestão de Usuários</h3>
                  <p className="text-sm text-slate-400">Adicione ou remova membros da sua equipe.</p>
                </div>
                <button 
                  onClick={() => setShowAddUser(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Plus size={16} /> Adicionar Usuário
                </button>
              </div>

              {showAddUser && (
                <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4">
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Users size={18} className="text-blue-600" /> Novo Membro
                  </h4>
                  <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      required
                      placeholder="Nome Completo"
                      value={newUser.name}
                      onChange={e => setNewUser({...newUser, name: e.target.value})}
                      className="px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Shield size={18} className="text-blue-600" />
                      </div>
                      <input 
                        readOnly
                        value={generatedCode}
                        className="w-full pl-12 pr-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 font-mono text-lg tracking-widest text-center rounded-xl border border-blue-100 dark:border-blue-800 outline-none cursor-not-allowed"
                        title="Código de Acesso Gerado Automaticamente"
                      />
                      <p className="text-[10px] text-center text-blue-600/70 mt-1 uppercase font-black tracking-widest">Código de Acesso</p>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <select 
                        value={newUser.role}
                        onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value={UserRole.AUX_ALMOXARIFE}>Aux. Almoxarife</option>
                        <option value={UserRole.ALMOXARIFE}>Almoxarife (Admin)</option>
                      </select>
                      
                      {newUser.role === UserRole.AUX_ALMOXARIFE ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 text-sm">
                            <div className="flex items-start gap-2">
                              <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-blue-800 dark:text-blue-200 block mb-1">
                                  Personalizar Acesso
                                </span>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
                                  Defina o nível de permissão para cada ferramenta do sistema.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {[
                              { id: 'products', label: 'Produtos', icon: Package },
                              { id: 'suppliers', label: 'Fornecedores', icon: Truck },
                              { id: 'inventory', label: 'Estoque', icon: Warehouse },
                              { id: 'movements', label: 'Movimentações', icon: ArrowLeftRight },
                              { id: 'reports', label: 'Relatórios', icon: BarChart3 },
                              { id: 'purchases', label: 'Compras', icon: ShoppingCart },
                              { id: 'sectors', label: 'Setores', icon: Building2 },
                            ].map((module) => (
                              <div key={module.id} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2 mb-2">
                                  {React.createElement(module.icon, { size: 14, className: "text-slate-400" })}
                                  <span className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wide">{module.label}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                   <label className={`
                                      cursor-pointer p-2 rounded-lg text-[10px] font-bold text-center transition border flex items-center justify-center
                                      ${newUser.permissions[module.id as keyof UserPermissions] === 'none' 
                                        ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800' 
                                        : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-500'}
                                   `}>
                                     <input 
                                       type="radio" 
                                       name={`perm-${module.id}`}
                                       className="hidden"
                                       checked={newUser.permissions[module.id as keyof UserPermissions] === 'none'}
                                       onChange={() => setNewUser({
                                         ...newUser,
                                         permissions: { ...newUser.permissions, [module.id]: 'none' }
                                       })}
                                     />
                                     Bloqueado
                                   </label>
                                   <label className={`
                                      cursor-pointer p-2 rounded-lg text-[10px] font-bold text-center transition border flex items-center justify-center
                                      ${newUser.permissions[module.id as keyof UserPermissions] === 'view' 
                                        ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' 
                                        : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-500'}
                                   `}>
                                     <input 
                                       type="radio" 
                                       name={`perm-${module.id}`}
                                       className="hidden"
                                       checked={newUser.permissions[module.id as keyof UserPermissions] === 'view'}
                                       onChange={() => setNewUser({
                                         ...newUser,
                                         permissions: { ...newUser.permissions, [module.id]: 'view' }
                                       })}
                                     />
                                     Somente Ver
                                   </label>
                                   <label className={`
                                      cursor-pointer p-2 rounded-lg text-[10px] font-bold text-center transition border flex items-center justify-center
                                      ${newUser.permissions[module.id as keyof UserPermissions] === 'full' 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800' 
                                        : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-500'}
                                   `}>
                                     <input 
                                       type="radio" 
                                       name={`perm-${module.id}`}
                                       className="hidden"
                                       checked={newUser.permissions[module.id as keyof UserPermissions] === 'full'}
                                       onChange={() => setNewUser({
                                         ...newUser,
                                         permissions: { ...newUser.permissions, [module.id]: 'full' }
                                       })}
                                     />
                                     Total
                                   </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 text-sm">
                          <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-blue-800 dark:text-blue-200 block mb-1">
                                Acesso Total (Administrador)
                              </span>
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
                                Tem permissão para acessar todas as áreas, incluindo Setores, Compras, Relatórios, Otimização, Importação de Planilhas e Configurações da Empresa.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2 flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition">Cancelar</button>
                      <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">Adicionar</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="space-y-4">
                {loadingUsers ? (
                  <div className="text-center py-8">
                    <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
                    <p className="text-slate-500 mt-2">Carregando usuários...</p>
                  </div>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200">{u.name}</h4>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500">{u.email.includes('@aura.local') ? 'Acesso via Código' : u.email}</p>
                            {u.accessCode && (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-slate-500" title="Código de Acesso">
                                {u.accessCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full outline-none border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          <option value={UserRole.ALMOXARIFE}>Almoxarife</option>
                          <option value={UserRole.AUX_ALMOXARIFE}>Aux. Almoxarife</option>
                        </select>
                        
                        <button
                          onClick={() => handleOpenPermissionsModal(u)}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                          title="Editar permissões"
                        >
                          <Edit2 size={16} />
                        </button>

                        {u.id !== user.id && (
                          <button
                            onClick={() => handleRemoveUser(u.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Remover usuário"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              {loadingSubscription ? (
                <div className="text-center py-12">
                   <Loader2 size={48} className="animate-spin text-blue-600 mx-auto" />
                   <p className="text-slate-500 mt-4">Carregando detalhes da assinatura...</p>
                </div>
              ) : !subscription ? (
                 <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                    <CreditCard size={48} className="text-slate-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Nenhuma Assinatura Ativa</h3>
                    <p className="text-slate-500 mb-6">Sua empresa não possui um plano de assinatura ativo no momento.</p>
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition">
                        Ver Planos Disponíveis
                    </button>
                 </div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[32px] p-8 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                      <CreditCard size={120} />
                    </div>
                    <div className="relative z-10">
                      <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 backdrop-blur-sm border border-white/10">
                        {subscription.plan?.name || 'Plano Personalizado'}
                      </span>
                      <h3 className="text-3xl font-bold mb-2">Aura Almoxarife</h3>
                      <p className="text-blue-100 mb-8 opacity-80">
                        {subscription.status === 'active' 
                            ? `Próxima renovação em ${new Date(subscription.nextBillingDate).toLocaleDateString('pt-BR')}`
                            : `Status: ${subscription.status.toUpperCase()}`}
                      </p>
                      
                      <div className="flex items-end gap-1 mb-8">
                        <span className="text-4xl font-bold">
                          {subscription.plan?.price 
                            ? `R$ ${subscription.plan.price.toFixed(2).replace('.', ',')}` 
                            : 'Sob Consulta'}
                        </span>
                        <span className="text-sm opacity-60 mb-1">
                          /{subscription.plan?.interval === 'yearly' ? 'ano' : 'mês'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-8 max-w-md">
                          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                              <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Usuários</p>
                              <p className="font-bold text-lg">{subscription.plan?.maxUsers === 999999 ? 'Ilimitado' : subscription.plan?.maxUsers} <span className="text-xs font-normal opacity-70">usuários</span></p>
                          </div>
                          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                              <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Itens</p>
                              <p className="font-bold text-lg">{subscription.plan?.maxItems === 999999 ? 'Ilimitado' : subscription.plan?.maxItems} <span className="text-xs font-normal opacity-70">itens</span></p>
                          </div>
                      </div>

                      <div className="flex gap-4">
                        <button className="px-6 py-3 bg-white text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition shadow-lg">Gerenciar Plano</button>
                        <button className="px-6 py-3 bg-blue-800/50 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-800 transition backdrop-blur-sm border border-white/10">Alterar Cartão</button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                      <Clock size={20} className="text-blue-600" /> Histórico de Faturas
                    </h3>
                    <div className="space-y-4">
                      {invoices.length === 0 ? (
                          <p className="text-slate-500 text-center py-4">Nenhuma fatura encontrada.</p>
                      ) : (
                          invoices.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition border-b border-slate-50 dark:border-slate-800 last:border-0">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center">
                                  <DollarSign size={20} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-700 dark:text-slate-200">{inv.description || 'Mensalidade'}</h4>
                                  <p className="text-xs text-slate-400">{new Date(inv.billingDate).toLocaleDateString('pt-BR')} • {inv.status.toUpperCase()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-slate-800 dark:text-slate-100">R$ {inv.amount.toFixed(2).replace('.', ',')}</p>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                    inv.status === 'paid' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 
                                    inv.status === 'open' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                                    'text-slate-500 bg-slate-50 dark:bg-slate-900/20'
                                }`}>
                                    {inv.status === 'paid' ? 'Pago' : inv.status === 'open' ? 'Aberto' : inv.status}
                                </span>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Bell size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Configuração de Alertas</h3>
                    <p className="text-sm text-slate-500">Gerencie como você deseja ser notificado sobre eventos importantes.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Estoque Mínimo */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Estoque Mínimo</h4>
                        <p className="text-sm text-slate-500 max-w-md">Receba notificações automáticas quando a quantidade de um produto atingir o nível mínimo de segurança definido.</p>
                        
                        {alertSettings.minStock && (
                          <div className="mt-4 flex items-center gap-3">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Frequência:</span>
                            <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                              <button 
                                onClick={() => setAlertSettings({...alertSettings, minStockFrequency: 'daily'})}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${alertSettings.minStockFrequency === 'daily' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}
                              >
                                Diário
                              </button>
                              <button 
                                onClick={() => setAlertSettings({...alertSettings, minStockFrequency: 'weekly'})}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${alertSettings.minStockFrequency === 'weekly' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}
                              >
                                Semanal
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={alertSettings.minStock || false}
                        onChange={(e) => setAlertSettings({...alertSettings, minStock: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Consumo Anômalo */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Consumo Anômalo (IA)</h4>
                        <p className="text-sm text-slate-500 max-w-md">Nossa IA monitora padrões de saída e notifica quando houver um consumo muito acima da média histórica.</p>
                        
                        {alertSettings.unusualConsumption && (
                          <div className="mt-4">
                            <div className="flex justify-between mb-1">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Sensibilidade do Alerta</span>
                                <span className="text-xs font-bold text-purple-600">{alertSettings.consumptionThreshold || 20}% acima da média</span>
                            </div>
                            <input 
                                type="range" 
                                min="10" 
                                max="100" 
                                step="5"
                                value={alertSettings.consumptionThreshold || 20}
                                onChange={(e) => setAlertSettings({...alertSettings, consumptionThreshold: parseInt(e.target.value)})}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                            <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-medium">
                                <span>Mais sensível (10%)</span>
                                <span>Menos sensível (100%)</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={alertSettings.unusualConsumption || false}
                        onChange={(e) => setAlertSettings({...alertSettings, unusualConsumption: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* E-mails para Notificação */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex gap-4 w-full">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Mail size={20} />
                      </div>
                      <div className="w-full">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">E-mails para Notificação</h4>
                        <p className="text-sm text-slate-500 max-w-md mb-4">Adicione os endereços de e-mail que receberão os alertas.</p>
                        
                        <div className={`w-full bg-white dark:bg-slate-900 p-3 rounded-xl border transition-all ${emailError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent'}`}>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {getEmailsArray().map((email, index) => (
                              <div key={index} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg text-xs font-medium animate-in zoom-in-50 duration-200">
                                <span>{email}</span>
                                <button 
                                  onClick={() => handleRemoveEmail(email)}
                                  className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition-colors"
                                  title="Remover email"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newEmail}
                              onChange={(e) => {
                                setNewEmail(e.target.value);
                                if (emailError) setEmailError('');
                              }}
                              onKeyDown={handleKeyDown}
                              placeholder="Digite um e-mail e pressione Enter"
                              className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                            />
                            <button
                              onClick={handleAddEmail}
                              disabled={!newEmail}
                              className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Adicionar email"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </div>
                        {emailError && (
                          <p className="mt-2 text-xs text-red-500 font-bold flex items-center gap-1">
                            <AlertCircle size={12} /> {emailError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button 
                      onClick={handleSaveAlerts}
                      id="save-alerts-btn"
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 flex items-center gap-2"
                    >
                        <Save size={16} /> Salvar Configurações
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showSuccessModal && successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={40} className="text-green-600 dark:text-green-400" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Usuário Criado!</h3>
                <p className="text-slate-500 dark:text-slate-400">O novo membro da equipe já pode acessar o sistema.</p>
              </div>

              <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
                <div className="mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Nome do Usuário</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">{successModalData.name}</p>
                </div>
                
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Código de Acesso</p>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 dashed border-2 border-blue-200 dark:border-blue-900">
                    <code className="flex-1 text-2xl font-mono font-bold text-blue-600 text-center tracking-widest">
                      {successModalData.code}
                    </code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(successModalData.code);
                      }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition"
                      title="Copiar código"
                    >
                      <Copy size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
      {showPermissionModal && editingPermissionsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Shield size={20} className="text-blue-600" /> Editar Permissões
              </h3>
              <button onClick={() => setShowPermissionModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-slate-500 mb-4">
                Editando permissões para <span className="font-bold text-slate-700 dark:text-slate-300">{editingPermissionsUser.user.name}</span>
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'products', label: 'Produtos', icon: Package },
                  { id: 'suppliers', label: 'Fornecedores', icon: Truck },
                  { id: 'inventory', label: 'Estoque', icon: Warehouse },
                  { id: 'movements', label: 'Movimentações', icon: ArrowLeftRight },
                  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
                  { id: 'purchases', label: 'Compras', icon: ShoppingCart },
                  { id: 'sectors', label: 'Setores', icon: Building2 },
                ].map((module) => (
                  <div key={module.id} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      {React.createElement(module.icon, { size: 14, className: "text-slate-400" })}
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wide">{module.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                       <label className={`
                          cursor-pointer p-2 rounded-lg text-[10px] font-bold text-center transition border flex items-center justify-center
                          ${editingPermissionsUser.permissions[module.id as keyof UserPermissions] === 'none' 
                            ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800' 
                            : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-500'}
                       `}>
                         <input 
                           type="radio" 
                           name={`edit-perm-${module.id}`}
                           className="hidden"
                           checked={editingPermissionsUser.permissions[module.id as keyof UserPermissions] === 'none'}
                           onChange={() => setEditingPermissionsUser({
                             ...editingPermissionsUser,
                             permissions: { ...editingPermissionsUser.permissions, [module.id]: 'none' }
                           })}
                         />
                         Bloqueado
                       </label>
                       <label className={`
                          cursor-pointer p-2 rounded-lg text-[10px] font-bold text-center transition border flex items-center justify-center
                          ${editingPermissionsUser.permissions[module.id as keyof UserPermissions] === 'view' 
                            ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' 
                            : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-500'}
                       `}>
                         <input 
                           type="radio" 
                           name={`edit-perm-${module.id}`}
                           className="hidden"
                           checked={editingPermissionsUser.permissions[module.id as keyof UserPermissions] === 'view'}
                           onChange={() => setEditingPermissionsUser({
                             ...editingPermissionsUser,
                             permissions: { ...editingPermissionsUser.permissions, [module.id]: 'view' }
                           })}
                         />
                         Ver
                       </label>
                       <label className={`
                          cursor-pointer p-2 rounded-lg text-[10px] font-bold text-center transition border flex items-center justify-center
                          ${editingPermissionsUser.permissions[module.id as keyof UserPermissions] === 'full' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800' 
                            : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-500'}
                       `}>
                         <input 
                           type="radio" 
                           name={`edit-perm-${module.id}`}
                           className="hidden"
                           checked={editingPermissionsUser.permissions[module.id as keyof UserPermissions] === 'full'}
                           onChange={() => setEditingPermissionsUser({
                             ...editingPermissionsUser,
                             permissions: { ...editingPermissionsUser.permissions, [module.id]: 'full' }
                           })}
                         />
                         Total
                       </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPermissionModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">Cancelar</button>
              <button onClick={handleSavePermissions} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;