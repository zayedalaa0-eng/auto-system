-- Drop existing policy for inventory
drop policy if exists "inventory_select_scope" on public.inventory;

-- Recreate policy with cross-branch rule for used cars and consignment
create policy "inventory_select_scope"
on public.inventory
for select
to authenticated
using (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or branch_id is null
  or (deal_type in ('برسم البيع', 'استبدال') and availability_status = 'متوفرة')
);

-- Drop existing policy for customers
drop policy if exists "customers_select_branch_scope" on public.customers;

-- Recreate policy with cross-branch rule for related used-car customers
create policy "customers_select_branch_scope"
on public.customers
for select
to authenticated
using (
  public.is_manager()
  or assigned_user_id = public.current_app_user_id()
  or branch_id = public.current_user_branch_id()
  or operation_type in ('buyer_tradein', 'buyer_tradein_pending', 'buyer_tradein_evaluated', 'sell_on_behalf')
);
