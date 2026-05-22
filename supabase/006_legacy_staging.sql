create table if not exists public.legacy_customers_import (
  legacy_row_id integer primary key,
  created_at_raw text,
  branch_name text,
  employee_name text,
  customer_name text,
  phone text,
  requested_car text,
  payment_plan text,
  attachments_raw text,
  notes_raw text,
  status text,
  nickname text,
  address text,
  whatsapp_prefix text,
  next_follow_up_raw text,
  visit_count_raw text,
  last_contact_raw text,
  trade_in_raw text,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.legacy_inventory_import (
  legacy_row_id integer primary key,
  model text,
  owner_name text,
  deal_type text,
  chassis_no text,
  condition_label text,
  availability_status text,
  price_raw text,
  gearbox text,
  fuel_type text,
  review_date_raw text,
  installment_price_raw text,
  color text,
  production_year_raw text,
  mileage_raw text,
  specs text,
  inspection text,
  photos_raw text,
  imported_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_legacy_customers_import_branch_name
  on public.legacy_customers_import(branch_name);

create index if not exists idx_legacy_customers_import_employee_name
  on public.legacy_customers_import(employee_name);

create index if not exists idx_legacy_inventory_import_owner_name
  on public.legacy_inventory_import(owner_name);
