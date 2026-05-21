create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  is_active boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  whatsapp_prefix text default '+970',
  telegram_chat_id text unique,
  branch_id uuid references public.branches(id) on delete set null,
  role text not null,
  status text not null default 'active',
  is_active boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  legacy_staff_row_id integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  legacy_row_id integer unique,
  branch_id uuid references public.branches(id) on delete set null,
  assigned_user_id uuid references public.app_users(id) on delete set null,
  full_name text not null,
  phone text not null,
  requested_car text,
  payment_plan text,
  status text not null,
  nickname text,
  address text,
  whatsapp_prefix text default '+970',
  next_follow_up_at timestamptz,
  visit_count integer not null default 1,
  last_contact_at timestamptz,
  notes text,
  attachment_notes text,
  source text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_attachments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  file_name text,
  file_category text,
  storage_path text,
  public_url text,
  mime_type text,
  file_size_bytes bigint,
  uploaded_by_user_id uuid references public.app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trade_ins (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  owner_name text,
  model text not null,
  price numeric(12, 2),
  chassis_no text,
  color text,
  production_year integer,
  mileage integer,
  specs text,
  inspection text,
  status text,
  condition_label text,
  deal_type text,
  license_expiry text,
  notes text,
  is_active boolean not null default true,
  archived_reason text,
  archived_at timestamptz,
  archived_by_user_id uuid references public.app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  legacy_row_id integer unique,
  branch_id uuid references public.branches(id) on delete set null,
  source_customer_id uuid references public.customers(id) on delete set null,
  model text not null,
  owner_name text,
  deal_type text,
  chassis_no text,
  condition_label text,
  availability_status text not null default 'متوفرة',
  price numeric(12, 2),
  gearbox text,
  fuel_type text,
  license_expiry text,
  notes text,
  color text,
  production_year integer,
  mileage integer,
  specs text,
  inspection text,
  photo_urls jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.app_users(id) on delete cascade,
  recipient_branch_id uuid references public.branches(id) on delete cascade,
  recipient_label text,
  notification_type text,
  title text,
  message text not null,
  status text not null default 'unread',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  assigned_user_id uuid references public.app_users(id) on delete set null,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  reminder_type text not null,
  title text,
  message text,
  due_at timestamptz,
  status text not null default 'pending',
  completed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  actor_user_id uuid references public.app_users(id) on delete set null,
  actor_name text,
  action text not null,
  next_follow_up_at timestamptz,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_uuid uuid,
  legacy_entity_id text,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.car_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text,
  requested_car text not null,
  budget text,
  source text,
  status text not null default 'open',
  owner_user_id uuid references public.app_users(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  actor_user_id uuid references public.app_users(id) on delete set null,
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_users_branch_id on public.app_users(branch_id);
create index if not exists idx_app_users_role on public.app_users(role);
create index if not exists idx_app_users_telegram_chat_id on public.app_users(telegram_chat_id);

create index if not exists idx_customers_branch_id on public.customers(branch_id);
create index if not exists idx_customers_assigned_user_id on public.customers(assigned_user_id);
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_customers_status on public.customers(status);
create index if not exists idx_customers_next_follow_up_at on public.customers(next_follow_up_at);
create index if not exists idx_customers_created_at on public.customers(created_at desc);

create index if not exists idx_customer_attachments_customer_id on public.customer_attachments(customer_id);
create index if not exists idx_trade_ins_customer_id on public.trade_ins(customer_id);
create index if not exists idx_trade_ins_chassis_no on public.trade_ins(chassis_no);
create index if not exists idx_inventory_branch_id on public.inventory(branch_id);
create index if not exists idx_inventory_source_customer_id on public.inventory(source_customer_id);
create index if not exists idx_inventory_chassis_no on public.inventory(chassis_no);
create index if not exists idx_inventory_availability_status on public.inventory(availability_status);
create index if not exists idx_notifications_recipient_user_id on public.notifications(recipient_user_id);
create index if not exists idx_notifications_recipient_branch_id on public.notifications(recipient_branch_id);
create index if not exists idx_notifications_status on public.notifications(status);
create index if not exists idx_reminders_assigned_user_id on public.reminders(assigned_user_id);
create index if not exists idx_reminders_due_at on public.reminders(due_at);
create index if not exists idx_customer_logs_customer_id on public.customer_logs(customer_id);
create index if not exists idx_audit_logs_entity_type on public.audit_logs(entity_type);
create index if not exists idx_price_history_inventory_id on public.price_history(inventory_id);
create index if not exists idx_car_requests_status on public.car_requests(status);

create unique index if not exists uq_customers_branch_phone
  on public.customers(branch_id, phone);

drop trigger if exists trg_branches_set_updated_at on public.branches;
create trigger trg_branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

drop trigger if exists trg_app_users_set_updated_at on public.app_users;
create trigger trg_app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_set_updated_at on public.customers;
create trigger trg_customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_trade_ins_set_updated_at on public.trade_ins;
create trigger trg_trade_ins_set_updated_at
before update on public.trade_ins
for each row execute function public.set_updated_at();

drop trigger if exists trg_inventory_set_updated_at on public.inventory;
create trigger trg_inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();

drop trigger if exists trg_reminders_set_updated_at on public.reminders;
create trigger trg_reminders_set_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

drop trigger if exists trg_car_requests_set_updated_at on public.car_requests;
create trigger trg_car_requests_set_updated_at
before update on public.car_requests
for each row execute function public.set_updated_at();

comment on table public.app_users is 'Application users and staff directory, mapped later to Supabase auth.users.';
comment on table public.customers is 'Main customer records migrated from the current Google Sheets customers sheet.';
comment on table public.trade_ins is 'Customer trade-in or seller-car records with active/archive support.';
comment on table public.inventory is 'Vehicle inventory, including company stock and customer cars for sale.';
comment on table public.notifications is 'In-app notification records for users or branches.';
comment on table public.reminders is 'Follow-up tasks and scheduled reminders.';
