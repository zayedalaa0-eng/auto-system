import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      <div className="mx-auto grid min-h-screen max-w-[1400px] gap-6 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr] lg:px-6">
        <section className="flex flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-sm lg:p-10 border border-slate-200">
          <div className="mb-16 text-center">
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Auto System Web</h1>
            <p className="mt-4 text-lg text-slate-500">نظام إدارة معارض السيارات الذكي والمتكامل</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-3xl justify-items-center">
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-40 h-40 flex items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm p-4 transition-transform group-hover:scale-105 group-hover:shadow-md">
                <img src="/logos/chery.jpg" alt="معرض شيري" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-bold text-slate-700">معرض شيري</span>
            </div>
            
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-40 h-40 flex items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm p-4 transition-transform group-hover:scale-105 group-hover:shadow-md">
                <img src="/logos/forthing.jpg" alt="معرض فورثنج" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-bold text-slate-700">معرض فورثنج</span>
            </div>
            
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-40 h-40 flex items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm p-4 transition-transform group-hover:scale-105 group-hover:shadow-md">
                <img src="/logos/lemalem.jpg" alt="معرض المعلم" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-bold text-slate-700">معرض المعلم</span>
            </div>
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
