
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMAILS = ['carlosgabriel.camppos@gmail.com'];
const COMPANY_ID = 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';

async function checkProfile() {
  console.log('--- Checking Profile ---');

  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .in('email', EMAILS);

  if (error) {
    console.error('Error fetching profile:', error);
    return;
  }

  console.log('Users found:', users);

  if (users.length > 0) {
    const user = users[0];
    console.log(`User Company ID: ${user.company_id}`);
    console.log(`Expected Company ID: ${COMPANY_ID}`);
    console.log(`Match: ${user.company_id === COMPANY_ID}`);
  }
}

checkProfile();
