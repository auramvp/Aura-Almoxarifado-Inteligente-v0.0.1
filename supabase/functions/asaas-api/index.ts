import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const asaasApiKey = Deno.env.get('ASAAS_API_KEY')
const asaasApiUrl = Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3'

const supabase = createClient(supabaseUrl, supabaseKey)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const action = url.searchParams.get('action')

        if (action === 'sync_customers') {
            const { data: companies, error: companiesError } = await supabase
                .from('companies')
                .select('*')

            if (companiesError) throw companiesError

            for (const company of companies) {
                if (!company.asaas_customer_id) {
                    const response = await fetch(`${asaasApiUrl}/customers`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'access_token': asaasApiKey!
                        },
                        body: JSON.stringify({
                            name: company.name,
                            cpfCnpj: company.cnpj,
                            email: company.email,
                            externalReference: company.id
                        })
                    })

                    const asaasCustomer = await response.json()
                    if (asaasCustomer.id) {
                        await supabase
                            .from('companies')
                            .update({ asaas_customer_id: asaasCustomer.id })
                            .eq('id', company.id)
                    }
                }
            }
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) \n
        }

        if (action === 'sync_financials') {
            const { data: companies } = await supabase.from('companies').select('id, asaas_customer_id').not('asaas_customer_id', 'is', null)

            for (const company of companies!) {
                const response = await fetch(`${asaasApiUrl}/payments?customer=${company.asaas_customer_id}`, {
                    headers: { 'access_token': asaasApiKey! }
                })
                const payments = await response.json()

                if (payments.data) {
                    for (const payment of payments.data) {
                        await supabase.from('invoices').upsert({
                            company_id: company.id,
                            amount: payment.value,
                            status: payment.status === 'RECEIVED' || payment.status === 'CONFIRMED' ? 'paid' : payment.status === 'OVERDUE' ? 'overdue' : 'open',
                            due_date: payment.dueDate,
                            billing_date: payment.paymentDate || payment.confirmedDate || new Date().toISOString(),
                            payment_method: payment.billingType === 'PIX' ? 'pix' : payment.billingType === 'BOLETO' ? 'boleto' : 'credit_card',
                            description: payment.description || 'Assinatura Aura',
                            plan_name: 'Plano Aura'
                        }, { onConflict: 'company_id, due_date, amount' })
                    }
                }
            }
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
