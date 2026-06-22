import { Metadata } from "next";
import { ProfileForm } from "./profile-form";
import { getDashboardContext } from "@/lib/data";

export const metadata: Metadata = {
  title: "الملف الشخصي",
};

export default async function ProfilePage() {
  const { profile, session } = await getDashboardContext();
  const userName = profile?.full_name ?? session?.user.email ?? "المستخدم";
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          الملف الشخصي
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          مرحباً {userName}، يمكنك إدارة إعدادات حسابك من هنا.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ProfileForm />
      </div>
    </div>
  );
}
