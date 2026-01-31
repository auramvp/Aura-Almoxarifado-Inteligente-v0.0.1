import { supabase } from './supabaseClient';
import { EmailService } from './emailService';
import { 
  User, UserRole, Product, StockMovement, 
  MovementType, StockBalance, AuditLog, Location, 
  Supplier, DashboardStats, Category, Company, Sector,
  TaxAnalysisRequest, TaxDocument, Plan, Subscription, Invoice
} from '../types.ts';
import { AlertService } from './alertService';

export { supabase };

const normalize = (str: string | undefined): string => {
  if (!str) return '';
  return str.trim().toUpperCase().replace(/\s+/g, ' ');
};

export const db = {
  async getImportHistory(): Promise<AuditLog[]> {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity', 'IMPORT_BATCH')
      .eq('action', 'IMPORT')
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

  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. If valid Auth session exists, return fresh profile
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
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
      
      // Update cache
      localStorage.setItem('aura_user', JSON.stringify(fullUser));
      return fullUser;
    }

    // 2. Fallback: Check LocalStorage for "Legacy Login"
    const cached = localStorage.getItem('aura_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Verify if it looks like a valid user
        if (parsed && parsed.id && parsed.companyId) {
          return parsed;
        }
      } catch (e) {
        localStorage.removeItem('aura_user');
      }
    }

    return null;
  },

  async login(email: string, password?: string): Promise<User | null> {
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });
      if (error) {
        console.error("Supabase Auth Error (ignoring for legacy access):", error);
      }
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).single();
    if (!profile) return null;
    let role = profile.role;
    
    const fullUser = { 
      id: profile.id, 
      name: profile.name, 
      email: profile.email, 
      role: role as UserRole, 
      createdAt: profile.created_at, 
      companyId: profile.company_id,
      accessCode: profile.access_code,
      permissions: profile.permissions
    } as User;

    // Save to LocalStorage for persistence
    localStorage.setItem('aura_user', JSON.stringify(fullUser));

    return fullUser;
  },

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  },

  async register(userData: any, companyData: any): Promise<User> {
    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Erro ao criar usuário de autenticação.");

    // 2. Create Company
    const { data: company, error: compErr } = await supabase.from('companies').insert({ 
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
    }).select().single();
    
    if (compErr) {
      // Rollback auth user if company creation fails? 
      // Ideally yes, but Supabase doesn't support transactions across auth and public schema easily from client.
      // For now, we assume it works or manual cleanup is needed.
      throw compErr;
    }
    
    // 3. Create Profile linked to Auth User
    const { data: user, error: userErr } = await supabase.from('profiles').insert({ 
      id: authData.user.id, // Link to Auth User ID
      name: userData.name, 
      email: userData.email, 
      role: UserRole.ALMOXARIFE, 
      company_id: company.id 
    }).select().single();
    
    if (userErr) throw userErr;
    
    return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at, companyId: user.company_id } as User;
  },

  async checkDailyDigest() {
    const user = await this.getCurrentUser();
    if (user?.companyId) {
       await AlertService.checkAndSendDailyDigest(this, user.companyId);
    }
  },

  async logout() { 
    await supabase.auth.signOut(); 
    localStorage.removeItem('aura_user');
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
      createdAt: data.created_at 
    };
  },

  async getSubscription(companyId: string): Promise<Subscription | null> {
    // Try to get active subscription
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:plans(*)
      `)
      .eq('company_id', companyId)
      .in('status', ['active', 'trialing', 'past_due'])
      .single();

    if (error || !sub) return null;

    return {
        id: sub.id,
        companyId: sub.company_id,
        planId: sub.plan_id,
        status: sub.status,
        startDate: sub.start_date,
        nextBillingDate: sub.next_billing_date,
        paymentMethod: sub.payment_method,
        plan: sub.plan ? {
            id: sub.plan.id,
            name: sub.plan.name,
            maxUsers: sub.plan.max_users,
            maxItems: sub.plan.max_items,
            price: sub.plan.price,
            interval: sub.plan.interval,
            features: sub.plan.features,
            active: sub.plan.active
        } : undefined
    };
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
        amount: inv.amount,
        status: inv.status,
        billingDate: inv.billing_date,
        dueDate: inv.due_date,
        pdfUrl: inv.pdf_url,
        description: inv.description
    }));
  },

  async getPlans(): Promise<Plan[]> {
      const { data } = await supabase.from('plans').select('*').eq('active', true).order('price', { ascending: true });
      return (data || []).map(p => ({
          id: p.id,
          name: p.name,
          maxUsers: p.max_users,
          maxItems: p.max_items,
          price: p.price,
          interval: p.interval,
          features: p.features,
          active: p.active
      }));
  },

  // Sectors
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
    return data;
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
      createdAt: data.created_at 
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
    if (!user?.companyId) {
      console.warn('getProducts: Usuário sem empresa ou não logado');
      return [];
    }
    const { data, error } = await supabase.from('products').select('*').eq('active', true).eq('company_id', user.companyId);
    if (error) {
      console.error('Erro ao buscar produtos:', error);
      return [];
    }
    return (data || []).map(p => ({
      id: p.id, companyId: p.company_id, cod: p.cod, description: p.description, unit: p.unit, minStock: p.min_stock, categoryId: p.category_id, defaultSupplierId: p.default_supplier_id, storageLocation: p.storage_location, observations: p.observations, pmed: Number(p.pmed || 0), active: p.active, createdAt: p.created_at, updatedAt: p.updated_at
    })) as Product[];
  },

  async saveProduct(p: any): Promise<Product> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) throw new Error("Usuário sem empresa");
    const payload = { 
      cod: normalize(p.cod), description: p.description, unit: normalize(p.unit), 
      min_stock: p.minStock, category_id: p.categoryId || null, 
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

    const payload = { 
      cod: normalize(updates.cod),
      description: updates.description,
      unit: normalize(updates.unit),
      min_stock: updates.minStock, 
      category_id: updates.categoryId || null, 
      default_supplier_id: updates.defaultSupplierId || null, 
      storage_location: normalize(updates.storageLocation), 
      observations: updates.observations, 
      pmed: Number(updates.pmed || 0), 
      updated_at: new Date().toISOString() 
    };
    const { data, error } = await supabase.from('products').update(payload).eq('id', id).eq('company_id', user.companyId).select().single();
    if (error) throw error;
    return data as Product;
  },

  async getMovements(): Promise<StockMovement[]> {
    const user = await this.getCurrentUser();
    if (!user?.companyId) return [];
    const { data } = await supabase.from('stock_movements').select('*').eq('company_id', user.companyId).order('created_at', { ascending: false });
    return (data || []).map(m => ({
      id: m.id, companyId: m.company_id, movementDate: m.movement_date, monthRef: m.month_ref, productId: m.product_id, supplierId: m.supplier_id, sectorId: m.sector_id, personName: m.person_name, type: m.type as MovementType, quantity: Number(m.quantity || 0), totalValue: Number(m.total_value || 0), destination: m.destination, invoiceNumber: m.invoice_number, invoiceDate: m.invoice_date, invoiceValue: Number(m.invoice_value || 0), pmedAtTime: Number(m.pmed_at_time || 0), createdByUserId: m.created_by_user_id, createdAt: m.created_at
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
      product_id: m.productId, supplier_id: m.supplierId || null, 
      sector_id: m.sectorId || null, person_name: m.personName || null, 
      type: m.type, quantity: m.quantity, total_value: m.totalValue, 
      destination: normalize(m.destination), invoice_number: m.invoiceNumber,
      invoice_date: m.invoiceDate || null, invoice_value: m.invoiceValue || 0,
      pmed_at_time: Number(product.pmed || 0), created_by_user_id: userData.user?.id || 'system',
      company_id: user.companyId
    };
    const { data, error } = await supabase.from('stock_movements').insert(payload).select().single();
    if (error) throw error;

    // --- ALERT LOGIC ---
    try {
      // Recalculate stock after movement
      let finalStock = currentStock;
      if (m.type === MovementType.OUT) finalStock -= Number(m.quantity);
      else finalStock += Number(m.quantity);

      const company = await this.getCompanyById(user.companyId);
      const settings = company?.settings?.alerts;
      
      const recipients: string[] = [];
      if (settings?.alertEmails) {
        recipients.push(...settings.alertEmails.split(',').map(e => e.trim()).filter(e => e));
      }
      
      // Fallback to default emails if no specific alert emails are configured
      if (recipients.length === 0) {
        const defaultEmail = company?.sectorEmail || company?.email;
        if (defaultEmail) recipients.push(defaultEmail);
      }

      if (settings && recipients.length > 0) {
        // Need full history for average consumption calculation
        // We reuse the movements fetched earlier (line 413) but filter for this product
        const productMovements = movements.filter(pm => pm.productId === m.productId);
        
        // Add the newly created movement
        const newMovement = {
           id: data.id,
           companyId: data.company_id,
           movementDate: data.movement_date,
           monthRef: data.month_ref,
           productId: data.product_id,
           type: data.type,
           quantity: Number(data.quantity),
           totalValue: Number(data.total_value),
           createdAt: data.created_at
        } as StockMovement;

        const history = [newMovement, ...productMovements];

        await AlertService.processMovementAlert({
           product: product,
           currentStock: finalStock,
           movements: history,
           settings: settings,
           recipients: recipients
        }, this, Number(m.quantity), m.type);
      }
    } catch (alertError) {
      console.error("Erro ao processar alertas via AlertService:", alertError);
    }

    return data as StockMovement;
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
    
    // Previous Month Calculation
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.toISOString().substring(0, 7);

    const balanceMap: Record<string, number> = {};
    movements.forEach(m => { balanceMap[m.productId] = (balanceMap[m.productId] || 0) + (m.type === MovementType.IN ? m.quantity : -m.quantity); });

    const belowMin = products.filter(p => (balanceMap[p.id] || 0) < p.minStock).length;
    
    // Inventory Value Calculation (Top Items)
    const productValues = products.map(p => ({
      name: p.description,
      value: (balanceMap[p.id] || 0) * p.pmed
    })).sort((a, b) => b.value - a.value).slice(0, 10);

    const totalInventoryValue = productValues.reduce((sum, p) => sum + p.value, 0); // This might be lower than total if we slice. Recalculate total correctly.
    const trueTotalInventoryValue = products.reduce((sum, p) => sum + ((balanceMap[p.id] || 0) * p.pmed), 0);

    const monthMovements = movements.filter(m => m.monthRef === currentMonth);
    const prevMonthMovements = movements.filter(m => m.monthRef === prevMonth);

    const entriesValue = monthMovements.filter(m => m.type === MovementType.IN).reduce((sum, m) => sum + m.totalValue, 0);
    const exitsValue = monthMovements.filter(m => m.type === MovementType.OUT).reduce((sum, m) => sum + m.totalValue, 0);
    const prevExitsValue = prevMonthMovements.filter(m => m.type === MovementType.OUT).reduce((sum, m) => sum + m.totalValue, 0);

    // Most Consumed Product (Month)
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

    // Top Consumer Sector (Month)
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

    // AI Insight Generation
    let aiInsight = { title: "Análise de Consumo", content: "Mantenha o controle do estoque atualizado para melhores insights.", type: 'info' as const };
    if (exitsValue > prevExitsValue && prevExitsValue > 0) {
      const increase = ((exitsValue - prevExitsValue) / prevExitsValue) * 100;
      aiInsight = { 
        title: "Alerta de Gasto", 
        content: `O consumo mensal aumentou ${increase.toFixed(1)}% em relação ao mês anterior. Verifique os setores com maior demanda.`, 
        type: 'warning' 
      };
    } else if (exitsValue < prevExitsValue && prevExitsValue > 0) {
      const decrease = ((prevExitsValue - exitsValue) / prevExitsValue) * 100;
      aiInsight = { 
        title: "Economia Detectada", 
        content: `Você reduziu os gastos em ${decrease.toFixed(1)}% comparado ao mês passado. Ótimo trabalho na gestão!`, 
        type: 'success' 
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
      aiInsight
    };
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    return (data || []).map(l => ({ id: l.id, entity: l.entity, entityId: l.entity_id, action: l.action, beforeJson: l.before_json, afterJson: l.after_json, userId: l.user_id, createdAt: l.created_at })) as AuditLog[];
  },

  // Tax Analysis
  async uploadTaxDocument(file: File, companyId: string): Promise<string> {
    // Sanitize filename
    const fileExt = file.name.split('.').pop();
    const safeFileName = file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${companyId}/${Date.now()}-${safeFileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('tax-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL (or signed URL if private, but using public for simplicity as per bucket config in SQL might need adjustment if private)
    // Note: If bucket is private, we need createSignedUrl. Assuming private for security.
    const { data, error } = await supabase.storage
      .from('tax-documents')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year validity for simplicity

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

    const { data, error } = await supabase
      .from('tax_analysis_requests')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      companyId: data.company_id,
      requesterUserId: data.requester_user_id,
      status: data.status,
      documents: data.documents,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  async getTaxAnalysisRequests(companyId: string): Promise<TaxAnalysisRequest[]> {
    const { data, error } = await supabase
      .from('tax_analysis_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      companyId: r.company_id,
      requesterUserId: r.requester_user_id,
      status: r.status,
      documents: r.documents,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  // User Management
  async getCompanyUsers(companyId: string): Promise<User[]> {
    const { data, error } = await supabase.from('profiles').select('*').eq('company_id', companyId);
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role as UserRole,
      createdAt: p.created_at,
      companyId: p.company_id,
      accessCode: p.access_code,
      permissions: p.permissions
    }));
  },

  async addUser(user: { name: string; email?: string; role: UserRole; companyId: string; accessCode: string; permissions?: any }): Promise<User> {
    const email = user.email || `${user.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}.${user.accessCode}@aura.local`;

    const { data, error } = await supabase.from('profiles').insert({
      name: user.name,
      email: email,
      role: user.role,
      company_id: user.companyId,
      access_code: user.accessCode,
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

  async loginWithAccessCode(name: string, code: string): Promise<User | null> {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('name', name)
      .eq('access_code', code);
      
    if (error || !profiles || profiles.length === 0) return null;
    
    const profile = profiles[0];
    const fullUser = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role as UserRole,
      createdAt: profile.created_at,
      companyId: profile.company_id,
      accessCode: profile.access_code,
      permissions: profile.permissions
    };

    // Save to LocalStorage for persistence (Legacy/Simple Login)
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
    // Note: This only removes from profiles table. 
    // Complete removal from auth system requires server-side admin API.
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
  }
};