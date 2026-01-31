
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectData() {
  console.log('--- Data Distribution Inspection ---');

  const companies = [
    { id: 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a', name: 'Carlos (48.418.200)' },
    { id: '76c36f15-7759-467d-9b74-5424b5fdd00e', name: 'Kayky (NIC. BR)' }
  ];

  for (const company of companies) {
    console.log(`\nChecking Company: ${company.name} (${company.id})`);

    const { count: products } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', company.id);
    const { count: suppliers } = await supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('company_id', company.id);
    const { count: movements } = await supabase.from('stock_movements').select('*', { count: 'exact', head: true }).eq('company_id', company.id);

    console.log(`- Products: ${products}`);
    console.log(`- Suppliers: ${suppliers}`);
    console.log(`- Movements: ${movements}`);
  }
}

inspectData();
