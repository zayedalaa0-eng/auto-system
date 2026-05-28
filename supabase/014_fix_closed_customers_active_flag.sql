-- Ensure closed customer statuses are always reflected as inactive records.
-- This is safe to run multiple times.

update public.customers
set
  is_active = false,
  updated_at = timezone('utc', now())
where
  is_active = true
  and (
    status ilike '%العميل غير فعال%'
    or status ilike '%تم البيع%'
    or status ilike '%تمت صفقة الاستبدال%'
    or status ilike '%شراء من قبل المعرض%'
    or status ilike '%شراء السيارة للمعرض%'
    or status ilike '%رفض من قبل المعرض%'
    or status ilike '%رفض من قبل العميل%'
    or status ilike '%تراجع العميل عن البيع%'
  );

