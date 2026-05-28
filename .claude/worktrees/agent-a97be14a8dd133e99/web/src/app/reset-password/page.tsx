"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";

export default function ResetPasswordPage() {
  const router = useRouter();
  const canUseSupabase = useMemo(() => hasSupabaseEnv(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseSupabase) {
      setError("أضف مفاتيح Supabase في .env.local أولًا.");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (password !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 1300);
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto mt-10 w-full max-w-xl rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">تغيير كلمة المرور</h1>
        <p className="mt-2 text-sm text-slate-600">أدخل كلمة مرور جديدة للحساب ثم احفظ.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm"
            placeholder="كلمة المرور الجديدة"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm"
            placeholder="تأكيد كلمة المرور"
            required
          />

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              تم تغيير كلمة المرور بنجاح، سيتم تحويلك لتسجيل الدخول.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
          </button>
        </form>

        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-sky-700 underline underline-offset-4">
          العودة لتسجيل الدخول
        </Link>
      </div>
    </div>
  );
}

