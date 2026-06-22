import { PackageSearch, Plus } from "lucide-react";
import { getProductionItems } from "@/lib/production-data";
import { ItemsTable } from "@/components/production/items-table";
import Link from "next/link";

export default async function ProductionItemsPage() {
  const items = await getProductionItems();

  return (
    <div className="legacy-grid gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PackageSearch className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">إدارة الأصناف والتسعير</h1>
        </div>
        <Link
          href="/dashboard/production/items/new"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 transition"
        >
          <Plus className="h-5 w-5" />
          إضافة صنف جديد
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <ItemsTable items={items} />
      </div>
    </div>
  );
}
