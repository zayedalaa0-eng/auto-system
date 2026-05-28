import Link from "next/link";

import { X } from "lucide-react";

type CustomerModalShellProps = {
  closeHref: string;
  title: string;
  children: React.ReactNode;
};

export function CustomerModalShell({ closeHref, title, children }: CustomerModalShellProps) {
  return (
    <>
      {/* Backdrop */}
      <Link href={closeHref} className="drawer-overlay" aria-label="إغلاق" />

      {/* Side Drawer */}
      <div className="side-drawer">
        <div className="side-drawer__header">
          {title ? <h4 className="side-drawer__title">{title}</h4> : <span />}
          <Link href={closeHref} className="side-drawer__close" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </Link>
        </div>
        <div className="side-drawer__body">{children}</div>
      </div>
    </>
  );
}
