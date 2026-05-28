# Legacy Import Steps

## 1) Generate import CSV files from `cars.xlsx`

Run:

- `python scripts/export_supabase_imports.py`

Generated files will be written to:

- `supabase/imports/legacy_customers_import.csv`
- `supabase/imports/legacy_inventory_import.csv`
- `supabase/imports/legacy_staff_import.csv`
- `supabase/imports/legacy_showrooms_import.csv`
- `supabase/imports/legacy_notifications_import.csv`
- `supabase/imports/legacy_customer_logs_import.csv`
- `supabase/imports/legacy_audit_logs_import.csv`

## 2) Create staging tables in Supabase

Run in SQL Editor:

- `006_legacy_staging.sql`
- `009_legacy_support_staging.sql`

## 3) Import CSV files into staging tables

From Supabase Table Editor, use `Import data from CSV` for:

- `legacy_customers_import` <- `legacy_customers_import.csv`
- `legacy_inventory_import` <- `legacy_inventory_import.csv`
- `legacy_staff_import` <- `legacy_staff_import.csv`
- `legacy_showrooms_import` <- `legacy_showrooms_import.csv`
- `legacy_notifications_import` <- `legacy_notifications_import.csv`
- `legacy_customer_logs_import` <- `legacy_customer_logs_import.csv`
- `legacy_audit_logs_import` <- `legacy_audit_logs_import.csv`

Important:

- `legacy_row_id` must remain exactly as generated. It is the join key used to reconnect customers, inventory, and activity logs.

## 4) Run migrations into final tables

Run in this order:

- `003_seed_initial_data.sql`
- `007_migrate_legacy_customers.sql`
- `010_migrate_legacy_inventory.sql`
- `011_migrate_legacy_support_data.sql`

## 5) Verify counts

Run:

```sql
select count(*) from public.legacy_customers_import;
select count(*) from public.legacy_inventory_import;
select count(*) from public.legacy_staff_import;
select count(*) from public.customers;
select count(*) from public.inventory;
select count(*) from public.app_users;
select count(*) from public.notifications;
select count(*) from public.customer_logs;
select count(*) from public.audit_logs;
```
