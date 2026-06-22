"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  Building2,
  CarFront,
  CalendarClock,
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
  ShieldAlert,
  Hammer,
  Wrench,
  CheckSquare,
} from "lucide-react";
import { BranchLogo } from "./branch-logo";
import { ThemeToggle } from "./theme-toggle";

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
  // اسم العلامة: المدير العام يرى "مجموعة لمعلم للسيارات"، البقية يرون اسم معرضهم
  const brandName = isGeneralManager || !branchName
    ? "مجموعة لمعلم للسيارات"
    : branchName;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // تسجيل الخروج التلقائي بعد 30 دقيقة من الخمول
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        signOutAction();
      }, 30 * 60 * 1000); // 30 mins
    };
    
    // Listen for activity
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("scroll", resetTimer);
    window.addEventListener("click", resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      window.removeEventListener("click", resetTimer);
    };
  }, [signOutAction]);

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "الرئيسية", icon: ChartBar },
    { href: "/dashboard/agenda", label: "الأجندة", icon: CalendarClock },
    { href: "/dashboard/customers", label: "إدارة العملاء (CRM)", icon: UsersRound },
    { href: "/dashboard/production", label: "الإنتاج", icon: Warehouse },
    { href: "/dashboard/inventory", label: "المخزون والأصناف", icon: List },
    { href: "/dashboard/maintenance", label: "إدارة الصيانة", icon: Wrench },
    { href: "/dashboard/blacksmiths", label: "طلبيات الحدادين", icon: Hammer },
    { href: "/dashboard/quality", label: "فحص الجودة", icon: CheckSquare },
    { href: "/dashboard/notifications", label: "التنبيهات", icon: Bell, badge: unreadCount },
    { href: "/dashboard/management", label: "تقرير الإدارة", icon: ChartPie, managerOnly: true },
    { href: "/dashboard/staff", label: "الموظفين", icon: UsersRound, managerOnly: true },
    { href: "/dashboard/branches", label: "إدارة المعارض", icon: Building2, gmOnly: true },
    { href: "/dashboard/audit", label: "سجل المراقبة والتدقيق", icon: ShieldAlert, gmOnly: true },
  ].filter((item) => {
    if (item.gmOnly) return isGeneralManager;
    if (item.managerOnly) return isManager;
    return true;
  });

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon flex items-center justify-center bg-transparent">
          {branchName || isGeneralManager ? (
            <BranchLogo branchName={brandName} className="w-8 h-8 rounded" />
          ) : (
            <CarFront className="h-5 w-5 text-white" />
          )}
        </div>
        <div>
          <div className="sidebar-brand-name">{brandName}</div>
          <div className="sidebar-brand-role">{userRole}</div>
        </div>
        {unreadCount > 0 && (
          <Link href="/dashboard/notifications" className="relative ms-auto flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-amber-500 hover:bg-slate-200 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          </Link>
        )}
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
        <div className="flex items-center justify-between gap-2 w-full mb-3">
          <Link href="/dashboard/profile" className="sidebar-user flex items-center gap-2 truncate hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer w-full" title="الملف الشخصي">
            <UserCircle2 className="h-4 w-4 text-sky-400 flex-shrink-0" />
            <span className="sidebar-user-name truncate font-medium text-sm">{userName}</span>
          </Link>
          <ThemeToggle />
        </div>
        <form action={signOutAction} className="w-full">
          <button type="submit" className="sidebar-logout w-full">
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
        <div className="mobile-brand flex items-center gap-2">
          {branchName || isGeneralManager ? (
            <BranchLogo branchName={brandName} className="w-6 h-6 rounded" />
          ) : (
            <CarFront className="h-5 w-5 text-sky-400" />
          )}
          <span>{brandName}</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="القائمة">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* ── Desktop sidebar ── */}
      <aside className="app-sidebar" aria-label="القائمة الجانبية">
        {sidebarContent}
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
        {sidebarContent}
      </aside>
    </>
  );
}
