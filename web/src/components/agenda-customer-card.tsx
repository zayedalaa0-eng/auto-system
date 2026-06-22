import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function AgendaCustomerCard({
  id,
  name,
  sub1,
  sub2,
  badge,
  badgeColor,
  detailBasePath,
  linkQuery = "?mode=view"
}: {
  id: string;
  name: string;
  sub1?: string;
  sub2?: string;
  badge?: string;
  badgeColor?: string;
  detailBasePath: string;
  linkQuery?: string;
}) {
  return (
    <Link
      href={`${detailBasePath}${detailBasePath.includes("?") ? "&" : "?"}customer=${id}${linkQuery.replace("?", "&")}`}
      className="group/card flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-sky-300 hover:shadow-md mb-2 last:mb-0 relative overflow-hidden"
    >
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: badgeColor || "#94a3b8" }} />
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-bold text-slate-800 truncate" style={{ fontSize: 14 }}>{name}</div>
          {badge && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shrink-0" style={{ backgroundColor: badgeColor || "#94a3b8" }}>
              {badge}
            </span>
          )}
        </div>
        {sub1 && <div className="text-xs font-medium text-slate-600 truncate mb-1">{sub1}</div>}
        {sub2 && <div className="text-xs text-slate-500 truncate">{sub2}</div>}
      </div>
      <div className="shrink-0 flex sm:flex-col items-center justify-end gap-2 pr-2 sm:pr-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover/card:bg-sky-50 group-hover/card:text-sky-600">
          <ExternalLink className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}
