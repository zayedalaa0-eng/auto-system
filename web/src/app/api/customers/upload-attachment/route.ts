import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const VOICE_BUCKET = "voice-notes";
const PHOTO_BUCKET = "customer-attachments";

function toSafeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "file";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const formData = await req.formData();
    const customerId = formData.get("customer_id") as string | null;
    const category = (formData.get("category") as string | null) ?? "trade_photo";
    const file = formData.get("file") as File | null;

    if (!customerId || !file) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `حجم الملف "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB) يتجاوز الحد المسموح (50 MB).` },
        { status: 400 },
      );
    }

    // التحقق من صلاحية الوصول لهذا العميل
    const { data: customer } = await supabase
      .from("customers")
      .select("branch_id, assigned_user_id")
      .eq("id", customerId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    }

    const caps = getRoleCapabilities(profile.role, profile.full_name);
    const canUpload =
      caps.isGeneralManager ||
      customer.branch_id === profile.branch_id ||
      customer.assigned_user_id === profile.id;

    if (!canUpload) {
      return NextResponse.json({ error: "غير مصرح — لا تملك صلاحية رفع مرفقات لهذا العميل" }, { status: 403 });
    }

    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const baseName = toSafeFileName(file.name.replace(/\.[^.]+$/, ""));
    const path = `${customerId}/${Date.now()}-${baseName}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const cleanMime = (file.type || "application/octet-stream").split(";")[0].trim();
    const isVoice = category === "voice_note";

    let storageBucket = PHOTO_BUCKET;
    let publicUrl: string | null = null;
    const uploader = isVoice && hasSupabaseServiceRoleEnv() ? createAdminClient() : supabase;

    if (isVoice) {
      storageBucket = VOICE_BUCKET;
      if (hasSupabaseServiceRoleEnv()) {
        try {
          const { data: bkt } = await (uploader as ReturnType<typeof createAdminClient>).storage.getBucket(VOICE_BUCKET);
          if (!bkt) {
            await (uploader as ReturnType<typeof createAdminClient>).storage.createBucket(VOICE_BUCKET, { public: true, fileSizeLimit: MAX_FILE_SIZE });
          }
        } catch {
          // ignored
        }
      }
    }

    const { error: uploadError } = await uploader.storage
      .from(storageBucket)
      .upload(path, buffer, { contentType: cleanMime || "application/octet-stream", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    if (isVoice) {
      const { data } = uploader.storage.from(storageBucket).getPublicUrl(path);
      publicUrl = data.publicUrl;
    }

    const { error: insertError } = await supabase.from("customer_attachments").insert({
      customer_id: customerId,
      file_name: file.name,
      file_category: category,
      storage_path: `${storageBucket}/${path}`,
      public_url: publicUrl,
      mime_type: cleanMime || "application/octet-stream",
      file_size_bytes: file.size,
      uploaded_by_user_id: profile.id,
      metadata: { source: "web_independent_upload" },
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[customers/upload-attachment] unexpected error:", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
