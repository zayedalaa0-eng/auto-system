insert into public.inventory (
  legacy_row_id,
  branch_id,
  source_customer_id,
  model,
  owner_name,
  deal_type,
  chassis_no,
  condition_label,
  availability_status,
  price,
  gearbox,
  fuel_type,
  license_expiry,
  notes,
  color,
  production_year,
  mileage,
  specs,
  inspection,
  photo_urls,
  metadata,
  is_active,
  created_at,
  updated_at
)
select
  l.legacy_row_id,
  coalesce(branch_from_owner.id, source_customer.branch_id) as branch_id,
  source_customer.id as source_customer_id,
  coalesce(nullif(btrim(l.model), ''), 'سيارة بدون اسم') as model,
  nullif(btrim(l.owner_name), '') as owner_name,
  nullif(btrim(l.deal_type), '') as deal_type,
  nullif(btrim(l.chassis_no), '') as chassis_no,
  nullif(btrim(l.condition_label), '') as condition_label,
  coalesce(nullif(btrim(l.availability_status), ''), 'متوفرة') as availability_status,
  nullif(regexp_replace(coalesce(l.price_raw, ''), '[^0-9.]', '', 'g'), '')::numeric(12, 2) as price,
  nullif(btrim(l.gearbox), '') as gearbox,
  nullif(btrim(l.fuel_type), '') as fuel_type,
  nullif(btrim(l.review_date_raw), '') as license_expiry,
  nullif(
    concat_ws(
      E'\n',
      case when nullif(btrim(l.installment_price_raw), '') is not null then 'السعر بعد التقسيط: ' || btrim(l.installment_price_raw) end,
      case when nullif(btrim(l.review_date_raw), '') is not null then 'تاريخ المراجعة/الرخصة: ' || btrim(l.review_date_raw) end
    ),
    ''
  ) as notes,
  nullif(btrim(l.color), '') as color,
  nullif(regexp_replace(coalesce(l.production_year_raw, ''), '[^0-9]', '', 'g'), '')::integer as production_year,
  nullif(regexp_replace(coalesce(l.mileage_raw, ''), '[^0-9]', '', 'g'), '')::integer as mileage,
  nullif(btrim(l.specs), '') as specs,
  nullif(btrim(l.inspection), '') as inspection,
  coalesce(
    (
      select jsonb_agg(trim(item.url))
      from regexp_split_to_table(coalesce(l.photos_raw, ''), E'[\\n,]+') as item(url)
      where trim(item.url) <> ''
        and trim(item.url) <> '-'
    ),
    '[]'::jsonb
  ) as photo_urls,
  jsonb_strip_nulls(
    jsonb_build_object(
      'legacy_owner_name', nullif(l.owner_name, ''),
      'review_date_raw', nullif(l.review_date_raw, ''),
      'installment_price_raw', nullif(l.installment_price_raw, '')
    )
  ) as metadata,
  case
    when coalesce(l.availability_status, '') ilike '%مباعة%' then false
    else true
  end as is_active,
  timezone('utc', now()) as created_at,
  timezone('utc', now()) as updated_at
from public.legacy_inventory_import l
left join public.branches branch_from_owner
  on lower(branch_from_owner.name) = lower(coalesce(l.owner_name, ''))
left join public.customers source_customer
  on lower(source_customer.full_name) = lower(coalesce(l.owner_name, ''))
on conflict (legacy_row_id) do update
set
  branch_id = excluded.branch_id,
  source_customer_id = excluded.source_customer_id,
  model = excluded.model,
  owner_name = excluded.owner_name,
  deal_type = excluded.deal_type,
  chassis_no = excluded.chassis_no,
  condition_label = excluded.condition_label,
  availability_status = excluded.availability_status,
  price = excluded.price,
  gearbox = excluded.gearbox,
  fuel_type = excluded.fuel_type,
  license_expiry = excluded.license_expiry,
  notes = excluded.notes,
  color = excluded.color,
  production_year = excluded.production_year,
  mileage = excluded.mileage,
  specs = excluded.specs,
  inspection = excluded.inspection,
  photo_urls = excluded.photo_urls,
  metadata = public.inventory.metadata || excluded.metadata,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());
