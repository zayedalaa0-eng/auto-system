"use client";

import { useState } from "react";
import { createItemAction } from "@/app/dashboard/production/actions";
import { Calculator, PackagePlus, Save, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

export function ItemForm() {
  const [costPrice, setCostPrice] = useState<number>(0);
  const [profitMargin, setProfitMargin] = useState<number>(30); // Default 30%
  const [isPending, setIsPending] = useState(false);

  // حساب السعر النهائي المباشر للعرض
  const calculatedPriceCents = Math.round((costPrice * 100) * (1 + profitMargin / 100));

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
            <PackagePlus className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">إضافة صنف جديد (تسعير)</h2>
        </div>
        <Link href="/dashboard/production/items" className="text-sm font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 transition">
          <ArrowRight className="h-4 w-4" /> رجوع للقائمة
        </Link>
      </div>

      <form 
        action={async (formData) => {
          setIsPending(true);
          try {
            await createItemAction(formData);
          } finally {
            setIsPending(false);
          }
        }} 
        className="p-6 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* كود الصنف */}
          <div className="space-y-2">
            <label htmlFor="item_code" className="block text-sm font-bold text-slate-700">كود الصنف (Item Code)</label>
            <input 
              required
              type="text" 
              name="item_code" 
              id="item_code" 
              placeholder="مثال: NS-101" 
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition font-mono text-left dir-ltr"
            />
          </div>

          {/* اسم الصنف */}
          <div className="space-y-2">
            <label htmlFor="original_name" className="block text-sm font-bold text-slate-700">اسم الصنف</label>
            <input 
              required
              type="text" 
              name="original_name" 
              id="original_name" 
              placeholder="مثال: باب حديد مشغول" 
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-6">
          <div className="flex items-center gap-2 mb-2 text-indigo-700">
            <Calculator className="h-5 w-5" />
            <h3 className="font-bold">معادلة التسعير التلقائية</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* سعر التكلفة */}
            <div className="space-y-2">
              <label htmlFor="cost_price" className="block text-sm font-bold text-slate-700">سعر التكلفة</label>
              <div className="relative">
                <input 
                  required
                  type="number" 
                  step="0.01"
                  name="cost_price" 
                  id="cost_price" 
                  value={costPrice || ""}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  placeholder="0.00" 
                  className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition text-left dir-ltr font-mono"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">SAR</div>
              </div>
            </div>

            {/* هامش الربح */}
            <div className="space-y-2">
              <label htmlFor="profit_margin" className="block text-sm font-bold text-slate-700">هامش الربح المطلوب</label>
              <div className="relative">
                <input 
                  required
                  type="number" 
                  step="0.1"
                  name="profit_margin" 
                  id="profit_margin" 
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(Number(e.target.value))}
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition text-left dir-ltr font-mono"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</div>
              </div>
            </div>
          </div>

          {/* النتيجة */}
          <div className="mt-6 p-4 rounded-xl bg-indigo-600 text-white flex items-center justify-between shadow-inner">
            <span className="font-bold text-indigo-100">سعر البيع النهائي المتوقع:</span>
            <span className="text-2xl font-black font-mono">
              {formatCurrency(calculatedPriceCents)}
            </span>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button 
            type="submit" 
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5" />
            {isPending ? "جاري الحفظ..." : "حفظ الصنف وتأكيد السعر"}
          </button>
        </div>
      </form>
    </div>
  );
}
