# Legacy Import Steps

## 1) إنشاء جداول staging

شغّل:

- `006_legacy_staging.sql`

## 2) تصدير Google Sheets إلى CSV

من ملف Google Sheets الحالي:

- ورقة `customers` -> CSV
- ورقة `inventory` -> CSV

## 3) استيراد CSV إلى Supabase

من داخل Supabase:

1. افتح جدول `legacy_customers_import`
2. استخدم `Import data from CSV`
3. اجعل الأعمدة بالترتيب التالي:

```text
legacy_row_id
created_at_raw
branch_name
employee_name
customer_name
phone
requested_car
payment_plan
attachments_raw
notes_raw
status
nickname
address
whatsapp_prefix
next_follow_up_raw
visit_count_raw
last_contact_raw
trade_in_raw
```

مهم:
- `legacy_row_id` يجب أن يكون رقم الصف القديم أو معرفًا ثابتًا فريدًا
- إذا كان CSV لا يحتوي `legacy_row_id` أضفه يدويًا قبل الاستيراد

## 4) تشغيل الترحيل

شغّل:

- `007_migrate_legacy_customers.sql`

## 5) المراجعة

نفّذ:

```sql
select count(*) from public.legacy_customers_import;
select count(*) from public.customers;
select count(*) from public.customer_attachments;
select count(*) from public.customer_logs;
```
