
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function investigate() {
  console.log('--- Investigation ---');

  // 1. Fetch Users
  const emails = ['carlosgabriel.camppos@gmail.com', 'contato.auramvp@gmail.com'];
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, name, email, role, company_id, created_at')
    .or(`email.in.(${emails.join(',')}),name.ilike.%Joao%`);

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  console.log('Users found:', users);

  // 2. Fetch Companies for these users
  const companyIds = [...new Set(users.map(u => u.company_id).filter(id => id))];
  
  if (companyIds.length > 0) {
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('*')
      .in('id', companyIds);

    console.log('Companies found for users:', companies);
  } else {
    console.log('No company IDs found linked to these users.');
  }

  // 3. List ALL companies to see available options
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, name, cnpj, created_at');
    
  console.log('ALL Companies in DB:', allCompanies);
}

investigate();
