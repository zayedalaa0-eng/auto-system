"use client";

import { AlertCircle, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { StatusChipOption } from "@/lib/customer-report";

type Props = {
  statuses: StatusChipOption[];
  overdueCount: number;
  users?: string[];
  queryPlaceholder?: string;
};

const PERIOD_OPTIONS = [
  { value: "all", label: "كل الأوقات" },
  { value: "today", label: "آخر 24 ساعة" },
  { value: "2days", label: "آخر يومين" },
  { value: "week", label: "آخر أسبوع" },
  { value: "month", label: "آخر شهر" },
];

const SEARCH_FIELD_OPTIONS = [
  { value: "all", label: "🔍 كل الحقول" },
  { value: "name", label: "👤 اسم العميل" },
  { value: "phone", label: "📞 الهاتف" },
  { value: "car", label: "🚗 السيارة" },
  { value: "status", label: "🏷 الحالة" },
  { value: "staff", label: "👷 الموظف" },
  { value: "branch", label: "🏢 المعرض" },
  { value: "operation", label: "⚙️ نوع العملية" },
];

export function CustomerReportFilters({ statuses, overdueCount, users, queryPlaceholder }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeQuery = searchParams.get("q") ?? "";
  const activeField = searchParams.get("field") ?? "all";
  const activeStatus = searchParams.get("status") ?? "all";
  const activePeriod = searchParams.get("period") ?? "all";
  const activeUser = searchParams.get("user") ?? "all";
  const isOverdue = searchParams.get("overdue") === "1";

  const [queryText, setQueryText] = useState(activeQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // مزامنة مع URL
  useEffect(() => {
    setQueryText(activeQuery);
  }, [activeQuery]);

  // بحث ذكي مع تأخير 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (queryText === activeQuery) return;
    debounceRef.current = setTimeout(() => {
      navigate({ q: queryText || null });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryText]);

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearSearch() {
    setQueryText("");
    inputRef.current?.focus();
  }

  function clearAll() {
    setQueryText("");
    navigate({ q: null, field: null, status: null, period: null, user: null, overdue: null });
  }

  const hasActiveFilters =
    activeQuery || activeField !== "all" || activeStatus !== "all" ||
    activePeriod !== "all" || activeUser !== "all" || isOverdue;

  return (
    <div className="space-y-2.5">
      {/* ── صف البحث الذكي ── */}
      <div className="flex gap-2">
        {/* حقل البحث */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            className="legacy-input pe-10 ps-10 h-[42px]"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={queryPlaceholder ?? "ابحث بذكاء في السجل..."}
          />
          {queryText ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
              aria-label="مسح البحث"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        {/* حقل البحث في — الحقل المحدد */}
        <select
          className="legacy-select crf-select flex-shrink-0"
          style={{ minWidth: 155 }}
          value={activeField}
          onChange={(e) => navigate({ field: e.target.value })}
        >
          {SEARCH_FIELD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── صف الفلاتر المنسدلة ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* الحالة */}
        <select
          className="legacy-select crf-select"
          value={activeStatus}
          onChange={(e) => navigate({ status: e.target.value })}
        >
          <option value="all">كل الحالات</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value} ({s.count})
            </option>
          ))}
        </select>

        {/* آخر تواصل */}
        <select
          className="legacy-select crf-select"
          value={activePeriod}
          onChange={(e) => navigate({ period: e.target.value })}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* الموظف — تقرير الإدارة فقط */}
        {users && users.length > 0 ? (
          <select
            className="legacy-select crf-select"
            value={activeUser}
            onChange={(e) => navigate({ user: e.target.value })}
          >
            <option value="all">كل الموظفين</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        ) : null}

        {/* المتابعة المتأخرة */}
        {overdueCount > 0 ? (
          <button
            type="button"
            onClick={() => navigate({ overdue: isOverdue ? null : "1" })}
            className={`crf-overdue-btn${isOverdue ? " crf-overdue-btn--active" : ""}`}
          >
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            متأخرة
            <span className="crf-count">{overdueCount}</span>
          </button>
        ) : null}

        {/* مسح كل الفلاتر */}
        {hasActiveFilters ? (
          <button type="button" className="crf-clear-btn" onClick={clearAll}>
            <X className="h-3.5 w-3.5" />
            مسح الكل
          </button>
        ) : null}
      </div>
    </div>
  );
}
