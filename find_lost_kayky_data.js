
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CARLOS_COMPANY_ID = 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
const KAYKY_CREATED_AT = '2026-01-30T23:30:34.462377+00:00';

async function findLostData() {
  console.log('--- Searching for Kayky Data in Carlos Company ---');
  
  // Find products in Carlos company created AFTER Kayky registered
  const { data: recentProducts, error } = await supabase
    .from('products')
    .select('id, description, created_at')
    .eq('company_id', CARLOS_COMPANY_ID)
    .gte('created_at', KAYKY_CREATED_AT)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${recentProducts.length} recent products in Carlos Company (Potential candidates for restore):`);
  recentProducts.forEach(p => console.log(`- [${p.created_at}] ${p.description} (${p.id})`));
  
  // Also check movements
  const { count: recentMovements } = await supabase
    .from('stock_movements')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', CARLOS_COMPANY_ID)
    .gte('created_at', KAYKY_CREATED_AT);
    
   console.log(`Found ${recentMovements} recent stock movements.`);
}

findLostData();
