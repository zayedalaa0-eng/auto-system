import Link from "next/link";

import { X } from "lucide-react";

type CustomerModalShellProps = {
  closeHref: string;
  title: string;
  children: React.ReactNode;
};

export function CustomerModalShell({ closeHref, title, children }: CustomerModalShellProps) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 pt-8">
      <div className="legacy-modal-card my-2 max-h-[92vh] w-full max-w-[720px] overflow-hidden rounded-2xl border-0 bg-white shadow-2xl">
        <div className={`modal-profile-header relative sticky top-0 z-10 ${!title ? "min-h-[34px] bg-white p-2" : ""}`}>
          <Link
            href={closeHref}
            className="absolute end-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-700 transition hover:bg-white"
          >
            <X className="h-5 w-5" />
          </Link>
          {title ? <h4 className="pe-12 text-2xl font-bold text-sky-700">{title}</h4> : null}
        </div>
        <div className="max-h-[calc(92vh-96px)] overflow-y-auto bg-white p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}
