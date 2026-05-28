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
    <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent)] via-sky-400 to-emerald-400" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <div
          className={clsx(
            "rounded-2xl bg-gradient-to-br p-3 ring-1 ring-inset",
            toneClasses[tone],
          )}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{hint}</p>
    </div>
  );
}
