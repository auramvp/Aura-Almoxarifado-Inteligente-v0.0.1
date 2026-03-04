import { supabase } from './supabaseClient';
import { EmailService } from './emailService';
import {
  User, UserRole, Product, StockMovement,
  MovementType, StockBalance, AuditLog, Location,
  Supplier, DashboardStats, Category, Company, Sector,
  TaxAnalysisRequest, TaxDocument, Plan, Subscription, Invoice,
  SupportTicket, ProductType, ExitType, ReturnStatus
} from '../types';
import { AlertService } from './alertService';

export { supabase };

const normalize = (str: string | undefined): string => {
  if (!str) return '';
  return str.trim().toUpperCase().replace(/\s+/g, ' ');
};

// Feature mapping from Plan.features to internal module IDs
export type SystemModule = 'inventory' | 'reports' | 'ai' | 'purchases' | 'sectors' | 'suppliers' | 'support';

export const MODULE_MAPPING: Record<string, SystemModule> = {
  'Controle de Estoque Básico': 'inventory',
  'Controle Avançado': 'inventory',
  'IA Otimizadora': 'ai',
  'IA Premium': 'ai',
  'Relatórios Simples': 'reports',
  'Relatórios Avançados': 'reports',
  'Suporte Prioritário': 'support',
  'API Dedicada': 'purchases',
  'Gestor de Contas': 'support',
  'Ilimitado': 'inventory'
};

// Cache de assinaturas para evitar múltiplas chamadas lentas (TTL de 30s)
const subscriptionCache: Record<string, { data: Subscription; timestamp: number }> = {};

export const db = {
  async getImportHistory(): Promise<AuditLog[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];

    const { data: companyUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', user.companyId);

    const userIds = (companyUsers || []).map(u => u.id);
    if (userIds.length === 0) return [];

    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity', 'IMPORT_BATCH')
      .eq('action', 'IMPORT')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(50);

    return (data || []).map(d => ({
      id: d.id,
      entity: d.entity,
      entityId: d.entity_id,
      action: d.action,
      beforeJson: d.before_json,
      afterJson: d.after_json,
      userId: d.user_id,
      createdAt: d.created_at
    }));
  },

  async addAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>) {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      entity: log.entity,
      entity_id: log.entityId,
      action: log.action,
      before_json: log.beforeJson,
      after_json: log.afterJson,
      user_id: userData.user?.id || 'system'
    });
  },

  async getCurrentUser(authUser?: any): Promise<User | null> {
    try {
      const { data: { user } } = authUser ? { data: { user: authUser } } : await supabase.auth.getUser();

      if (user) {
        // Tentar obter do cache primeiro se o ID for o mesmo
        const cached = localStorage.getItem('aura_user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id === user.id && parsed.companyId) {
              // Retorna o cache imediatamente mas pode atualizar em background se desejar
              // Aqui vamos retornar direto para velocidade máxima
              return parsed;
            }
          } catch (e) {
            localStorage.removeItem('aura_user');
          }
        }

        let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

        // Fallback 1: buscar por email (cobre casos de ID desatualizado)
        if (!profile && user.email) {
          const { data: emailProfile } = await supabase.from('profiles')
            .select('*')
            .eq('email', user.email.toLowerCase())
            .maybeSingle();

          if (emailProfile) {
            try {
              // Tentar sincronizar o ID (pode falhar por RLS, mas tudo bem)
              const { data: updated, error: syncError } = await supabase
                .from('profiles')
                .update({ id: user.id })
                .eq('email', user.email.toLowerCase())
                .select()
                .single();

              profile = syncError ? emailProfile : (updated || emailProfile);
            } catch (syncErr) {
              profile = emailProfile;
            }
          }
        }

        // Fallback 2: se ainda não tem perfil, criar um mínimo automaticamente
        // (cobre casos onde o auth user existe mas o perfil foi deletado ou nunca criado)
        if (!profile && user.email) {
          try {
            const { data: newProfile } = await supabase.from('profiles').insert({
              id: user.id,
              name: user.email.split('@')[0],
              email: user.email.toLowerCase(),
              role: UserRole.ALMOXARIFE,
              // Sem company_id — não vincular a empresa errada automaticamente
            }).select().single();
            profile = newProfile;
          } catch (insertErr) {
            console.error("Erro ao criar perfil de fallback:", insertErr);
          }
        }

        if (!profile) return null;

        const fullUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as UserRole,
          createdAt: profile.created_at,
          companyId: profile.company_id,
          accessCode: profile.access_code,
          permissions: profile.permissions
        } as User;

        localStorage.setItem('aura_user', JSON.stringify(fullUser));
        return fullUser;
      }
    } catch (err) {
      console.error("Erro ao buscar usuário atual:", err);
    }

    const cached = localStorage.getItem('aura_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && parsed.companyId) {
          return parsed;
        }
      } catch (e) {
        localStorage.removeItem('aura_user');
      }
    }

    return null;
  },



  async login(email: string, password?: string, captchaToken?: string): Promise<User | null> {
    let authUser: any = null;
    if (password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
        options: { captchaToken }
      });
      if (error) throw error;
      authUser = data.user;
    }

    // Se temos o authUser (do login manual), usamos o ID dele que é muito mais rápido que filtrar por email
    const query = authUser
      ? supabase.from('profiles').select('*').eq('id', authUser.id)
      : supabase.from('profiles').select('*').eq('email', email.toLowerCase());

    const { data: profile } = await query.maybeSingle();
    if (!profile) return null;

    const fullUser = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role as UserRole,
      createdAt: profile.created_at,
      companyId: profile.company_id,
      accessCode: profile.access_code,
      permissions: profile.permissions
    } as User;

    localStorage.setItem('aura_user', JSON.stringify(fullUser));
    return fullUser;
  },

  async resetPassword(email: string, captchaToken?: string): Promise<void> {
    const isProd = window.location.hostname === 'app.auraalmoxarifado.com.br';
    const redirectTo = isProd ? 'https://app.auraalmoxarifado.com.br' : window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo,
      captchaToken
    });
    if (error) throw error;
  },

  async addUser(user: { name: string; email?: string; role: UserRole; companyId: string; accessCode?: string; permissions?: any }): Promise<User> {
    if (!user.companyId) throw new Error("ID da empresa é obrigatório");

    const sub = await this.getSubscription(user.companyId);
    if (sub?.plan) {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('company_id', user.companyId);
      if (count && count >= sub.plan.maxUsers) {
        throw new Error(`Limite de usuários atingido para o seu plano (${sub.plan.maxUsers}).`);
      }
    }

    const email = user.email || `${user.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}.${Date.now().toString().slice(-4)}@aura.local`;

    const { data, error } = await supabase.from('profiles').insert({
      name: user.name,
      email: email,
      role: user.role,
      company_id: user.companyId,
      access_code: user.accessCode || '',
      permissions: user.permissions || {}
    }).select().single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as UserRole,
      createdAt: data.created_at,
      companyId: data.company_id,
      accessCode: data.access_code,
      permissions: data.permissions
    };
  },

  async register(userData: any, companyData: any): Promise<User> {
    let finalAuthUser: any;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });

      if (authError) {
        // Se o usuário já existe, tentamos prosseguir se ele estiver autenticado
        if (authError.message.includes("User already registered") || authError.status === 422) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser && currentUser.email === userData.email) {
            finalAuthUser = currentUser;
          } else {
            // Se não conseguimos o usuário da sessão, lançamos o erro original
            throw authError;
          }
        } else {
          throw authError;
        }
      } else {
        finalAuthUser = authData.user;
      }
    } catch (err: any) {
      // Caso de erro no signUp, verificamos se já temos sessão
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && currentUser.email === userData.email) {
        finalAuthUser = currentUser;
      } else {
        throw err;
      }
    }

    if (!finalAuthUser) throw new Error("Erro ao identificar usuário de autenticação.");

    // 2. Upsert Company (CNPJ is unique)
    const { data: company, error: compErr } = await supabase.from('companies').upsert({
      cnpj: companyData.cnpj,
      name: companyData.name,
      address: companyData.address,
      email: companyData.email,
      phone: companyData.phone,
      logo: companyData.logo,
      sector_name: companyData.sectorName,
      sector_responsible: companyData.sectorResponsible,
      sector_whatsapp: companyData.sectorWhatsApp,
      sector_email: companyData.sectorEmail,
      contact_extra: companyData.contactExtra
    }, { onConflict: 'cnpj' }).select().single();

    if (compErr) throw compErr;

    // 3. Upsert Profile
    const { data: user, error: userErr } = await supabase.from('profiles').upsert({
      id: finalAuthUser.id,
      name: userData.name,
      email: userData.email,
      role: UserRole.ALMOXARIFE,
      company_id: company.id
    }, { onConflict: 'id' }).select().single();

    if (userErr) throw userErr;

    return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at, companyId: user.company_id } as User;
  },

  async registerWarehouseAdmin(userData: any, companyId: string): Promise<User> {
    let finalAuthUser: any;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });

      if (authError) {
        if (authError.message.includes("User already registered") || authError.status === 422) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser && currentUser.email === userData.email) {
            finalAuthUser = currentUser;
          } else {
            throw authError;
          }
        } else {
          throw authError;
        }
      } else {
        finalAuthUser = authData.user;
      }
    } catch (err: any) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && currentUser.email === userData.email) {
        finalAuthUser = currentUser;
      } else {
        throw err;
      }
    }

    if (!finalAuthUser) throw new Error("Erro ao identificar usuário de autenticação.");

    // Vincular o usuário à empresa (filial) existente
    const { data: profile, error: profileErr } = await supabase.from('profiles').upsert({
      id: finalAuthUser.id,
      name: userData.name,
      email: userData.email,
      role: UserRole.ALMOXARIFE,
      company_id: companyId
    }, { onConflict: 'id' }).select().single();

    if (profileErr) throw profileErr;

    // Ativar a empresa (unidade) ao finalizar o primeiro cadastro
    await supabase.from('companies').update({ status: 'Ativo' }).eq('id', companyId);

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      createdAt: profile.created_at,
      companyId: profile.company_id
    } as User;
  },

  async registerPartner(userData: { name: string, email: string, password?: string }, companyData: { cnpj: string, name: string }): Promise<User> {
    console.log("Iniciando registerPartner para:", userData.email);
    let finalAuthUser: any;

    // 1. Create or Identify Auth User
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password || Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
      });

      if (authError) {
        console.warn("Aviso no signUp de parceiro:", authError.message);
        // Se o usuário já existe, tentamos prosseguir
        if (authError.message.includes("User already registered") || authError.status === 422) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser && currentUser.email === userData.email) {
            finalAuthUser = currentUser;
            console.log("Usuário já existente identificado via sessão.");
          } else {
            // Se não temos sessão, mas o erro diz que já existe, pode ser um convite refeito
            // O Supabase não permite recuperar o User via API anon se ele já existe por questões de segurança.
            // No entanto, se o signUp deu 422 e não temos sessão, lançamos o erro original
            throw authError;
          }
        } else {
          throw authError;
        }
      } else {
        finalAuthUser = authData.user;
        console.log("Novo usuário de auth criado com sucesso.");
      }
    } catch (err: any) {
      console.error("Erro crítico no signUp de parceiro:", err);
      // Fallback: verificar se já temos sessão ativa (pode acontecer em retentativas)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && currentUser.email === userData.email) {
        finalAuthUser = currentUser;
        console.log("Recuperado usuário da sessão após erro.");
      } else {
        throw err;
      }
    }

    if (!finalAuthUser) throw new Error("Não foi possível identificar ou criar o usuário de autenticação.");

    const newUserId = finalAuthUser.id;
    console.log("ID do usuário:", newUserId);

    // 2. Upsert Company (CNPJ is unique)
    console.log("Processando empresa (CNPJ):", companyData.cnpj);
    const { data: company, error: compErr } = await supabase.from('companies').upsert({
      cnpj: companyData.cnpj,
      name: companyData.name,
      status: 'active',
      sector_name: 'Geral',
      sector_responsible: userData.name,
      email: userData.email
    }, { onConflict: 'cnpj' }).select().single();

    if (compErr) {
      console.error("Erro no upsert da empresa:", compErr);
      throw compErr;
    }
    console.log("Empresa processada ID:", company.id);

    // 3. Upsert Profile
    console.log("Processando perfil para usuário:", newUserId);
    const { data: user, error: userErr } = await supabase.from('profiles').upsert({
      id: newUserId,
      name: userData.name,
      email: userData.email,
      role: UserRole.ALMOXARIFE,
      company_id: company.id
    }, { onConflict: 'id' }).select().single();

    if (userErr) {
      console.error("Erro no upsert do perfil:", userErr);
      throw userErr;
    }
    console.log("Perfil processado com sucesso.");

    // 4. Create Automatic Partners Subscription for Partners
    console.log("Configurando plano Partners...");
    const { data: plan } = await supabase.from('plans').select('id').eq('name', 'Partners').single();

    if (plan) {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('company_id', company.id)
        .in('status', ['active', 'trialing', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSub) {
        await supabase
          .from('subscriptions')
          .update({ plan_id: plan.id, status: 'active', updated_at: new Date().toISOString() })
          .eq('id', existingSub.id);
        console.log("Assinatura existente atualizada para Partners.");
      } else {
        await supabase.from('subscriptions').insert({
          company_id: company.id,
          plan_id: plan.id,
          status: 'active',
          start_date: new Date().toISOString().split('T')[0]
        });
        console.log("Nova assinatura Partners criada.");
      }

      await supabase.from('companies').update({ plan_id: plan.id }).eq('id', company.id);
    }

    // 5. Send Magic Link for initial login
    console.log("Enviando link de acesso por e-mail...");
    await this.sendMagicLink(userData.email);

    // 6. APENAS AGORA fazer signOut - após todas as operações de DB concluídas.
    // Usamos try/catch para garantir que falha no signOut não impeça o retorno de sucesso.
    try {
      console.log("Realizando logout preventivo...");
      await supabase.auth.signOut();
      localStorage.removeItem('aura_user');
      console.log("Logout concluído.");
    } catch (logoutErr) {
      console.warn("Falha silenciosa no logout final:", logoutErr);
    }

    console.log("Registro de parceiro finalizado com sucesso.");
    return { id: user.id, name: user.name, email: user.email, role: user.role as UserRole, createdAt: user.created_at, companyId: user.company_id } as User;
  },



  async getCompanyWarehouses(parentId: string): Promise<Company[]> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('parent_id', parentId)
      .order('name');

    if (error) throw error;
    return (data || []).map(d => ({
      id: d.id,
      cnpj: d.cnpj,
      name: d.name,
      address: d.address,
      email: d.email,
      phone: d.phone,
      logo: d.logo,
      sectorName: d.sector_name,
      sectorResponsible: d.sector_responsible,
      sectorWhatsApp: d.sector_whatsapp,
      sectorEmail: d.sector_email,
      contactExtra: d.contact_extra,
      settings: d.settings,
      status: d.status,
      suspensionReason: d.status_reason,
      planId: d.plan_id,
      createdAt: d.created_at,
      parentId: d.parent_id
    }));
  },

  async checkDailyDigest() {
    const user = await this.getCurrentUser();
    if (user?.companyId) {
      const { AlertService } = await import('./alertService');
      await AlertService.checkAndSendDailyDigest(this, user.companyId);
    }
  },

  async addWarehouse(parentId: string, data: { name: string, responsibleName: string, responsibleEmail: string, cnpj?: string }): Promise<Company> {
    // Buscar dados da matriz para replicar CNPJ se não informado (ou base do CNPJ)
    const { data: parent } = await supabase.from('companies').select('*').eq('id', parentId).single();

    const { data: warehouse, error } = await supabase.from('companies').insert({
      name: data.name,
      parent_id: parentId,
      cnpj: data.cnpj || (parent ? `${parent.cnpj}-FILIAL-${Math.random().toString(36).slice(-4).toUpperCase()}` : `FILIAL-${Math.random().toString(36).slice(-4).toUpperCase()}`),
      sector_responsible: data.responsibleName,
      sector_email: data.responsibleEmail,
      email: data.responsibleEmail,
      status: 'Pendente',
      sector_name: 'Geral'
    }).select().single();

    if (error) throw error;

    return {
      id: warehouse.id,
      cnpj: warehouse.cnpj,
      name: warehouse.name,
      address: warehouse.address,
      email: warehouse.email,
      phone: warehouse.phone,
      logo: warehouse.logo,
      sectorName: warehouse.sector_name,
      sectorResponsible: warehouse.sector_responsible,
      sectorWhatsApp: warehouse.sector_whatsapp,
      sectorEmail: warehouse.sector_email,
      contactExtra: warehouse.contact_extra,
      settings: warehouse.settings,
      status: warehouse.status,
      suspensionReason: warehouse.status_reason,
      planId: warehouse.plan_id,
      createdAt: warehouse.created_at,
      parentId: warehouse.parent_id
    };
  },

  async logout() {
    await supabase.auth.signOut();
    localStorage.removeItem('aura_user');
    // Limpar cache de assinatura no logout
    Object.keys(subscriptionCache).forEach(key => delete subscriptionCache[key]);
  },

  async getCompanyById(id: string): Promise<Company | null> {
    const { data } = await supabase.from('companies').select('*').eq('id', id).single();
    if (!data) return null;
    return {
      id: data.id,
      cnpj: data.cnpj,
      name: data.name,
      address: data.address,
      email: data.email,
      phone: data.phone,
      logo: data.logo,
      sectorName: data.sector_name,
      sectorResponsible: data.sector_responsible,
      sectorWhatsApp: data.sector_whatsapp,
      sectorEmail: data.sector_email,
      contactExtra: data.contact_extra,
      settings: data.settings,
      status: data.status || 'active',
      suspensionReason: data.status_reason,
      planId: data.plan_id,
      createdAt: data.created_at,
      parentId: data.parent_id
    };
  },

  async getSubscription(companyId: string): Promise<Subscription | null> {
    const now = Date.now();
    const cached = subscriptionCache[companyId];
    if (cached && (now - cached.timestamp < 30000)) {
      return cached.data;
    }

    const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
    if (!company) return null;

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .or(`company_id.eq.${companyId},cnpj.eq.${company?.cnpj}`)
      .in('status', ['active', 'trialing', 'past_due', 'Ativo'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let planData = null;
    if (company.plan_id) {
      const { data: plan } = await supabase.from('plans').select('*').eq('id', company.plan_id).maybeSingle();
      planData = plan;
    } else if (sub?.plan_id) {
      const { data: plan } = await supabase.from('plans').select('*').eq('id', sub.plan_id).maybeSingle();
      planData = plan;
    } else if (sub?.plan) {
      const { data: plan } = await supabase.from('plans').select('*').eq('name', sub.plan).maybeSingle();
      planData = plan;
    }

    if (!planData && !sub) return null;

    const subscription: Subscription = {
      id: sub?.id || 'manual-' + companyId,
      companyId: companyId,
      planId: planData?.id || sub?.plan_id || '',
      status: (sub?.status === 'Ativo' ? 'active' : sub?.status || 'active') as any,
      startDate: sub?.created_at || company.created_at,
      nextBillingDate: sub?.next_billing || sub?.next_billing_date || '',
      paymentMethod: sub?.payment_method || 'PIX',
      plan: {
        id: planData?.id || '',
        name: planData?.name || sub?.plan || 'Plano Personalizado',
        maxUsers: planData?.max_users || 999,
        maxItems: planData?.max_items || 9999,
        price: Number(sub?.value || planData?.value || 0),
        interval: 'monthly',
        features: planData?.description
          ? planData.description.split(/[,\n;]+/).map((f: string) => f.trim()).filter(Boolean)
          : [],
        active: true
      }
    };

    subscriptionCache[companyId] = { data: subscription, timestamp: now };
    return subscription;
  },

  async getInvoices(companyId: string): Promise<Invoice[]> {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('billing_date', { ascending: false });

    return (data || []).map(inv => ({
      id: inv.id,
      companyId: inv.company_id,
      amount: Number(inv.amount),
      status: inv.status,
      billingDate: inv.billing_date,
      dueDate: inv.due_date,
      pdfUrl: inv.pdf_url,
      description: inv.description || inv.plan_name,
      paymentMethod: inv.payment_method,
      planName: inv.plan_name
    })) as any;
  },

  async getPlans(): Promise<Plan[]> {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('status', 'active');

    return (data || []).map(p => ({
      id: p.id,
      name: p.name,
      maxUsers: p.max_users,
      maxItems: p.max_items,
      price: Number(p.value),
      interval: 'monthly',
      features: p.description ? [p.description] : [],
      active: p.status === 'active'
    }));
  },

  async sendMagicLink(email: string, captchaToken?: string): Promise<void> {
    const isProd = window.location.hostname === 'app.auraalmoxarifado.com.br';
    const redirectTo = isProd ? 'https://app.auraalmoxarifado.com.br' : window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        captchaToken
      }
    });
    if (error) throw error;
  },

  async hasActiveSubscription(email: string): Promise<boolean> {
    const result = await this.validateAsaasSubscription(email);
    return result.valid;
  },

  async validateAsaasSubscription(email: string, cpfCnpj?: string): Promise<{ valid: boolean; status: string; message: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('validate-subscription', {
        body: { email, cpfCnpj }
      });

      if (error) {
        console.error('Error calling validate-subscription:', error);
        // Fallback to local database check
        return this.fallbackSubscriptionCheck(email);
      }

      return {
        valid: data.valid || false,
        status: data.status || 'ERROR',
        message: data.message || 'Erro ao validar assinatura'
      };
    } catch (err) {
      console.error('Exception in validateAsaasSubscription:', err);
      return this.fallbackSubscriptionCheck(email);
    }
  },

  async fallbackSubscriptionCheck(email: string): Promise<{ valid: boolean; status: string; message: string }> {
    // Fallback to local database if Edge Function fails
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('email', email)
      .in('status', ['active', 'Ativo', 'trialing', 'trial'])
      .limit(1);

    if (error || !data || data.length === 0) {
      return { valid: false, status: 'NOT_FOUND', message: 'Nenhuma assinatura encontrada.' };
    }
    return { valid: true, status: 'ACTIVE', message: 'Assinatura válida (verificação local).' };
  },

  async verifyAsaasOnboarding(email: string): Promise<{ valid: boolean; status?: string; message?: string }> {
    return this.validateAsaasSubscription(email);
  },

  async getSectors(): Promise<Sector[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];

    const { data } = await supabase.from('sectors').select('*').eq('company_id', user.companyId).order('name', { ascending: true });
    return (data || []).map(s => ({
      id: s.id,
      companyId: s.company_id,
      name: s.name,
      color: s.color,
      people: s.people || [],
      createdAt: s.created_at
    }));
  },

  async saveSector(s: any): Promise<Sector> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");

    const { data, error } = await supabase.from('sectors').insert({ ...s, company_id: user.companyId }).select().single();
    if (error) throw error;
    await this.addAuditLog({ entity: 'sectors', entityId: data.id, action: 'CREATE', afterJson: JSON.stringify(data) });
    return data;
  },

  async updateSector(id: string, updates: any): Promise<Sector> {
    const { data, error } = await supabase.from('sectors').update(updates).eq('id', id).select().single();
    if (error) throw error;
    if (!data) throw new Error("Erro ao criar unidade: nenhum dado retornado."); // Changed 'warehouse' to 'data'

    return data;
  },

  async getSectorConsumption(sectorId: string): Promise<{ total: number; movements: StockMovement[] }> {
    const movements = await this.getMovements();
    const sectorMovements = movements.filter(m => m.sectorId === sectorId && m.type === MovementType.OUT);
    const total = sectorMovements.reduce((acc, m) => acc + m.totalValue, 0);
    return { total, movements: sectorMovements };
  },

  async createSupportTicket(description: string): Promise<SupportTicket> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");
    const company = await this.getCompanyById(user.companyId);

    const payload = {
      company_id: user.companyId,
      company_name: company?.name || 'Não informada',
      user_id: user.id,
      user_name: user.name,
      description: description,
      status: 'Em aberto'
    };

    const { data, error } = await supabase
      .from('support_tickets')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      companyId: data.company_id,
      userId: data.user_id,
      userName: data.user_name,
      companyName: data.company_name,
      description: data.description,
      status: data.status,
      createdAt: data.created_at
    };
  },

  async getSupportTickets(): Promise<SupportTicket[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('company_id', user.companyId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
      id: d.id,
      companyId: d.company_id,
      userId: d.user_id,
      userName: d.user_name,
      companyName: d.company_name,
      description: d.description,
      status: d.status,
      createdAt: d.created_at,
      resolution: d.resolution,
      resolvedAt: d.resolved_at,
      resolvedBy: d.resolved_by,
      startedAt: d.started_at,
      startedBy: d.started_by
    }));
  },

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const { data, error } = await supabase.from('companies').update({
      name: updates.name,
      address: updates.address,
      email: updates.email,
      phone: updates.phone,
      sector_name: updates.sectorName,
      sector_responsible: updates.sectorResponsible,
      sector_whatsapp: updates.sectorWhatsApp,
      sector_email: updates.sectorEmail,
      contact_extra: updates.contactExtra,
      settings: updates.settings
    }).eq('id', id).select().single();

    if (error) throw error;

    return {
      id: data.id,
      cnpj: data.cnpj,
      name: data.name,
      address: data.address,
      email: data.email,
      phone: data.phone,
      logo: data.logo,
      sectorName: data.sector_name,
      sectorResponsible: data.sector_responsible,
      sectorWhatsApp: data.sector_whatsapp,
      sectorEmail: data.sector_email,
      contactExtra: data.contact_extra,
      settings: data.settings,
      status: data.status || 'active',
      suspensionReason: data.suspension_reason,
      createdAt: data.created_at,
      parentId: data.parent_id
    };
  },

  async deleteSector(id: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");
    const { error } = await supabase.from('sectors').delete().eq('id', id).eq('company_id', user.companyId);
    if (error) throw error;
    await this.addAuditLog({ entity: 'sectors', entityId: id, action: 'DELETE' });
  },

  async getLocations(): Promise<Location[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];
    const { data } = await supabase.from('locations').select('*').eq('company_id', user.companyId);
    return (data || []) as Location[];
  },

  async getCategories(): Promise<Category[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];
    const { data } = await supabase.from('categories').select('*').eq('company_id', user.companyId);
    return (data || []) as Category[];
  },

  async addCategory(c: any): Promise<Category> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");
    const { data, error } = await supabase.from('categories').insert({ ...c, company_id: user.companyId }).select().single();
    if (error) throw error;
    return data as Category;
  },

  async updateCategory(id: string, updates: any): Promise<Category> {
    const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Category;
  },

  async deleteCategory(id: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");
    await supabase.from('categories').delete().eq('id', id).eq('company_id', user.companyId);
  },

  async getSuppliers(): Promise<Supplier[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];
    const { data } = await supabase.from('suppliers').select('*').eq('company_id', user.companyId);
    return (data || []) as Supplier[];
  },

  async addSupplier(s: any): Promise<Supplier> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");
    const payload = {
      name: s.name, cnpj: s.cnpj, phone: s.phone, email: s.email,
      address: s.address, cep: s.cep, website: s.website,
      contact_person: s.contactPerson, company_id: user.companyId
    };
    const { data, error } = await supabase.from('suppliers').insert(payload).select().single();
    if (error) throw error;
    return data as Supplier;
  },

  async updateSupplier(id: string, updates: any): Promise<Supplier> {
    const payload = { name: updates.name, cnpj: updates.cnpj, phone: updates.phone, email: updates.email, address: updates.address, cep: updates.cep, website: updates.website, contact_person: updates.contactPerson };
    const { data, error } = await supabase.from('suppliers').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Supplier;
  },

  async deleteSupplier(id: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");
    await supabase.from('suppliers').delete().eq('id', id).eq('company_id', user.companyId);
  },

  async getProducts(): Promise<Product[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];
    const { data, error } = await supabase.from('products').select('*').eq('active', true).eq('company_id', user.companyId);
    if (error) return [];
    return (data || []).map(p => ({
      id: p.id, companyId: p.company_id, cod: p.cod, description: p.description, type: p.type, unit: p.unit, minStock: p.min_stock, category_id: p.category_id, categoryId: p.category_id, defaultSupplierId: p.default_supplier_id, storageLocation: p.storage_location, observations: p.observations, pmed: Number(p.pmed || 0), active: p.active, createdAt: p.created_at, updatedAt: p.updated_at
    })) as Product[];
  },

  async saveProduct(p: any): Promise<Product> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");

    const sub = await this.getSubscription(user.companyId);
    if (sub?.plan) {
      const count = await this.getProductsCount(user.companyId);
      if (count >= sub.plan.maxItems) {
        throw new Error(`Limite de produtos atingido para o seu plano (${sub.plan.maxItems}).`);
      }
    }

    const payload = {
      cod: normalize(p.cod), description: p.description, type: p.type || 'CONSUMABLE', unit: normalize(p.unit),
      min_stock: p.min_stock, category_id: p.categoryId || null,
      default_supplier_id: p.defaultSupplierId || null,
      storage_location: normalize(p.storageLocation), observations: p.observations,
      pmed: Number(p.pmed || 0), active: true, company_id: user.companyId
    };
    const { data, error } = await supabase.from('products').insert(payload).select().single();
    if (error) throw error;
    return data as Product;
  },

  async updateProduct(id: string, updates: any): Promise<Product> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");

    const payload: any = {};
    if (updates.cod !== undefined) payload.cod = normalize(updates.cod);
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.unit !== undefined) payload.unit = normalize(updates.unit);
    if (updates.minStock !== undefined) payload.min_stock = updates.minStock;
    if (updates.categoryId !== undefined) payload.category_id = updates.categoryId || null;
    if (updates.defaultSupplierId !== undefined) payload.default_supplier_id = updates.defaultSupplierId || null;
    if (updates.storageLocation !== undefined) payload.storage_location = normalize(updates.storageLocation);
    if (updates.observations !== undefined) payload.observations = updates.observations;
    if (updates.pmed !== undefined) payload.pmed = Number(updates.pmed || 0);

    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('products').update(payload).eq('id', id).eq('company_id', user.companyId).select().single();
    if (error) throw error;
    return data as Product;
  },

  async getMovements(): Promise<StockMovement[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];
    const { data } = await supabase.from('stock_movements').select('*').eq('company_id', user.companyId).order('created_at', { ascending: false });
    return (data || []).map(m => ({
      id: m.id, companyId: m.company_id, movementDate: m.movement_date, monthRef: m.month_ref,
      productId: m.product_id, supplierId: m.supplier_id, supplierName: m.supplier_name, sectorId: m.sector_id,
      personName: m.person_name, type: m.type as MovementType,
      quantity: Number(m.quantity || 0), totalValue: Number(m.total_value || 0),
      destination: m.destination, invoiceNumber: m.invoice_number, invoiceDate: m.invoice_date,
      invoiceValue: Number(m.invoice_value || 0), invoiceUrl: m.invoice_url,
      pmedAtTime: Number(m.pmed_at_time || 0), createdByUserId: m.created_by_user_id,
      createdAt: m.created_at, originId: m.origin_id || '',
      exitType: m.exit_type as ExitType,
      returnedQuantity: Number(m.returned_quantity || 0),
      returnStatus: m.return_status as ReturnStatus,
      returnObservation: m.return_observation
    })) as StockMovement[];
  },

  async createMovement(m: any): Promise<StockMovement> {
    const { data: userData } = await supabase.auth.getUser();
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");

    const { data: product } = await supabase.from('products').select('*').eq('id', m.productId).eq('company_id', user.companyId).single();
    if (!product) throw new Error('Produto não encontrado');

    const movements = await this.getMovements();
    const currentStock = movements.filter(mov => mov.productId === m.productId).reduce((acc, curr) => curr.type === MovementType.IN ? acc + curr.quantity : acc - curr.quantity, 0);

    if (m.type === MovementType.OUT && currentStock < m.quantity) throw new Error(`Saldo insuficiente. Disponível: ${currentStock}`);

    let newPmed = Number(product.pmed);
    if (m.type === MovementType.IN) {
      const unitCost = Number(m.totalValue) / Number(m.quantity);
      newPmed = currentStock === 0 ? unitCost : (currentStock * Number(product.pmed) + Number(m.quantity) * unitCost) / (currentStock + Number(m.quantity));
      await this.updateProduct(product.id, { pmed: newPmed });
    }

    const movementDate = m.movementDate || new Date().toISOString().split('T')[0];
    const payload = {
      movement_date: movementDate, month_ref: movementDate.substring(0, 7),
      product_id: m.productId, supplier_id: m.supplierId || null, supplier_name: m.supplierName || null,
      sector_id: m.sectorId || null, person_name: m.personName || null,
      type: m.type, quantity: m.quantity, total_value: m.totalValue,
      destination: normalize(m.destination), invoice_number: m.invoiceNumber,
      invoice_date: m.invoiceDate || null, invoice_value: m.invoiceValue || 0,
      invoice_url: m.invoiceUrl || null,
      pmed_at_time: Number(product.pmed || 0), created_by_user_id: userData.user?.id || 'system',
      company_id: user.companyId,
      exit_type: m.exitType || null,
      returned_quantity: Number(m.returnedQuantity || 0),
      return_status: m.returnStatus || 'OK',
      return_observation: m.returnObservation || null,
      origin_id: m.originId || null
    };
    const { data, error } = await supabase.from('stock_movements').insert(payload).select().single();
    if (error) throw error;

    try {
      let finalStock = currentStock;
      if (m.type === MovementType.OUT) finalStock -= Number(m.quantity);
      else finalStock += Number(m.quantity);

      const company = await this.getCompanyById(user.companyId);
      const settings = company?.settings?.alerts;

      const recipients: string[] = [];
      if (settings?.alertEmails) {
        recipients.push(...settings.alertEmails.split(',').map(e => e.trim()).filter(e => e));
      }

      if (recipients.length === 0) {
        const defaultEmail = company?.sectorEmail || company?.email;
        if (defaultEmail) recipients.push(defaultEmail);
      }

      if (settings && recipients.length > 0) {
        const history = [data, ...movements.filter(pm => pm.productId === m.productId)];
        await AlertService.processMovementAlert({
          product: product,
          currentStock: finalStock,
          movements: history,
          settings: settings,
          recipients: recipients
        }, this, Number(m.quantity), m.type);
      }
    } catch (alertError) {
      console.error("Erro ao processar alertas:", alertError);
    }

    return data as StockMovement;
  },

  async updateMovement(id: string, updates: Partial<StockMovement>): Promise<void> {
    const payload: any = {};
    if (updates.returnedQuantity !== undefined) payload.returned_quantity = updates.returnedQuantity;
    if (updates.returnStatus !== undefined) payload.return_status = updates.returnStatus;
    if (updates.returnObservation !== undefined) payload.return_observation = updates.returnObservation;

    const { error } = await supabase.from('stock_movements').update(payload).eq('id', id);
    if (error) throw error;
  },

  async getStockBalances(): Promise<StockBalance[]> {
    const movements = await this.getMovements();
    const balanceMap: Record<string, number> = {};
    movements.forEach(m => {
      balanceMap[m.productId] = (balanceMap[m.productId] || 0) + (m.type === MovementType.IN ? Number(m.quantity) : -Number(m.quantity));
    });
    return Object.entries(balanceMap).map(([pId, qty]) => ({ productId: pId, locationId: 'ALMOXARIFADO', quantity: qty })).filter(b => b.quantity !== 0);
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const products = await this.getProducts();
    const movements = await this.getMovements();
    const sectors = await this.getSectors();

    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.toISOString().substring(0, 7);

    const balanceMap: Record<string, number> = {};
    movements.forEach(m => { balanceMap[m.productId] = (balanceMap[m.productId] || 0) + (m.type === MovementType.IN ? m.quantity : -m.quantity); });

    const belowMin = products.filter(p => (balanceMap[p.id] || 0) < p.minStock).length;

    const productValues = products.map(p => ({
      name: p.description,
      value: (balanceMap[p.id] || 0) * p.pmed
    })).sort((a, b) => b.value - a.value).slice(0, 10);

    const trueTotalInventoryValue = products.reduce((sum, p) => sum + ((balanceMap[p.id] || 0) * p.pmed), 0);

    const monthMovements = movements.filter(m => m.monthRef === currentMonth);
    const prevMonthMovements = movements.filter(m => m.monthRef === prevMonth);

    const entriesValue = monthMovements.filter(m => m.type === MovementType.IN).reduce((sum, m) => sum + m.totalValue, 0);
    const exitsValue = monthMovements.filter(m => m.type === MovementType.OUT).reduce((sum, m) => sum + m.totalValue, 0);
    const prevExitsValue = prevMonthMovements.filter(m => m.type === MovementType.OUT).reduce((sum, m) => sum + m.totalValue, 0);

    const consumptionMap: Record<string, number> = {};
    monthMovements.filter(m => m.type === MovementType.OUT).forEach(m => {
      consumptionMap[m.productId] = (consumptionMap[m.productId] || 0) + m.quantity;
    });
    const mostConsumedId = Object.keys(consumptionMap).reduce((a, b) => consumptionMap[a] > consumptionMap[b] ? a : b, '');
    const mostConsumedProductObj = products.find(p => p.id === mostConsumedId);
    const mostConsumedProduct = mostConsumedProductObj ? {
      name: mostConsumedProductObj.description,
      quantity: consumptionMap[mostConsumedId],
      unit: mostConsumedProductObj.unit,
      value: consumptionMap[mostConsumedId] * mostConsumedProductObj.pmed
    } : undefined;

    const sectorConsumptionMap: Record<string, number> = {};
    monthMovements.filter(m => m.type === MovementType.OUT && m.sectorId).forEach(m => {
      sectorConsumptionMap[m.sectorId!] = (sectorConsumptionMap[m.sectorId!] || 0) + m.totalValue;
    });
    const topSectorId = Object.keys(sectorConsumptionMap).reduce((a, b) => sectorConsumptionMap[a] > sectorConsumptionMap[b] ? a : b, '');
    const topSectorObj = sectors.find(s => s.id === topSectorId);
    const topConsumerSector = topSectorObj ? {
      name: topSectorObj.name,
      value: sectorConsumptionMap[topSectorId]
    } : undefined;

    // Enhanced AI Insights Logic
    let aiInsight: { title: string; content: string; type: 'success' | 'warning' | 'info' } = {
      title: "Análise de Consumo",
      content: "Mantenha o registro de entradas e saídas em dia para insights mais precisos.",
      type: 'info'
    };

    const belowMinRatio = products.length > 0 ? (belowMin / products.length) : 0;
    const inactiveProducts = products.filter(p => !movements.some(m => m.productId === p.id)).length;
    const inactiveRatio = products.length > 0 ? (inactiveProducts / products.length) : 0;

    // Priority: Alerts > Economy > Inactivity > Generic
    if (belowMinRatio > 0.15) {
      aiInsight = {
        title: "Risco de Ruptura",
        content: `Atenção: ${(belowMinRatio * 100).toFixed(0)}% do seu catálogo está abaixo do estoque mínimo. Recomendamos reposição imediata.`,
        type: 'warning'
      };
    } else if (exitsValue < prevExitsValue && prevExitsValue > 0) {
      const decrease = ((prevExitsValue - exitsValue) / prevExitsValue) * 100;
      aiInsight = {
        title: "Economia Detectada",
        content: `Você reduziu os custos operacionais em ${decrease.toFixed(1)}% comparado ao mês passado. Ótimo trabalho!`,
        type: 'success'
      };
    } else if (inactiveRatio > 0.3) {
      aiInsight = {
        title: "Estoque Ocioso",
        content: `Detectamos que ${(inactiveRatio * 100).toFixed(0)}% dos seus itens não tiveram movimentação recente. Considere revisar o mix de produtos.`,
        type: 'info'
      };
    } else if (exitsValue > prevExitsValue && prevExitsValue > 0) {
      const increase = ((exitsValue - prevExitsValue) / prevExitsValue) * 100;
      aiInsight = {
        title: "Aumento de Demanda",
        content: `O consumo este mês subiu ${increase.toFixed(1)}%. Verifique se há necessidade de ajuste no planejamento de compras.`,
        type: 'warning'
      };
    } else if (trueTotalInventoryValue > 50000) {
      aiInsight = {
        title: "Patrimônio Robusto",
        content: `Seu almoxarifado gerencia atualmente mais de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(50000)} em ativos.`,
        type: 'info'
      };
    }

    return {
      belowMinCount: belowMin,
      totalEntriesMonth: entriesValue,
      totalExitsMonth: exitsValue,
      totalProducts: products.length,
      totalInventoryValue: trueTotalInventoryValue,
      topItemsByCost: productValues,
      recentMovements: movements.slice(0, 5),
      mostConsumedProduct,
      topConsumerSector,
      previousMonthExits: prevExitsValue,
      aiInsight,
      lastUpdated: new Date().toISOString()
    };
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    return (data || []).map(l => ({ id: l.id, entity: l.entity, entityId: l.entity_id, action: l.action, beforeJson: l.before_json, afterJson: l.after_json, userId: l.user_id, createdAt: l.created_at })) as AuditLog[];
  },

  async uploadTaxDocument(file: File, companyId: string): Promise<string> {
    const safeFileName = file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${companyId}/${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from('tax-documents').upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data, error } = await supabase.storage.from('tax-documents').createSignedUrl(fileName, 60 * 60 * 24 * 365);
    if (error) throw error;
    return data.signedUrl;
  },

  async createTaxAnalysisRequest(request: { companyId: string, documents: TaxDocument[] }): Promise<TaxAnalysisRequest> {
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      company_id: request.companyId,
      requester_user_id: userData.user?.id,
      status: 'PENDING',
      documents: request.documents,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('tax_analysis_requests').insert(payload).select().single();
    if (error) throw error;
    return {
      id: data.id, companyId: data.company_id, requesterUserId: data.requester_user_id,
      status: data.status, documents: data.documents, createdAt: data.created_at, updatedAt: data.updated_at
    };
  },

  async getTaxAnalysisRequests(companyId: string): Promise<TaxAnalysisRequest[]> {
    const { data, error } = await supabase.from('tax_analysis_requests').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id, companyId: r.company_id, requesterUserId: r.requester_user_id,
      status: r.status, documents: r.documents, createdAt: r.created_at, updatedAt: r.updated_at
    }));
  },

  async getCompanyUsers(companyId: string): Promise<User[]> {
    const { data, error } = await supabase.from('profiles').select('*').eq('company_id', companyId);
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id, name: p.name, email: p.email, role: p.role as UserRole,
      createdAt: p.created_at, companyId: p.company_id, accessCode: p.access_code, permissions: p.permissions
    }));
  },

  async loginWithAccessCode(name: string, code: string): Promise<User | null> {
    const { data: profiles, error } = await supabase.from('profiles').select('*').ilike('name', name).eq('access_code', code);
    if (error || !profiles || profiles.length === 0) return null;
    const profile = profiles[0];
    const fullUser = {
      id: profile.id, name: profile.name, email: profile.email, role: profile.role as UserRole,
      createdAt: profile.created_at, companyId: profile.company_id, accessCode: profile.access_code, permissions: profile.permissions
    } as User;
    localStorage.setItem('aura_user', JSON.stringify(fullUser));
    return fullUser;
  },

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
  },

  async updateUserPermissions(userId: string, permissions: any): Promise<void> {
    const { error } = await supabase.from('profiles').update({ permissions }).eq('id', userId);
    if (error) throw error;
  },

  async removeUser(userId: string): Promise<void> {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
  },

  async getProfilesCount(companyId: string): Promise<number> {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
    return count || 0;
  },

  async getProductsCount(companyId: string): Promise<number> {
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('active', true);
    return count || 0;
  },

  async canAccessModule(companyId: string, moduleId: SystemModule): Promise<boolean> {
    const sub = await this.getSubscription(companyId);
    if (!sub?.plan?.features || sub.plan.features.length === 0) {
      // Basic plans might not have explicit features in description yet, 
      // but 'inventory' is usually basic.
      if (moduleId === 'inventory') return true;
      return false;
    }

    const normalizedPlanName = sub.plan.name.toLowerCase();
    if (normalizedPlanName.includes('partners') || normalizedPlanName.includes('enterprise')) return true;

    return sub.plan.features.some(feature => {
      const f = feature.toLowerCase();
      if (f.includes('ilimitado') || f.includes('unlimited') || f.includes('todos os módulos')) return true;

      const mappedModule = MODULE_MAPPING[feature];
      return mappedModule === moduleId;
    });
  },

  async getActiveBanners(): Promise<any[]> {
    // We fetch all active banners and filter dates in JS to handle NULLs effectively
    // because Supabase filters are rigid with NULLs in range queries
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching banners:', error);
      return [];
    }

    const now = new Date().toISOString();
    return (data || []).filter(banner => {
      const starts = !banner.start_date || banner.start_date <= now;
      const ends = !banner.end_date || banner.end_date >= now;
      return starts && ends;
    });
  },
  async addExportLog(userId: string, type: string, count: number, details: string): Promise<void> {
    const payload = {
      entity: 'export',
      entity_id: type, // Using type as entity_id (e.g., 'products', 'movements')
      action: 'EXPORT',
      user_id: userId,
      after_json: { type, count, details },
      created_at: new Date().toISOString()
    };
    await supabase.from('audit_logs').insert(payload);
  },

  async getExportHistory(): Promise<AuditLog[]> {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'EXPORT')
      .order('created_at', { ascending: false });

    return (data || []).map(l => ({
      id: l.id,
      entity: l.entity,
      entityId: l.entity_id,
      action: l.action,
      beforeJson: l.before_json,
      afterJson: l.after_json,
      userId: l.user_id,
      createdAt: l.created_at
    })) as AuditLog[];
  },

  // ─── Transfers ───────────────────────────────────────────────

  async createTransfer(data: {
    fromCompanyId: string;
    toCompanyId: string;
    items: { productId: string; description: string; quantity: number; pmed: number }[];
    reason: string;
    createdBy: string;
  }): Promise<{ id: string }> {
    const { data: transfer, error } = await supabase
      .from('stock_transfers')
      .insert({
        from_company_id: data.fromCompanyId,
        to_company_id: data.toCompanyId,
        items: data.items,
        reason: data.reason,
        created_by: data.createdBy,
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: transfer.id };
  },

  async getTransfers(companyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('stock_transfers')
      .select('*')
      .or(`from_company_id.eq.${companyId},to_company_id.eq.${companyId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async confirmTransfer(transferId: string, confirmedBy: string): Promise<void> {
    const { error } = await supabase.rpc('process_stock_transfer', {
      p_transfer_id: transferId,
      p_user_id: confirmedBy,
      p_action: 'confirm'
    });
    if (error) throw new Error('Erro ao confirmar transferência: ' + error.message);
  },

  async rejectTransfer(transferId: string, rejectedBy: string): Promise<void> {
    const { error } = await supabase.rpc('process_stock_transfer', {
      p_transfer_id: transferId,
      p_user_id: rejectedBy,
      p_action: 'reject'
    });
    if (error) throw new Error('Erro ao rejeitar transferência: ' + error.message);
  }
};
