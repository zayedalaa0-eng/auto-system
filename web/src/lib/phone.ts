/**
 * توحيد التعامل مع رقم الهاتف عبر النظام بالكامل.
 * القاعدة الموحّدة: الرقم يجب أن يكون **10 أرقام بالضبط** (لا أكثر ولا أقل).
 * يُستخدم في: فورم الويب، البوت، الـ mini-app، وواجهات الـ API.
 */

/** عدد أرقام الهاتف المطلوب — قيمة واحدة معتمدة في كل النظام */
export const PHONE_LENGTH = 10;

/** يُزيل كل ما ليس رقمًا من النص */
export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** هل الرقم صالح؟ (10 أرقام بالضبط بعد التطبيع) */
export function isValidPhone(value: string | null | undefined): boolean {
  return normalizePhone(value).length === PHONE_LENGTH;
}

/**
 * رسالة الخطأ الموحّدة عند رقم غير صالح.
 */
export const PHONE_ERROR_MESSAGE = `رقم الهاتف يجب أن يكون ${PHONE_LENGTH} أرقام بالضبط.`;
