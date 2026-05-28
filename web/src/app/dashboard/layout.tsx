import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Bell } from "lucide-react";

import { signOutAction } from "@/app/dashboard/actions";
import { ActionFeedbackModal } from "@/components/action-feedback-modal";
import { AgendaCenterClient } from "@/components/agenda-center-client";
import { SetupNotice } from "@/components/setup-notice";
import { SidebarNav } from "@/components/sidebar-nav";
import {
  getAgendaOverview,
  getCustomersDirectory,
  getDashboardContext,
  getDashboardOverview,
  getOperationalAlerts,
} from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/env";
import { getRoleCapabilities } from "@/lib/roles";

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
    <div className="app-layout">
      <SidebarNav
        userName={profile?.full_name ?? session?.user.email ?? "وضع الإعداد"}
        userRole={profile?.role ?? "لوحة التشغيل"}
        isManager={capabilities.isManager}
        isGeneralManager={capabilities.isGeneralManager}
        unreadCount={unreadCount}
        signOutAction={signOutAction}
      />

      <main className="app-main">
        <div className="app-content">
          <Suspense fallback={null}>
            <ActionFeedbackModal />
          </Suspense>
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
