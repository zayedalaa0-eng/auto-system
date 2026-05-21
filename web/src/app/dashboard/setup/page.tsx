import { CheckCircle2, Database, KeyRound, Shield } from "lucide-react";

const items = [
  "تشغيل 001 و002 و003 و005 في Supabase",
  "إنشاء مستخدمي Authentication وربط auth_user_id مع app_users",
  "إضافة NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY إلى .env.local",
  "تشغيل المشروع محليًا ثم ربطه مع Vercel",
];

export default function SetupPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">الإعداد</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">حالة المشروع الجديد</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          هذه الصفحة تجمع لك ما أنجزناه حتى الآن، وما نحتاجه قبل بدء النماذج الحقيقية وترحيل
          البيانات النهائية.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Database className="h-5 w-5 text-slate-700" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">الجداول</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Schema وRLS وStorage أصبحت جاهزة في مجلد <code>supabase</code>.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Shield className="h-5 w-5 text-slate-700" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">الصلاحيات</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            أضفنا سياسات RLS مبدئية مبنية على الفرع والدور وربط auth.uid().
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <KeyRound className="h-5 w-5 text-slate-700" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">الربط</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            بقي فقط ملف <code>.env.local</code> ومستخدما الدخول الأوليان.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-slate-700" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">الواجهة</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            هيكل تسجيل الدخول، الداشبورد، العملاء، والمخزون أصبح جاهزًا للتمدد.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-950">الخطوات المتبقية قبل الترحيل</h3>
        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
