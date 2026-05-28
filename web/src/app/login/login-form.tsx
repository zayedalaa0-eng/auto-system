"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";

import { loginWithPasswordAction, sendPasswordResetAction } from "@/app/login/actions";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loginWithPasswordAction({
        email: email.trim(),
        password,
      });

      if (!result.ok) {
        setError(result.message ?? "تعذر تسجيل الدخول.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    });
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("أدخل البريد الإلكتروني أولًا لإرسال رابط تغيير كلمة المرور.");
      return;
    }

    setError(null);
    setResetSent(false);

    const result = await sendPasswordResetAction({
      email: email.trim(),
      origin: window.location.origin,
    });

    if (!result.ok) {
      setError(result.message ?? "تعذر إرسال رابط تغيير كلمة المرور.");
      return;
    }

    setResetSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none ring-0 transition focus:border-slate-400"
          placeholder="name@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          كلمة المرور
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none ring-0 transition focus:border-slate-400"
          placeholder="••••••••"
          required
        />
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {resetSent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم إرسال رابط تغيير كلمة المرور إلى البريد الإلكتروني.
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleForgotPassword}
        className="text-sm font-medium text-sky-700 underline underline-offset-4"
      >
        نسيت كلمة المرور؟
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        تسجيل الدخول
      </button>
    </form>
  );
}

