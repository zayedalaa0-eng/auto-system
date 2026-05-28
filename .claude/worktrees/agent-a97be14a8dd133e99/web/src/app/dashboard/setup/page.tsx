import { CheckCircle2, Database, KeyRound, Shield, UploadCloud } from "lucide-react";

const items = [
  "تشغيل جداول Supabase وسياسات RLS لجميع المستخدمين والفروع.",
  "إنشاء مستخدمي Authentication وربط auth_user_id مع app_users.",
  "إضافة مفاتيح NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY داخل بيئات النشر.",
  "ربط GitHub مع Vercel حتى تصبح أي دفعة جديدة قابلة للنشر التلقائي.",
  "إكمال النماذج والإجراءات التشغيلية فوق الجداول الجديدة بدل الاعتماد على الشيت.",
];

export default function SetupPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-medium text-slate-500">الإعداد</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">حالة المشروع والبنية الجديدة</h2>
        <p className="mt-3 max-w-4xl text-sm leading-8 text-slate-600">
          هذه الصفحة تجمع ما تم تثبيته في البنية الجديدة: قاعدة البيانات، الترحيل، الواجهة، وبيئات النشر. الهدف
          أن تكون نقطة مرجعية سريعة لأي خطوة تنفيذية قادمة.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <Database className="h-5 w-5 text-[var(--accent-strong)]" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">الجداول</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            المخطط، الاستيراد المرحلي، ونصوص الترحيل أصبحت ضمن مجلد <code>supabase</code>.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <Shield className="h-5 w-5 text-[var(--accent-strong)]" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">الصلاحيات</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            يوجد أساس واضح لـ RLS مبني على الدور والفرع، وهو ما يسهّل نقل العمل اليومي بدون كشف زائد للبيانات.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <KeyRound className="h-5 w-5 text-[var(--accent-strong)]" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">بيئات الربط</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            تم تجهيز الربط مع Supabase وVercel، ويتبقى فقط تثبيت بقية التدفقات التفاعلية داخل التطبيق.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <UploadCloud className="h-5 w-5 text-[var(--accent-strong)]" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">الترحيل</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            ملفات الاستيراد من <code>cars.xlsx</code> أصبحت جاهزة لتدفق منظم بدل النقل اليدوي المتكرر.
          </p>
        </div>
      </div>

      <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
        <h3 className="text-lg font-semibold text-slate-950">خطوات العمل المتبقية</h3>
        <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
              <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
