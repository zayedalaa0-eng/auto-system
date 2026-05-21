import { DataTableCard } from "@/components/data-table-card";
import { getRecentCustomers } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default async function CustomersPage() {
  const customers = await getRecentCustomers();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">العملاء</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">بداية صفحة العملاء</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          هذه النسخة الأولى من صفحة العملاء. الفكرة هنا أن نبني القراءة والفلترة والتفاصيل
          الجديدة فوق قاعدة PostgreSQL، ثم ندخل الترحيل النهائي عندما نكون مرتاحين للشكل
          والمسارات.
        </p>
      </section>

      <DataTableCard
        title="سجل العملاء"
        description="عرض أولي للبيانات الحديثة. سنضيف لاحقًا البحث، التصفية، والنماذج."
        columns={["العميل", "الهاتف", "المركبة المطلوبة", "الحالة", "المتابعة القادمة", "الفرع"]}
        hasRows={customers.length > 0}
        emptyMessage="لا توجد سجلات بعد. يمكننا متابعة بناء النماذج أولًا ثم نرجع للترحيل."
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
    </div>
  );
}
