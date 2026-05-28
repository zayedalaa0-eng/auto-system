-- ══════════════════════════════════════════════════════════════
-- Migration: دورة العميل (Customer Cycles)
-- شغّل هذا الملف في Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. ربط الدورة بالدورة الأم (العميل العائد)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS parent_customer_id uuid
    REFERENCES customers(id) ON DELETE SET NULL;

-- 2. رقم الدورة (1 للأولى، 2 للثانية، ...)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS cycle_number integer NOT NULL DEFAULT 1;

-- 3. Unique constraint: دورة نشطة واحدة لكل (هاتف + فرع + نوع عملية)
--    يمنع تكرار نفس نوع العملية النشطة للعميل في نفس الفرع
--    NULL branch_id يُعامل كقيمة منفصلة عبر COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS customers_active_cycle_unique
  ON customers (
    phone,
    COALESCE(branch_id::text, '__no_branch__'),
    COALESCE(operation_type, 'buyer')
  )
  WHERE is_active = true
    AND phone IS NOT NULL
    AND phone <> '';

-- 4. Index سريع للبحث بـ parent_customer_id
CREATE INDEX IF NOT EXISTS customers_parent_customer_id_idx
  ON customers(parent_customer_id)
  WHERE parent_customer_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- تحقق من التطبيق:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'customers'
--   AND column_name IN ('parent_customer_id', 'cycle_number');
-- ══════════════════════════════════════════════════════════════
