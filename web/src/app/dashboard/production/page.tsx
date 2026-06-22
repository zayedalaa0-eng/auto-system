import Link from "next/link";
import { Warehouse, PackageSearch, Factory } from "lucide-react";

export default function ProductionDashboardPage() {
  return (
    <div className="legacy-grid gap-6">
      <div className="flex items-center gap-3">
        <Warehouse className="h-8 w-8 text-indigo-600" />
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">نظام الإنتاج والتسعير</h1>
      </div>
      <p className="text-slate-500 max-w-2xl text-lg">
        مرحباً بك في مركز التحكم الخاص بالإنتاج. من هنا يمكنك إدارة الأصناف، تحديد معادلات التسعير، ومتابعة أوامر التشغيل والإنتاج.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* بطاقة الأصناف */}
        <Link href="/dashboard/production/items" className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <PackageSearch className="h-32 w-32 text-indigo-600" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 mb-6 shadow-inner">
              <PackageSearch className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">إدارة الأصناف والتسعير</h2>
            <p className="text-slate-600 font-medium">
              أضف المواد الخام والمنتجات النهائية، وحدد التكلفة وهامش الربح لتوليد الأسعار تلقائياً.
            </p>
          </div>
        </Link>

        {/* بطاقة أوامر الإنتاج */}
        <Link href="/dashboard/production/orders" className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Factory className="h-32 w-32 text-emerald-600" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-6 shadow-inner">
              <Factory className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">أوامر الإنتاج (Kanban)</h2>
            <p className="text-slate-600 font-medium">
              لوحة تتبع تفاعلية لحالة أوامر الإنتاج (مخطط، قيد التنفيذ، منتهي) مرتبطة بطلبات المبيعات.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
