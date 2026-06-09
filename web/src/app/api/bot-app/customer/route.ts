import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_BY_TYPE } from "@/lib/statuses";
import { getRoleCapabilities } from "@/lib/roles";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chat_id");
    const customerId = searchParams.get("id");

    if (!chatId || !customerId) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const admin = createAdminClient();

    // التحقق من المستخدم
    const { data: user } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("telegram_chat_id", chatId)
      .eq("is_active", true)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    // جلب بيانات العميل الكاملة
    const [customerRes, logsRes, tradeInsRes, attachmentsRes, inventoryRes, branchesRes] = await Promise.all([
      admin
        .from("customers")
        .select("id, full_name, phone, nickname, address, status, operation_type, requested_car, notes, branch_id, assigned_user_id, next_follow_up_at, created_at, is_active, metadata, visit_count, last_contact_at")
        .eq("id", customerId)
        .maybeSingle(),

      admin
        .from("customer_logs")
        .select("id, action, details, actor_name, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50),

      admin
        .from("trade_ins")
        .select("id, model, price, color, production_year, mileage, chassis_no, specs, inspection, license_expiry, status, deal_type, notes, metadata, is_active, updated_at")
        .eq("customer_id", customerId)
        .order("updated_at", { ascending: false })
        .limit(5),

      admin
        .from("customer_attachments")
        .select("id, file_name, file_category, public_url, mime_type, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),

      // سيارات المخزون المتاحة للربط (مشتري عند حجز/بيع)
      admin
        .from("inventory")
        .select("id, model, chassis_no, price, color, production_year, availability_status, deal_type, owner_name, condition_label")
        .eq("branch_id", user.branch_id ?? "")
        .not("availability_status", "in", '("مباعة","محجوزة","مسحوبة من المعرض")')
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(30),
      // أسماء المعارض للتصنيف
      admin.from("branches").select("name").eq("is_active", true),
    ]);

    if (!customerRes.data) {
      return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    }

    const customer = customerRes.data;

    // ── فحص صلاحية العرض ────────────────────────────────────────────────────────
    // الموظف والمدير لا يمكنهما رؤية عملاء معارض أخرى
    const caps = getRoleCapabilities(user.role, user.full_name);
    const canView =
      caps.isGeneralManager ||
      customer.branch_id === user.branch_id ||
      user.id === customer.assigned_user_id;

    if (!canView) {
      return NextResponse.json({ error: "غير مصرح بعرض هذا العميل" }, { status: 403 });
    }

    // ── جلب الدورات السابقة (ancestor chain) ──────────────────────────────────
    type AncestorInfo = { id: string; status: string; cycle_number: number };
    const ancestorInfos: AncestorInfo[] = [];
    const visitedIds = new Set<string>([customerId]);
    let traverseId: string | null = (customer as Record<string,unknown>).parent_customer_id as string | null ?? null;
    while (traverseId && !visitedIds.has(traverseId) && ancestorInfos.length < 8) {
      visitedIds.add(traverseId);
      const { data: anc } = await admin.from("customers")
        .select("id, status, cycle_number, parent_customer_id").eq("id", traverseId).maybeSingle();
      if (!anc) break;
      ancestorInfos.push({ id: anc.id, status: anc.status ?? "", cycle_number: (anc as Record<string,unknown>).cycle_number as number ?? 1 });
      traverseId = (anc as Record<string,unknown>).parent_customer_id as string | null;
    }
    let ancestorCycles: Array<{ id: string; status: string; cycle_number: number; logs: Array<{ id: string; action: string; details: string | null; actor_name: string; created_at: string }> }> = [];
    if (ancestorInfos.length > 0) {
      const { data: ancLogs } = await admin.from("customer_logs")
        .select("id, action, details, actor_name, created_at, customer_id")
        .in("customer_id", ancestorInfos.map(a => a.id))
        .order("created_at", { ascending: false });
      const logsByAnc = new Map<string, typeof ancestorCycles[0]["logs"]>();
      for (const row of ancLogs ?? []) {
        const arr = logsByAnc.get(row.customer_id) ?? [];
        arr.push({ id: row.id, action: row.action, details: row.details, actor_name: row.actor_name ?? "", created_at: row.created_at });
        logsByAnc.set(row.customer_id, arr);
      }
      ancestorCycles = ancestorInfos.map(a => ({ ...a, logs: logsByAnc.get(a.id) ?? [] }));
    }

    const isGeneralManager = caps.isGeneralManager;

    // جلب قائمة المعارض للمدير العام فقط
    let branches: { id: string; name: string }[] = [];
    if (isGeneralManager) {
      const { data: branchesData } = await admin
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      branches = branchesData ?? [];
    }

    // استخراج كود نوع العملية من metadata أو العمود
    const meta = (customer.metadata as Record<string, unknown> | null) ?? {};
    const opCode = (() => {
      const code = meta.operation_type_code;
      if (code === "sell_on_behalf" || code === "buyer_tradein_pending" || code === "buyer") return String(code);
      const col = String(customer.operation_type ?? "");
      if (col === "sell_on_behalf" || col === "بيع بالوكالة") return "sell_on_behalf";
      if (col === "buyer_tradein_pending" || col.includes("استبدال")) return "buyer_tradein_pending";
      return "buyer";
    })();

    // قائمة الحالات المناسبة لنوع العملية
    const statuses = STATUS_BY_TYPE[opCode as keyof typeof STATUS_BY_TYPE] ?? STATUS_BY_TYPE.buyer;

    // السيارة النشطة للاستبدال
    const activeTradeIn = (tradeInsRes.data ?? []).find(t => t.is_active) ?? (tradeInsRes.data ?? [])[0] ?? null;

    // الصور فقط (بدون الصوت)
    const photos = (attachmentsRes.data ?? []).filter(
      a => a.file_category !== "voice_note" && !a.mime_type?.startsWith("audio/")
    );

    // التسجيلات الصوتية (للسجل التاريخي فقط)
    const voiceNotes = (attachmentsRes.data ?? []).filter(
      a => a.file_category === "voice_note" || a.mime_type?.startsWith("audio/")
    );

    return NextResponse.json({
      customer: {
        ...customer,
        operation_type_code: opCode,
        cycle_number: (customer as Record<string,unknown>).cycle_number as number ?? 1,
        parent_customer_id: (customer as Record<string,unknown>).parent_customer_id as string | null ?? null,
      },
      statuses,
      logs: logsRes.data ?? [],
      tradeIn: activeTradeIn,
      allTradeIns: tradeInsRes.data ?? [],
      ancestorCycles,
      photos,
      voiceNotes,
      inventoryOptions: (() => {
        const branchNames = new Set((branchesRes.data ?? []).map(b => (b.name ?? "").trim().toLowerCase()));
        return (inventoryRes.data ?? []).map(i => {
          const owner = (i.owner_name ?? "").trim().toLowerCase();
          const isCustomer = Boolean(owner) && !branchNames.has(owner);
          return {
            id: i.id,
            // التسمية المختصرة: النوع — السنة — الحالة — اللون (الشاصي يُضاف في الواجهة عند الحجز/البيع)
            label: [i.model, i.production_year ? String(i.production_year) : null, i.condition_label, i.color]
              .filter(Boolean).join(" — "),
            model: i.model ?? "",
            chassis_no: i.chassis_no,
            availability_status: i.availability_status,
            category: isCustomer ? "customer" : "showroom",
          };
        });
      })(),
      canEdit:
        isGeneralManager ||
        customer.branch_id === user.branch_id ||
        user.id === customer.assigned_user_id,
      isManager: caps.isManager,
      isGeneralManager,
      branches,
    });
  } catch (err) {
    console.error("[bot-app/customer]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
