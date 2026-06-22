"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, Package, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

type Item = {
  item_code: string;
  original_name: string;
  approved_name: string | null;
  pricing_status: string;
  final_selling_price_cents: number | null;
  cost_price_cents: number | null;
  erp_categories?: { name: string } | null;
};

export function ItemsTable({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");

  const filtered = items.filter((item) =>
    (item.original_name || "").includes(query) || (item.item_code || "").includes(query)
  );

  return (
    <div className="flex flex-col w-full">
      {/* شريط البحث والفلترة */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث برمز أو اسم الصنف..."
            className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition">
          <SlidersHorizontal className="h-4 w-4" />
          فلاتر متقدمة
        </button>
      </div>

      {/* الجدول */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-sm border-b border-slate-200">
              <th className="p-4 font-bold">كود الصنف</th>
              <th className="p-4 font-bold">اسم الصنف</th>
              <th className="p-4 font-bold">التصنيف</th>
              <th className="p-4 font-bold text-center">حالة التسعير</th>
              <th className="p-4 font-bold">التكلفة</th>
              <th className="p-4 font-bold">سعر البيع النهائي</th>
              <th className="p-4 font-bold w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <tr key={item.item_code} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="p-4 font-mono text-sm text-slate-500">{item.item_code}</td>
                  <td className="p-4 font-medium text-slate-800">
                    {item.approved_name || item.original_name}
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {item.erp_categories?.name || "—"}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${
                        item.pricing_status === "مسعّر"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.pricing_status || "غير مسعّر"}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-600">
                    {item.cost_price_cents ? formatCurrency(item.cost_price_cents) : "—"}
                  </td>
                  <td className="p-4 text-sm font-bold text-indigo-700">
                    {item.final_selling_price_cents ? formatCurrency(item.final_selling_price_cents) : "—"}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/dashboard/production/items/${item.item_code}`}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  لا توجد أصناف مطابقة للبحث.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
