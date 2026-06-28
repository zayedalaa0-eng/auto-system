import React from "react";

export function DashboardAccordion({ title, icon: Icon, iconColor, count, badgeColor, children }: any) {
  return (
    <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all open:border-sky-300 open:shadow-md w-full">
      <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50 p-4 transition-colors hover:bg-slate-100 group-open:bg-sky-50">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <span className="font-bold text-slate-800">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-bold text-white shadow-sm`} style={{ backgroundColor: badgeColor || "#475569" }}>
            {count}
          </span>
          <span className="text-slate-400 transition-transform duration-300 group-open:rotate-180">▼</span>
        </div>
      </summary>
      <div className="p-4 bg-white/50 space-y-3 border-t border-slate-100">
        {children}
      </div>
    </details>
  );
}
