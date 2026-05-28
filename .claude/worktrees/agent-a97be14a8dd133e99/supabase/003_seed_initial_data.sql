insert into public.branches (code, name, notes)
values
  ('main-showroom', 'معرض المعلم', 'الفرع الافتراضي المستنتج من النظام الحالي'),
  ('company', 'الشركة', 'فرع إداري عام للعمليات المركزية')
on conflict (name) do update
set
  code = excluded.code,
  notes = excluded.notes,
  updated_at = timezone('utc', now());

insert into public.app_users (
  full_name,
  phone,
  whatsapp_prefix,
  telegram_chat_id,
  branch_id,
  role,
  status,
  is_active,
  notes,
  metadata
)
select
  seed.full_name,
  seed.phone,
  seed.whatsapp_prefix,
  seed.telegram_chat_id,
  b.id,
  seed.role,
  'active',
  true,
  seed.notes,
  seed.metadata
from (
  values
    (
      'المدير العام',
      null,
      '+970',
      null,
      'الشركة',
      'مدير عام',
      'حساب إداري أولي. اربطه لاحقًا مع auth.users عبر auth_user_id.',
      jsonb_build_object('seed', true, 'kind', 'initial-admin')
    ),
    (
      'مدير معرض المعلم',
      null,
      '+970',
      null,
      'معرض المعلم',
      'مدير معرض',
      'حساب أولي لمدير المعرض. عدل الاسم أو الهاتف أو الدردشة لاحقًا.',
      jsonb_build_object('seed', true, 'kind', 'initial-showroom-manager')
    )
) as seed(full_name, phone, whatsapp_prefix, telegram_chat_id, branch_name, role, notes, metadata)
join public.branches b on b.name = seed.branch_name
where not exists (
  select 1
  from public.app_users u
  where u.full_name = seed.full_name
    and u.role = seed.role
);

insert into public.notifications (
  recipient_branch_id,
  recipient_label,
  notification_type,
  title,
  message,
  status,
  payload
)
select
  b.id,
  b.name,
  'system',
  'تهيئة أولية',
  'تم إنشاء بيانات البداية للمشروع الجديد بنجاح.',
  'unread',
  jsonb_build_object('seed', true)
from public.branches b
where b.name = 'الشركة'
  and not exists (
    select 1
    from public.notifications n
    where n.title = 'تهيئة أولية'
      and n.recipient_branch_id = b.id
  );
