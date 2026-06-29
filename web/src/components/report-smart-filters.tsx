"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { StatusChipOption } from "@/lib/customer-report";

type Props = {
  statuses: StatusChipOption[];
  users?: string[];
  customerNames?: string[];
  branches?: string[];
  queryPlaceholder?: string;
};

const PERIOD_OPTIONS = [
  { value: "all", label: "كل الأوقات" },
  { value: "today", label: "آخر 24 ساعة" },
  { value: "2days", label: "آخر يومين" },
  { value: "week", label: "آخر أسبوع" },
  { value: "month", label: "آخر شهر" },
];

export function ReportSmartFilters({ statuses, users, customerNames, branches, queryPlaceholder }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeQuery = searchParams.get("q") ?? "";
  const activeStatus = searchParams.get("status") ?? "all";
  const activeLifecycle = searchParams.get("lifecycle") ?? "all";
  const activePeriod = searchParams.get("period") ?? "all";
  const activeUser = searchParams.get("user") ?? "all";
  const activeBranch = searchParams.get("branch") ?? "all";
  const activeCustomerName = searchParams.get("customer_name") ?? "all";
  const [queryText, setQueryText] = useState(activeQuery);

  useEffect(() => {
    setQueryText(activeQuery);
  }, [activeQuery]);

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    // تنظيف بقايا فلتر الحقول القديم نهائيًا
    params.delete("field");
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (queryText === activeQuery) return;
      navigate({ q: queryText || null });
    }, 250);
    return () => clearTimeout(timer);
  }, [queryText, activeQuery]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="legacy-input pe-10"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={queryPlaceholder ?? "ابحث في التقرير..."}
          />
        </label>
      </div>

      <div className={`grid gap-2 ${(users && users.length > 0) || (branches && branches.length > 0) ? "md:grid-cols-6" : "md:grid-cols-4"}`}>
        {branches && branches.length > 0 ? (
          <select className="legacy-select" value={activeBranch} onChange={(e) => navigate({ branch: e.target.value })}>
            <option value="all">كل المعارض</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        ) : null}

        <select
          className="legacy-select"
          value={activeCustomerName}
          onChange={(e) => navigate({ customer_name: e.target.value })}
        >
          <option value="all">كل العملاء</option>
          {(customerNames ?? []).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select className="legacy-select" value={activeStatus} onChange={(e) => navigate({ status: e.target.value })}>
          <option value="all">كل الحالات</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value} ({s.count})
            </option>
          ))}
        </select>

        <select className="legacy-select" value={activeLifecycle} onChange={(e) => navigate({ lifecycle: e.target.value })}>
          <option value="all">كل الدورات</option>
          <option value="active">نشطة فقط</option>
          <option value="closed">مغلقة فقط</option>
        </select>

        <select className="legacy-select" value={activePeriod} onChange={(e) => navigate({ period: e.target.value })}>
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {users && users.length > 0 ? (
          <select className="legacy-select" value={activeUser} onChange={(e) => navigate({ user: e.target.value })}>
            <option value="all">كل الموظفين</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}
