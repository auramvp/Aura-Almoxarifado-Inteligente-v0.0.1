import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { products, suppliers, movements, userRequest } = await req.json();

        const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('API_KEY');
        if (!apiKey) {
            throw new Error('API key not configured');
        }

        // Prepare data summaries for the AI
        const productsSummary = products.slice(0, 10).map((p: any) => ({
            codigo: p.cod,
            nome: p.description,
            categoria: p.category,
            estoque: p.stock,
            estoqueMinimo: p.minStock
        }));

        const movementsSummary = movements.slice(0, 10).map((m: any) => ({
            data: m.date,
            produto: m.productName,
            tipo: m.type,
            quantidade: m.quantity,
            valor: m.value
        }));

        // Build the AI prompt
        const prompt = `Você é um assistente especializado em gerar relatórios de dados de almoxarifado.

DADOS DISPONÍVEIS:
- ${products.length} produtos cadastrados
- ${suppliers.length} fornecedores
- ${movements.length} movimentações

AMOSTRA DE PRODUTOS:
${JSON.stringify(productsSummary, null, 2)}

AMOSTRA DE MOVIMENTAÇÕES:
${JSON.stringify(movementsSummary, null, 2)}

PEDIDO DO USUÁRIO: "${userRequest}"

Com base nos dados fornecidos, gere o relatório solicitado.
Retorne APENAS um JSON válido com esta estrutura:
{
  "fileName": "nome_arquivo.xlsx",
  "sheetName": "Nome da Aba",
  "data": [
    { "coluna1": "valor1", "coluna2": "valor2" },
    ...
  ]
}

IMPORTANTE:
- Use NOMES, nunca IDs
- Formate datas como DD/MM/AAAA
- Formate valores monetários com R$
- Agrupe e totalize conforme solicitado
- Gere dados reais baseados nas amostras fornecidas`;

        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 8192
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini API error:', error);
            throw new Error('Erro ao chamar a API de IA');
        }

        const aiResult = await response.json();
        const text = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Resposta da IA não contém JSON válido');
        }

        const result = JSON.parse(jsonMatch[0]);

        // Generate the actual data based on AI instructions
        // If the AI gave generic data, let's enhance with real data
        let finalData = result.data;

        // Process common report types
        if (userRequest.toLowerCase().includes('moviment') && userRequest.toLowerCase().includes('produto')) {
            // Group movements by product
            const productTotals: Record<string, { entradas: number; saidas: number; valorTotal: number }> = {};

            movements.forEach((m: any) => {
                const key = m.productName || m.productCode;
                if (!productTotals[key]) {
                    productTotals[key] = { entradas: 0, saidas: 0, valorTotal: 0 };
                }
                if (m.type === 'Entrada') {
                    productTotals[key].entradas += m.quantity;
                } else {
                    productTotals[key].saidas += m.quantity;
                }
                productTotals[key].valorTotal += m.value || 0;
            });

            finalData = Object.entries(productTotals).map(([produto, totais]) => ({
                'Produto': produto,
                'Total Entradas': totais.entradas,
                'Total Saídas': totais.saidas,
                'Saldo': totais.entradas - totais.saidas,
                'Valor Total': `R$ ${totais.valorTotal.toFixed(2)}`
            }));
        } else if (userRequest.toLowerCase().includes('estoque') && userRequest.toLowerCase().includes('baixo')) {
            // Low stock products
            finalData = products
                .filter((p: any) => p.stock < p.minStock)
                .map((p: any) => ({
                    'Código': p.cod,
                    'Produto': p.description,
                    'Categoria': p.category,
                    'Estoque Atual': p.stock,
                    'Estoque Mínimo': p.minStock,
                    'Falta': p.minStock - p.stock
                }));
        } else if (userRequest.toLowerCase().includes('mês') || userRequest.toLowerCase().includes('mensal')) {
            // Monthly summary
            const monthlyTotals: Record<string, { entradas: number; saidas: number; valor: number }> = {};

            movements.forEach((m: any) => {
                const month = m.date.substring(0, 7); // YYYY-MM
                if (!monthlyTotals[month]) {
                    monthlyTotals[month] = { entradas: 0, saidas: 0, valor: 0 };
                }
                if (m.type === 'Entrada') {
                    monthlyTotals[month].entradas += m.quantity;
                } else {
                    monthlyTotals[month].saidas += m.quantity;
                }
                monthlyTotals[month].valor += m.value || 0;
            });

            finalData = Object.entries(monthlyTotals)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([mes, totais]) => ({
                    'Mês': mes,
                    'Total Entradas': totais.entradas,
                    'Total Saídas': totais.saidas,
                    'Valor Total': `R$ ${totais.valor.toFixed(2)}`
                }));
        }

        return new Response(
            JSON.stringify({
                fileName: result.fileName || `Relatorio_${new Date().toISOString().split('T')[0]}.xlsx`,
                sheetName: result.sheetName || 'Dados',
                data: finalData
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error: any) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
