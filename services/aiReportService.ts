
import { db } from './db';
import { AiReportPayload, MovementType } from '../types';
import OpenAI from 'openai';

// Configuration
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const MODEL_NAME = import.meta.env.VITE_AI_MODEL || 'gpt-oss-120b';

// Helper to calculate days between dates
const diffDays = (d1: Date, d2: Date) => Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

export const AiReportService = {
  /**
   * Builds the payload required for the AI model.
   * This function performs ALL calculations. The AI only interprets.
   */
  async buildRelatorioPayload(startDate: string, endDate: string): Promise<AiReportPayload> {
    const user = await db.getCurrentUser();
    const company = user?.companyId ? await db.getCompanyById(user.companyId) : null;
    const products = await db.getProducts();
    const movements = await db.getMovements();
    const balances = await db.getStockBalances();

    // Filter movements by period
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodMovements = movements.filter(m => {
      const d = new Date(m.movementDate);
      return d >= start && d <= end;
    });

    // Calculate Consumption per Product (for ABC and Turnover)
    const productConsumption: Record<string, number> = {};
    periodMovements.filter(m => m.type === MovementType.OUT).forEach(m => {
      productConsumption[m.productId] = (productConsumption[m.productId] || 0) + m.totalValue;
    });

    // Calculate Balances Map
    const balanceMap: Record<string, number> = {};
    balances.forEach(b => balanceMap[b.productId] = b.quantity);

    // 1. KPIs
    let criticalCount = 0;
    let excessCount = 0;
    let deadCount = 0;
    let totalInventoryValue = 0;
    const alerts: AiReportPayload['alerts'] = [];

    // Identify Dead Stock (No OUT movement in 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const deadStockList: AiReportPayload['dead_stock'] = [];

    products.forEach(p => {
      const balance = balanceMap[p.id] || 0;
      const value = balance * p.pmed;
      totalInventoryValue += value;

      // Critical Stock (Ruptura)
      if (balance <= p.minStock) {
        criticalCount++;
        alerts.push({
          type: 'RUPTURA',
          product: p.description,
          current_stock: balance,
          min_stock: p.minStock,
          suggestion: `Comprar urgente. Estoque abaixo do mínimo (${p.minStock}).`
        });
      }

      // Excess Stock (Simple rule: > 3x MinStock AND Balance > 0)
      if (p.minStock > 0 && balance > (p.minStock * 3)) {
        excessCount++;
        alerts.push({
          type: 'EXCESSO',
          product: p.description,
          current_stock: balance,
          min_stock: p.minStock,
          suggestion: 'Avaliar redução de compras ou promoção.'
        });
      }

      // Dead Stock Check
      const lastOut = movements
        .filter(m => m.productId === p.id && m.type === MovementType.OUT)
        .sort((a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime())[0];
      
      const lastMoveDate = lastOut ? new Date(lastOut.movementDate) : new Date(p.createdAt); // If never moved, use creation
      const daysWithoutMove = diffDays(new Date(), lastMoveDate);

      if (daysWithoutMove > 90 && balance > 0) {
        deadCount++;
        deadStockList.push({
          product: p.description,
          days_without_movement: daysWithoutMove,
          value: value
        });
      }
    });

    // Sort Dead Stock by Value
    deadStockList.sort((a, b) => b.value - a.value);

    // ABC Analysis
    const consumptionList = Object.entries(productConsumption).map(([pid, val]) => ({
      pid,
      val,
      product: products.find(p => p.id === pid)?.description || 'Unknown'
    })).sort((a, b) => b.val - a.val);

    const totalConsumption = consumptionList.reduce((acc, item) => acc + item.val, 0);
    
    let accumulated = 0;
    const curveA: any[] = [];
    const curveB: any[] = [];
    const curveC: any[] = [];

    consumptionList.forEach(item => {
      accumulated += item.val;
      const percentage = (accumulated / totalConsumption) * 100;
      const itemData = {
        product: item.product,
        consumption_value: item.val,
        percentage: (item.val / totalConsumption) * 100
      };

      if (percentage <= 80) curveA.push(itemData);
      else if (percentage <= 95) curveB.push(itemData);
      else curveC.push(itemData);
    });

    // Financials
    const totalPurchases = periodMovements
      .filter(m => m.type === MovementType.IN)
      .reduce((sum, m) => sum + m.totalValue, 0);

    const totalExits = periodMovements
      .filter(m => m.type === MovementType.OUT)
      .reduce((sum, m) => sum + m.totalValue, 0);

    return {
      company: {
        name: company?.name || 'Empresa Não Identificada',
        cnpj: company?.cnpj || '',
        sector: company?.sectorName || 'Geral'
      },
      period: {
        start: startDate,
        end: endDate
      },
      kpis: {
        total_items: products.length,
        critical_stock_items: criticalCount,
        excess_stock_items: excessCount,
        dead_stock_items_90d: deadCount,
        current_inventory_value: Number(totalInventoryValue.toFixed(2)),
        total_purchases_period: Number(totalPurchases.toFixed(2)),
        total_exits_period: Number(totalExits.toFixed(2))
      },
      alerts: alerts.slice(0, 15), // Top 15 alerts to avoid token overflow
      abc: {
        curve_a: curveA,
        curve_b: curveB,
        curve_c: curveC
      },
      dead_stock: deadStockList.slice(0, 10), // Top 10 dead items
      rules: {
        min_stock_method: "Manual (Cadastro)",
        dead_stock_days: 90
      }
    };
  },

  /**
   * Generates the report using Fetch API (safer for browser than SDK).
   */
  async generateAiReport(startDate: string, endDate: string, userInstruction?: string): Promise<string> {
    if (!API_KEY) throw new Error("Chave de API da IA não configurada.");

    const payload = await this.buildRelatorioPayload(startDate, endDate);

    const systemPrompt = `
      Você é um analista de almoxarifado sênior da 'Aura'. 
      Use SOMENTE os dados fornecidos no JSON abaixo. 
      NÃO invente números. NÃO recalcule os totais (confie no JSON).
      Se faltar algum dado crítico, mencione "Dado ausente".
      
      Seu objetivo é produzir um relatório gerencial em Markdown para o gestor.
      
      REGRAS DE FORMATAÇÃO (IMPORTANTE):
      - Utilize espaçamento generoso entre as seções.
      - Use **negrito** para destacar valores monetários, quantidades críticas e nomes de produtos.
      - Use tabelas Markdown simples e limpas para KPIs e listas de produtos.
      - Use títulos e subtítulos hierárquicos (#, ##, ###) para organizar o texto.
      - Utilize listas (bullet points) para facilitar a leitura de recomendações e alertas.

      ${userInstruction ? `IMPORTANTE: O usuário forneceu a seguinte instrução específica para este relatório: "${userInstruction}". Adapte a estrutura e o foco do relatório para atender a este pedido.` : `
      ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:
      1. # Relatório de Otimização de Estoque
         - Período: DD/MM/AAAA a DD/MM/AAAA
         - Empresa: [Nome]
      
      2. ## 📋 Resumo Executivo
         - 5 bullet points com os fatos mais importantes do período (ex: valor total movimentado, saúde do estoque).
      
      3. ## 📊 Indicadores Chave (KPIs)
         - Crie uma tabela com: Valor em Estoque, Compras no Período, Saídas, Itens Críticos, Itens Parados.
      
      4. ## 🚨 Alertas Críticos
         - Liste os principais itens em RUPTURA (urgente) e EXCESSO.
         - Seja direto: "Item X acabou - repor" ou "Item Y tem excesso de R$ Z".
      
      5. ## 📉 Itens Parados (Risco de Perda)
         - Destaque os itens de maior valor que não giram há 90 dias.
      
      6. ## 🏆 Análise Curva ABC
         - Comente brevemente onde está concentrado o valor de consumo (Curva A).
         - Cite 2 ou 3 produtos da Curva A que exigem atenção redobrada.
      
      7. ## ✅ Recomendações Práticas
         - Liste de 3 a 5 ações concretas para o time de compras ou almoxarifado.
         - Ex: "Focar em renegociar itens da Curva A", "Liquidar itens parados", etc.
      
      8. ## 🛒 Sugestão de Compras (Baseada em Ruptura)
         - Se houver itens em ruptura, liste-os como um checklist simples.
      `}
      
      Tom de voz: Profissional, direto, analítico e útil.
    `;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Gere o relatório com base neste JSON: ${JSON.stringify(payload)}` }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro na API (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "Erro ao gerar relatório: Resposta vazia da IA.";
    } catch (error: any) {
      console.error("Erro na geração do relatório IA:", error);
      throw new Error(`Falha na comunicação com IA: ${error.message}`);
    }
  }
};
