import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CarFront, LayoutDashboard, LogOut, Settings2, Users } from "lucide-react";

import { SetupNotice } from "@/components/setup-notice";
import { hasSupabaseEnv } from "@/lib/env";
import { getDashboardContext } from "@/lib/data";
import { signOutAction } from "@/app/dashboard/actions";

const navigation = [
  { href: "/dashboard", label: "النظرة العامة", icon: LayoutDashboard },
  { href: "/dashboard/customers", label: "العملاء", icon: Users },
  { href: "/dashboard/inventory", label: "المخزون", icon: CarFront },
  { href: "/dashboard/setup", label: "الإعداد", icon: Settings2 },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const envReady = hasSupabaseEnv();
  const { session, profile } = await getDashboardContext();

  if (envReady && !session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="w-full rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Auto System</p>
              <h1 className="mt-2 text-2xl font-semibold">أوتو سيستم</h1>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <CarFront className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-white/5 p-4">
            <p className="text-sm text-slate-400">الحساب الحالي</p>
            <p className="mt-2 text-lg font-semibold">
              {profile?.full_name ?? session?.user.email ?? "وضع الإعداد"}
            </p>
            <p className="mt-1 text-sm text-slate-400">{profile?.role ?? "لم يتم ربط app_users بعد"}</p>
          </div>

          <nav className="mt-8 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-11 items-center gap-3 rounded-xl px-4 text-sm text-slate-200 transition hover:bg-white/10"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-white">
              <Bell className="h-4 w-4" />
              تذكير قصير
            </div>
            <p className="mt-2 leading-6 text-slate-400">
              نبني الآن أول نسخة تشغيلية. بعد الواجهة سنعود لترحيل البيانات القديمة بهدوء.
            </p>
          </div>

          <form action={signOutAction} className="mt-8">
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </button>
          </form>
        </aside>

        <main className="flex-1 space-y-6">
          {!envReady ? <SetupNotice /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
