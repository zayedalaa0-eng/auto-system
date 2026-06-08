"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  Building2,
  CarFront,
  ChartBar,
  ChartPie,
  FileSearch,
  List,
  LogOut,
  Menu,
  UserCircle2,
  UserPlus,
  UsersRound,
  Warehouse,
  X,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  managerOnly?: boolean;
  gmOnly?: boolean;
  badge?: number;
};

type SidebarNavProps = {
  userName: string;
  userRole: string;
  isManager: boolean;
  isGeneralManager?: boolean;
  branchName?: string | null;
  unreadCount: number;
  signOutAction: () => Promise<void>;
};

export function SidebarNav({
  userName,
  userRole,
  isManager,
  isGeneralManager = false,
  branchName,
  unreadCount,
  signOutAction,
}: SidebarNavProps) {
  // اسم العلامة: المدير العام يرى "مجموعة المعلم للسيارات"، البقية يرون اسم معرضهم
  const brandName = isGeneralManager || !branchName
    ? "مجموعة المعلم للسيارات"
    : branchName;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const navItems: NavItem[] = [
    { href: "/dashboard/customers/new", label: "إدخال عميل جديد", icon: UserPlus },
    { href: "/dashboard/customers", label: "تقرير عملائي", icon: List },
    { href: "/dashboard/search", label: "عملاء المعرض", icon: FileSearch },
    { href: "/dashboard/inventory", label: "المخزون", icon: Warehouse },
    { href: "/dashboard/notifications", label: "التنبيهات", icon: Bell, badge: unreadCount },
    { href: "/dashboard", label: "الإحصائيات", icon: ChartBar },
    { href: "/dashboard/management", label: "تقرير الإدارة", icon: ChartPie, managerOnly: true },
    { href: "/dashboard/staff", label: "الموظفين", icon: UsersRound, managerOnly: true },
    { href: "/dashboard/branches", label: "إدارة المعارض", icon: Building2, gmOnly: true },
  ].filter((item) => {
    if (item.gmOnly) return isGeneralManager;
    if (item.managerOnly) return isManager;
    return true;
  });

  const SidebarContent = () => (
    <div className="sidebar-inner">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <CarFront className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="sidebar-brand-name">{brandName}</div>
          <div className="sidebar-brand-role">{userRole}</div>
        </div>
      </div>

      {/* Divider */}
      <div className="sidebar-divider" />

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx("sidebar-link", active && "active")}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="sidebar-link-label">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="sidebar-badge">{item.badge > 99 ? "99+" : item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <UserCircle2 className="h-4 w-4 text-sky-400 flex-shrink-0" />
          <span className="sidebar-user-name">{userName}</span>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="sidebar-logout">
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile topbar ── */}
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <CarFront className="h-5 w-5 text-sky-400" />
          <span>{brandName}</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="القائمة">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* ── Desktop sidebar ── */}
      <aside className="app-sidebar" aria-label="القائمة الجانبية">
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay ── */}
      {open && (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} aria-hidden />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={clsx("app-sidebar mobile-drawer", open && "open")}
        aria-label="القائمة"
      >
        <button className="sidebar-close-btn" onClick={() => setOpen(false)} aria-label="إغلاق">
          <X className="h-5 w-5" />
        </button>
        <SidebarContent />
      </aside>
    </>
  );
}
