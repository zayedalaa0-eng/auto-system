# Supabase Auth Linking Notes

بعد تشغيل ملف `003_seed_initial_data.sql` سيكون لديك:

- فرع `معرض المعلم`
- فرع `الشركة`
- سجل أولي للمدير العام
- سجل أولي لمدير معرض المعلم

## الخطوة التالية

1. افتح `Supabase > Authentication > Users`
2. أنشئ المستخدمين الحقيقيين من لوحة Supabase Auth
3. انسخ `UUID` لكل مستخدم من `auth.users`
4. حدّث جدول `public.app_users` لربط كل سجل مع المستخدم الحقيقي

## مثال SQL للربط

```sql
update public.app_users
set auth_user_id = 'ضع-uuid-هنا'
where full_name = 'المدير العام';
```

```sql
update public.app_users
set auth_user_id = 'ضع-uuid-هنا'
where full_name = 'مدير معرض المعلم';
```

## مهم

- لا تستخدم `secret key` في الواجهة
- الواجهة ستحتاج فقط:
  - `Project URL`
  - `Publishable key`
- `auth_user_id` هو الذي يجعل RLS يعرف من هو المستخدم الحالي
