import Link from "next/link";

export const metadata = { title: "غير مصرح — نظام المعرض" };

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" dir="rtl">
      <div className="max-w-md w-full text-center">
        <div className="text-8xl mb-6">🔒</div>
        <h1 className="text-3xl font-bold text-slate-800 mb-3">403 — غير مصرح</h1>
        <p className="text-slate-500 mb-2">
          ليس لديك صلاحية الوصول إلى هذه الصفحة.
        </p>
        <p className="text-slate-400 text-sm mb-8">
          إذا كنت تعتقد أن هذا خطأ، تواصل مع المدير العام لتحديث صلاحياتك.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 transition-colors"
          >
            🏠 الرئيسية
          </Link>
          <Link
            href="/dashboard/customers"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow hover:bg-slate-50 transition-colors"
          >
            👥 ملفات العملاء
          </Link>
        </div>
      </div>
    </div>
  );
}
