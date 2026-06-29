"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  branches: string[];
};

export function SoldInventoryFilterBar({ branches }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeQuery = searchParams.get("q") ?? "";
  const activeBranch = searchParams.get("branch") ?? "all";
  const activeDeal = searchParams.get("deal") ?? "all";
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
            placeholder="بحث: السيارة، المشتري، العارض، المعرض..."
          />
        </label>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
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

        <select className="legacy-select" value={activeDeal} onChange={(e) => navigate({ deal: e.target.value })}>
          <option value="all">كل الأنواع</option>
          <option value="جديد">مخزون الشركة (جديد)</option>
          <option value="وكالة">بيع بالوكالة</option>
          <option value="استبدال">استبدال / حيازة</option>
        </select>
      </div>
    </div>
  );
}
