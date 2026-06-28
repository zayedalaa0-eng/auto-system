import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities, type RoleCapabilities } from "@/lib/roles";
import { isClosedStatus } from "@/lib/statuses";
import { pushTelegramToManagers } from "./push";
import { escapeHtml } from "./api";

export type BotUser = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  branch_name: string | null;
  capabilities: RoleCapabilities;
};

type RelationOrArray<T> = T | T[] | null;

function unwrap<T>(rel: RelationOrArray<T>): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export async function getBotUser(chatId: string): Promise<BotUser | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_users")
    .select("id, full_name, role, branch_id, branches(name)")
    .eq("telegram_chat_id", chatId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchName = unwrap((data as any).branches as RelationOrArray<{ name: string }>)?.name ?? null;

  let role = data.role;
  let caps = getRoleCapabilities(data.role, data.full_name);

  // استثناء خاص لـ "رجائي الاشهب": في الويب مدير عام، ولكن في البوت مدير معرض فقط (فرع شيري)
  if (data.full_name.includes("رجائي الاشهب") || data.full_name.includes("رجائي الأشهب")) {
    role = "branch_manager";
    caps = { isGeneralManager: false, isManager: true };
  }

  return {
    id: data.id,
    full_name: data.full_name,
    role: role,
    branch_id: data.branch_id ?? null,
    branch_name: branchName,
    capabilities: caps,
  };
}

// ─── Scope helpers ──────────────────────────────────────────────────────────

function applyScope<Q extends { eq: (col: string, val: string) => Q }>(
  query: Q,
  user: BotUser,
) {
  if (!user.capabilities.isGeneralManager && user.branch_id) {
    query = query.eq("branch_id", user.branch_id);
  }
  if (!user.capabilities.isManager) {
    query = query.eq("assigned_user_id", user.id);
  }
  return query;
}

async function countQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  base: any,
  branchId: string | null,
  isGeneralManager: boolean,
): Promise<number> {
  const q = !isGeneralManager && branchId ? base.eq("branch_id", branchId) : base;
  const result = await q;
  return (result as { count: number | null }).count ?? 0;
}

// ─── Today / Agenda ─────────────────────────────────────────────────────────

function getLicenseAlertDays(licenseExpiry: string | null): number | null {
  if (!licenseExpiry) return null;
  const target = new Date(licenseExpiry);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return days <= 30 ? days : null;
}

function getTradeMissingFieldsCount(trade: {
  color?: string | null;
  production_year?: number | null;
  mileage?: number | null;
  inspection?: string | null;
  chassis_no?: string | null;
}): number {
  let missing = 0;
  if (!trade.color?.trim()) missing++;
  if (!trade.production_year || trade.production_year <= 0) missing++;
  if (!trade.mileage || trade.mileage <= 0) missing++;
  if (!trade.inspection?.trim()) missing++;
  if (!trade.chassis_no?.trim()) missing++;
  return missing;
}

export type AgendaData = {
  followupsToday: Array<{
    id: string; full_name: string; phone: string | null;
    status: string; requested_car: string | null; next_follow_up_at: string | null;
  }>;
  followupsOverdue: Array<{
    id: string; full_name: string; phone: string | null;
    status: string; requested_car: string | null; next_follow_up_at: string | null;
  }>;
  reminders: Array<{
    id: string; title: string | null; message: string | null;
    due_at: string | null; customer_name: string | null;
  }>;
  pendingEvaluations: Array<{
    id: string; customer_name: string; trade_in_model: string;
    trade_in_status: string | null; photo_count: number;
  }>;
  incompleteTrades: Array<{
    id: string; customer_name: string; trade_in_model: string; missing_count: number;
  }>;
  licenseDue: Array<{
    id: string; customer_name: string; trade_in_model: string; days: number;
  }>;
};

export async function getAgendaData(user: BotUser): Promise<AgendaData> {
  const admin = createAdminClient();

  // حدود اليوم بتوقيت إسرائيل/فلسطين (UTC+3)
  // السيرفر يعمل بـ UTC، لذا نحسب بداية/نهاية اليوم بتوقيتنا المحلي
  const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3
  const localNow = new Date(Date.now() + TZ_OFFSET_MS);
  const todayStr = localNow.toISOString().slice(0, 10); // "2026-05-30"
  // منتصف الليل بتوقيت UTC+3 → UTC
  const todayStartMs = new Date(todayStr + "T00:00:00.000Z").getTime() - TZ_OFFSET_MS;
  const todayEndMs   = new Date(todayStr + "T23:59:59.999Z").getTime() - TZ_OFFSET_MS;
  const todayStartIso = new Date(todayStartMs).toISOString();
  const todayEndIso   = new Date(todayEndMs).toISOString();

  const isGM = user.capabilities.isGeneralManager;
  const isMgr = user.capabilities.isManager;
  const branchId = user.branch_id;

  // ── قائمة الحالات المغلقة (توافق مع الويب) ─────────────────────────────
  const CLOSED_STATUSES = [
    "تمت عملية البيع", "شراء من قبل المعرض", "رفض من قبل العميل",
    "رفض من قبل المعرض", "تراجع العميل عن الاستبدال",
    "سحب السيارة من البيع", "إغلاق الملف",
    "بيع السيارة لعميل خارجي", "تراجع",
  ];

  // ── استعلام واحد لجميع المتابعات (اليوم + المتأخرة) ────────────────────
  // مثل الويب: جميع العملاء النشطين الذين حان موعد متابعتهم اليوم أو قبله
  let followupsAllQ = admin.from("customers")
    .select("id, full_name, phone, status, requested_car, next_follow_up_at")
    .eq("is_active", true)
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", todayEndIso)
    .order("next_follow_up_at", { ascending: true })
    .limit(40);

  let remindersQ = admin.from("reminders")
    .select("id, title, message, due_at, customers(full_name)")
    .eq("status", "pending")
    .lte("due_at", todayEndIso)
    .order("due_at", { ascending: true })
    .limit(10);

  let evaluationsQ = admin.from("customers")
    .select("id, full_name, trade_ins(id, model, status, price)")
    .eq("is_active", true)
    .limit(100);

  let tradesDataQ = admin.from("customers")
    .select("id, full_name, trade_ins(id, model, status, color, production_year, mileage, inspection, chassis_no, license_expiry, is_active, price)")
    .eq("is_active", true)
    .limit(100);

  // Apply scope
  if (!isGM && branchId) {
    followupsAllQ  = followupsAllQ.eq("branch_id", branchId)   as typeof followupsAllQ;
    remindersQ     = remindersQ.eq("branch_id", branchId)       as typeof remindersQ;
    evaluationsQ   = evaluationsQ.eq("branch_id", branchId)     as typeof evaluationsQ;
    tradesDataQ    = tradesDataQ.eq("branch_id", branchId)      as typeof tradesDataQ;
  }
  if (!isMgr) {
    followupsAllQ  = followupsAllQ.eq("assigned_user_id", user.id)  as typeof followupsAllQ;
    remindersQ     = remindersQ.eq("assigned_user_id", user.id)     as typeof remindersQ;
    evaluationsQ   = evaluationsQ.eq("assigned_user_id", user.id)   as typeof evaluationsQ;
    tradesDataQ    = tradesDataQ.eq("assigned_user_id", user.id)    as typeof tradesDataQ;
  }

  const [
    { data: fAllRows },
    { data: remindersRows },
    { data: evalRows },
    { data: tradesRows },
  ] = await Promise.all([
    followupsAllQ,
    remindersQ,
    evaluationsQ,
    tradesDataQ,
  ]);

  // ── تقسيم المتابعات: اليوم vs المتأخرة (مثل الويب) ──────────────────────
  // - اليوم: موعد المتابعة في نطاق اليوم الحالي (من بداية اليوم حتى نهايته)
  // - متأخرة: موعد المتابعة قبل بداية اليوم (أيام سابقة فعلاً)
  const fTodayRows = (fAllRows ?? []).filter((c) => {
    if (!c.next_follow_up_at) return false;
    const t = new Date(c.next_follow_up_at).getTime();
    return t >= todayStartMs && t <= todayEndMs; // ضمن اليوم الحالي بتوقيت UTC+3
  });
  const fOverdueRows = (fAllRows ?? []).filter((c) => {
    if (!c.next_follow_up_at) return false;
    if (CLOSED_STATUSES.some((s) => (c.status ?? "").includes(s))) return false;
    const t = new Date(c.next_follow_up_at).getTime();
    return t < todayStartMs; // قبل بداية اليوم بتوقيت UTC+3
  });

  // ── Process evaluations ──────────────────────────────────────────────────
  const pendingEvaluations: AgendaData["pendingEvaluations"] = [];
  for (const c of evalRows ?? []) {
    const trades = Array.isArray(c.trade_ins) ? c.trade_ins : (c.trade_ins ? [c.trade_ins] : []);
    for (const t of trades) {
      if (!t?.id) continue;
      const price = (t as { price?: number | null }).price;
      if (price != null && price > 0) continue; // already evaluated
      pendingEvaluations.push({
        id: c.id,
        customer_name: c.full_name,
        trade_in_model: (t as { model?: string }).model ?? "—",
        trade_in_status: (t as { status?: string | null }).status ?? null,
        photo_count: 0,
      });
    }
  }

  // ── Process incomplete trades & license due ──────────────────────────────
  const incompleteTrades: AgendaData["incompleteTrades"] = [];
  const licenseDue: AgendaData["licenseDue"] = [];
  const CLOSED_KEYWORDS = ["رفض", "تراجع", "بيع السيارة لعميل خارجي"];

  for (const c of tradesRows ?? []) {
    const trades = Array.isArray(c.trade_ins) ? c.trade_ins : (c.trade_ins ? [c.trade_ins] : []);
    for (const t of trades) {
      if (!t?.id) continue;
      const trade = t as {
        id: string; model?: string; status?: string | null; color?: string | null;
        production_year?: number | null; mileage?: number | null; inspection?: string | null;
        chassis_no?: string | null; license_expiry?: string | null; is_active?: boolean;
        price?: number | null;
      };
      const isActive = Boolean(trade.is_active);
      const tradeStatus = (trade.status ?? "").trim();
      const isClosed = CLOSED_KEYWORDS.some((kw) => tradeStatus.includes(kw));

      if (isActive && !isClosed) {
        const missingCount = getTradeMissingFieldsCount(trade);
        if (missingCount > 0) {
          incompleteTrades.push({
            id: c.id,
            customer_name: c.full_name,
            trade_in_model: trade.model ?? "—",
            missing_count: missingCount,
          });
        }
      }

      const days = getLicenseAlertDays(trade.license_expiry ?? null);
      if (days !== null) {
        licenseDue.push({
          id: c.id,
          customer_name: c.full_name,
          trade_in_model: trade.model ?? "—",
          days,
        });
      }
    }
  }

  return {
    followupsToday: (fTodayRows ?? []).map((c) => ({
      id: c.id, full_name: c.full_name, phone: c.phone,
      status: c.status, requested_car: c.requested_car,
      next_follow_up_at: c.next_follow_up_at,
    })),
    followupsOverdue: (fOverdueRows ?? []).map((c) => ({
      id: c.id, full_name: c.full_name, phone: c.phone,
      status: c.status, requested_car: c.requested_car,
      next_follow_up_at: c.next_follow_up_at,
    })),
    reminders: (remindersRows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      due_at: r.due_at,
      customer_name: unwrap(r.customers as RelationOrArray<{ full_name: string }>)?.full_name ?? null,
    })),
    pendingEvaluations,
    incompleteTrades,
    licenseDue,
  };
}

// ─── Pending Evaluations (for Maalam manager) ────────────────────────────────

export type PendingEvalItem = {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  branch_name: string | null;
  staff_name: string | null;
  staff_user_id: string | null;
  staff_chat_id: string | null;
  trade_in_id: string;
  model: string;
  color: string | null;
  production_year: number | null;
  mileage: number | null;
  chassis_no: string | null;
  inspection: string | null;
  specs: string | null;
  status: string | null;
  notes: string | null;
  photo_urls: string[]; // signed URLs
};

export async function getAllPendingEvaluations(): Promise<PendingEvalItem[]> {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin
    .from("trade_ins")
    .select(
      "id, model, color, production_year, mileage, chassis_no, inspection, specs, status, price, " +
      "customers(id, full_name, phone, branch_id, assigned_user_id, branches(name), app_users(full_name, telegram_chat_id))"
    )
    .is("price", null)
    .eq("is_active", true)
    .not("status", "ilike", "%رفض%")
    .not("status", "ilike", "%تراجع%")
    .order("created_at", { ascending: false })
    .limit(50) as unknown as Promise<{ data: any[] | null }>);

  const results: PendingEvalItem[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (data ?? []) as any[]) {
    const cust = unwrap(t.customers as RelationOrArray<{
      id: string; full_name: string; phone: string | null; branch_id: string | null;
      assigned_user_id: string | null;
      branches: { name: string } | Array<{ name: string }> | null;
      app_users: { full_name: string; telegram_chat_id: string | null } | Array<{ full_name: string; telegram_chat_id: string | null }> | null;
    }>);
    if (!cust) continue;
    const branchName = unwrap(cust.branches as RelationOrArray<{ name: string }>)?.name ?? null;
    const staffUser = unwrap(cust.app_users as RelationOrArray<{ full_name: string; id?: string; telegram_chat_id: string | null }>);

    // جلب الصور الخاصة بهذا العميل (trade photos)
    const photoUrls: string[] = [];
    try {
      const { data: photos } = await admin
        .from("customer_attachments")
        .select("public_url, storage_path")
        .eq("customer_id", cust.id)
        .in("file_category", ["trade_photo", "trade_files_photos", "trade_inspection"])
        .order("created_at", { ascending: true })
        .limit(10);

      for (const p of photos ?? []) {
        let url = p.public_url as string | null;
        if (!url && p.storage_path) {
          // إنشاء رابط موقَّع لمدة ساعة
          const storagePath = (p.storage_path as string).replace(/^customer-attachments\//, "");
          const { data: signed } = await admin.storage
            .from("customer-attachments")
            .createSignedUrl(storagePath, 3600);
          url = signed?.signedUrl ?? null;
        }
        if (url) photoUrls.push(url);
      }
    } catch { /* best-effort */ }

    results.push({
      customer_id: cust.id,
      customer_name: cust.full_name,
      customer_phone: cust.phone,
      branch_name: branchName,
      staff_name: staffUser?.full_name ?? null,
      staff_user_id: cust.assigned_user_id ?? null,
      staff_chat_id: staffUser?.telegram_chat_id ?? null,
      trade_in_id: t.id,
      model: t.model ?? "—",
      color: t.color ?? null,
      production_year: t.production_year ?? null,
      mileage: t.mileage ?? null,
      chassis_no: t.chassis_no ?? null,
      inspection: t.inspection ?? null,
      specs: t.specs ?? null,
      status: t.status ?? null,
      notes: t.notes ?? null,
      photo_urls: photoUrls,
    });
  }
  return results;
}

/** هل المستخدم مدير معرض لمعلم؟ */
export async function isMaalamManager(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("app_users")
    .select("role, branch_id, full_name, branches(name)")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!user) return false;
  const caps = getRoleCapabilities(user.role, user.full_name);
  if (!caps.isManager || caps.isGeneralManager) return false;
  const branchName = unwrap(user.branches as RelationOrArray<{ name: string }>)?.name ?? "";
  return branchName.includes("لمعلم");
}

// Keep old getTodayTasks for backward compat (used internally)
export async function getTodayTasks(user: BotUser) {
  const agenda = await getAgendaData(user);
  return {
    reminders: agenda.reminders,
    followups: agenda.followupsToday,
  };
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function getMyCustomers(user: BotUser) {
  const admin = createAdminClient();

  let query = admin
    .from("customers")
    .select("id, full_name, phone, status, requested_car, next_follow_up_at, branches(name)")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (!user.capabilities.isGeneralManager && user.branch_id) {
    query = query.eq("branch_id", user.branch_id) as typeof query;
  }
  if (!user.capabilities.isManager) {
    query = query.eq("assigned_user_id", user.id) as typeof query;
  }

  const { data } = await query;
  return (data ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    status: c.status,
    requested_car: c.requested_car,
    next_follow_up_at: c.next_follow_up_at,
    branch_name: unwrap(c.branches as RelationOrArray<{ name: string }>)?.name ?? null,
  }));
}

export async function searchCustomers(user: BotUser, searchQuery: string) {
  const admin = createAdminClient();
  const like = `%${searchQuery.replace(/[%_]/g, " ")}%`;

  let query = admin
    .from("customers")
    .select("id, full_name, phone, status, requested_car, branches(name)")
    .or(`full_name.ilike.${like},phone.ilike.${like},requested_car.ilike.${like}`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (!user.capabilities.isGeneralManager && user.branch_id) {
    query = query.eq("branch_id", user.branch_id) as typeof query;
  }
  if (!user.capabilities.isManager) {
    query = query.eq("assigned_user_id", user.id) as typeof query;
  }

  const { data } = await query;
  return (data ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    status: c.status,
    requested_car: c.requested_car,
    branch_name: unwrap(c.branches as RelationOrArray<{ name: string }>)?.name ?? null,
  }));
}


// ─── Phone check ────────────────────────────────────────────────────────────

export async function checkPhoneExists(phone: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id, full_name, status, requested_car, is_active")
    .eq("phone", phone)
    .order("is_active", { ascending: false }) // الملفات النشطة أولاً
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// ─── Branches ────────────────────────────────────────────────────────────────

export async function getBranches() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((b) => ({ id: b.id, name: b.name }));
}

export async function createCustomer(
  user: BotUser,
  data: {
    full_name: string;
    phone: string;
    nickname?: string | null;
    operation_type: string;
    status: string;
    requested_car?: string | null;
    trade_in_model?: string | null;
    payment_method?: string | null;
    notes?: string | null;
    next_follow_up_at?: string | null;
    branch_id?: string | null;
  },
) {
  const admin = createAdminClient();
  const branchId = data.branch_id ?? user.branch_id ?? null;

  // الحالة الافتتاحية تتبع نوع العملية إذا لم يُحدد حالة صريحة
  const defaultStatus =
    data.operation_type === "sell_on_behalf"        ? "عرض سيارة للبيع" :
    data.operation_type === "buyer_tradein_pending" ? "استبدال — تحت التقييم" :
    "جديد";
  const resolvedStatus = (data.status && data.status !== "جديد") ? data.status : defaultStatus;
  const isClosed = isClosedStatus(resolvedStatus);

  const opLabel =
    data.operation_type === "buyer" ? "مشتري" :
    data.operation_type === "buyer_tradein_pending" ? "مشتري + استبدال" :
    data.operation_type === "sell_on_behalf" ? "بيع بالوكالة" :
    data.operation_type;

  const { data: inserted, error } = await admin.from("customers").insert({
    full_name: data.full_name,
    phone: data.phone,
    nickname: data.nickname ?? null,
    status: resolvedStatus,
    requested_car: data.requested_car ?? null,
    notes: data.notes ?? null,
    next_follow_up_at: data.next_follow_up_at ?? null,
    branch_id: branchId,
    assigned_user_id: user.id,
    is_active: !isClosed,
    // نُخزّن التسمية العربية في العمود (مطابق لمسار الويب) + الكود الإنجليزي في metadata
    operation_type: opLabel,
    metadata: {
      operation_type_code: data.operation_type,
      operation_type: opLabel,
      source: "telegram_bot",
      ...(data.payment_method ? { payment_method: data.payment_method } : {}),
    },
  }).select("id").maybeSingle();

  // Create trade_ins record if applicable
  if (!error && inserted?.id && data.trade_in_model &&
    (data.operation_type === "buyer_tradein_pending" || data.operation_type === "sell_on_behalf")) {
    await admin.from("trade_ins").insert({
      customer_id: inserted.id,
      branch_id: branchId,
      owner_name: data.full_name,
      model: data.trade_in_model.trim(),
      status: data.operation_type === "sell_on_behalf" ? "برسم البيع" : "استبدال (بانتظار التقييم)",
      condition_label: "مستعملة",
      deal_type: data.operation_type === "sell_on_behalf" ? "بيع بالوكالة" : "استبدال",
      is_active: true,
      metadata: { source: "telegram_bot" },
    });

    // إضافة سجل في المخزون لعمليات بيع بالوكالة
    if (data.operation_type === "sell_on_behalf") {
      const { error: invErr } = await admin.from("inventory").insert({
        branch_id: branchId,
        source_customer_id: inserted.id,
        model: data.trade_in_model.trim(),
        owner_name: data.full_name,
        deal_type: "برسم البيع",
        condition_label: "مستعملة",
        availability_status: "متوفرة",
        is_active: true,
        metadata: { source: "telegram_bot" },
      });
      if (invErr) console.error("[createCustomer] inventory insert failed:", invErr.message);
    }
  }

  if (!error && inserted?.id) {
    const opCode = data.operation_type;
    let icon = "🛒"; let opTitle = "مشتري جديد";
    if (opCode === "buyer_tradein_pending") { icon = "🔄"; opTitle = "مشتري جديد — مع استبدال"; }
    else if (opCode === "sell_on_behalf")   { icon = "🤝"; opTitle = "سيارة برسم البيع — جديد"; }

    let msg =
      `${icon} <b>${opTitle}</b>\n\n` +
      `👤 <b>بيانات العميل:</b>\n` +
      `<blockquote><b>الاسم:</b> ${escapeHtml(data.full_name)}\n` +
      `<b>الهاتف:</b> <code>${escapeHtml(data.phone)}</code>\n`;
    if (opCode === "buyer_tradein_pending") {
      if (data.requested_car)  msg += `<b>السيارة المطلوبة:</b> ${escapeHtml(data.requested_car)}\n`;
      if (data.trade_in_model) msg += `<b>سيارة الاستبدال:</b> ${escapeHtml(data.trade_in_model)}\n`;
    } else if (opCode === "sell_on_behalf") {
      if (data.trade_in_model) msg += `<b>سيارة برسم البيع:</b> ${escapeHtml(data.trade_in_model)}\n`;
    } else {
      if (data.requested_car)  msg += `<b>السيارة المطلوبة:</b> ${escapeHtml(data.requested_car)}\n`;
    }
    msg += `<b>الحالة:</b> ${escapeHtml(resolvedStatus)}\n`;
    if (data.next_follow_up_at) {
      try {
        const d = new Date(data.next_follow_up_at).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
        msg += `<b>موعد المتابعة:</b> ${d}\n`;
      } catch { /* ignore */ }
    }
    msg = msg.trim() + `</blockquote>\n\n`;
    msg += `👨‍💼 <b>الموظف المسؤول:</b> ${escapeHtml(user.full_name)}`;

    void pushTelegramToManagers({
      branchId,
      customerId: inserted.id,
      title: opTitle,
      message: msg,
    });
  }

  return { error };
}

// ─── Inventory ──────────────────────────────────────────────────────────────

export async function getInventory(user: BotUser) {
  const admin = createAdminClient();

  const [invResult, branchesResult] = await Promise.all([
    (() => {
      let query = admin
        .from("inventory")
        .select("id, model, production_year, color, price, availability_status, deal_type, condition_label, owner_name, source_customer_id, branches(name)")
        .eq("is_active", true)
        .order("availability_status", { ascending: true })
        .order("model", { ascending: true })
        .limit(100);

      if (!user.capabilities.isGeneralManager && user.branch_id) {
        query = query.eq("branch_id", user.branch_id) as typeof query;
      }
      return query;
    })(),
    admin.from("branches").select("name").eq("is_active", true)
  ]);

  const branchNamesSet = new Set(
    (branchesResult.data ?? [])
      .map(b => (b.name ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  const items = (invResult.data ?? []).map((c) => ({
    id: c.id,
    model: c.model,
    production_year: c.production_year,
    color: c.color,
    price: c.price,
    availability_status: c.availability_status,
    deal_type: c.deal_type,
    condition_label: c.condition_label,
    owner_name: c.owner_name,
    source_customer_id: c.source_customer_id,
    branch_name: unwrap(c.branches as RelationOrArray<{ name: string }>)?.name ?? null,
  }));

  return { items, branchNamesSet };
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function getNotifications(user: BotUser) {
  const admin = createAdminClient();

  let query = admin
    .from("notifications")
    .select("id, title, message, status, notification_type, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  if (!user.capabilities.isGeneralManager) {
    query = query.eq("recipient_user_id", user.id) as typeof query;
  }

  const { data } = await query;
  return (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    status: n.status,
    notification_type: n.notification_type,
    created_at: n.created_at,
  }));
}

export async function markNotificationsRead(user: BotUser) {
  const admin = createAdminClient();

  let query = admin
    .from("notifications")
    .update({ status: "read" })
    .eq("status", "unread");

  if (!user.capabilities.isGeneralManager) {
    query = query.eq("recipient_user_id", user.id) as typeof query;
  }

  await query;
}

// ─── Staff ──────────────────────────────────────────────────────────────────

export async function getStaffList(user: BotUser) {
  const admin = createAdminClient();

  let query = admin
    .from("app_users")
    .select("id, full_name, role, branch_id, is_active, branches(name)")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (!user.capabilities.isGeneralManager && user.branch_id) {
    query = query.eq("branch_id", user.branch_id) as typeof query;
  }

  const { data } = await query;
  return (data ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    role: u.role,
    branch_name: unwrap(u.branches as RelationOrArray<{ name: string }>)?.name ?? null,
  }));
}

export async function sendMessageToStaff(
  fromUser: BotUser,
  recipientId: string,
  message: string,
) {
  const admin = createAdminClient();

  // Get recipient telegram_chat_id
  const { data: recipient } = await admin
    .from("app_users")
    .select("telegram_chat_id, full_name")
    .eq("id", recipientId)
    .maybeSingle();

  // Insert notification in DB
  await admin.from("notifications").insert({
    recipient_user_id: recipientId,
    title: `رسالة من ${fromUser.full_name}`,
    message,
    notification_type: "message",
    status: "unread",
  });

  return { telegram_chat_id: recipient?.telegram_chat_id ?? null };
}

// ─── Reports ────────────────────────────────────────────────────────────────

export async function getBranchReport(user: BotUser) {
  const admin = createAdminClient();
  const _TZ = 3 * 60 * 60 * 1000;
  const _localNow = new Date(Date.now() + _TZ);
  const _todayStr = _localNow.toISOString().slice(0, 10);
  const todayEndIso = new Date(new Date(_todayStr + "T23:59:59.999Z").getTime() - _TZ).toISOString();
  const nowIso = new Date().toISOString();
  const { isGeneralManager } = user.capabilities;
  const branchId = user.branch_id;

  const [activeCustomers, availableInventory, todayFollowups, overdueFollowups] = await Promise.all([
    countQuery(
      admin.from("customers").select("*", { count: "exact", head: true }).eq("is_active", true),
      branchId,
      isGeneralManager,
    ),
    countQuery(
      admin.from("inventory").select("*", { count: "exact", head: true }).eq("availability_status", "متوفرة"),
      branchId,
      isGeneralManager,
    ),
    countQuery(
      admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .not("next_follow_up_at", "is", null)
        .lte("next_follow_up_at", todayEndIso)
        .or("status.ilike.%متابعة%,status.ilike.%حجز%"),
      branchId,
      isGeneralManager,
    ),
    countQuery(
      admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .not("next_follow_up_at", "is", null)
        .lt("next_follow_up_at", nowIso)
        .or("status.ilike.%متابعة%,status.ilike.%حجز%"),
      branchId,
      isGeneralManager,
    ),
  ]);

  return { activeCustomers, availableInventory, todayFollowups, overdueFollowups };
}

export async function getGeneralManagerReport() {
  const admin = createAdminClient();
  const _TZ2 = 3 * 60 * 60 * 1000;
  const _localNow2 = new Date(Date.now() + _TZ2);
  const _todayStr2 = _localNow2.toISOString().slice(0, 10);
  const todayEndIso = new Date(new Date(_todayStr2 + "T23:59:59.999Z").getTime() - _TZ2).toISOString();
  const nowIso = new Date().toISOString();

  const [
    { data: branches },
    { count: totalCustomers },
    { count: totalInventory },
    { count: todayFollowups },
    { count: overdueFollowups },
    { count: unreadNotifications },
  ] = await Promise.all([
    admin
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    admin.from("customers").select("*", { count: "exact", head: true }).eq("is_active", true),
    admin.from("inventory").select("*", { count: "exact", head: true }).eq("availability_status", "متوفرة"),
    admin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", todayEndIso)
      .or("status.ilike.%متابعة%,status.ilike.%حجز%"),
    admin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", nowIso)
      .or("status.ilike.%متابعة%,status.ilike.%حجز%"),
    admin.from("notifications").select("*", { count: "exact", head: true }).eq("status", "unread"),
  ]);

  const branchIds = (branches ?? []).map((b) => b.id);
  const branchStats: Array<{ name: string; customers: number; inventory: number }> = [];

  if (branchIds.length > 0) {
    const [{ data: custRows }, { data: invRows }] = await Promise.all([
      admin.from("customers").select("branch_id").eq("is_active", true).in("branch_id", branchIds),
      admin.from("inventory").select("branch_id").eq("availability_status", "متوفرة").in("branch_id", branchIds),
    ]);

    const custMap = new Map<string, number>();
    const invMap = new Map<string, number>();
    for (const r of custRows ?? []) {
      const bid = String(r.branch_id ?? "");
      custMap.set(bid, (custMap.get(bid) ?? 0) + 1);
    }
    for (const r of invRows ?? []) {
      const bid = String(r.branch_id ?? "");
      invMap.set(bid, (invMap.get(bid) ?? 0) + 1);
    }

    for (const b of branches ?? []) {
      branchStats.push({
        name: b.name,
        customers: custMap.get(b.id) ?? 0,
        inventory: invMap.get(b.id) ?? 0,
      });
    }
  }

  return {
    totalCustomers: totalCustomers ?? 0,
    totalInventory: totalInventory ?? 0,
    todayFollowups: todayFollowups ?? 0,
    overdueFollowups: overdueFollowups ?? 0,
    unreadNotifications: unreadNotifications ?? 0,
    branchStats,
  };
}
