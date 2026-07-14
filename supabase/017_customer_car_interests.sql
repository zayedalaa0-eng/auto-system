create table if not exists public.customer_car_interests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  interest_level text not null default 'medium', -- high, medium, low
  notes text,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_customer_car_interests_customer_id on public.customer_car_interests(customer_id);
create index if not exists idx_customer_car_interests_inventory_id on public.customer_car_interests(inventory_id);

drop trigger if exists trg_customer_car_interests_set_updated_at on public.customer_car_interests;
create trigger trg_customer_car_interests_set_updated_at
before update on public.customer_car_interests
for each row execute function public.set_updated_at();

alter table public.customer_car_interests enable row level security;

drop policy if exists "customer_car_interests_select_scope" on public.customer_car_interests;
create policy "customer_car_interests_select_scope"
on public.customer_car_interests
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_car_interests.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
);

drop policy if exists "customer_car_interests_insert_scope" on public.customer_car_interests;
create policy "customer_car_interests_insert_scope"
on public.customer_car_interests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_car_interests.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
);

drop policy if exists "customer_car_interests_update_scope" on public.customer_car_interests;
create policy "customer_car_interests_update_scope"
on public.customer_car_interests
for update
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_car_interests.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
)
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_car_interests.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
);

drop policy if exists "customer_car_interests_delete_scope" on public.customer_car_interests;
create policy "customer_car_interests_delete_scope"
on public.customer_car_interests
for delete
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_car_interests.customer_id
      and (
        public.is_manager()
        or c.assigned_user_id = public.current_app_user_id()
        or c.branch_id = public.current_user_branch_id()
      )
  )
);

comment on table public.customer_car_interests is 'Link table representing a customers interest in a specific inventory item.';
