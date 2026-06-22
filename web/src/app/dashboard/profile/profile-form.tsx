"use client";

import { useState, useTransition } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { updatePasswordAction } from "./actions";

export function ProfileForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("كلمتي المرور غير متطابقتين.");
      return;
    }

    if (password.length < 6) {
      setError("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.");
      return;
    }

    startTransition(async () => {
      const result = await updatePasswordAction(password);

      if (!result.ok) {
        setError(result.message ?? "تعذر تحديث كلمة المرور.");
        return;
      }

      setSuccess(result.message ?? "تم تحديث كلمة المرور بنجاح.");
      setPassword("");
      setConfirmPassword("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      <div className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">تغيير كلمة المرور</h2>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
            كلمة المرور الجديدة
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 text-sm outline-none ring-0 transition focus:border-slate-400 dark:focus:border-slate-500"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="confirmPassword">
            تأكيد كلمة المرور الجديدة
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 text-sm outline-none ring-0 transition focus:border-slate-400 dark:focus:border-slate-500"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400">
            {error}
          </div>
        ) : null}
        
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 dark:bg-slate-700 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-800"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          حفظ التغييرات
        </button>
      </div>
    </form>
  );
}
