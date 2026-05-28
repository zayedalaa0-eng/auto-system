import Link from "next/link";
import { ArrowLeft, Database, LockKeyhole, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";

const benefits = [
  {
    icon: Database,
    title: "PostgreSQL بدل Sheets",
    body: "القراءة والفلترة والتقارير ستصبح أسرع وأكثر ثباتًا من البنية القديمة.",
  },
  {
    icon: ShieldCheck,
    title: "صلاحيات حقيقية",
    body: "RLS تربط الفرع والدور بالمستخدم الحالي بدل الاعتماد على localStorage أو منطق الواجهة فقط.",
  },
  {
    icon: LockKeyhole,
    title: "إرسال ومرفقات لاحقًا في الخلفية",
    body: "ننقل المسارات الثقيلة إلى backend jobs بدل أن تعلق شاشة المستخدم.",
  },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1400px] gap-6 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr] lg:px-6">
        <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm lg:p-10">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Auto System Web</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              نبدأ هنا النسخة الأسرع والأهدأ من النظام
            </h1>
            <p className="mt-5 text-sm leading-8 text-slate-300">
              ما بنيناه حتى الآن ليس مجرد قالب. الجداول، الصلاحيات، التخزين، وهيكل الواجهة صار
              جاهزًا لنبدأ فوقه النسخة الجديدة بعيدًا عن اختناقات Apps Script.
            </p>
          </div>

          <div className="mt-10 grid gap-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <benefit.icon className="h-5 w-5 text-slate-200" />
                <h2 className="mt-4 text-lg font-semibold">{benefit.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">{benefit.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-3xl bg-white p-8 shadow-sm lg:p-10">
          <div>
            <p className="text-sm font-medium text-slate-500">تسجيل الدخول</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">جاهزون للدخول</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              استخدم حسابًا أنشأته داخل Supabase Authentication. بعد تسجيل الدخول سنبدأ توصيل
              النماذج الحقيقية فوق الجداول التي جهزناها.
            </p>
          </div>

          <div className="mt-8">
            <LoginForm />
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500">
            <span>لوحة الإعداد والجداول أصبحت جاهزة داخل المشروع.</span>
            <Link
              href="/dashboard/setup"
              className="inline-flex items-center gap-2 font-medium text-slate-900"
            >
              صفحة الإعداد
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
