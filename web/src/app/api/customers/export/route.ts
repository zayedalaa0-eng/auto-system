import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";

function normalize(v: string | null | undefined) { return (v ?? "").trim().toLowerCase(); }
function fmtD(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { data: profile } = await supabase
      .from("app_users").select("id, role, branch_id").eq("auth_user_id", session.user.id).maybeSingle();
    if (!profile) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const caps = getRoleCapabilities(profile.role);
    const sp = req.nextUrl.searchParams;
    const lifecycle = sp.get("lifecycle") ?? "all";
    const statusF   = sp.get("status")   ?? "";
    const qF        = normalize(sp.get("q") ?? "");

    let query = supabase
      .from("customers")
      .select("id, full_name, nickname, phone, address, status, operation_type, requested_car, next_follow_up_at, last_contact_at, visit_count, created_at, is_active, branch_id, assigned_user_id, metadata, branches(name), app_users(full_name)")
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (!caps.isGeneralManager && profile.branch_id) {
      query = query.eq("branch_id", profile.branch_id) as typeof query;
    }
    if (lifecycle === "active")  query = query.eq("is_active", true)  as typeof query;
    if (lifecycle === "closed")  query = query.eq("is_active", false) as typeof query;
    if (statusF) query = query.ilike("status", `%${statusF}%`) as typeof query;

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let items = (rows ?? []) as Array<Record<string, unknown>>;
    if (qF) {
      items = items.filter(i =>
        [i.full_name, i.phone, i.nickname, i.address].some(v =>
          normalize(v as string).includes(qF)
        )
      );
    }

    const data = items.map((i, idx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const br = (i as any).branches;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const au = (i as any).app_users;
      const branchName = Array.isArray(br) ? (br[0]?.name ?? "") : (br?.name ?? "");
      const staffName  = Array.isArray(au) ? (au[0]?.full_name ?? "") : (au?.full_name ?? "");
      const meta = (i.metadata ?? {}) as Record<string, unknown>;
      return {
        "#":                  idx + 1,
        "الاسم الكامل":       i.full_name ?? "",
        "الكنية":             i.nickname  ?? "",
        "الهاتف":             i.phone     ?? "",
        "المدينة / العنوان":  i.address   ?? "",
        "نوع العملية":        i.operation_type ?? "",
        "الحالة":             i.status    ?? "",
        "السيارة المطلوبة":  i.requested_car ?? "",
        "طريقة الدفع":        (meta.payment_method as string) ?? "",
        "قيمة الصفقة (₪)":   typeof meta.deal_value === "number" ? meta.deal_value : "",
        "موعد المتابعة":     fmtD(i.next_follow_up_at as string | null),
        "آخر تواصل":          fmtD(i.last_contact_at  as string | null),
        "عدد التفاعلات":      i.visit_count ?? 0,
        "تاريخ الإضافة":      fmtD(i.created_at as string | null),
        "الحالة العامة":      (i.is_active ? "نشط" : "مغلق"),
        "المعرض":             branchName,
        "الموظف المسؤول":     staffName,
      };
    });

    const stats = {
      total:    items.length,
      active:   items.filter(i => i.is_active).length,
      closed:   items.filter(i => !i.is_active).length,
      withFU:   items.filter(i => i.next_follow_up_at).length,
      totalDV:  items.reduce((s, i) => {
        const m = (i.metadata ?? {}) as Record<string, unknown>;
        return s + (typeof m.deal_value === "number" ? m.deal_value : 0);
      }, 0),
    };

    const lifecycleLabel = lifecycle === "active" ? "نشطون" : lifecycle === "closed" ? "مغلقون" : "الكل";
    return NextResponse.json({ data, stats, label: lifecycleLabel });
  } catch (err) {
    console.error("[customers/export]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
