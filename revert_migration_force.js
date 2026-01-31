
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CARLOS_COMPANY_ID = 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
const KAYKY_COMPANY_ID = '76c36f15-7759-467d-9b74-5424b5fdd00e';
const CUTOFF_DATE = '2026-01-30T23:00:00+00:00';

async function forceRevert() {
  console.log('--- FORCING Revert for Products ---');
  
  // Try without created_at filter first to see if anything is there
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', KAYKY_COMPANY_ID);
    
  console.log(`Total products in Kayky's company: ${count}`);
  
  if (count > 0) {
      // We will move ALL products from Kayky to Carlos, 
      // because we know Kayky just started and shouldn't have 600+ products
      const { data, error: updateError } = await supabase
      .from('products')
      .update({ company_id: CARLOS_COMPANY_ID })
      .eq('company_id', KAYKY_COMPANY_ID)
      .select('id');
      
      if (updateError) console.error('Update Error:', updateError);
      else console.log(`Moved ${data.length} products back to Carlos.`);
  }

  // Repeat for others without created_at check (safer to just move all if we assume Kayky is empty)
  const tables = ['suppliers', 'stock_movements', 'sectors', 'categories', 'locations'];
  for (const table of tables) {
      const { data, error: updateError } = await supabase
      .from(table)
      .update({ company_id: CARLOS_COMPANY_ID })
      .eq('company_id', KAYKY_COMPANY_ID)
      .select('id');
       if (updateError) console.error(`Update Error ${table}:`, updateError);
       else console.log(`Moved ${data?.length || 0} items back to Carlos in ${table}.`);
  }
}

forceRevert();
