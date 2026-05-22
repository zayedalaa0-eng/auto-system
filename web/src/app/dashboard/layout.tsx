import { redirect } from "next/navigation";
import { Bell, CarFront, LogOut, UserCircle2 } from "lucide-react";

import { signOutAction } from "@/app/dashboard/actions";
import { ActionFeedbackModal } from "@/components/action-feedback-modal";
import { AgendaCenterClient } from "@/components/agenda-center-client";
import { NavLink } from "@/components/nav-link";
import { SetupNotice } from "@/components/setup-notice";
import {
  getAgendaOverview,
  getCustomersDirectory,
  getDashboardContext,
  getDashboardOverview,
  getOperationalAlerts,
} from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/env";
import { getRoleCapabilities } from "@/lib/roles";

const navigation = [
  { href: "/dashboard/customers/new", label: "إدخال عميل جديد", icon: "new-customer" as const },
  { href: "/dashboard/customers", label: "تقرير عملائي", icon: "customers-report" as const },
  { href: "/dashboard/search", label: "بحث المعرض", icon: "search" as const },
  { href: "/dashboard/inventory", label: "المخزون", icon: "inventory" as const },
  { href: "/dashboard/notifications", label: "التنبيهات", icon: "notifications" as const },
  { href: "/dashboard", label: "الإحصائيات", icon: "stats" as const, managerOnly: true },
  { href: "/dashboard/management", label: "تقرير الإدارة", icon: "management" as const, managerOnly: true },
  { href: "/dashboard/staff", label: "الموظفين", icon: "staff" as const, managerOnly: true },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const envReady = hasSupabaseEnv();
  const { session, profile } = await getDashboardContext();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);

  if (envReady && !session) redirect("/login");

  const [overview, agendaOverview, operationalAlerts, customers] = envReady
    ? await Promise.all([
        getDashboardOverview(),
        getAgendaOverview(),
        getOperationalAlerts(),
        getCustomersDirectory(250),
      ])
    : [null, null, null, []];

  const followupsCount = overview?.followUps.length ?? 0;
  const remindersCount = overview?.reminders.length ?? 0;
  const unreadCount = overview?.notifications.filter((item) => item.status === "unread").length ?? 0;
  const incompleteTradesCount = operationalAlerts?.incompleteTrades.length ?? 0;
  const licenseDueCount = operationalAlerts?.licenseDue.length ?? 0;
  const pendingEvaluation = customers.filter((customer) => {
    const statusText = customer.status ?? "";
    const requestedCarText = customer.requested_car ?? "";
    const isPending = statusText.includes("التقييم") || requestedCarText.includes("طلب خاص");
    if (!isPending) return false;
    if (capabilities.isManager) return true;
    return customer.assigned_user_id === profile?.id;
  });

  const hasAgendaItems =
    followupsCount > 0 ||
    remindersCount > 0 ||
    unreadCount > 0 ||
    incompleteTradesCount > 0 ||
    licenseDueCount > 0 ||
    pendingEvaluation.length > 0;

  return (
    <div>
      <nav className="legacy-navbar">
        <div className="legacy-container">
          <div className="legacy-navbar-row">
            <div className="legacy-brand">
              <CarFront className="h-5 w-5 text-sky-400" />
              أوتو سيستم
              <span className="legacy-role-badge">{profile?.role ?? "لوحة التشغيل"}</span>
            </div>

            <div className="legacy-nav">
              {navigation
                .filter((item) => !item.managerOnly || capabilities.isManager)
                .map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
                ))}
            </div>

            <div className="legacy-userbar">
              <span className="legacy-user-pill">
                <UserCircle2 className="me-1 inline h-4 w-4 text-sky-300" />
                {profile?.full_name ?? session?.user.email ?? "وضع الإعداد"}
              </span>
              <form action={signOutAction}>
                <button type="submit" className="legacy-logout-btn">
                  <LogOut className="me-1 inline h-4 w-4" />
                  تسجيل الخروج
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="legacy-main">
        <div className="legacy-container">
          <ActionFeedbackModal />
          {!envReady ? <SetupNotice /> : null}
          {envReady && session && !profile ? (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800">
              هذا الحساب مسجّل دخول لكنه غير مربوط بعد بسجل موظف داخل <code>app_users</code>.
            </div>
          ) : null}

          {hasAgendaItems && agendaOverview && operationalAlerts ? (
            <div className="agenda-alert">
              <div className="agenda-alert__summary">
                <div>
                  <h5 className="m-0 text-lg font-bold text-amber-900">
                    <Bell className="me-2 inline h-5 w-5 text-amber-500" />
                    أجندة العمل
                  </h5>
                  <span className="mt-1 block text-sm font-bold text-amber-900">
                    ({followupsCount}) عميل بانتظار التواصل | ({pendingEvaluation.length}) سيارة بانتظار التقييم | ({incompleteTradesCount}) سيارة استبدال تحتاج إكمال بيانات | ({licenseDueCount}) رخصة سيارة عميل تنتهي خلال أسبوع
                  </span>
                </div>
              </div>
              <AgendaCenterClient
                agenda={agendaOverview}
                incompleteTrades={operationalAlerts.incompleteTrades}
                licenseDue={operationalAlerts.licenseDue}
                pendingEvaluation={pendingEvaluation.map((customer) => ({
                  id: customer.id,
                  full_name: customer.full_name,
                  requested_car: customer.requested_car,
                  assigned_user_name: customer.assigned_user_name ?? null,
                  branch_name: customer.branch_name ?? null,
                }))}
                detailBasePath={capabilities.isManager ? "/dashboard/management" : "/dashboard/customers"}
              />
            </div>
          ) : null}

          {children}
        </div>
      </main>
    </div>
  );
}
