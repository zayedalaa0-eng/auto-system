-- ─── إضافة حقول إدارة المعارض ────────────────────────────────────────────────
-- يُشغَّل مرة واحدة في Supabase SQL Editor

-- رقم واتساب الخاص بالمعرض (بدون + وبدون مسافات، مثال: 966501234567)
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS whatsapp_number          text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_prefix          text DEFAULT '+966',
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS city                     text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS address                  text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_at               timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at               timestamptz DEFAULT now();

-- ── trigger لتحديث updated_at تلقائياً ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_branches_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_branches_updated_at();

-- ── RLS: المدير العام فقط يعدّل المعارض ─────────────────────────────────────
-- (اختياري — إذا كانت RLS مفعّلة على جدول branches)
-- ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
