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
    const supabase = await createClient();
    const appBaseUrl = await resolveBaseUrl(payload.origin);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appBaseUrl}/reset-password`,
    });

    if (error) {
      return { ok: false, message: normalizeAuthError(error.message) };
    }

    return { ok: true, message: "تم إرسال رابط تغيير كلمة المرور إلى البريد الإلكتروني." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return { ok: false, message: normalizeAuthError(message) };
  }
}

