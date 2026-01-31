-- Create PLANS table
create table if not exists plans (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  max_users int not null default 1,
  max_items int not null default 100,
  price numeric(10, 2) not null default 0,
  interval text not null check (interval in ('monthly', 'yearly')),
  features text[] default '{}',
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create SUBSCRIPTIONS table
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  plan_id uuid references plans(id) not null,
  status text not null check (status in ('active', 'canceled', 'past_due', 'trialing')),
  start_date date not null default current_date,
  next_billing_date date,
  payment_method text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create INVOICES table
create table if not exists invoices (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  amount numeric(10, 2) not null,
  status text not null check (status in ('paid', 'open', 'void', 'uncollectible')),
  billing_date date not null default current_date,
  due_date date,
  pdf_url text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Insert Default Plans
insert into plans (name, max_users, max_items, price, interval, features) values
('Plano Starter', 3, 500, 99.90, 'monthly', '{"Controle de Estoque Básico", "Até 3 usuários", "Relatórios Simples"}'),
('Plano Pro', 10, 5000, 199.90, 'monthly', '{"Controle Avançado", "IA Otimizadora", "Até 10 usuários", "Suporte Prioritário"}'),
('Plano Enterprise', 999, 999999, 299.90, 'monthly', '{"Ilimitado", "API Dedicada", "Gestor de Contas", "IA Premium"}')
on conflict do nothing;

-- Enable RLS (Row Level Security) - Optional but recommended
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table invoices enable row level security;

-- Policies (Simplified for now - public read or authenticated read)
create policy "Enable read access for authenticated users" on plans for select using (auth.role() = 'authenticated');
create policy "Enable read access for users to their own subscription" on subscriptions for select using (auth.uid() in (select id from profiles where company_id = subscriptions.company_id));
create policy "Enable read access for users to their own invoices" on invoices for select using (auth.uid() in (select id from profiles where company_id = invoices.company_id));
