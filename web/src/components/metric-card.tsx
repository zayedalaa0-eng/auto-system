import { type ReactNode } from "react";
import clsx from "clsx";

type MetricCardProps = {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone?: "sky" | "emerald" | "amber" | "rose";
};

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  sky: "from-sky-500/12 to-cyan-500/6 text-sky-700 ring-sky-200",
  emerald: "from-emerald-500/12 to-green-500/6 text-emerald-700 ring-emerald-200",
  amber: "from-amber-500/14 to-orange-500/6 text-amber-700 ring-amber-200",
  rose: "from-rose-500/12 to-pink-500/6 text-rose-700 ring-rose-200",
};

export function MetricCard({ label, value, hint, icon, tone = "sky" }: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors" title={hint}>
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--accent)] via-sky-400 to-emerald-400 opacity-50" />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div
          className={clsx(
            "rounded-lg bg-gradient-to-br p-2 ring-1 ring-inset shrink-0",
            toneClasses[tone],
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
