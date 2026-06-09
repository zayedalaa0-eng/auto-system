-- Drop existing policy
drop policy if exists "inventory_select_scope" on public.inventory;

-- Recreate policy with cross-branch consignment rule
create policy "inventory_select_scope"
on public.inventory
for select
to authenticated
using (
  public.is_manager()
  or branch_id = public.current_user_branch_id()
  or branch_id is null
  or (deal_type = 'برسم البيع' and availability_status = 'متوفرة')
);
