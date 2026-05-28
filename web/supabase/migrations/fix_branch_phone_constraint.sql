-- ══════════════════════════════════════════════════════════════
-- Migration: إصلاح unique constraint للسماح بدورات متعددة
-- المشكلة: uq_customers_branch_phone يمنع إنشاء دورة جديدة
--           لعميل مغلق لأنه يطبّق على جميع السجلات (active وغير active)
-- الحل:    حذف الـ constraint القديم والاعتماد على
--           customers_active_cycle_unique الذي يطبّق فقط على
--           السجلات النشطة (WHERE is_active = true)
-- شغّل هذا الملف في Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. حذف الـ constraint القديم الذي يمنع تكرار (branch_id, phone)
--    على جميع السجلات بما فيها المغلقة
DROP INDEX IF EXISTS uq_customers_branch_phone;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS uq_customers_branch_phone;

-- 2. تأكد أن الـ partial index الصحيح موجود
--    (يسمح بدورات متعددة لنفس العميل طالما السابقة مغلقة)
CREATE UNIQUE INDEX IF NOT EXISTS customers_active_cycle_unique
  ON customers (
    phone,
    COALESCE(branch_id::text, '__no_branch__'),
    COALESCE(operation_type, 'buyer')
  )
  WHERE is_active = true
    AND phone IS NOT NULL
    AND phone <> '';

-- ══════════════════════════════════════════════════════════════
-- تحقق من التطبيق:
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'customers'
--   AND indexname IN ('uq_customers_branch_phone', 'customers_active_cycle_unique');
-- ══════════════════════════════════════════════════════════════
