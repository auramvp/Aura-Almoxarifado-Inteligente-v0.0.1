
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdgapmcalocdvdgvbwsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BgGJ0noZ8kExU47L3Y5KZw_KraGXjuz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMAIL = 'carlosgabriel.camppos@gmail.com';

async function debugFetch() {
  console.log('--- Debug Fetching Products ---');

  // 1. Simulate Login / Get User
  // Note: We can't easily sign in with password in Node without the password.
  // But we can check public data or use a service key if we had one (we don't, only anon).
  // However, we can simulate the query logic IF RLS wasn't the issue.
  
  // Since RLS depends on the *authenticated user*, I cannot fully simulate the browser behavior 
  // without signing in.
  
  // BUT, I can try to sign in with the password if I knew it. I don't.
  
  // Instead, I will check the data using the *same query parameters* but without RLS enforcement
  // (assuming I'm an admin/checking directly via code that might bypass if I was server-side, 
  // but here I am client-side anon).
  
  // Wait, I can't bypass RLS with anon key.
  
  // Let's rely on the previous `check_active.js` which used the same client.
  // Did `check_active.js` work?
  // Yes, it printed "Total Products: 685".
  // Why did it work?
  // Because I didn't verify *who* was logged in? No, `check_active.js` didn't login!
  // It just ran: `supabase.from('products').select(...)`.
  
  // IF `check_active.js` worked without login, it means:
  // 1. RLS is NOT enabled, OR
  // 2. RLS has a policy allowing "public" access?
  
  // Let's re-examine `check_active.js`.
  /*
  const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', CARLOS_COMPANY_ID);
  */
  
  // If this worked, it means RLS might NOT be enforcing read access for anon users properly, 
  // OR it allows anon access.
  
  // IF RLS allows anon access, why does the authenticated user NOT see it?
  // Maybe the authenticated user matches a policy that *restricts* them, while anon matches nothing 
  // (and if RLS is off, they see everything).
  
  // I enabled RLS in V3 script: `ALTER TABLE products ENABLE ROW LEVEL SECURITY;`
  // So now RLS *should* be on.
  
  // If `check_active.js` worked *before* V3, it might fail *after* V3 if I don't login.
  
  console.log("Checking if we can fetch products as ANON (no login)...");
  const CARLOS_COMPANY_ID = 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
  
  const { data, error } = await supabase
    .from('products')
    .select('id, description, company_id, active')
    .eq('company_id', CARLOS_COMPANY_ID)
    .eq('active', true)
    .limit(5);
    
  if (error) {
    console.error("Anon fetch error:", error);
  } else {
    console.log("Anon fetch success (Active=true):", data);
  }
}

debugFetch();
