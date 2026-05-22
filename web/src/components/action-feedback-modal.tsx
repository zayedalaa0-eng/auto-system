"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ActionFeedbackModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const message = useMemo(() => {
    const notice = searchParams.get("notice");
    return notice ?? "";
  }, [searchParams]);

  if (!message || dismissed) return null;

  const clearParams = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("notice");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xl">
        <div className="text-lg font-bold text-emerald-700">تمت العملية بنجاح</div>
        <p className="mt-2 text-sm font-medium text-slate-700">{decodeURIComponent(message)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="legacy-btn legacy-btn-secondary"
            onClick={() => {
              setDismissed(true);
              clearParams();
            }}
          >
            إغلاق
          </button>
          <button
            type="button"
            className="legacy-btn legacy-btn-primary"
            onClick={() => {
              setDismissed(true);
              clearParams();
            }}
          >
            إكمال
          </button>
        </div>
      </div>
    </div>
  );
}
