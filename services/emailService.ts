import { Resend } from 'resend';
import { supabase } from './supabaseClient';

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export interface LowStockAlertPayload {
  to: string | string[];
  productName: string;
  currentStock: number;
  minStock: number;
  avgDailyConsumption: number;
  daysToRupture: number;
  financialImpact: number;
}

export interface UnusualConsumptionPayload {
  to: string | string[];
  productName: string;
  quantity: number;
  avgQuantity: number;
  deviation: number;
  financialImpact: number;
  isCritical: boolean;
}

export interface DailyDigestPayload {
  to: string | string[];
  date: string;
  warnings: Array<{ productName: string, deviation: number, impact: number }>;
  riskyProducts: Array<{ name: string, qty: number, min: number }>;
}

export interface OptimizationReportPayload {
  to: string | string[];
  reportHtml: string;
  companyName: string;
  period: string;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://app.auraalmoxarife.com.br'; // Fallback
};

// --- Template Helper ---
const generateEmailTemplate = (title: string, content: string, accentColor: string = '#2563eb') => {
  const baseUrl = getBaseUrl();
  const year = new Date().getFullYear();
  const logoUrl = "https://zdgapmcalocdvdgvbwsj.supabase.co/storage/v1/object/public/AuraLogo/branco.png";
  // Generate a unique ID for this email instance to prevent Gmail from collapsing it as duplicate content
  const emailId = Math.random().toString(36).substring(2, 10);
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
      
      <!-- Main Container -->
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Top Bar: Color Indicator -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${accentColor};">
            <tr>
                <td style="padding: 14px 24px; text-align: left;">
                     <span style="color: #ffffff; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                        ${title}
                     </span>
                </td>
            </tr>
        </table>

        <!-- Logo Section: Dark Background -->
        <div style="background-color: #111827; padding: 32px 20px; text-align: center;">
             <img src="${logoUrl}" alt="Aura Almoxarife" width="160" style="display: block; margin: 0 auto; max-width: 160px; height: auto; border: 0; outline: none; text-decoration: none;" />
        </div>

        <!-- Body Content -->
        <div style="padding: 40px 32px;">
          ${content}
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            &copy; ${year} Aura Almoxarife Inteligente. Todos os direitos reservados.
          </p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af;">
            Este é um e-mail automático. Por favor, não responda.
          </p>
          <p style="margin: 8px 0 0; font-size: 10px; color: #e5e7eb;">
            ID: ${emailId}
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
};

export const EmailService = {
  /**
   * Envia um email usando o Resend.
   */
  async sendEmail(payload: EmailPayload) {
    console.log(`[EmailService] Tentando enviar email para ${payload.to}`);

    // Ensure we use the correct sender
    const finalPayload = {
        ...payload,
        from: payload.from || 'Aura Almoxarife <time@auraalmoxarifado.com.br>'
    };

    // 1. Tentar via Supabase Edge Function (Recomendado para Produção)
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: finalPayload
      });

      if (!error) {
        console.log('[EmailService] Email enviado com sucesso via Supabase Function!');
        return { success: true, data };
      }

      if (error) {
        console.warn('[EmailService] Falha ao invocar Supabase Function. Tentando método direto...', error);
      }
    } catch (err) {
      console.warn('[EmailService] Erro ao chamar Supabase Function:', err);
    }

    // 2. Tentativa via Proxy Local (Correção de CORS em Dev)
    try {
        console.log('[EmailService] Tentando via Proxy Local (port 3001)...');
        const res = await fetch('http://localhost:3001/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });
        
        if (res.ok) {
            const data = await res.json();
            console.log('[EmailService] Email enviado via Proxy Local!', data);
            return { success: true, data };
        } else {
             console.warn('[EmailService] Proxy Local retornou erro:', res.status);
        }
    } catch (err) {
        console.warn('[EmailService] Proxy local não disponível (provavelmente não iniciado).');
    }

    // 3. Fallback: Tentativa direta (Pode falhar por CORS)
    if (RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify(finalPayload)
        });

        if (res.ok) {
          const data = await res.json();
          console.log('[EmailService] Email enviado com sucesso via API Direta!', data);
          return { success: true, data };
        } else {
          const errData = await res.json();
          console.error('[EmailService] Erro na API do Resend:', errData);
          throw new Error(errData.message || 'Erro ao enviar email via Resend API');
        }
      } catch (err: any) {
        console.error('[EmailService] Erro crítico no envio direto:', err);
        if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
             throw new Error("Erro de conexão. Verifique se o Proxy Local está rodando (npm run proxy) ou se a Edge Function está ativa.");
        }
        throw err;
      }
    } else {
        throw new Error("VITE_RESEND_API_KEY não configurada e Supabase Function falhou.");
    }
  },

  async sendLowStockAlert(payload: LowStockAlertPayload) {
    const subject = `🔴 Ruptura Iminente: ${payload.productName}`;
    const accentColor = '#ef4444'; // Red for critical

    const content = `
      <p style="margin-top: 0; font-size: 16px; line-height: 1.6; color: #374151;">
        O produto <strong>${payload.productName}</strong> atingiu o nível de segurança.
      </p>

      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700; letter-spacing: 0.5px;">Estoque Atual</p>
            <p style="margin: 4px 0 0; font-size: 24px; font-weight: 700; color: #ef4444;">${payload.currentStock}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700; letter-spacing: 0.5px;">Mínimo Seguro</p>
            <p style="margin: 4px 0 0; font-size: 24px; font-weight: 700; color: #374151;">${payload.minStock}</p>
          </div>
          <div>
             <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700; letter-spacing: 0.5px;">Média Diária</p>
             <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600; color: #374151;">${payload.avgDailyConsumption.toFixed(1)} un</p>
          </div>
          <div>
             <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700; letter-spacing: 0.5px;">Ruptura em</p>
             <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600; color: #ef4444;">${payload.daysToRupture < 999 ? payload.daysToRupture.toFixed(0) + ' dias' : 'Indefinido'}</p>
          </div>
        </div>
      </div>

      <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px;">
        <p style="margin: 0; color: #991b1b; font-size: 14px;">
          <strong>Impacto Financeiro:</strong><br/>
          Valor em risco de aproximadamente <strong>${formatCurrency(payload.financialImpact)}</strong>.
        </p>
      </div>
    `;

    const html = generateEmailTemplate('Alerta de Estoque Crítico', content, accentColor);
    return this.sendEmail({ to: payload.to, subject, html });
  },

  async sendUnusualConsumptionAlert(payload: UnusualConsumptionPayload) {
    const accentColor = payload.isCritical ? '#ef4444' : '#f59e0b'; // Red or Amber
    const title = payload.isCritical ? 'Consumo Crítico Detectado' : 'Consumo Atípico Detectado';
    const subject = `${payload.isCritical ? '🔴' : '⚠️'} ${title}: ${payload.productName}`;

    const content = `
      <p style="margin-top: 0; font-size: 16px; line-height: 1.6; color: #374151;">
        Detectamos uma saída incomum para o produto <strong>${payload.productName}</strong>.
      </p>

      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
           <span style="font-size: 14px; color: #6b7280;">Quantidade Retirada</span>
           <strong style="font-size: 16px; color: #1f2937;">${payload.quantity}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
           <span style="font-size: 14px; color: #6b7280;">Média Histórica</span>
           <strong style="font-size: 16px; color: #1f2937;">${payload.avgQuantity.toFixed(1)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
           <span style="font-size: 14px; color: #6b7280;">Desvio Percentual</span>
           <strong style="font-size: 16px; color: ${accentColor};">+${payload.deviation.toFixed(0)}%</strong>
        </div>
         <div style="display: flex; justify-content: space-between;">
           <span style="font-size: 14px; color: #6b7280;">Impacto Financeiro</span>
           <strong style="font-size: 16px; color: #1f2937;">${formatCurrency(payload.financialImpact)}</strong>
        </div>
      </div>

      <p style="font-size: 14px; color: #6b7280; font-style: italic;">
        Essa movimentação destoa significativamente do padrão histórico.
      </p>
    `;

    const html = generateEmailTemplate(title, content, accentColor);
    return this.sendEmail({ to: payload.to, subject, html });
  },

  async sendDailyDigest(payload: DailyDigestPayload) {
    const subject = `📋 Resumo Diário - ${payload.date}`;
    const accentColor = '#2563eb'; // Brand Blue
    
    // Generate Rows for Warnings
    const warningRows = payload.warnings.map(w => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 0; font-size: 14px; color: #1f2937;">${w.productName}</td>
        <td style="padding: 12px 0; font-size: 14px; color: #f59e0b; font-weight: bold; text-align: right;">+${w.deviation.toFixed(0)}%</td>
      </tr>
    `).join('');

    const riskRows = payload.riskyProducts.map(p => `
       <li style="margin-bottom: 8px; font-size: 14px; color: #4b5563;">
         <strong>${p.name}</strong> <span style="color: #ef4444;">(${p.qty} un)</span>
       </li>
    `).join('');

    const content = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
        <div style="background-color: #eff6ff; padding: 20px; border-radius: 12px; text-align: center;">
          <span style="display: block; font-size: 32px; font-weight: 800; color: #2563eb; line-height: 1;">${payload.warnings.length}</span>
          <span style="font-size: 11px; text-transform: uppercase; color: #60a5fa; font-weight: 700; margin-top: 4px; display: block;">Alertas</span>
        </div>
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 12px; text-align: center;">
          <span style="display: block; font-size: 32px; font-weight: 800; color: #ef4444; line-height: 1;">${payload.riskyProducts.length}</span>
          <span style="font-size: 11px; text-transform: uppercase; color: #f87171; font-weight: 700; margin-top: 4px; display: block;">Riscos</span>
        </div>
      </div>

      ${payload.warnings.length > 0 ? `
        <h3 style="font-size: 14px; font-weight: 800; color: #1f2937; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ Consumos Atípicos</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
          <tbody>
            ${warningRows}
          </tbody>
        </table>
      ` : ''}

      ${payload.riskyProducts.length > 0 ? `
        <div style="background-color: #fff1f2; border-radius: 12px; padding: 20px; border: 1px solid #fecdd3;">
          <h3 style="font-size: 12px; font-weight: 800; color: #9f1239; margin: 0 0 12px; text-transform: uppercase;">📉 Produtos em Baixa</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${riskRows}
          </ul>
        </div>
      ` : ''}
    `;

    const html = generateEmailTemplate('Resumo Diário', content, accentColor);
    return this.sendEmail({ to: payload.to, subject, html });
  },

  async sendOptimizationReport(payload: OptimizationReportPayload) {
    const subject = `📈 Relatório de Otimização - ${payload.companyName}`;
    const accentColor = '#7c3aed'; // Violet/Purple for AI/Optimization

    const content = `
      <p style="margin-top: 0; font-size: 16px; line-height: 1.6; color: #374151;">
        Segue em anexo digital o relatório de otimização gerado pela <strong>Aura IA</strong>.
      </p>
      
      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Período Analisado</p>
        <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #1f2937;">${payload.period}</p>
      </div>

      <div class="report-content" style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        ${payload.reportHtml}
      </div>
      
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">
        Este relatório foi gerado automaticamente com base nos dados do seu estoque.
      </p>
    `;

    const html = generateEmailTemplate('Relatório de Otimização', content, accentColor);
    return this.sendEmail({ to: payload.to, subject, html });
  }
};
