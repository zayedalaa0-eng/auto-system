import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { logAuditAction } from "@/lib/audit";

// مطابق للويب: صور في customer-attachments (خاص)، صوت في voice-notes (عام)
const PHOTO_BUCKET = "customer-attachments";
const VOICE_BUCKET = "voice-notes";

async function ensureBucket(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  isPublic: boolean,
) {
  try {
    const { data: existing } = await admin.storage.getBucket(bucket);
    if (!existing) {
      await admin.storage.createBucket(bucket, {
        public: isPublic,
        fileSizeLimit: 52428800,
      });
    }
  } catch (e) {
    console.error(`[upload-attachment] ensureBucket(${bucket}) error:`, e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const chatId = formData.get("chat_id") as string | null;
    const customerId = formData.get("customer_id") as string | null;
    const category = (formData.get("category") as string | null) ?? "trade_photo";

    const files = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((f): f is File => f instanceof File);

    if (!chatId || !customerId || files.length === 0) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const admin = createAdminClient();

    // تحقق من المستخدم
    const { data: user, error: userErr } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("telegram_chat_id", chatId)
      .eq("is_active", true)
      .maybeSingle();

    if (userErr || !user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // فحص صلاحية الرفع: تأكد أن المستخدم يملك حق الوصول لهذا العميل
    const { data: customer } = await admin
      .from("customers")
      .select("branch_id, assigned_user_id")
      .eq("id", customerId)
      .maybeSingle();

    if (customer) {
      const isGlobal = getRoleCapabilities(user.role, user.full_name).isGeneralManager && !user.branch_id;
      const canUpload =
        isGlobal ||
        customer.branch_id === user.branch_id ||
        customer.assigned_user_id === user.id;

      if (!canUpload) {
        return NextResponse.json({ error: "غير مصرح — لا تملك صلاحية رفع مرفقات لهذا العميل" }, { status: 403 });
      }
    }

    const isVoice = category === "voice_note";
    const bucket = isVoice ? VOICE_BUCKET : PHOTO_BUCKET;

    // تأكد من وجود الـ bucket
    await ensureBucket(admin, bucket, isVoice /* صوت=عام، صور=خاص */);

    const uploaded: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = (file.name.split(".").pop() || (isVoice ? "ogg" : "jpg")).toLowerCase();
      const folder = isVoice ? "voice" : "photos";
      const storagePath = `${folder}/${customerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const mimeType = file.type || (isVoice ? "audio/ogg" : "image/jpeg");

      // رفع الملف
      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

      if (uploadError) {
        console.error("[upload-attachment] storage upload failed:", uploadError.message);
        errors.push(`رفع الملف فشل: ${uploadError.message}`);
        continue;
      }

      // رابط الملف:
      // - الصوت: رابط عام مباشر
      // - الصور: رابط عام مؤقت (signed URL لمدة سنة) — مطابق للويب
      let publicUrl: string;
      if (isVoice) {
        const { data } = admin.storage.from(bucket).getPublicUrl(storagePath);
        publicUrl = data.publicUrl;
      } else {
        const { data, error: signErr } = await admin.storage
          .from(bucket)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // سنة
        if (signErr || !data?.signedUrl) {
          // fallback: رابط عام إذا فشل التوقيع
          const { data: pub } = admin.storage.from(bucket).getPublicUrl(storagePath);
          publicUrl = pub.publicUrl;
        } else {
          publicUrl = data.signedUrl;
        }
      }

      // إدخال في customer_attachments
      const fileName = file.name || `miniapp_${category}_${Date.now()}.${ext}`;
      const { error: insertErr } = await admin.from("customer_attachments").insert({
        customer_id: customerId,
        file_name: fileName,
        file_category: category,
        public_url: publicUrl,
        storage_path: `${bucket}/${storagePath}`,
        mime_type: mimeType,
        file_size_bytes: buffer.length,
        uploaded_by_user_id: user.id,
        metadata: { source: "telegram_miniapp" },
      });

      if (insertErr) {
        console.error("[upload-attachment] customer_attachments insert failed:", insertErr.message);
        errors.push(`حفظ في قاعدة البيانات فشل: ${insertErr.message}`);
        continue;
      }

      uploaded.push(publicUrl);
    }

    // سجل واحد فقط بعد انتهاء كل الرفعات
    if (uploaded.length > 0) {
      const logDetails = isVoice
        ? `🎤 تسجيل صوتي عبر Mini App — بواسطة ${user.full_name}`
        : uploaded.length === 1
          ? `📷 تم إضافة صورة عبر Mini App — بواسطة ${user.full_name}`
          : `📷 تم إضافة ${uploaded.length} صور عبر Mini App — بواسطة ${user.full_name}`;

      await admin.from("customer_logs").insert({
        customer_id: customerId,
        actor_user_id: user.id,
        actor_name: user.full_name,
        action: isVoice ? "voice_note_added" : "photo_added",
        details: logDetails,
      });

      void logAuditAction({
        action: isVoice ? "إضافة تسجيل صوتي" : "إضافة صورة",
        entity_type: "customer",
        entity_id: customerId,
        actorId: user.id,
        details: { source: "telegram_miniapp", description: logDetails },
        supabase: admin,
      });
    }

    if (errors.length > 0 && uploaded.length === 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 500 });
    }

    return NextResponse.json({ ok: true, uploaded: uploaded.length, errors });
  } catch (err) {
    console.error("[upload-attachment] unexpected error:", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
