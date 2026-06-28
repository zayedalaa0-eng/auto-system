import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * دالة مساعدة لتسجيل العمليات في سجل التدقيق (Audit Logs)
 * 
 * @param params.action - الإجراء الذي تم (مثال: 'إضافة عميل', 'تعديل سيارة')
 * @param params.entity_type - نوع الكيان (مثال: 'customer', 'inventory')
 * @param params.entity_id - المُعرّف الخاص بالكيان (UUID)
 * @param params.details - تفاصيل إضافية (JSON)
 * @param params.supabase - (اختياري) العميل الخاص بقاعدة البيانات، في حال لم يتم تمريره سيتم استخدام العميل الافتراضي.
 * @param params.actorId - (اختياري) معرف المستخدم الذي قام بالعملية، إذا لم يتم تمريره سيحاول استخراجه من الجلسة الحالية.
 */
export async function logAuditAction({
  action,
  entity_type,
  entity_id,
  details,
  supabase,
  actorId,
}: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: any;
  supabase?: SupabaseClient<any, "public", any>;
  actorId?: string;
}) {
  try {
    const client = supabase || await createClient();
    let appUserId = actorId;
    let appUserName = null;

    // محاولة جلب المستخدم من الجلسة إذا لم يتم تمريره
    if (!appUserId) {
      const { data: { session } } = await client.auth.getSession();
      const authUserId = session?.user?.id;

      if (authUserId) {
        const { data: appUser } = await client
          .from("app_users")
          .select("id, full_name")
          .eq("auth_user_id", authUserId)
          .maybeSingle();

        if (appUser) {
          appUserId = appUser.id;
          appUserName = appUser.full_name;
        }
      }
    } else {
      // Fetch full_name if actorId is passed
      const { data: appUser } = await client
        .from("app_users")
        .select("full_name")
        .eq("id", appUserId)
        .maybeSingle();
      if (appUser) {
        appUserName = appUser.full_name;
      }
    }

    // إذا لم يكن لدينا صلاحيات في العميل الممرر، نستخدم الأدمن للتعامل مع جدول السجلات
    const writer = hasSupabaseServiceRoleEnv() ? createAdminClient() : client;

    const { error: insertErr } = await writer.from("audit_logs").insert({
      actor_user_id: appUserId || null,
      actor_name: appUserName || null,
      action,
      entity_type: entity_type || "unknown",
      entity_uuid: entity_id || null,
      details: details || null,
    });
    if (insertErr) {
      console.error("[audit.ts] Insert Error:", insertErr);
    }
  } catch (error) {
    // تجاهل أخطاء التدقيق لتجنب إيقاف العملية الأساسية
    console.error("Failed to log audit action:", error);
  }
}
