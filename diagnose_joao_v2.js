
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  console.log('--- Diagnostic Round 2 ---');

  // 1. Get User Joao
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('name', '%Joao%');

  if (userError || !users?.length) {
    console.error('User not found or error:', userError);
    return;
  }

  const joao = users[0];
  console.log('User Joao:', { id: joao.id, company_id: joao.company_id, email: joao.email });

  if (!joao.company_id) {
    console.error('Joao has no company_id!');
    return;
  }

  // 2. Get Company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', joao.company_id)
    .single();

  if (companyError) {
    console.error('Error fetching company:', companyError);
  } else {
    console.log('Company Details:', company);
  }

  // 3. Count Products for this Company
  const { count: productCount, error: productError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', joao.company_id);

  console.log(`Products for company ${joao.company_id}: ${productCount} (Error: ${productError?.message || 'none'})`);

  // 4. List ALL companies to see if there's a duplicate or confusion
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, name, cnpj');
    
  console.log('All Companies in DB:', allCompanies);
}

diagnose();
