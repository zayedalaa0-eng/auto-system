create table if not exists public.legacy_staff_import (
  legacy_row_id integer primary key,
  telegram_chat_id text,
  full_name text,
  branch_name text,
  role_raw text,
  password_raw text,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.legacy_showrooms_import (
  legacy_row_id integer primary key,
  branch_name text,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.legacy_notifications_import (
  legacy_row_id integer primary key,
  created_at_raw text,
  target_role_or_room text,
  message text,
  status text,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.legacy_customer_logs_import (
  legacy_row_id integer primary key,
  created_at_raw text,
  customer_row_id_raw text,
  customer_name text,
  actor_name text,
  action text,
  next_follow_up_raw text,
  details text,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.legacy_audit_logs_import (
  legacy_row_id integer primary key,
  created_at_raw text,
  actor_name text,
  actor_role text,
  action text,
  entity_type text,
  entity_row_id_raw text,
  details text,
  imported_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_legacy_staff_import_full_name
  on public.legacy_staff_import(full_name);

create index if not exists idx_legacy_showrooms_import_branch_name
  on public.legacy_showrooms_import(branch_name);

create index if not exists idx_legacy_notifications_import_target
  on public.legacy_notifications_import(target_role_or_room);

create index if not exists idx_legacy_customer_logs_import_customer_row
  on public.legacy_customer_logs_import(customer_row_id_raw);

create index if not exists idx_legacy_audit_logs_import_entity
  on public.legacy_audit_logs_import(entity_type, entity_row_id_raw);
