"use client";

import { SoldInventoryItem } from "@/lib/inventory-sold";
import { CarFront, Store, User, RefreshCw, Star, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Props = {
  items: SoldInventoryItem[];
};

export function SoldInventoryList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-500 bg-white">
        <CarFront className="mx-auto h-12 w-12 text-slate-300 opacity-50" />
        <p className="mt-4 font-medium">لا توجد سيارات مباعة تطابق بحثك</p>
      </div>
    );
  }

  function getDealBadge(item: SoldInventoryItem) {
    const d = (item.deal_type ?? "").toLowerCase();
    if (d.includes("وكالة") || d.includes("برسم البيع")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 shadow-sm border border-amber-200">
          <Star className="h-3 w-3" />
          بيع بالوكالة
        </span>
      );
    }

    const opType = item.buyer_operation_type ?? "";
    if (opType.includes("trade") || opType.includes("استبدال") || d.includes("استبدال") || d.includes("حيازة")) {
      return (
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-semibold text-fuchsia-700 shadow-sm border border-fuchsia-200">
            <RefreshCw className="h-3 w-3" />
            مشتري + استبدال
          </span>
          {item.buyer_trade_in_model && (
            <span className="text-[10px] text-slate-500 max-w-[120px] truncate" title={item.buyer_trade_in_model}>
              عن: {item.buyer_trade_in_model}
            </span>
          )}
        </div>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm border border-sky-200">
        <CarFront className="h-3 w-3" />
        مشتري
      </span>
    );
  }

  function formatPrice(price: number | null) {
    if (price === null) return "غير محدد";
    return new Intl.NumberFormat("en-US").format(price) + " ₪";
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
      {items.map((item) => {
        const isAgencyOrTradeIn = (item.deal_type ?? "").includes("استبدال") || (item.deal_type ?? "").includes("وكالة") || (item.deal_type ?? "").includes("برسم البيع");

        return (
          <div
            key={item.id}
            className="group relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            {/* 1. Car Info */}
            <div className="flex flex-1 items-start gap-4 lg:w-[25%] lg:flex-none">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100 shadow-inner">
                <CarFront className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-slate-800" title={item.model}>
                  {item.model}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{item.production_year ?? "سنة ؟"}</span>
                  {item.chassis_no && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="font-mono bg-slate-100 px-1 rounded">#{item.chassis_no.slice(-6)}</span>
                    </>
                  )}
                  {item.color && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{item.color}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Transaction Flow (From -> To) */}
            <div className="flex flex-1 flex-col gap-3 rounded-lg bg-slate-50 p-3 lg:flex-row lg:items-center lg:gap-6 lg:bg-transparent lg:p-0">
              
              {/* Source / Owner */}
              <div className="flex-1 min-w-0 border-l border-slate-200 pl-4 last:border-0 lg:border-l-0">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">المصدر / المالك السابق</div>
                {isAgencyOrTradeIn && item.owner_name ? (
                  <div className="flex flex-col">
                    <span className="truncate font-semibold text-slate-700 flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {item.owner_name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Store className="h-3 w-3" />
                      {item.branch_name || "غير محدد"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Store className="h-3.5 w-3.5 text-slate-400" />
                      {item.branch_name || "الرئيسي"}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <CarFront className="h-3 w-3" />
                      مخزون الشركة
                    </span>
                  </div>
                )}
              </div>

              {/* Arrow Indicator (Cross-branch visually) */}
              <div className="hidden lg:flex flex-col items-center justify-center px-2">
                <div className="h-[2px] w-8 bg-gradient-to-l from-slate-200 to-transparent relative">
                  <div className="absolute -left-1 -top-[3px] h-2 w-2 rotate-45 border-b-2 border-l-2 border-slate-300"></div>
                </div>
              </div>

              {/* Destination / Buyer */}
              <div className="flex-1 min-w-0">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600/70">المشتري / منفذ البيع</div>
                <div className="flex flex-col">
                  {item.buyer_id ? (
                    <Link
                      href={`/dashboard/customer-profile/${item.buyer_id}`}
                      className="truncate font-semibold text-emerald-700 flex items-center gap-1 hover:underline decoration-emerald-300 underline-offset-4"
                    >
                      <User className="h-3.5 w-3.5" />
                      {item.buyer_name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-400 flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      غير مرتبط
                    </span>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Store className="h-3 w-3 text-emerald-500/70" />
                      {item.buyer_branch_name || item.branch_name || "غير محدد"}
                    </span>
                    {item.buyer_creator_name && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>البائع: {item.buyer_creator_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Deal & Price */}
            <div className="flex flex-row items-center justify-between gap-4 border-t border-slate-100 pt-3 lg:w-[20%] lg:flex-col lg:items-end lg:justify-center lg:border-t-0 lg:pt-0">
              {getDealBadge(item)}
              <div className="text-right">
                <div className="font-bold text-slate-800">{formatPrice(item.price)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
