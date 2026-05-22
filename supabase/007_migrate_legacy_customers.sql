create or replace function public.try_parse_timestamptz(raw text)
returns timestamptz
language plpgsql
as $$
declare
  parsed timestamptz;
begin
  if raw is null or btrim(raw) = '' or btrim(raw) = '-' then
    return null;
  end if;

  begin
    parsed := raw::timestamptz;
    return parsed;
  exception when others then
    null;
  end;

  begin
    parsed := to_timestamp(raw, 'YYYY/MM/DD HH12:MI AM');
    return parsed;
  exception when others then
    null;
  end;

  begin
    parsed := to_timestamp(raw, 'DD/MM/YYYY HH12:MI AM');
    return parsed;
  exception when others then
    null;
  end;

  begin
    parsed := to_timestamp(raw, 'YYYY-MM-DD HH24:MI:SS');
    return parsed;
  exception when others then
    return null;
  end;
end;
$$;

with prepared_legacy_customers as (
  select
    l.*,
    b.id as branch_id,
    u.id as assigned_user_id,
    coalesce(nullif(replace(btrim(l.phone), '''', ''), ''), 'UNKNOWN-' || l.legacy_row_id::text) as normalized_phone,
    coalesce(public.try_parse_timestamptz(l.created_at_raw), timezone('utc', now())) as parsed_created_at,
    row_number() over (
      partition by
        b.id,
        coalesce(nullif(replace(btrim(l.phone), '''', ''), ''), 'UNKNOWN-' || l.legacy_row_id::text)
      order by
        coalesce(public.try_parse_timestamptz(l.created_at_raw), timezone('utc', now())) desc,
        l.legacy_row_id desc
    ) as dedupe_rank
  from public.legacy_customers_import l
  left join public.branches b
    on lower(b.name) = lower(coalesce(l.branch_name, ''))
  left join public.app_users u
    on lower(u.full_name) = lower(coalesce(l.employee_name, ''))
   and (u.branch_id = b.id or b.id is null or u.branch_id is null)
),
deduped_legacy_customers as (
  select *
  from prepared_legacy_customers
  where dedupe_rank = 1
)
insert into public.customers (
  legacy_row_id,
  branch_id,
  assigned_user_id,
  full_name,
  phone,
  requested_car,
  payment_plan,
  status,
  nickname,
  address,
  whatsapp_prefix,
  next_follow_up_at,
  visit_count,
  last_contact_at,
  notes,
  is_active,
  metadata,
  created_at,
  updated_at
)
select
  l.legacy_row_id,
  l.branch_id,
  l.assigned_user_id,
  coalesce(nullif(btrim(l.customer_name), ''), 'عميل بدون اسم') as full_name,
  l.normalized_phone as phone,
  nullif(btrim(l.requested_car), '') as requested_car,
  nullif(btrim(l.payment_plan), '') as payment_plan,
  coalesce(nullif(btrim(l.status), ''), 'غير محدد') as status,
  nullif(btrim(l.nickname), '') as nickname,
  nullif(btrim(l.address), '') as address,
  coalesce(nullif(btrim(l.whatsapp_prefix), ''), '+970') as whatsapp_prefix,
  public.try_parse_timestamptz(l.next_follow_up_raw) as next_follow_up_at,
  greatest(coalesce(nullif(regexp_replace(coalesce(l.visit_count_raw, ''), '[^0-9]', '', 'g'), '')::integer, 1), 1) as visit_count,
  public.try_parse_timestamptz(l.last_contact_raw) as last_contact_at,
  nullif(btrim(l.notes_raw), '') as notes,
  case
    when coalesce(l.status, '') ilike '%غير فعال%' then false
    else true
  end as is_active,
  jsonb_strip_nulls(
    jsonb_build_object(
      'legacy_attachments_raw', nullif(l.attachments_raw, ''),
      'legacy_trade_in_raw', nullif(l.trade_in_raw, ''),
      'legacy_employee_name', nullif(l.employee_name, ''),
      'legacy_branch_name', nullif(l.branch_name, ''),
      'dedupe_rank', l.dedupe_rank
    )
  ) as metadata,
  l.parsed_created_at as created_at,
  timezone('utc', now()) as updated_at
from deduped_legacy_customers l
on conflict (legacy_row_id) do update
set
  branch_id = excluded.branch_id,
  assigned_user_id = excluded.assigned_user_id,
  full_name = excluded.full_name,
  phone = excluded.phone,
  requested_car = excluded.requested_car,
  payment_plan = excluded.payment_plan,
  status = excluded.status,
  nickname = excluded.nickname,
  address = excluded.address,
  whatsapp_prefix = excluded.whatsapp_prefix,
  next_follow_up_at = excluded.next_follow_up_at,
  visit_count = excluded.visit_count,
  last_contact_at = excluded.last_contact_at,
  notes = excluded.notes,
  is_active = excluded.is_active,
  metadata = public.customers.metadata || excluded.metadata,
  updated_at = timezone('utc', now());

with prepared_legacy_customers as (
  select
    l.*,
    b.id as branch_id,
    coalesce(nullif(replace(btrim(l.phone), '''', ''), ''), 'UNKNOWN-' || l.legacy_row_id::text) as normalized_phone,
    row_number() over (
      partition by
        b.id,
        coalesce(nullif(replace(btrim(l.phone), '''', ''), ''), 'UNKNOWN-' || l.legacy_row_id::text)
      order by
        coalesce(public.try_parse_timestamptz(l.created_at_raw), timezone('utc', now())) desc,
        l.legacy_row_id desc
    ) as dedupe_rank
  from public.legacy_customers_import l
  left join public.branches b
    on lower(b.name) = lower(coalesce(l.branch_name, ''))
),
deduped_legacy_customers as (
  select *
  from prepared_legacy_customers
  where dedupe_rank = 1
)
insert into public.customer_logs (
  customer_id,
  actor_name,
  action,
  next_follow_up_at,
  details,
  metadata,
  created_at
)
select
  c.id,
  l.employee_name,
  'legacy_import',
  public.try_parse_timestamptz(l.next_follow_up_raw),
  left(coalesce(l.notes_raw, 'تم ترحيل السجل من النظام القديم.'), 5000),
  jsonb_build_object('source', 'legacy_customers_import', 'legacy_row_id', l.legacy_row_id),
  coalesce(public.try_parse_timestamptz(l.created_at_raw), timezone('utc', now()))
from deduped_legacy_customers l
join public.customers c on c.legacy_row_id = l.legacy_row_id
where not exists (
  select 1
  from public.customer_logs cl
  where cl.customer_id = c.id
    and cl.metadata ->> 'source' = 'legacy_customers_import'
    and cl.metadata ->> 'legacy_row_id' = l.legacy_row_id::text
);

with prepared_legacy_customers as (
  select
    l.*,
    b.id as branch_id,
    coalesce(nullif(replace(btrim(l.phone), '''', ''), ''), 'UNKNOWN-' || l.legacy_row_id::text) as normalized_phone,
    row_number() over (
      partition by
        b.id,
        coalesce(nullif(replace(btrim(l.phone), '''', ''), ''), 'UNKNOWN-' || l.legacy_row_id::text)
      order by
        coalesce(public.try_parse_timestamptz(l.created_at_raw), timezone('utc', now())) desc,
        l.legacy_row_id desc
    ) as dedupe_rank
  from public.legacy_customers_import l
  left join public.branches b
    on lower(b.name) = lower(coalesce(l.branch_name, ''))
),
deduped_legacy_customers as (
  select *
  from prepared_legacy_customers
  where dedupe_rank = 1
)
insert into public.customer_attachments (
  customer_id,
  file_name,
  file_category,
  public_url,
  metadata
)
select
  c.id,
  split_part(trim(url_item.url), '/', array_length(string_to_array(trim(url_item.url), '/'), 1)),
  'legacy-url',
  trim(url_item.url),
  jsonb_build_object('source', 'legacy_customers_import', 'legacy_row_id', l.legacy_row_id)
from deduped_legacy_customers l
join public.customers c on c.legacy_row_id = l.legacy_row_id
cross join lateral regexp_split_to_table(coalesce(l.attachments_raw, ''), E'[\\n,]+') as url_item(url)
where trim(url_item.url) <> ''
  and trim(url_item.url) <> '-'
  and not exists (
    select 1
    from public.customer_attachments ca
    where ca.customer_id = c.id
      and ca.public_url = trim(url_item.url)
  );
