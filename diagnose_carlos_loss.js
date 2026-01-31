
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CARLOS_COMPANY_ID = 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
const KAYKY_COMPANY_ID = '76c36f15-7759-467d-9b74-5424b5fdd00e';

async function diagnose() {
  console.log('--- Diagnostic Round 3: Carlos Data Loss ---');

  // 1. Count products in both companies
  const { count: countCarlos } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', CARLOS_COMPANY_ID);
  const { count: countKayky } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', KAYKY_COMPANY_ID);
  const { count: countTotal } = await supabase.from('products').select('*', { count: 'exact', head: true });

  console.log(`Products in Carlos Company: ${countCarlos}`);
  console.log(`Products in Kayky Company: ${countKayky}`);
  console.log(`Total Products in DB: ${countTotal}`);
  console.log(`Orphaned/Other Products: ${countTotal - (countCarlos || 0) - (countKayky || 0)}`);

  // 2. Check if Carlos user still points to his company
  const { data: carlosUser } = await supabase.from('profiles').select('*').eq('email', 'carlosgabriel.camppos@gmail.com').single();
  console.log('Carlos User:', { id: carlosUser?.id, company_id: carlosUser?.company_id });

  // 3. Sample products from Kayky's company to see if old ones moved there
  if (countKayky > 0) {
      const { data: sampleKayky } = await supabase
        .from('products')
        .select('description, created_at')
        .eq('company_id', KAYKY_COMPANY_ID)
        .order('created_at', { ascending: true }) // Oldest first
        .limit(5);
      
      console.log('Oldest products in Kayky Company (Should only be recent ones):');
      sampleKayky.forEach(p => console.log(`- ${p.created_at}: ${p.description}`));
  }
}

diagnose();
