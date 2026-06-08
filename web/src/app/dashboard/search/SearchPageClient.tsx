"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerItem } from "@/lib/data";

/* ── types ── */
type SearchResult = {
  customers: CustomerItem[];
  isGeneralManager: boolean;
  isManager: boolean;
  total: number;
};

/* ── constants ── */
const OP_OPTIONS = [
  { value: "all",                   label: "كل الأنواع" },
  { value: "buyer",                 label: "🛒 مشتري" },
  { value: "buyer_tradein_pending", label: "🔄 مشتري + استبدال" },
  { value: "sell_on_behalf",        label: "🚗 بيع بالوكالة" },
];

const LIFECYCLE_OPTIONS = [
  { value: "all",    label: "الكل" },
  { value: "active", label: "✅ نشط" },
  { value: "closed", label: "🔒 مغلق" },
];

/* ── helpers ── */
function opLabel(op: string | null | undefined) {
  if (op === "sell_on_behalf")        return "بيع بالوكالة";
  if (op === "buyer_tradein_pending" || op === "buyer_tradein_evaluated") return "مشتري + استبدال";
  if (op === "buyer")                 return "مشتري";
  return op ?? "—";
}

function statusColor(status: string): string {
  if (status.includes("تمت عملية البيع") || status.includes("للعميل")) return "#22c55e";
  if (status.includes("حجز"))    return "#a855f7";
  if (status.includes("جديد"))   return "#3b82f6";
  if (status.includes("تواصل")) return "#6366f1";
  if (status.includes("معاينة")) return "#8b5cf6";
  if (status.includes("عرض سعر") || status.includes("عرض سيارة")) return "#f97316";
  if (status.includes("استبدال")) return "#f97316";
  if (status.includes("رفض"))    return "#ef4444";
  if (status.includes("مغلق") || status.includes("إغلاق") || status.includes("سحب") || status.includes("تراجع")) return "#6b7280";
  return "#6366f1";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}`;
}

function isOverdue(iso: string | null | undefined) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

/* ── smart scorer: للترتيب الذكي للنتائج ── */
function scoreCustomer(c: CustomerItem, q: string): number {
  if (!q) return 0;
  const needle = q.toLowerCase();
  let score = 0;
  if (c.full_name.toLowerCase().startsWith(needle))        score += 100;
  else if (c.full_name.toLowerCase().includes(needle))     score += 60;
  if (c.phone.includes(needle))                            score += 80;
  if ((c.requested_car ?? "").toLowerCase().includes(needle)) score += 30;
  if ((c.status ?? "").toLowerCase().includes(needle))     score += 20;
  if (c.is_active) score += 5; // النشطة أعلى
  return score;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Customer Card Component
   ══════════════════════════════════════════════════════════════════════════════ */
function CustomerCard({
  customer,
  isGM,
  onClick,
}: {
  customer: CustomerItem;
  isGM: boolean;
  onClick: () => void;
}) {
  const isClosed = !customer.is_active;
  const followupOverdue = isOverdue(customer.next_follow_up_at);
  const sColor = statusColor(customer.status);

  return (
    <button
      onClick={onClick}
      className="w-full text-right transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95"
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
    >
      <div
        className="rounded-2xl border p-4 flex flex-col gap-3"
        style={{
          background: isClosed ? "rgba(107,114,128,0.04)" : "white",
          borderColor: isClosed ? "#e5e7eb" : `${sColor}33`,
          borderWidth: isClosed ? 1 : 1.5,
        }}
      >
        {/* ── Row 1: Avatar + Name + badges ── */}
        <div className="flex items-start gap-3">
          {/* avatar */}
          <div
            className="rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
            style={{
              width: 42,
              height: 42,
              background: isClosed
                ? "linear-gradient(135deg,#9ca3af,#6b7280)"
                : `linear-gradient(135deg,${sColor}cc,${sColor}88)`,
            }}
          >
            {initials(customer.full_name)}
          </div>

          <div className="flex-1 min-w-0">
            {/* name row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-800 truncate">
                {customer.full_name}
              </span>
              {isClosed && (
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  🔒 مغلق
                </span>
              )}
            </div>

            {/* phone */}
            <div className="text-xs text-slate-400 font-mono mt-0.5">{customer.phone}</div>

            {/* badges row */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {/* status */}
              <span
                className="text-xs font-bold rounded-full px-2 py-0.5"
                style={{
                  background: `${sColor}18`,
                  color: sColor,
                  border: `1px solid ${sColor}44`,
                }}
              >
                {customer.status}
              </span>

              {/* op type */}
              <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-slate-100 text-slate-500">
                {opLabel(customer.operation_type)}
              </span>

              {/* branch — GM only */}
              {isGM && customer.branch_name && (
                <span className="text-xs rounded-full px-2 py-0.5 bg-sky-50 text-sky-600 font-medium">
                  🏢 {customer.branch_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 2: Car + staff + dates ── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {customer.requested_car && (
            <span className="flex items-center gap-1">
              <span>🚗</span>
              <span className="truncate max-w-[140px]">{customer.requested_car}</span>
            </span>
          )}
          {customer.assigned_user_name && (
            <span className="flex items-center gap-1">
              <span>👤</span>
              <span>{customer.assigned_user_name}</span>
            </span>
          )}
          {customer.last_contact_at && (
            <span className="flex items-center gap-1">
              <span>🕐</span>
              <span>{fmtDate(customer.last_contact_at)}</span>
            </span>
          )}
        </div>

        {/* ── Row 3: Follow-up badge ── */}
        {customer.next_follow_up_at && !isClosed && (
          <div
            className="text-xs font-semibold rounded-lg px-3 py-1.5 flex items-center gap-2"
            style={{
              background: followupOverdue ? "#fef2f2" : "#f0fdf4",
              color: followupOverdue ? "#b91c1c" : "#15803d",
              border: `1px solid ${followupOverdue ? "#fca5a5" : "#86efac"}`,
            }}
          >
            <span>{followupOverdue ? "⚠️ متابعة متأخرة" : "📅 متابعة"}</span>
            <span>{fmtDate(customer.next_follow_up_at)}</span>
          </div>
        )}
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════════════════ */
export function SearchPageClient() {
  const router = useRouter();

  /* ── state ── */
  const [query,     setQuery]     = useState("");
  const [lifecycle, setLifecycle] = useState("all");
  const [opType,    setOpType]    = useState("all");
  const [status,    setStatus]    = useState("");

  const [results,   setResults]   = useState<CustomerItem[]>([]);
  const [isGM,      setIsGM]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [searched,  setSearched]  = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── fetch ── */
  const doSearch = useCallback(async (q: string, lc: string, op: string, st: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, lifecycle: lc, op, limit: "80" });
      if (st) params.set("status", st);
      const res = await fetch(`/api/customers/search?${params}`);
      const json: SearchResult & { error?: string } = await res.json();
      if (json.error) { setError(json.error); return; }
      setIsGM(json.isGeneralManager);

      // ترتيب ذكي: الأعلى تطابقاً أولاً
      const sorted = [...json.customers].sort((a, b) => scoreCustomer(b, q) - scoreCustomer(a, q));
      setResults(sorted);
      setSearched(true);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── debounced search on any filter change ── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, lifecycle, opType, status);
    }, query ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, lifecycle, opType, status, doSearch]);

  /* ── unique status options from results ── */
  const statusOptions = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of results) {
      map.set(c.status, (map.get(c.status) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [results]);

  const hasFilters = lifecycle !== "all" || opType !== "all" || status !== "";

  return (
    <div className="space-y-4" dir="rtl">

      {/* ══ Search bar ══ */}
      <div className="legacy-card space-y-3">
        <div className="flex items-center gap-2 text-xl font-bold text-sky-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          عملاء المعرض
          {searched && (
            <span className="text-base font-normal text-slate-400">
              ({results.length}{results.length === 80 ? "+" : ""})
            </span>
          )}
        </div>

        {/* input */}
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث بالاسم، الهاتف، السيارة، الحالة، أي شيء..."
            className="legacy-input pr-10"
          />
          {loading && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            </div>
          )}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Filter chips ── */}
        <div className="flex flex-wrap gap-2 items-center">

          {/* lifecycle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {LIFECYCLE_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setLifecycle(o.value)}
                className="px-3 py-1.5 font-medium transition-colors"
                style={{
                  background: lifecycle === o.value ? "#0ea5e9" : "white",
                  color: lifecycle === o.value ? "white" : "#64748b",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* op type */}
          <select
            value={opType}
            onChange={e => setOpType(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white text-slate-600 outline-none"
          >
            {OP_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* status — ظاهر فقط إذا في نتائج */}
          {statusOptions.length > 0 && (
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white text-slate-600 outline-none max-w-[180px]"
            >
              <option value="">كل الحالات</option>
              {statusOptions.map(([s, count]) => (
                <option key={s} value={s}>{s} ({count})</option>
              ))}
            </select>
          )}

          {/* clear filters */}
          {hasFilters && (
            <button
              onClick={() => { setLifecycle("all"); setOpType("all"); setStatus(""); }}
              className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded border border-rose-200 bg-rose-50"
            >
              ✕ إزالة الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* ══ Error ══ */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {/* ══ Empty state ══ */}
      {!loading && searched && results.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">🔍</div>
          <div className="font-semibold">لا توجد نتائج مطابقة</div>
          <div className="text-sm mt-1">جرّب تغيير كلمة البحث أو الفلاتر</div>
        </div>
      )}

      {/* ══ Initial empty state ══ */}
      {!searched && !loading && (
        <div className="text-center py-16 text-slate-300">
          <div className="text-5xl mb-3">👥</div>
          <div className="font-semibold text-slate-400">ابدأ البحث عن عميل</div>
          <div className="text-sm mt-1 text-slate-300">أو اختر فلتراً لعرض العملاء</div>
        </div>
      )}

      {/* ══ Results grid ══ */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {results.map(customer => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              isGM={isGM}
              onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
            />
          ))}
        </div>
      )}

      {/* ══ Limit notice ══ */}
      {results.length === 80 && (
        <div className="text-center text-xs text-slate-400 py-2">
          يُعرض أول 80 نتيجة — دقق البحث لتضييق النتائج
        </div>
      )}
    </div>
  );
}
