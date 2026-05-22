"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  ChartBar,
  ChartPie,
  FileSearch,
  List,
  UserPlus,
  UsersRound,
  Warehouse,
} from "lucide-react";

type NavLinkIcon =
  | "new-customer"
  | "customers-report"
  | "search"
  | "inventory"
  | "notifications"
  | "stats"
  | "management"
  | "staff";

type NavLinkProps = {
  href: string;
  label: string;
  icon: NavLinkIcon;
};

const icons = {
  "new-customer": UserPlus,
  "customers-report": List,
  search: FileSearch,
  inventory: Warehouse,
  notifications: Bell,
  stats: ChartBar,
  management: ChartPie,
  staff: UsersRound,
} as const;

export function NavLink({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href;
  const Icon = icons[icon];

  return (
    <Link href={href} className={clsx("legacy-nav-link", active && "active")}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
