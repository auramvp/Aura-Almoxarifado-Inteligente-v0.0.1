import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AsaasCustomer {
    id: string;
    name: string;
    email: string;
    cpfCnpj: string;
}

interface AsaasSubscription {
    id: string;
    status: string;
    customer: string;
    billingType: string;
}

interface ValidationResult {
    valid: boolean;
    status: string;
    message: string;
    trialEnd?: string;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { email, cpfCnpj } = await req.json();

        if (!email && !cpfCnpj) {
            return new Response(
                JSON.stringify({ valid: false, status: 'ERROR', message: 'Email ou CPF/CNPJ é obrigatório' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
        if (!ASAAS_API_KEY) {
            console.error('ASAAS_API_KEY not configured');
            return new Response(
                JSON.stringify({ valid: false, status: 'ERROR', message: 'Erro de configuração do servidor' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Determine if we're in sandbox mode based on API key
        const isSandbox = ASAAS_API_KEY.includes('$aact_hmlg');
        const baseUrl = isSandbox
            ? 'https://sandbox.asaas.com/api/v3'
            : 'https://api.asaas.com/v3';

        // Step 1: Find customer by email or CPF/CNPJ
        const searchParam = email
            ? `email=${encodeURIComponent(email)}`
            : `cpfCnpj=${encodeURIComponent(cpfCnpj.replace(/\D/g, ''))}`;

        const customersResponse = await fetch(`${baseUrl}/customers?${searchParam}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'access_token': ASAAS_API_KEY,
            },
        });

        if (!customersResponse.ok) {
            console.error('Error fetching customers:', await customersResponse.text());
            return new Response(
                JSON.stringify({ valid: false, status: 'ERROR', message: 'Erro ao consultar Asaas' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const customersData = await customersResponse.json();
        const customers: AsaasCustomer[] = customersData.data || [];

        if (customers.length === 0) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    status: 'NOT_FOUND',
                    message: 'Nenhuma assinatura encontrada para este email. Realize a assinatura primeiro.'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Step 2: Get subscriptions for the customer
        const customerId = customers[0].id;

        const subscriptionsResponse = await fetch(`${baseUrl}/subscriptions?customer=${customerId}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'access_token': ASAAS_API_KEY,
            },
        });

        if (!subscriptionsResponse.ok) {
            console.error('Error fetching subscriptions:', await subscriptionsResponse.text());
            return new Response(
                JSON.stringify({ valid: false, status: 'ERROR', message: 'Erro ao consultar assinaturas' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const subscriptionsData = await subscriptionsResponse.json();
        const subscriptions: AsaasSubscription[] = subscriptionsData.data || [];

        if (subscriptions.length === 0) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    status: 'NO_SUBSCRIPTION',
                    message: 'Nenhuma assinatura encontrada. Realize a assinatura primeiro.'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Step 3: Check subscription status
        // Valid statuses for account creation:
        // - ACTIVE: Subscription is active (card/automatic PIX confirmed)
        // - TRIAL: 7-day trial period (card/automatic PIX)
        // 
        // Invalid statuses:
        // - PENDING: Waiting for payment (boleto/PIX)
        // - OVERDUE: Payment overdue
        // - EXPIRED: Subscription expired
        // - INACTIVE: Subscription cancelled

        const validStatuses = ['ACTIVE', 'TRIAL'];
        const activeSubscription = subscriptions.find(sub => validStatuses.includes(sub.status.toUpperCase()));

        if (activeSubscription) {
            const result: ValidationResult = {
                valid: true,
                status: activeSubscription.status.toUpperCase(),
                message: activeSubscription.status.toUpperCase() === 'TRIAL'
                    ? 'Assinatura válida! Período trial de 7 dias ativo.'
                    : 'Assinatura ativa confirmada!'
            };

            return new Response(
                JSON.stringify(result),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check if there's a pending subscription
        const pendingSubscription = subscriptions.find(sub => sub.status.toUpperCase() === 'PENDING');
        if (pendingSubscription) {
            const billingTypeMessages: Record<string, string> = {
                'BOLETO': 'Aguardando confirmação do pagamento do boleto. Após a compensação, você poderá criar sua conta.',
                'PIX': 'Aguardando confirmação do pagamento via PIX. Após a confirmação, você poderá criar sua conta.',
                'UNDEFINED': 'Aguardando confirmação do pagamento. Após a confirmação, você poderá criar sua conta.',
            };

            return new Response(
                JSON.stringify({
                    valid: false,
                    status: 'PENDING',
                    message: billingTypeMessages[pendingSubscription.billingType] || billingTypeMessages['UNDEFINED']
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check for overdue
        const overdueSubscription = subscriptions.find(sub => sub.status.toUpperCase() === 'OVERDUE');
        if (overdueSubscription) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    status: 'OVERDUE',
                    message: 'Sua assinatura está com pagamento atrasado. Regularize o pagamento para criar sua conta.'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // No valid subscription found
        return new Response(
            JSON.stringify({
                valid: false,
                status: 'INACTIVE',
                message: 'Nenhuma assinatura ativa encontrada. Realize uma nova assinatura.'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in validate-subscription:', error);
        return new Response(
            JSON.stringify({ valid: false, status: 'ERROR', message: 'Erro interno do servidor' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
