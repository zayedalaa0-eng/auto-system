create or replace function public.current_app_user_id()
returns uuid
language sql
stable
as $$
  select au.id
  from public.app_users au
  where au.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_branch_id()
returns uuid
language sql
stable
as $$
  select au.branch_id
  from public.app_users au
  where au.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(au.role, '')
  from public.app_users au
  where au.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_users au
    where au.auth_user_id = auth.uid()
      and (
        au.role ilike '%مدير عام%'
        or au.role ilike '%مدير معرض%'
        or au.role ilike '%admin%'
        or au.role ilike '%owner%'
      )
  )
$$;

alter table public.branches enable row level security;
alter table public.app_users enable row level security;
alter table public.customers enable row level security;
alter table public.customer_attachments enable row level security;
alter table public.trade_ins enable row level security;
alter table public.inventory enable row level security;
alter table public.notifications enable row level security;
alter table public.reminders enable row level security;
alter table public.customer_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.car_requests enable row level security;
alter table public.price_history enable row level security;

drop policy if exists "branches_select_authenticated" on public.branches;
create policy "branches_select_authenticated"
on public.branches
for select
to authenticated
using (true);

drop policy if exists "app_users_select_authenticated" on public.app_users;
create policy "app_users_select_authenticated"
on public.app_users
for select
to authenticated
using (true);

drop policy if exists "app_users_update_self_or_manager" on public.app_users;
create policy "app_users_update_self_or_manager"
on public.app_users
for update
to authenticated
using (id = public.current_app_user_id() or public.is_manager())
with check (id = public.current_app_user_id() or public.is_manager());

drop policy if exists "customers_select_branch_scope" on public.customers;
create policy "customers_select_branch_scope"
on public.customers
for select
to authenticated
using (
  public.is_manager()
  or assigned_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "customers_insert_branch_scope" on public.customers;
create policy "customers_insert_branch_scope"
on public.customers
for insert
to authenticated
with check (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or assigned_user_id = public.current_app_user_id()
);

drop policy if exists "customers_update_branch_scope" on public.customers;
create policy "customers_update_branch_scope"
on public.customers
for update
to authenticated
using (
  public.is_manager()
  or assigned_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
)
with check (
  public.is_manager()
  or assigned_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "customer_attachments_select_scope" on public.customer_attachments;
create policy "customer_attachments_select_scope"
on public.customer_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_attachments.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
);

drop policy if exists "customer_attachments_insert_scope" on public.customer_attachments;
create policy "customer_attachments_insert_scope"
on public.customer_attachments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_attachments.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
);

drop policy if exists "trade_ins_select_scope" on public.trade_ins;
create policy "trade_ins_select_scope"
on public.trade_ins
for select
to authenticated
using (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or exists (
    select 1
    from public.customers c
    where c.id = trade_ins.customer_id
      and c.assigned_user_id = public.current_app_user_id()
  )
);

drop policy if exists "trade_ins_insert_scope" on public.trade_ins;
create policy "trade_ins_insert_scope"
on public.trade_ins
for insert
to authenticated
with check (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or exists (
    select 1
    from public.customers c
    where c.id = trade_ins.customer_id
      and c.assigned_user_id = public.current_app_user_id()
  )
);

drop policy if exists "trade_ins_update_scope" on public.trade_ins;
create policy "trade_ins_update_scope"
on public.trade_ins
for update
to authenticated
using (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
)
with check (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "inventory_select_scope" on public.inventory;
create policy "inventory_select_scope"
on public.inventory
for select
to authenticated
using (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or branch_id is null
);

drop policy if exists "inventory_insert_scope" on public.inventory;
create policy "inventory_insert_scope"
on public.inventory
for insert
to authenticated
with check (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or branch_id is null
);

drop policy if exists "inventory_update_scope" on public.inventory;
create policy "inventory_update_scope"
on public.inventory
for update
to authenticated
using (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or branch_id is null
)
with check (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or branch_id is null
);

drop policy if exists "notifications_select_scope" on public.notifications;
create policy "notifications_select_scope"
on public.notifications
for select
to authenticated
using (
  public.is_manager()
  or recipient_user_id = public.current_app_user_id()
  or recipient_branch_id = public.current_user_branch_id()
);

drop policy if exists "notifications_update_scope" on public.notifications;
create policy "notifications_update_scope"
on public.notifications
for update
to authenticated
using (
  public.is_manager()
  or recipient_user_id = public.current_app_user_id()
  or recipient_branch_id = public.current_user_branch_id()
)
with check (
  public.is_manager()
  or recipient_user_id = public.current_app_user_id()
  or recipient_branch_id = public.current_user_branch_id()
);

drop policy if exists "reminders_select_scope" on public.reminders;
create policy "reminders_select_scope"
on public.reminders
for select
to authenticated
using (
  public.is_manager()
  or assigned_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "reminders_insert_scope" on public.reminders;
create policy "reminders_insert_scope"
on public.reminders
for insert
to authenticated
with check (
  public.is_manager()
  or assigned_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "reminders_update_scope" on public.reminders;
create policy "reminders_update_scope"
on public.reminders
for update
to authenticated
using (
  public.is_manager()
  or assigned_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
)
with check (
  public.is_manager()
  or assigned_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "customer_logs_select_scope" on public.customer_logs;
create policy "customer_logs_select_scope"
on public.customer_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_logs.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
);

drop policy if exists "customer_logs_insert_scope" on public.customer_logs;
create policy "customer_logs_insert_scope"
on public.customer_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_logs.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
);

drop policy if exists "audit_logs_select_manager_only" on public.audit_logs;
create policy "audit_logs_select_manager_only"
on public.audit_logs
for select
to authenticated
using (public.is_manager());

drop policy if exists "car_requests_select_scope" on public.car_requests;
create policy "car_requests_select_scope"
on public.car_requests
for select
to authenticated
using (
  public.is_manager()
  or owner_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "car_requests_insert_scope" on public.car_requests;
create policy "car_requests_insert_scope"
on public.car_requests
for insert
to authenticated
with check (
  public.is_manager()
  or owner_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "car_requests_update_scope" on public.car_requests;
create policy "car_requests_update_scope"
on public.car_requests
for update
to authenticated
using (
  public.is_manager()
  or owner_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
)
with check (
  public.is_manager()
  or owner_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
);

drop policy if exists "price_history_select_scope" on public.price_history;
create policy "price_history_select_scope"
on public.price_history
for select
to authenticated
using (
  exists (
    select 1
    from public.inventory i
    where i.id = price_history.inventory_id
      and (
        public.is_manager()
        or i.branch_id = public.current_user_branch_id()
        or i.branch_id is null
      )
  )
);

drop policy if exists "price_history_insert_manager_only" on public.price_history;
create policy "price_history_insert_manager_only"
on public.price_history
for insert
to authenticated
with check (public.is_manager());
