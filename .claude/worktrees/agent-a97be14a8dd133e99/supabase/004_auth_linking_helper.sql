-- 004_auth_linking_helper.sql
-- هذا الملف آمن للتشغيل، وهو لا يغير أي شيء تلقائيًا.
-- فقط يعطيك عرضًا للحسابات الحالية وقوالب SQL جاهزة للربط.

select
  id,
  full_name,
  role,
  auth_user_id,
  branch_id,
  is_active,
  created_at
from public.app_users
order by created_at asc;

-- بعد إنشاء المستخدمين من Supabase Auth > Users
-- خذ UUID لكل مستخدم ونفذ أوامر update التالية بعد تعديلها:

-- update public.app_users
-- set auth_user_id = 'ضع-uuid-هنا'
-- where full_name = 'المدير العام';

-- update public.app_users
-- set auth_user_id = 'ضع-uuid-هنا'
-- where full_name = 'مدير معرض المعلم';

-- فحص المستخدمين غير المرتبطين حتى الآن:
-- select id, full_name, role
-- from public.app_users
-- where auth_user_id is null
-- order by created_at asc;
