
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CARLOS_COMPANY_ID = 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';

async function checkActive() {
  console.log('--- Checking Active Status ---');

  const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', CARLOS_COMPANY_ID);
  const { count: active } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', CARLOS_COMPANY_ID).eq('active', true);
  const { count: inactive } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', CARLOS_COMPANY_ID).eq('active', false);

  console.log(`Total Products: ${total}`);
  console.log(`Active: ${active}`);
  console.log(`Inactive: ${inactive}`);
}

checkActive();
