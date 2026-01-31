
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  console.log('Diagnosing user Joao and company link - Round 2...');

  // 1. Check the company Joao is currently linked to
  const currentCompanyId = '76c36f15-7759-467d-9b74-5424b5fdd00e';
  const { data: currentCompany, error: err1 } = await supabase
    .from('companies')
    .select('*')
    .eq('id', currentCompanyId);
  
  console.log('Company Joao is linked to:', currentCompany);

  // 2. Search for the target company by CNPJ (various formats)
  const targetCnpj = '05.506.560/0001-36';
  const targetCnpjClean = targetCnpj.replace(/\D/g, ''); // 05506560000136

  console.log(`Searching for CNPJ: "${targetCnpj}" and "${targetCnpjClean}"`);

  const { data: companiesByCnpj, error: err2 } = await supabase
    .from('companies')
    .select('*')
    .or(`cnpj.eq.${targetCnpj},cnpj.eq.${targetCnpjClean}`);

  console.log('Companies found by CNPJ:', companiesByCnpj);

  // 3. List all companies just in case
  const { data: allCompanies } = await supabase.from('companies').select('id, name, cnpj').limit(10);
  console.log('All companies (first 10):', allCompanies);
}

diagnose();
