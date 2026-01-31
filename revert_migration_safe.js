
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CARLOS_COMPANY_ID = 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
const KAYKY_COMPANY_ID = '76c36f15-7759-467d-9b74-5424b5fdd00e';
const CUTOFF_DATE = '2026-01-30T23:00:00+00:00'; // Approximate time before Kayky created account

async function revertData() {
  console.log('--- Starting Safe Revert ---');
  
  const tables = ['products', 'suppliers', 'stock_movements', 'sectors', 'categories', 'locations'];
  
  for (const table of tables) {
    console.log(`Processing table: ${table}`);
    
    // Update items in Kayky's company that are older than the cutoff
    const { data, error, count } = await supabase
      .from(table)
      .update({ company_id: CARLOS_COMPANY_ID })
      .eq('company_id', KAYKY_COMPANY_ID)
      .lt('created_at', CUTOFF_DATE)
      .select('id');
      
    if (error) {
      console.error(`Error updating ${table}:`, error);
    } else {
      console.log(`Moved ${data.length} items back to Carlos in ${table}.`);
    }
  }
  
  console.log('--- Revert Complete ---');
}

revertData();
