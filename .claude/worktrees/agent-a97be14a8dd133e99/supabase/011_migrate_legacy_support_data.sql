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

insert into public.branches (code, name, notes)
select
  'legacy-' || md5(lower(trim(branch_name))),
  trim(branch_name),
  'فرع مستورد من ملف legacy staff/settings.'
from (
  select branch_name from public.legacy_staff_import
  union
  select branch_name from public.legacy_customers_import
  union
  select branch_name from public.legacy_showrooms_import
) src
where branch_name is not null
  and btrim(branch_name) <> ''
  and btrim(branch_name) <> 'الكل'
on conflict (name) do nothing;

update public.app_users u
set
  full_name = src.full_name,
  telegram_chat_id = src.telegram_chat_id,
  branch_id = src.branch_id,
  role = src.role,
  metadata = u.metadata || src.metadata,
  updated_at = timezone('utc', now())
from (
  select
    s.legacy_row_id,
    coalesce(nullif(btrim(s.full_name), ''), 'موظف بدون اسم') as full_name,
    nullif(btrim(s.telegram_chat_id), '') as telegram_chat_id,
    b.id as branch_id,
    case
      when coalesce(s.role_raw, '') ilike '%مدير عام%' then 'مدير عام'
      when coalesce(s.role_raw, '') ilike '%مدير معرض%' then 'مدير معرض'
      else 'موظف'
    end as role,
    jsonb_strip_nulls(
      jsonb_build_object(
        'source', 'legacy_staff_import',
        'legacy_role_raw', nullif(s.role_raw, ''),
        'legacy_branch_name', nullif(s.branch_name, ''),
        'legacy_password_present', case when nullif(s.password_raw, '') is not null then true else null end
      )
    ) as metadata
  from public.legacy_staff_import s
  left join public.branches b
    on lower(b.name) = lower(coalesce(s.branch_name, ''))
) src
where u.legacy_staff_row_id = src.legacy_row_id;

insert into public.app_users (
  legacy_staff_row_id,
  full_name,
  telegram_chat_id,
  branch_id,
  role,
  status,
  is_active,
  notes,
  metadata
)
select
  s.legacy_row_id,
  coalesce(nullif(btrim(s.full_name), ''), 'موظف بدون اسم'),
  nullif(btrim(s.telegram_chat_id), ''),
  b.id,
  case
    when coalesce(s.role_raw, '') ilike '%مدير عام%' then 'مدير عام'
    when coalesce(s.role_raw, '') ilike '%مدير معرض%' then 'مدير معرض'
    else 'موظف'
  end as role,
  'active',
  true,
  'تم ترحيل المستخدم من Google Sheets. كلمة المرور القديمة لم تُنقل إلى Supabase.',
  jsonb_strip_nulls(
    jsonb_build_object(
      'source', 'legacy_staff_import',
      'legacy_role_raw', nullif(s.role_raw, ''),
      'legacy_branch_name', nullif(s.branch_name, ''),
      'legacy_password_present', case when nullif(s.password_raw, '') is not null then true else null end
    )
  )
from public.legacy_staff_import s
left join public.branches b
  on lower(b.name) = lower(coalesce(s.branch_name, ''))
where not exists (
  select 1
  from public.app_users u
  where u.legacy_staff_row_id = s.legacy_row_id
);

insert into public.notifications (
  recipient_user_id,
  recipient_branch_id,
  recipient_label,
  notification_type,
  title,
  message,
  status,
  payload,
  created_by_user_id,
  created_at
)
select
  recipient_user.id,
  recipient_branch.id,
  nullif(btrim(n.target_role_or_room), '') as recipient_label,
  'legacy',
  null,
  coalesce(nullif(n.message, ''), 'رسالة قديمة بدون محتوى'),
  case when coalesce(n.status, '') ilike '%read%' then 'read' else 'unread' end,
  jsonb_build_object('source', 'legacy_notifications_import', 'legacy_row_id', n.legacy_row_id),
  null,
  coalesce(public.try_parse_timestamptz(n.created_at_raw), timezone('utc', now()))
from public.legacy_notifications_import n
left join public.branches recipient_branch
  on lower(recipient_branch.name) = lower(coalesce(n.target_role_or_room, ''))
left join public.app_users recipient_user
  on lower(recipient_user.full_name) = lower(coalesce(n.target_role_or_room, ''))
where not exists (
  select 1
  from public.notifications existing
  where existing.payload ->> 'source' = 'legacy_notifications_import'
    and existing.payload ->> 'legacy_row_id' = n.legacy_row_id::text
);

insert into public.customer_logs (
  customer_id,
  actor_user_id,
  actor_name,
  action,
  next_follow_up_at,
  details,
  metadata,
  created_at
)
select
  c.id,
  actor_user.id,
  nullif(btrim(l.actor_name), '') as actor_name,
  coalesce(nullif(btrim(l.action), ''), 'legacy_log'),
  public.try_parse_timestamptz(l.next_follow_up_raw),
  nullif(l.details, '') as details,
  jsonb_build_object(
    'source', 'legacy_customer_logs_import',
    'legacy_row_id', l.legacy_row_id,
    'legacy_customer_row_id', l.customer_row_id_raw
  ),
  coalesce(public.try_parse_timestamptz(l.created_at_raw), timezone('utc', now()))
from public.legacy_customer_logs_import l
join public.customers c
  on c.legacy_row_id = nullif(regexp_replace(coalesce(l.customer_row_id_raw, ''), '[^0-9]', '', 'g'), '')::integer
left join public.app_users actor_user
  on lower(actor_user.full_name) = lower(coalesce(l.actor_name, ''))
where not exists (
  select 1
  from public.customer_logs existing
  where existing.metadata ->> 'source' = 'legacy_customer_logs_import'
    and existing.metadata ->> 'legacy_row_id' = l.legacy_row_id::text
);

insert into public.audit_logs (
  actor_user_id,
  actor_name,
  actor_role,
  action,
  entity_type,
  entity_uuid,
  legacy_entity_id,
  details,
  metadata,
  created_at
)
select
  actor_user.id,
  nullif(btrim(a.actor_name), ''),
  nullif(btrim(a.actor_role), ''),
  coalesce(nullif(btrim(a.action), ''), 'legacy_audit'),
  coalesce(nullif(btrim(a.entity_type), ''), 'unknown'),
  case
    when lower(coalesce(a.entity_type, '')) = 'customers' then customer_entity.id
    when lower(coalesce(a.entity_type, '')) = 'inventory' then inventory_entity.id
    else null
  end as entity_uuid,
  nullif(btrim(a.entity_row_id_raw), ''),
  nullif(a.details, ''),
  jsonb_build_object('source', 'legacy_audit_logs_import', 'legacy_row_id', a.legacy_row_id),
  coalesce(public.try_parse_timestamptz(a.created_at_raw), timezone('utc', now()))
from public.legacy_audit_logs_import a
left join public.app_users actor_user
  on lower(actor_user.full_name) = lower(coalesce(a.actor_name, ''))
left join public.customers customer_entity
  on lower(coalesce(a.entity_type, '')) = 'customers'
 and customer_entity.legacy_row_id = nullif(regexp_replace(coalesce(a.entity_row_id_raw, ''), '[^0-9]', '', 'g'), '')::integer
left join public.inventory inventory_entity
  on lower(coalesce(a.entity_type, '')) = 'inventory'
 and inventory_entity.legacy_row_id = nullif(regexp_replace(coalesce(a.entity_row_id_raw, ''), '[^0-9]', '', 'g'), '')::integer
where not exists (
  select 1
  from public.audit_logs existing
  where existing.metadata ->> 'source' = 'legacy_audit_logs_import'
    and existing.metadata ->> 'legacy_row_id' = a.legacy_row_id::text
);
