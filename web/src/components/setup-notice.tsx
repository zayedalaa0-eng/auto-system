import Link from "next/link";
import { Database, KeyRound, ShieldCheck } from "lucide-react";

const steps = [
  {
    icon: KeyRound,
    title: "أضف مفاتيح Supabase",
    body: "ضع NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY داخل ملف .env.local.",
  },
  {
    icon: ShieldCheck,
    title: "أنشئ مستخدمي Auth",
    body: "أضف المدير العام ومدير المعرض في Supabase Auth ثم اربط auth_user_id مع app_users.",
  },
  {
    icon: Database,
    title: "ابدأ الترحيل لاحقًا",
    body: "البنية جاهزة. نستطيع تأجيل استيراد البيانات القديمة حتى ننهي الواجهة الأساسية.",
  },
];

export function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-slate-900">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-amber-700">حالة الإعداد</p>
        <h2 className="text-2xl font-semibold">الواجهة جاهزة وتنتظر ربط المفاتيح</h2>
        <p className="max-w-3xl text-sm leading-7 text-slate-700">
          قبل أن يبدأ تسجيل الدخول والقراءة من قاعدة البيانات، أضف مفاتيح Supabase في{" "}
          <code className="rounded bg-white px-2 py-1 text-xs">.env.local</code>. تركت لك أيضًا
          ملفًا مرجعيًا في{" "}
          <Link className="font-medium text-slate-900 underline" href="/dashboard/setup">
            صفحة الإعداد
          </Link>
          .
        </p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.title} className="rounded-2xl bg-white p-4 shadow-sm">
            <step.icon className="mb-3 h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
