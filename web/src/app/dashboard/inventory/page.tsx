import { DataTableCard } from "@/components/data-table-card";
import { getRecentInventory } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function InventoryPage() {
  const inventory = await getRecentInventory();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">المخزون</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">بداية صفحة المخزون</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          هذه الصفحة جاهزة لتصبح بديلًا أسرع من قراءة Google Sheets كاملة. عندما نكمل نماذج
          الإدخال والتعديل سيكون المخزون فعليًا تحت قاعدة بيانات واحدة وسريعة.
        </p>
      </section>

      <DataTableCard
        title="المركبات"
        description="عرض أولي لآخر المركبات. سنضيف لاحقًا البحث، الحالات، وإدارة الصور."
        columns={["السيارة", "المالك", "الحالة", "السعر", "السنة", "اللون", "الفرع"]}
        hasRows={inventory.length > 0}
        emptyMessage="لا توجد بيانات بعد. لا بأس، الهيكل جاهز والترحيل مؤجل لآخر مرحلة."
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
  );
}
