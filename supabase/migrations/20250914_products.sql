-- Enable pg_trgm for trigram index if available
create extension if not exists pg_trgm;

-- Create products table if missing (minimal set)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  brand text,
  category text,
  unit text default 'unit',
  unit_size numeric default 1,
  retail_price numeric not null default 0,
  cost_price numeric not null default 0,
  min_stock_threshold integer not null default 0,
  tax_rate numeric default 0,
  is_active boolean not null default true,
  expires_in_days integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add columns if they do not exist (idempotent)
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists unit text default 'unit';
alter table public.products add column if not exists unit_size numeric default 1;
alter table public.products add column if not exists retail_price numeric not null default 0;
alter table public.products add column if not exists cost_price numeric not null default 0;
alter table public.products add column if not exists min_stock_threshold integer not null default 0;
alter table public.products add column if not exists tax_rate numeric default 0;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists expires_in_days integer;
alter table public.products add column if not exists updated_at timestamptz default now();

-- Unique constraint (prefer (tenant_id, sku) when tenant_id exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'tenant_id'
  ) then
    create unique index if not exists products_tenant_sku_uniq on public.products(tenant_id, sku);
  else
    create unique index if not exists products_sku_uniq on public.products(sku);
  end if;
end $$;

-- Search index
create index if not exists idx_products_search_trgm on public.products using gin ((coalesce(sku,'') || ' ' || coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(category,'')) gin_trgm_ops);

-- RLS (demo policies)
alter table public.products enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_read') then
    create policy products_read on public.products for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_write') then
    create policy products_write on public.products for all to authenticated using (true) with check (true);
  end if;
end $$;

