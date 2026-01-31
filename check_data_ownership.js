
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkOwnership() {
  const KAYKY_CREATED_AT = new Date('2026-01-30T23:30:34.462377+00:00');
  
  // Fetch 5 products from Kayky's company
  const { data: products } = await supabase
    .from('products')
    .select('id, description, created_at')
    .eq('company_id', '76c36f15-7759-467d-9b74-5424b5fdd00e')
    .limit(5);

  console.log('Kayky Created At:', KAYKY_CREATED_AT);
  
  if (products && products.length > 0) {
    console.log('Sample Products in Kayky Company:');
    products.forEach(p => {
      const pDate = new Date(p.created_at);
      console.log(`- ${p.description}: Created ${p.created_at} (${pDate < KAYKY_CREATED_AT ? 'OLDER - Belongs to Carlos' : 'NEWER - Belongs to Kayky'})`);
    });
  } else {
    console.log('No products found in Kayky company.');
  }
}

checkOwnership();
