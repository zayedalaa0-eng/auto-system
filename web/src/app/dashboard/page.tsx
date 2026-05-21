import { Bell, CalendarClock, CarFront, Users } from "lucide-react";

import { MetricCard } from "@/components/metric-card";
import { DataTableCard } from "@/components/data-table-card";
import { getDashboardMetrics, getRecentCustomers, getRecentInventory } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

const icons = [Users, CarFront, CalendarClock, Bell];

export default async function DashboardPage() {
  const [metrics, customers, inventory] = await Promise.all([
    getDashboardMetrics(),
    getRecentCustomers(),
    getRecentInventory(),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">لوحة العمل</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">نسخة الويب الجديدة بدأت تتشكل</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          هذا أول shell حقيقي للنظام الجديد. ربطنا قاعدة البيانات والهيكل العام، والآن أي شاشة
          جديدة ستبنى فوق الجداول والسياسات التي جهزناها في Supabase.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = icons[index] ?? Users;
          return (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              icon={<Icon className="h-5 w-5" />}
            />
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataTableCard
          title="آخر العملاء"
          description="أول قراءة سريعة من جدول العملاء بعد بدء الربط مع Supabase."
          columns={["العميل", "الهاتف", "المطلوب", "الحالة", "المتابعة", "الفرع"]}
          hasRows={customers.length > 0}
          emptyMessage="لا توجد بيانات بعد. هذا طبيعي قبل ترحيل العملاء أو قبل إدخال أول سجل."
        >
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td className="px-6 py-4 font-medium text-slate-950">{customer.full_name}</td>
              <td className="px-6 py-4">{customer.phone}</td>
              <td className="px-6 py-4">{customer.requested_car ?? "—"}</td>
              <td className="px-6 py-4">{customer.status}</td>
              <td className="px-6 py-4">{formatDate(customer.next_follow_up_at)}</td>
              <td className="px-6 py-4">{customer.branch_name ?? "—"}</td>
            </tr>
          ))}
        </DataTableCard>

        <DataTableCard
          title="آخر المركبات"
          description="أول عرض للمخزون بصيغته الجديدة، مع بقاء الترحيل للمرحلة النهائية."
          columns={["السيارة", "المالك", "الحالة", "السعر", "السنة", "اللون", "الفرع"]}
          hasRows={inventory.length > 0}
          emptyMessage="لا توجد مركبات بعد. عندما نرحّل inventory ستظهر هنا مباشرة."
        >
          {inventory.map((item) => (
            <tr key={item.id}>
              <td className="px-6 py-4 font-medium text-slate-950">{item.model}</td>
              <td className="px-6 py-4">{item.owner_name ?? "—"}</td>
              <td className="px-6 py-4">{item.availability_status}</td>
              <td className="px-6 py-4">{formatCurrency(item.price)}</td>
              <td className="px-6 py-4">{item.production_year ?? "—"}</td>
              <td className="px-6 py-4">{item.color ?? "—"}</td>
              <td className="px-6 py-4">{item.branch_name ?? "—"}</td>
            </tr>
          ))}
        </DataTableCard>
      </div>
    </div>
  );
}
