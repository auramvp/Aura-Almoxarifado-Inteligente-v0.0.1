
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  console.log('--- Diagnostic Round 3: Missing Products ---');

  // 1. Get User Joao to confirm his current company_id
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, name, company_id')
    .ilike('name', '%Joao%');

  if (userError || !users?.length) {
    console.error('User not found:', userError);
    return;
  }
  const joao = users[0];
  console.log('User Joao:', joao);

  // 2. Get the Parent User (contato.auramvp@gmail.com) to compare company_id
  const { data: parents } = await supabase
    .from('profiles')
    .select('id, name, email, company_id')
    .eq('email', 'contato.auramvp@gmail.com');
  
  if (parents?.length) {
    console.log('Parent User (contato.auramvp):', parents[0]);
    if (parents[0].company_id !== joao.company_id) {
      console.error('MISMATCH: Joao and Parent have different company_ids!');
    } else {
      console.log('MATCH: Joao and Parent share the same company_id.');
    }
  }

  // 3. Count products for this company_id
  const { count: productCount, error: prodErr } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', joao.company_id);

  console.log(`Products with company_id ${joao.company_id}: ${productCount}`);

  // 4. Count products with NULL company_id (potential orphans)
  const { count: orphanCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .is('company_id', null);
  
  console.log(`Products with NULL company_id: ${orphanCount}`);

  // 5. List a few products to see their structure
  const { data: sampleProducts } = await supabase
    .from('products')
    .select('id, name, company_id')
    .limit(5);
  
  console.log('Sample Products in DB:', sampleProducts);
}

diagnose();
