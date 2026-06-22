import { ShieldAlert, ShieldCheck, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/format";

export default async function AuditPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select("role, full_name")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  const capabilities = getRoleCapabilities(profile?.role);
  
  // فقط المدير العام يمكنه رؤية هذه الصفحة
  if (!capabilities.isGeneralManager) {
    redirect("/dashboard/unauthorized");
  }

  // محاولة جلب السجلات (إذا كان الجدول موجوداً)
  let logs: any[] = [];
  let tableExists = true;
  
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, actor_name, actor_user_id")
      .order("created_at", { ascending: false })
      .limit(50);
      
    if (error) {
      tableExists = false;
    } else if (data) {
      logs = data;
    }
  } catch (err) {
    tableExists = false;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
          سجل التدقيق والمراقبة
        </h1>
      </div>

      {!tableExists ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-amber-900 mb-2">جدول audit_logs غير موجود</h2>
          <p className="text-amber-700 max-w-md mx-auto mb-4">
            يرجى تشغيل السكربت التالي في Supabase SQL Editor لإنشاء جدول المراقبة.
          </p>
          <pre className="text-left bg-slate-900 text-emerald-400 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr">
{`CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    actor_role VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255),
    entity_uuid UUID,
    legacy_entity_id VARCHAR(255),
    details JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`}
          </pre>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="text-slate-400 mb-2">لا توجد سجلات حتى الآن</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <table className="premium-table">
            <thead className="legacy-standard-head">
              <tr>
                <th>الموظف</th>
                <th>الحدث</th>
                <th>النوع</th>
                <th>التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <User className="h-4 w-4 text-slate-400" />
                      {log.actor_name ?? "مجهول"}
                    </div>
                  </td>
                  <td>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-700">
                      {log.action}
                    </span>
                  </td>
                  <td>{log.entity_type}</td>
                  <td className="text-emerald-700 font-semibold">{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
