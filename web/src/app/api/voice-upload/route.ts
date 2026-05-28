import { NextResponse } from "next/server";

import { createAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pushTelegramVoiceToManagers } from "@/lib/telegram/push";

const VOICE_BUCKET = "voice-notes";

/**
 * يضمن وجود bucket مخصص للصوتيات (عام، بدون قيود MIME)
 * يُستدعى مرة واحدة فقط لكل cold start
 */
let bucketReady = false;
async function ensureVoiceBucket(admin: ReturnType<typeof createAdminClient>) {
  if (bucketReady) return;
  const { data: existing } = await admin.storage.getBucket(VOICE_BUCKET);
  if (!existing) {
    await admin.storage.createBucket(VOICE_BUCKET, {
      public: true,
      fileSizeLimit: 52428800, // 50 MB
    });
  } else if (!existing.public) {
    // إذا كان موجوداً لكن خاصاً → نجعله عاماً
    await admin.storage.updateBucket(VOICE_BUCKET, { public: true });
  }
  bucketReady = true;
}

/**
 * POST /api/voice-upload
 * يستقبل ملف صوتي ويرفعه إلى bucket مخصص ويُدخله في customer_attachments
 * يُعيد { id, public_url, file_name }
 */
export async function POST(request: Request) {
  // ── التحقق من الجلسة ──────────────────────────────────────────
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  // ── قراءة الـ FormData ────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "تعذر قراءة البيانات" }, { status: 400 });
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();
  if (!customerId) {
    return NextResponse.json({ error: "customer_id مطلوب" }, { status: 400 });
  }

  // وصف السياق (تفاوض BMW X5، ملاحظات عامة...) يُعرض في السجل التاريخي
  const label = String(formData.get("label") ?? "").trim() || null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "لم يُرسَل ملف صوتي" }, { status: 400 });
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "service role غير مفعّل" }, { status: 500 });
  }
  const admin = createAdminClient();

  // ── ضمان وجود الـ bucket ──────────────────────────────────────
  try {
    await ensureVoiceBucket(admin);
  } catch (err) {
    console.error("[voice-upload] bucket error:", err);
    return NextResponse.json({ error: "تعذر إعداد مساحة التخزين" }, { status: 500 });
  }

  // ── رفع الملف ─────────────────────────────────────────────────
  const ext = (file.name.split(".").pop() ?? "webm").toLowerCase();
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_");
  const storagePath = `${customerId}/${Date.now()}-${baseName}-${crypto.randomUUID()}.${ext}`;

  // MIME نظيف بدون parameters
  const mimeType = (file.type || "audio/webm").split(";")[0].trim() || "audio/webm";

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(VOICE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[voice-upload] upload error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // ── Public URL (الـ bucket عام) ───────────────────────────────
  const { data: { publicUrl } } = admin.storage
    .from(VOICE_BUCKET)
    .getPublicUrl(storagePath);

  // ── إدخال في customer_attachments ────────────────────────────
  // نستخدم الـ label كـ file_name إن وُجد — يُعرض في السجل التاريخي
  const displayName = label ?? file.name;

  const { data: inserted, error: insertError } = await admin
    .from("customer_attachments")
    .insert({
      customer_id: customerId,
      file_name: displayName,
      file_category: "voice_note",
      storage_path: `${VOICE_BUCKET}/${storagePath}`,
      public_url: publicUrl,
      mime_type: mimeType,
      file_size_bytes: file.size,
      uploaded_by_user_id: profile?.id ?? null,
      metadata: { source: "voice_recorder", bucket: VOICE_BUCKET, label },
    })
    .select("id, file_name, public_url")
    .single();

  if (insertError) {
    console.error("[voice-upload] insert error:", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ── إشعار تيليجرام للمديرين (best-effort) ───────────────────────
  const staffName = profile?.full_name ?? "موظف";
  const voiceCaption =
    `🎤 <b>تسجيل صوتي جديد</b>\n` +
    `👤 الموظف: ${staffName}\n` +
    (label ? `📝 السياق: ${label}\n` : "") +
    `🆔 العميل: <code>${customerId}</code>`;

  void pushTelegramVoiceToManagers({
    branchId: profile?.branch_id ?? null,
    caption: voiceCaption,
    voiceUrl: inserted.public_url,
  });

  return NextResponse.json({
    id: inserted.id,
    file_name: inserted.file_name,
    public_url: inserted.public_url,
  });
}
