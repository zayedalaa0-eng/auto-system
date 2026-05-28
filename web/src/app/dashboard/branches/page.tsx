import { redirect } from "next/navigation";
import { Building2, Plus, Phone } from "lucide-react";

import { createBranchAction } from "@/app/dashboard/actions";
import { BranchEditForm } from "@/components/branch-edit-form";
import { BranchToggleBtn } from "@/components/branch-toggle-btn";
import { getBranchesAdmin } from "@/lib/data";
import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "إدارة المعارض — نظام المعرض" };

const COUNTRY_PREFIXES = [
  { label: "السعودية +966", value: "+966" },
  { label: "الإمارات +971", value: "+971" },
  { label: "الكويت +965",  value: "+965" },
  { label: "قطر +974",     value: "+974" },
  { label: "البحرين +973", value: "+973" },
  { label: "عُمان +968",   value: "+968" },
  { label: "فلسطين +970",  value: "+970" },
  { label: "الأردن +962",  value: "+962" },
];

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // ── حماية الصفحة: المدير العام فقط ──────────────────────────────────────
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const { data: profile } = await supabase
    .from("app_users").select("role").eq("auth_user_id", session.user.id).maybeSingle();
  if (!getRoleCapabilities(profile?.role).isGeneralManager) redirect("/dashboard/unauthorized");

  const params = await searchParams;
  const notice = params.branch_notice ? decodeURIComponent(params.branch_notice) : null;
  const error  = params.branch_error  ? decodeURIComponent(params.branch_error)  : null;
  const editId = params.edit ?? null;

  const branches = await getBranchesAdmin();
  const editBranch = editId ? branches.find((b) => b.id === editId) : null;

  return (
    <div className="legacy-grid gap-6" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Building2 className="h-7 w-7 text-sky-600" />
        <div>
          <h4 className="m-0 text-2xl font-bold text-slate-800">إدارة المعارض</h4>
          <p className="m-0 text-sm text-slate-500">فتح وإغلاق المعارض وربط أرقام واتساب — المدير العام فقط</p>
        </div>
      </div>

      {/* ── Notices ── */}
      {notice && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800 font-medium">
          ✅ {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* ── إنشاء معرض جديد ── */}
      <form action={createBranchAction} className="legacy-card border-t-4 border-sky-500">
        <h5 className="mb-4 text-xl font-bold text-sky-700 flex items-center gap-2">
          <Plus className="h-5 w-5" />
          فتح معرض جديد
        </h5>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">اسم المعرض *</label>
            <input
              className="legacy-input"
              name="branch_name"
              placeholder="مثال: معرض النور — الرياض"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">المدينة</label>
            <input className="legacy-input" name="branch_city" placeholder="الرياض" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">العنوان</label>
            <input className="legacy-input" name="branch_address" placeholder="حي السلامة، شارع الملك فهد" />
          </div>
          {/* رقم واتساب */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              رقم واتساب المعرض
            </label>
            <div className="flex gap-2" dir="ltr">
              <select
                name="branch_whatsapp_prefix"
                className="legacy-select shrink-0"
                style={{ minWidth: "170px", maxWidth: "170px" }}
                defaultValue="+966"
              >
                {COUNTRY_PREFIXES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <input
                className="legacy-input flex-1"
                name="branch_whatsapp"
                placeholder="501234567"
                type="tel"
                dir="ltr"
              />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              يُستخدم لإرسال رسائل واتساب للزبائن مباشرة من ملف كل عميل.
            </p>
          </div>
        </div>
        <button className="legacy-btn legacy-btn-info mt-5 w-full sm:w-auto" type="submit">
          <Plus className="h-4 w-4" />
          إنشاء المعرض
        </button>
      </form>

      {/* ── قائمة المعارض ── */}
      <h5 className="mt-2 text-xl font-bold text-slate-700">
        المعارض الحالية ({branches.length})
      </h5>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {branches.length === 0 ? (
          <div className="col-span-3 text-center text-slate-400 py-12">لا توجد معارض مسجّلة بعد.</div>
        ) : (
          branches.map((branch) => {
            const isEditing = editId === branch.id;
            const waFull = branch.whatsapp_number
              ? `${(branch.whatsapp_prefix ?? "+966").replace("+", "")}${branch.whatsapp_number}`
              : null;

            return (
              <div
                key={branch.id}
                className={`legacy-card flex flex-col gap-4 border-t-4 ${
                  branch.is_active ? "border-emerald-500" : "border-slate-300 opacity-60"
                }`}
              >
                {/* ── Header Card ── */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="m-0 text-lg font-bold text-slate-900">{branch.name}</h5>
                    {branch.city && (
                      <div className="text-sm text-slate-500">📍 {branch.city}</div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      branch.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {branch.is_active ? "🟢 مفتوح" : "🔴 مغلق"}
                  </span>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-2xl font-bold text-sky-700">{branch.total_staff}</div>
                    <div className="text-xs font-bold text-slate-500">موظف</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-2xl font-bold text-emerald-700">{branch.total_customers}</div>
                    <div className="text-xs font-bold text-slate-500">عميل نشط</div>
                  </div>
                </div>

                {/* ── WhatsApp ── */}
                {waFull ? (
                  <a
                    href={`https://wa.me/${waFull}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{branch.whatsapp_prefix} {branch.whatsapp_number}</span>
                    <span className="text-xs text-emerald-500 mr-auto">← اختبار</span>
                  </a>
                ) : (
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                    ⚠️ لم يُضف رقم واتساب بعد
                  </div>
                )}

                {/* ── Edit Form (inline) ── */}
                {isEditing ? (
                  <BranchEditForm
                    branchId={branch.id}
                    defaultName={branch.name}
                    defaultCity={branch.city ?? ""}
                    defaultWhatsappPrefix={branch.whatsapp_prefix ?? "+966"}
                    defaultWhatsappNumber={branch.whatsapp_number ?? ""}
                  />
                ) : (
                  <a
                    href={`/dashboard/branches?edit=${branch.id}`}
                    className="legacy-btn border w-full text-center text-sm hover:bg-slate-50"
                  >
                    ✏️ تعديل البيانات
                  </a>
                )}

                {/* ── Toggle Status ── */}
                <BranchToggleBtn
                  branchId={branch.id}
                  branchName={branch.name}
                  isActive={branch.is_active}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
