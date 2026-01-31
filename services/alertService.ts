import { 
  Product, StockMovement, CompanySettings, 
  AuditLog, MovementType 
} from '../types';
import { EmailService } from './emailService';

// Constants
const CRITICAL_FINANCIAL_IMPACT_THRESHOLD = 500; // R$ 500.00
const SPAM_COOLDOWN_HOURS = 24;

export interface AlertContext {
  product: Product;
  currentStock: number;
  movements: StockMovement[];
  settings: CompanySettings['alerts'];
  recipients: string[];
}

export const AlertService = {
  
  /**
   * Main entry point to process alerts after a stock movement
   */
  async processMovementAlert(
    ctx: AlertContext,
    db: any, // Avoiding circular dependency by passing db instance
    quantityChanged: number,
    movementType: MovementType
  ) {
    if (!ctx.settings || ctx.recipients.length === 0) return;

    const { product, currentStock, settings, recipients } = ctx;
    
    // 1. Calculate Metrics
    const avgDailyConsumption = this.calculateAverageConsumption(ctx.movements, 30); // Last 30 days
    const daysToRupture = avgDailyConsumption > 0 ? currentStock / avgDailyConsumption : 999;
    const stockValue = currentStock * Number(product.pmed);
    
    // 2. Check Min Stock (CRITICAL)
    if (settings.minStock && currentStock <= Number(product.minStock)) {
      const isCritical = true; // Min Stock is always critical
      
      if (await this.shouldSendAlert(db, 'ALERT_MIN_STOCK', product.id, isCritical)) {
        await EmailService.sendLowStockAlert({
          to: recipients,
          productName: product.description,
          currentStock,
          minStock: Number(product.minStock),
          avgDailyConsumption,
          daysToRupture,
          financialImpact: stockValue
        });

        await this.logAlert(db, 'ALERT_MIN_STOCK', product.id, 'SEND_EMAIL', {
          stock: currentStock,
          min: product.minStock,
          severity: 'CRITICAL'
        });
      }
    }

    // 3. Check Unusual Consumption (WARNING or CRITICAL)
    if (settings.unusualConsumption && movementType === MovementType.OUT) {
       const thresholdPercent = settings.consumptionThreshold || 25; // Default 25%
       
       // Calculate historical average for this specific movement size (heuristic)
       // Or better: Compare this EXIT quantity vs Average Exit Quantity
       const avgExitQuantity = this.calculateAverageExitQuantity(ctx.movements);
       
       if (avgExitQuantity > 0) {
         const deviation = ((quantityChanged - avgExitQuantity) / avgExitQuantity) * 100;
         
         if (deviation >= thresholdPercent) {
            const financialImpact = quantityChanged * Number(product.pmed);
            const isCritical = financialImpact >= CRITICAL_FINANCIAL_IMPACT_THRESHOLD;
            
            if (isCritical) {
              // Critical -> Send Immediately
              if (await this.shouldSendAlert(db, 'ALERT_UNUSUAL_CONSUMPTION', product.id, true)) {
                 await EmailService.sendUnusualConsumptionAlert({
                   to: recipients,
                   productName: product.description,
                   quantity: quantityChanged,
                   avgQuantity: avgExitQuantity,
                   deviation,
                   financialImpact,
                   isCritical: true
                 });

                 await this.logAlert(db, 'ALERT_UNUSUAL_CONSUMPTION', product.id, 'SEND_EMAIL', {
                   quantity: quantityChanged,
                   avg: avgExitQuantity,
                   impact: financialImpact,
                   severity: 'CRITICAL'
                 });
              }
            } else {
              // Warning -> Queue for Daily Digest
              // We log it as 'QUEUE_DIGEST' so the daily job picks it up
              // But we also enforce 24h spam check to not fill the digest with same warnings if not needed?
              // Actually, digest should aggregate ALL warnings of the day.
              
              await this.logAlert(db, 'ALERT_UNUSUAL_CONSUMPTION', product.id, 'QUEUE_DIGEST', {
                 quantity: quantityChanged,
                 avg: avgExitQuantity,
                 impact: financialImpact,
                 severity: 'WARNING',
                 productName: product.description // Store name for easier digest generation
              });
            }
         }
       }
    }
  },

  calculateAverageConsumption(movements: StockMovement[], days: number): number {
    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() - days);
    
    const relevantMovements = movements.filter(m => 
      m.type === MovementType.OUT && 
      new Date(m.movementDate) >= limitDate
    );

    const totalOut = relevantMovements.reduce((acc, m) => acc + Number(m.quantity), 0);
    return totalOut / days;
  },

  calculateAverageExitQuantity(movements: StockMovement[]): number {
    const exits = movements.filter(m => m.type === MovementType.OUT);
    if (exits.length === 0) return 0;
    const total = exits.reduce((acc, m) => acc + Number(m.quantity), 0);
    return total / exits.length;
  },

  async shouldSendAlert(db: any, type: string, productId: string, isCritical: boolean): Promise<boolean> {
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - SPAM_COOLDOWN_HOURS);

    // 1. Check for manual suppression (Ignore Action) in the last 7 days (default ignore period)
    const { data: ignored } = await db.supabase
      .from('audit_logs')
      .select('created_at')
      .eq('entity', type)
      .eq('entity_id', productId)
      .eq('action', 'IGNORE_ALERT')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    
    if (ignored && ignored.length > 0) return false;

    // 2. Check for recent emails (Spam Control)
    const { data: lastAlert } = await db.supabase
      .from('audit_logs')
      .select('created_at')
      .eq('entity', type)
      .eq('entity_id', productId)
      .eq('action', 'SEND_EMAIL') 
      .gte('created_at', oneDayAgo.toISOString())
      .limit(1)
      .maybeSingle();

    if (lastAlert) return false;

    return true;
  },

  async logAlert(db: any, type: string, productId: string, action: string, data: any) {
    await db.addAuditLog({
      entity: type,
      entityId: productId,
      action: action,
      afterJson: JSON.stringify({ ...data, triggered_at: new Date().toISOString() })
    });
  },

  /**
   * Generates and sends the daily digest
   * Should be called once a day (e.g., on first admin login)
   */
  async checkAndSendDailyDigest(db: any, companyId: string) {
    // 1. Check if digest was already sent today
    const today = new Date().toISOString().split('T')[0];
    const { data: lastDigest } = await db.supabase
      .from('audit_logs')
      .select('*')
      .eq('entity', 'DAILY_DIGEST')
      .eq('action', 'SEND_EMAIL')
      .gte('created_at', `${today}T00:00:00`)
      .limit(1);

    if (lastDigest && lastDigest.length > 0) return; // Already sent

    // 2. Fetch Pending Alerts (Queued today)
    // In a real backend, we'd query 'pending_alerts'. Here we query audit_logs with action 'QUEUE_DIGEST'
    // We look for logs created in the last 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: queuedAlerts } = await db.supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'QUEUE_DIGEST')
      .gte('created_at', yesterday.toISOString());

    if (!queuedAlerts || queuedAlerts.length === 0) return;

    // 3. Aggregate Data
    const company = await db.getCompanyById(companyId);
    if (!company) return;
    
    const recipients: string[] = [];
    if (company.settings?.alerts?.alertEmails) {
      recipients.push(...company.settings.alertEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e));
    } else {
      if (company.sectorEmail) recipients.push(company.sectorEmail);
      else if (company.email) recipients.push(company.email);
    }

    if (recipients.length === 0) return;

    const unusualConsumptions = queuedAlerts.filter((a: any) => a.entity === 'ALERT_UNUSUAL_CONSUMPTION');
    
    // Also fetch current stock status for "Products at Risk" summary
    const products = await db.getProducts();
    const stockRisks = products.filter((p: Product) => {
        // Simple risk check: stock <= minStock * 1.1 (Close to rupture)
        // We can reuse calculateAverageConsumption logic if we had movements, 
        // but for digest performance we might just check strict minStock
        return Number(p.pmed) > 0 && p.minStock > 0 && 
               // Assuming we can get stock quantity... db.getProducts doesn't return quantity.
               // We need stock balances.
               true; 
    });

    // Note: Fetching stock balances is heavy. 
    // For this MVP digest, we'll focus on the 'Queued' unusual consumptions 
    // and maybe a quick query for critical items if possible.
    const balances = await db.getStockBalances();
    const riskyProducts = [];
    
    for (const p of products) {
        const bal = balances.find((b: any) => b.productId === p.id);
        const qty = bal ? bal.quantity : 0;
        if (qty <= Number(p.minStock)) {
            riskyProducts.push({ name: p.description, qty, min: p.minStock });
        }
    }

    // 4. Send Email
    await EmailService.sendDailyDigest({
        to: recipients,
        date: today,
        warnings: unusualConsumptions.map((a: any) => {
            const d = JSON.parse(a.after_json || '{}');
            return {
                productName: d.productName || 'Produto Desconhecido',
                deviation: ((d.quantity - d.avg) / d.avg) * 100,
                impact: d.impact
            };
        }),
        riskyProducts
    });

    // 5. Log Success
    await this.logAlert(db, 'DAILY_DIGEST', 'system', 'SEND_EMAIL', { count: queuedAlerts.length });
  }
};
