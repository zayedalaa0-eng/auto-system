"use server";

import { headers } from "next/headers";

import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  message?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type ResetPayload = {
  email: string;
  origin?: string;
};

function normalizeAuthError(message: string | undefined) {
  const text = (message ?? "").trim();
  const lowered = text.toLowerCase();

  if (!text) return "تعذر تنفيذ الطلب. حاول مرة أخرى.";
  if (lowered.includes("invalid login credentials")) {
    return "بيانات الدخول غير صحيحة.";
  }
  if (lowered.includes("email rate limit exceeded")) {
    return "تم تجاوز حد إرسال البريد مؤقتًا. حاول بعد قليل.";
  }
  if (lowered.includes("failed to fetch") || lowered.includes("network")) {
    return "تعذر الاتصال بخدمة تسجيل الدخول. تأكد من الإنترنت ثم أعد المحاولة.";
  }

  return text;
}

async function resolveBaseUrl(originFromClient?: string) {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");

  if (originFromClient) return originFromClient.replace(/\/+$/, "");

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function loginWithPasswordAction(payload: LoginPayload): Promise<ActionResult> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message: "مفاتيح Supabase غير موجودة. أضفها في .env.local أولًا.",
    };
  }

  const email = payload.email?.trim();
  const password = payload.password ?? "";
  if (!email || !password) {
    return { ok: false, message: "أدخل البريد الإلكتروني وكلمة المرور." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, message: normalizeAuthError(error.message) };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return { ok: false, message: normalizeAuthError(message) };
  }
}

export async function sendPasswordResetAction(payload: ResetPayload): Promise<ActionResult> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message: "مفاتيح Supabase غير موجودة. أضفها في .env.local أولًا.",
    };
  }

  const email = payload.email?.trim();
  if (!email) {
    return { ok: false, message: "أدخل البريد الإلكتروني أولًا." };
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createAdminClient();
    
    // Find user by email in auth schema
    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError || !usersData?.users) {
      return { ok: false, message: normalizeAuthError(usersError?.message) };
    }

    const authUser = usersData.users.find(u => u.email === email);
    if (!authUser) {
      // Return a generic message to not leak emails
      return { ok: false, message: "لم يتم العثور على حساب مرتبط بهذا البريد، أو لم يتم ربطه بالبوت." };
    }

    // Get telegram_chat_id
    const { data: appUser } = await adminClient
      .from("app_users")
      .select("telegram_chat_id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (!appUser || !appUser.telegram_chat_id) {
      return { ok: false, message: "حسابك غير مربوط ببوت التليجرام. يرجى التواصل مع الإدارة." };
    }

    // Generate random 8-character password
    const newPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10);
    
    // Update password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
    });

    if (updateError) {
      return { ok: false, message: "تعذر إعادة تعيين كلمة المرور." };
    }

    // Send via Telegram
    const { sendMessage } = await import("@/lib/telegram/api");
    const text = `🔒 <b>إعادة تعيين كلمة المرور</b>\n\nتم إعادة تعيين كلمة المرور الخاصة بحسابك (${email}) بنجاح.\n\nكلمة المرور الجديدة:\n<code>${newPassword}</code>\n\nيُرجى تسجيل الدخول وتغييرها من إعدادات الحساب في أقرب وقت.`;
    
    await sendMessage(appUser.telegram_chat_id, text);

    return { ok: true, message: "تم إعادة تعيين كلمة المرور وإرسالها إلى حسابك في التليجرام." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return { ok: false, message: normalizeAuthError(message) };
  }
}

