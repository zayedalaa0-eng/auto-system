import { type ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
};

export function MetricCard({ label, value, hint, icon }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">{icon}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{hint}</p>
    </div>
  );
}
