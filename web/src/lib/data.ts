import { hasSupabaseEnv } from "@/lib/env";
import { getRoleCapabilities, type RoleCapabilities } from "@/lib/roles";
import {
  ALL_CUSTOMER_STATUSES,
  isClosedStatus,
  STATUSES_BUYER,
  STATUSES_BUYER_TRADEIN,
  STATUSES_SELL_ON_BEHALF,
  STATUS_BY_TYPE,
} from "@/lib/statuses";
import { createAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// إعادة تصدير لـ backward compatibility
export { isClosedStatus, STATUSES_BUYER, STATUSES_BUYER_TRADEIN, STATUSES_SELL_ON_BEHALF };

export type DashboardProfile = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  branch_name?: string | null;
};

export type DashboardMetric = {
  label: string;
  value: number;
  hint: string;
  tone: "sky" | "emerald" | "amber" | "rose";
};

export type CustomerItem = {
  id: string;
  full_name: string;
  nickname?: string | null;
  phone: string;
  operation_type?: string | null;
  requested_car: string | null;
  requested_car_report?: string | null;
  sale_offer_car?: string | null;
  payment_plan?: string | null;
  status: string;
  next_follow_up_at: string | null;
  branch_name: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  branch_id?: string | null;
  source?: string | null;
  is_active?: boolean;
  last_contact_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  visit_count?: number;
  /** معرّف سيارة المخزون المرتبطة (للمشترين عند حجز/بيع) */
  selected_inventory_id?: string | null;
  /** حالة سيارة العميل في المخزون (محجوزة / مباعة / متوفرة / مسحوبة) */
  inventory_availability?: string | null;
  /** حالة كل سيارة مطلوبة على حدة — مفتاح: اسم السيارة المُطبَّع، قيمة: حالة التوفر */
  inventory_availability_by_car?: Record<string, string>;
  /** حالة سيارة العميل (trade_in) — للعرض في عمود الحالة */
  trade_in_status?: string | null;
  /** سعر التقييم (trade_in) — يظهر بانتظار التقييم إذا كان فارغاً */
  trade_in_price?: number | null;
  /** موديل سيارة الاستبدال (buyer_tradein) أو سيارة العميل (sell_on_behalf) */
  trade_in_model?: string | null;
  /** طريقة الدفع من metadata.payment_method */
  payment_method?: string | null;
};

export type InventoryItem = {
  id: string;
  model: string;
  owner_name: string | null;
  deal_type?: string | null;
  chassis_no?: string | null;
  condition_label?: string | null;
  availability_status: string;
  price: number | null;
  production_year: number | null;
  color: string | null;
  gearbox?: string | null;
  fuel_type?: string | null;
  mileage?: number | null;
  specs?: string | null;
  inspection?: string | null;
  photo_urls?: string[];
  source_customer_id?: string | null;
  branch_name: string | null;
  branch_id?: string | null;
  /** الموظف الذي أدخل العميل المرتبط بالسيارة (عبر source_customer_id) */
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
};

export type InventoryCarAttachment = {
  url: string;
  fileName: string | null;
  mimeType: string | null;
  category: string | null;
  isImage: boolean;
};

export type StatusBreakdownItem = {
  label: string;
  count: number;
};

export type BranchSnapshot = {
  branch_name: string;
  customers: number;
  inventory: number;
};

export type NotificationItem = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  recipient_label: string | null;
};

export type ReminderItem = {
  id: string;
  title: string | null;
  message: string | null;
  due_at: string | null;
  status: string;
  branch_name: string | null;
  customer_name: string | null;
  assigned_user_name: string | null;
  assigned_user_id: string | null;
  branch_id: string | null;
};

export type DashboardOverview = {
  metrics: DashboardMetric[];
  customerStatus: StatusBreakdownItem[];
  inventoryStatus: StatusBreakdownItem[];
  branches: BranchSnapshot[];
  notifications: NotificationItem[];
  reminders: ReminderItem[];
  followUps: CustomerItem[];
  recentCustomers: CustomerItem[];
  recentInventory: InventoryItem[];
  unavailableRequests: CustomerItem[];
};

export type NotificationsCenterItem = {
  id: string;
  title: string | null;
  message: string;
  status: string;
  notification_type: string | null;
  payload?: Record<string, unknown> | null;
  recipient_label: string | null;
  created_at: string;
};

export type StaffOverviewItem = {
  id: string;
  full_name: string;
  role: string;
  status: string;
  is_active: boolean;
  branch_name: string | null;
  branch_id: string | null;
  telegram_chat_id: string | null;
  total_customers: number;
  total_sales: number;
  open_followups: number;
};

export type AgendaTaskItem = {
  id: string;
  source: "reminder" | "followup" | "notification";
  label: string;
  customer_id: string | null;
  customer_name: string | null;
  branch_name: string | null;
  staff_name: string | null;
  status: string;
  message: string;
  due_at: string | null;
  recipient_user_id: string | null;
  recipient_branch_id: string | null;
  recipient_label: string | null;
  requested_car?: string | null;
  notes?: string | null;
  logs?: Array<{ actor_name: string | null; action: string | null; details: string | null; created_at: string }>;
};

export type IncompleteCustomerItem = {
  id: string;
  full_name: string;
  phone: string;
  branch_name: string | null;
  staff_name: string | null;
  created_at: string;
};

export type AgendaOverview = {
  dueToday: number;
  overdue: number;
  reminders: AgendaTaskItem[];
  followUps: AgendaTaskItem[];
  notifications: AgendaTaskItem[];
  incompleteCustomers: IncompleteCustomerItem[];
};

export type OperationalAlertItem = {
  customer_id: string;
  customer_name: string;
  branch_id: string | null;
  branch_name: string | null;
  staff_id: string | null;
  staff_name: string | null;
  customer_status: string;
  requested_car: string | null;
  trade_in_id: string;
  trade_in_model: string;
  trade_in_status: string | null;
  trade_in_license_expiry: string | null;
  trade_in_missing_fields: string[];
};

export type BranchOption = {
  id: string;
  name: string;
  whatsapp_number?: string | null;
  whatsapp_prefix?: string | null;
};

export type StaffOption = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
};

export type CustomerLogItem = {
  id: string;
  action: string;
  details: string | null;
  actor_name: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

export type CustomerAttachmentItem = {
  id: string;
  file_name: string | null;
  file_category: string | null;
  public_url: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  created_at: string;
};

export type TradeInItem = {
  id: string;
  owner_name: string | null;
  model: string;
  price: number | null;
  chassis_no: string | null;
  color: string | null;
  production_year: number | null;
  mileage: number | null;
  specs: string | null;
  inspection: string | null;
  status: string | null;
  condition_label: string | null;
  deal_type: string | null;
  license_expiry: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  notes: string | null;
};

export type CustomerDetail = CustomerItem & {
  nickname: string | null;
  address: string | null;
  whatsapp_prefix: string | null;
  attachment_notes: string | null;
  metadata: Record<string, unknown>;
  cycle_number: number;
  parent_customer_id: string | null;
  parent_cycle: { id: string; status: string; cycle_number: number } | null;
  ancestor_cycles: Array<{ id: string; status: string; cycle_number: number; logs: CustomerLogItem[] }>;
  child_cycles: Array<{ id: string; status: string; cycle_number: number; created_at: string }>;
  logs: CustomerLogItem[];
  reminders: ReminderItem[];
  attachments: CustomerAttachmentItem[];
  tradeIns: TradeInItem[];
};

export type CustomerFormOptions = {
  branches: BranchOption[];
  staff: StaffOption[];
  inventoryOptions: Array<{
    id: string;
    label: string;
    chassis_no?: string | null;
    category?: "showroom" | "customer";
  }>;
  statuses: string[];
  statusesByType: {
    buyer: string[];
    buyer_tradein_pending: string[];
    sell_on_behalf: string[];
  };
  sources: string[];
  profile: DashboardProfile | null;
  capabilities: RoleCapabilities;
};

// قوائم الحالات مستوردة من statuses.ts
const CUSTOMER_STATUSES = ALL_CUSTOMER_STATUSES;

const CUSTOMER_SOURCES = [
  "المعرض",
  "واتساب",
  "تيليغرام",
  "إعلان",
  "توصية",
  "فيسبوك",
];

function isVirtualBranch(name: string | null | undefined) {
  const value = (name ?? "").trim();
  if (!value) return false;
  return value === "الشركة" || value === "المدير";
}

function getRelationshipValue<T extends Record<string, unknown>>(
  relation: T | T[] | null | undefined,
) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function getRelationshipName(
  relation: { name?: string } | { name?: string }[] | null | undefined,
) {
  return getRelationshipValue(relation)?.name ?? null;
}

function getRelationshipFullName(
  relation: { full_name?: string } | { full_name?: string }[] | null | undefined,
) {
  return getRelationshipValue(relation)?.full_name ?? null;
}

function incrementCount(map: Map<string, number>, key: string | null | undefined) {
  const normalized = (key ?? "").trim() || "غير مصنف";
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toSortedBreakdown(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function buildFallbackMetrics(): DashboardMetric[] {
  return [
    { label: "العملاء", value: 0, hint: "ستظهر بعد اكتمال الربط مع Supabase", tone: "sky" },
    { label: "المخزون", value: 0, hint: "الهيكل جاهز ويحتاج بيانات التشغيل", tone: "emerald" },
    { label: "المهام", value: 0, hint: "ستأتي من reminders ومركز اليوم", tone: "amber" },
    { label: "غير المقروءة", value: 0, hint: "مرتبطة مباشرة بجدول notifications", tone: "rose" },
  ];
}

function mapCustomerRow(item: Record<string, unknown>): CustomerItem {
  const metadata = (item.metadata as Record<string, unknown> | null) ?? {};
  const legacyEmployeeName =
    typeof metadata.legacy_employee_name === "string" ? metadata.legacy_employee_name : null;
  const rawVisitCount = item.visit_count;
  const parsedVisitCount =
    typeof rawVisitCount === "number"
      ? rawVisitCount
      : typeof rawVisitCount === "string"
        ? Number.parseInt(rawVisitCount, 10)
        : 0;

  return {
    id: String(item.id),
    full_name: String(item.full_name ?? ""),
    nickname: (item.nickname as string | null) ?? null,
    phone: String(item.phone ?? ""),
    // نُفضّل الكود الإنجليزي من metadata (يُخزَّن دائماً بواسطة الويب والبوت)
    // لأن دوال الإثراء والمكونات تقارن بالكود وليس بالتسمية العربية
    operation_type: (() => {
      const KNOWN_CODES = ["buyer", "buyer_tradein_pending", "buyer_tradein_evaluated", "sell_on_behalf"];
      const codeFromMeta = typeof metadata.operation_type_code === "string" ? metadata.operation_type_code : null;
      if (codeFromMeta && KNOWN_CODES.includes(codeFromMeta)) return codeFromMeta;
      const colVal = typeof item.operation_type === "string" ? item.operation_type : null;
      if (colVal && KNOWN_CODES.includes(colVal)) return colVal;
      // رجعة: التسمية العربية أو قيمة metadata.operation_type
      return colVal ?? (typeof metadata.operation_type === "string" ? metadata.operation_type : null) ?? null;
    })(),
    requested_car: (item.requested_car as string | null) ?? null,
    requested_car_report: (item.requested_car as string | null) ?? null,
    sale_offer_car: null,
    selected_inventory_id: typeof metadata.selected_inventory_id === "string" ? metadata.selected_inventory_id : null,
    inventory_availability: null,
    payment_plan: (item.payment_plan as string | null) ?? null,
    status: String(item.status ?? ""),
    next_follow_up_at: (item.next_follow_up_at as string | null) ?? null,
    branch_name: getRelationshipName(item.branches as { name?: string } | { name?: string }[] | null),
    assigned_user_id: (item.assigned_user_id as string | null) ?? null,
    assigned_user_name: getRelationshipFullName(
      item.app_users as { full_name?: string } | { full_name?: string }[] | null,
    ) ?? legacyEmployeeName,
    branch_id: (item.branch_id as string | null) ?? null,
    source: (item.source as string | null) ?? null,
    is_active: (item.is_active as boolean | undefined) ?? true,
    last_contact_at: (item.last_contact_at as string | null) ?? null,
    notes: (item.notes as string | null) ?? null,
    created_at: (item.created_at as string | null) ?? null,
    updated_at: (item.updated_at as string | null) ?? null,
    visit_count: Number.isFinite(parsedVisitCount) ? parsedVisitCount : 0,
    payment_method: typeof metadata.payment_method === "string" ? metadata.payment_method : null,
  };
}

function isTradeOfferForReport(status: string | null | undefined) {
  const value = (status ?? "").trim();
  return value.includes("برسم البيع") || value.includes("عرض سيارة") || value.includes("استبدال");
}

async function enrichCustomersWithSaleOfferInReport(
  baseCustomers: CustomerItem[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  if (!baseCustomers.length) return baseCustomers;
  const ids = baseCustomers.map((c) => c.id);

  // دالة مساعدة: التحقق من sell_on_behalf بالكود أو التسمية العربية (توافق مع السجلات القديمة)
  const isSellOnBehalf = (op: string | null | undefined): boolean =>
    op === "sell_on_behalf" || op === "بيع بالوكالة";

  // خريطة نوع العملية لكل عميل (للتمييز بين sell_on_behalf والمشترين)
  const opTypeMap = new Map<string, string | null>();
  for (const c of baseCustomers) opTypeMap.set(c.id, c.operation_type ?? null);

  // ── جلب آخر trade_in لكل عميل (بدون فلتر is_active لمنع اختفاء السيارة) ──
  const { data: tradeRows } = await supabase
    .from("trade_ins")
    .select("customer_id, model, status, is_active, updated_at, price")
    .in("customer_id", ids)
    .order("updated_at", { ascending: false });

  // build map: customerId → { model, isOffer, status, price }
  const latestTradeByCustomer = new Map<string, { model: string; isOffer: boolean; status: string | null; price: number | null }>();
  for (const row of tradeRows ?? []) {
    const cid = String(row.customer_id ?? "");
    const opType = opTypeMap.get(cid);
    const model = String(row.model ?? "").trim();
    if (!model || latestTradeByCustomer.has(cid)) continue;

    if (isSellOnBehalf(opType ?? null)) {
      // بيع بالوكالة: نُظهر اسم السيارة دائماً — والشارة فقط عند العرض النشط
      const isActiveOffer = Boolean(row.is_active) && isTradeOfferForReport(row.status);
      latestTradeByCustomer.set(cid, {
        model,
        isOffer: isActiveOffer,
        // نُعيِّن "برسم البيع" عندما السيارة نشطة — بغض النظر عن قيمة العمود في جدول trade_ins
        // (قد يكون "استبدال (بانتظار التقييم)" للسجلات القادمة من البوت/المني آب)
        status: isActiveOffer ? "برسم البيع" : (row.status ?? null),
        price: row.price ?? null,
      });
    } else {
      // مشتري / استبدال: نُظهر فقط إذا كانت سيارة نشطة ومعروضة
      if (Boolean(row.is_active) && isTradeOfferForReport(row.status)) {
        latestTradeByCustomer.set(cid, { model, isOffer: true, status: row.status ?? null, price: row.price ?? null });
      }
    }
  }

  // ── جلب حالة المخزون لعملاء sell_on_behalf (batch بـ source_customer_id) ──
  const sellOnBehalfIds = baseCustomers
    .filter((c) => isSellOnBehalf(c.operation_type))
    .map((c) => c.id);

  // ── جلب حالة المخزون للمشترين (batch بـ selected_inventory_id) ────────────
  const selectedInventoryIds = baseCustomers
    .map((c) => c.selected_inventory_id)
    .filter((id): id is string => Boolean(id));

  // ── المشترون غير المرتبطين بسيارة محددة (للمطابقة التلقائية بالاسم) ────────
  const unlinkedBuyers = baseCustomers.filter(
    (c) => !isSellOnBehalf(c.operation_type) && !c.selected_inventory_id,
  );

  const [invBySourceResult, invByIdResult, allInventoryResult] = await Promise.all([
    sellOnBehalfIds.length > 0
      ? supabase
          .from("inventory")
          .select("source_customer_id, availability_status")
          .in("source_customer_id", sellOnBehalfIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ source_customer_id: string | null; availability_status: string }> }),
    selectedInventoryIds.length > 0
      ? supabase
          .from("inventory")
          .select("id, availability_status")
          .in("id", selectedInventoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; availability_status: string }> }),
    unlinkedBuyers.length > 0
      ? (() => {
          // نجمع branch_ids الفريدة للمشترين غير المرتبطين لتضييق نطاق البحث
          const buyerBranchIds = [...new Set(
            unlinkedBuyers.map((c) => c.branch_id).filter((id): id is string => Boolean(id)),
          )];
          const q = supabase
            .from("inventory")
            .select("model, availability_status, branch_id");
          return buyerBranchIds.length > 0
            ? q.in("branch_id", buyerBranchIds)
            : q; // fallback إذا لم تكن branch_id متاحة
        })()
      : Promise.resolve({ data: [] as Array<{ model: string | null; availability_status: string | null; branch_id: string | null }> }),
  ]);

  // أحدث سجل فقط لكل عميل (الاستعلام مرتب desc، نأخذ الأول)
  const invBySource = new Map<string, string>();
  for (const row of (invBySourceResult.data ?? [])) {
    const cid = String(row.source_customer_id ?? "");
    if (cid && !invBySource.has(cid)) invBySource.set(cid, String(row.availability_status ?? ""));
  }
  const invById = new Map<string, string>();
  for (const row of (invByIdResult.data ?? [])) {
    invById.set(String(row.id), String(row.availability_status ?? ""));
  }

  // ── بناء فهرس المخزون (branchId:normModel → أعلى أولوية للحالة) ────────────
  // أولوية الحالات: متوفرة=3، محجوزة=2، مباعة=1، غيرها=0
  function statusPriority(s: string) {
    if (s.includes("متوفرة")) return 3;
    if (s.includes("محجوزة")) return 2;
    if (s.includes("مباعة"))  return 1;
    return 0;
  }
  // خريطة: "branchId::normModel" → { status, priority } (مُقيَّدة بالفرع لدقة أكبر)
  const invModelIndex = new Map<string, { status: string; priority: number }>();
  for (const row of (allInventoryResult.data ?? [])) {
    const m = (row.model ?? "").trim();
    const s = (row.availability_status ?? "").trim();
    const b = (("branch_id" in row ? (row as { branch_id?: string | null }).branch_id : null) ?? "");
    if (!m) continue;
    const norm = m.toLowerCase().replace(/\s+/g, " ");
    const key = `${b}::${norm}`;
    const p = statusPriority(s);
    const existing = invModelIndex.get(key);
    if (!existing || p > existing.priority) {
      invModelIndex.set(key, { status: s, priority: p });
    }
  }

  // ── ربط تلقائي بالاسم — يُطبَّق على كل سيارة مطلوبة على حدة (لا نقتصر على الأولى) ──
  function cleanCarSegment(raw: string): string {
    return raw
      .replace(/\(?\s*طلب\s+خاص\s*\)?/gi, "")
      .replace(/\s*-\s*موديل\s*:?\s*\S+/gi, "")
      .replace(/\s*-\s*model\s*:?\s*\S+/gi, "")
      .replace(/\s*-\s*شاصي\s*:\s*\S+/gi, "")
      .replace(/\s*-\s*chassis\s*:\s*\S+/gi, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function matchInventoryStatus(normReq: string, branchId: string | null): string | null {
    if (!normReq || normReq.length < 2) return null;
    const hasBranch = Boolean(branchId);
    const branchPrefix = (branchId ?? "") + "::";
    let bestStatus: string | null = null;
    let bestPriority = -1;

    for (const [key, { status, priority }] of invModelIndex) {
      // إذا كان للعميل فرع → طابق فرعه أولاً؛ إذا لم يكن → ابحث في كل المخزون
      if (hasBranch && !key.startsWith(branchPrefix)) continue;
      const normModel = key.slice(key.indexOf("::") + 2);
      // مطابقة جزئية: اسم السيارة المطلوبة يتضمن اسم المخزون أو العكس
      if (!normModel.includes(normReq) && !normReq.includes(normModel)) continue;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestStatus = status;
      }
    }

    // fallback: إذا لم يُوجد تطابق في فرع العميل → ابحث في كل المخزون
    if (bestStatus === null && hasBranch) {
      for (const [key, { status, priority }] of invModelIndex) {
        const normModel = key.slice(key.indexOf("::") + 2);
        if (!normModel.includes(normReq) && !normReq.includes(normModel)) continue;
        if (priority > bestPriority) {
          bestPriority = priority;
          bestStatus = status;
        }
      }
    }

    return bestStatus;
  }

  const invByNameMatch = new Map<string, string>(); // customerId → availability_status (السيارة الأولى — توافقاً مع الحقل القديم)
  const invByNameMatchPerCar = new Map<string, Record<string, string>>(); // customerId → { normCarName → status } لكل السيارات
  for (const c of unlinkedBuyers) {
    const segments = (c.requested_car ?? "").split("|");
    const perCar: Record<string, string> = {};
    segments.forEach((seg, idx) => {
      const normReq = cleanCarSegment(seg);
      const status = matchInventoryStatus(normReq, c.branch_id ?? null);
      if (status !== null) {
        perCar[normReq] = status;
        if (idx === 0) invByNameMatch.set(c.id, status);
      }
    });
    if (Object.keys(perCar).length > 0) invByNameMatchPerCar.set(c.id, perCar);
  }

  return baseCustomers.map((customer) => {
    const trade = latestTradeByCustomer.get(customer.id);
    const opType = customer.operation_type;

    // حالة السيارة في المخزون (sell_on_behalf → source، مشتري محدد → id، غيرهم → مطابقة بالاسم)
    const inventory_availability =
      opType === "sell_on_behalf"
        ? (invBySource.get(customer.id) ?? null)
        : customer.selected_inventory_id
          ? (invById.get(customer.selected_inventory_id) ?? null)
          : (invByNameMatch.get(customer.id) ?? null);

    // حالة كل سيارة مطلوبة على حدة
    const inventory_availability_by_car: Record<string, string> = {};
    if (opType !== "sell_on_behalf") {
      if (customer.selected_inventory_id) {
        const status = invById.get(customer.selected_inventory_id);
        const firstSeg = cleanCarSegment((customer.requested_car ?? "").split("|")[0] ?? "");
        if (status && firstSeg) inventory_availability_by_car[firstSeg] = status;
      } else {
        Object.assign(inventory_availability_by_car, invByNameMatchPerCar.get(customer.id) ?? {});
      }
    }

    if (!trade) return { ...customer, inventory_availability, inventory_availability_by_car, trade_in_status: null };

    const reportBase = (customer.requested_car ?? "").trim();
    const requested_car_report = reportBase
      ? reportBase.includes(trade.model)
        ? reportBase
        : `${reportBase} | ${trade.model}`
      : trade.model;

    return {
      ...customer,
      requested_car_report,
      sale_offer_car: trade.isOffer ? trade.model : (customer.sale_offer_car ?? null),
      trade_in_model: trade.model ?? null,
      inventory_availability,
      inventory_availability_by_car,
      trade_in_status: trade.status ?? null,
    };
  });
}

export async function getDashboardContext() {
  if (!hasSupabaseEnv()) {
    return {
      session: null,
      profile: null as DashboardProfile | null,
    };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      session: null,
      profile: null,
    };
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<DashboardProfile>();

  return {
    session,
    profile: profile ?? null,
  };
}

async function getScopedProfile() {
  const { profile } = await getDashboardContext();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);

  let isMuallim = false;
  if (profile && profile.branch_id) {
    if (!profile.branch_name) {
      const supabase = await createClient();
      const { data: b } = await supabase.from("branches").select("name").eq("id", profile.branch_id).maybeSingle();
      if (b) {
        profile.branch_name = b.name;
        isMuallim = b.name.includes("لمعلم") || b.name.includes("المعلم");
      }
      console.log("DEBUG getScopedProfile (fetched b):", { b_name: b?.name, isMuallim });
    } else {
      isMuallim = profile.branch_name.includes("لمعلم") || profile.branch_name.includes("المعلم");
      console.log("DEBUG getScopedProfile (had branch_name):", { branch_name: profile.branch_name, isMuallim });
    }
  } else {
    console.log("DEBUG getScopedProfile (no branch_id):", { profile });
  }

  return {
    profile,
    capabilities,
    isMuallim,
  };
}

function applyBranchScope(
  query: any,
  branchId: string | null | undefined,
  isGeneralManager: boolean,
  isMuallim = false,
  tableName: "customers" | "inventory" | "other" = "other",
  column = "branch_id",
  isPendingEvaluation = false
): unknown {
  if (isGeneralManager) {
    return query;
  }

  if (isMuallim) {
    if (isPendingEvaluation) {
      return query;
    }
    if (tableName === "customers") {
      if (branchId) {
        return query.or(column + ".eq." + branchId + ",operation_type.in.(buyer,buyer_tradein,buyer_tradein_pending,buyer_tradein_evaluated,sell_on_behalf,buying)");
      } else {
        return query.in("operation_type", ["buyer", "buyer_tradein", "buyer_tradein_pending", "buyer_tradein_evaluated", "sell_on_behalf", "buying"]);
      }
    } else if (tableName === "inventory") {
      if (branchId) {
        return query.or(column + ".eq." + branchId + ",deal_type.in.(استبدال,برسم البيع)");
      } else {
        return query.in("deal_type", ["استبدال", "برسم البيع"]);
      }
    }
  }

  if (branchId) {
    return query.eq(column, branchId);
  }

  return query;
}

function applyStaffScope(
  query: { eq: (column: string, value: string) => unknown },
  userId: string | null | undefined,
  isManager: boolean,
  column = "assigned_user_id",
): unknown {
  if (!isManager && userId) {
    return query.eq(column, userId);
  }

  return query;
}

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  if (!hasSupabaseEnv()) {
    return buildFallbackMetrics();
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;

  const customersCountQuery = supabase.from("customers").select("*", { count: "exact", head: true });
  const inventoryCountQuery = supabase.from("inventory").select("*", { count: "exact", head: true });
  const remindersCountQuery = supabase.from("reminders").select("*", { count: "exact", head: true }).eq("status", "pending");
  const notificationsCountQuery = supabase.from("notifications").select("*", { count: "exact", head: true }).eq("status", "unread");

  const [customersResult, inventoryResult, remindersResult, notificationsResult] = await Promise.all([
    applyBranchScope(customersCountQuery, branchId, capabilities.isGeneralManager, isMuallim, "customers") as typeof customersCountQuery,
    applyBranchScope(inventoryCountQuery, branchId, capabilities.isGeneralManager, isMuallim, "inventory") as typeof inventoryCountQuery,
    applyBranchScope(
      remindersCountQuery,
      branchId,
      capabilities.isGeneralManager,
      isMuallim,
      "customers"
    ) as typeof remindersCountQuery,
    applyBranchScope(
      notificationsCountQuery,
      branchId,
      capabilities.isGeneralManager,
      isMuallim,
      "other",
      "recipient_branch_id"
    ) as typeof notificationsCountQuery,
  ]);

  const customersCount = "count" in customersResult ? customersResult.count : 0;
  const inventoryCount = "count" in inventoryResult ? inventoryResult.count : 0;
  const remindersCount = "count" in remindersResult ? remindersResult.count : 0;
  const notificationsCount = "count" in notificationsResult ? notificationsResult.count : 0;

  return [
    { label: "العملاء", value: customersCount ?? 0, hint: "إجمالي السجلات النشطة داخل قاعدة البيانات", tone: "sky" },
    { label: "المخزون", value: inventoryCount ?? 0, hint: "كل المركبات المسجلة على الويب الجديد", tone: "emerald" },
    { label: "المهام المفتوحة", value: remindersCount ?? 0, hint: "المهام التي لم تُغلق بعد", tone: "amber" },
    { label: "تنبيهات غير مقروءة", value: notificationsCount ?? 0, hint: "المركز اليومي يحتاج مراجعة", tone: "rose" },
  ];
}

export type InventoryFilterContext = {
  isGeneralManager: boolean;
  isManager: boolean;
  branchId: string | null;
  branchName: string | null;
  isMuallimBranch: boolean;
  branches: string[];
  branchObjects: Array<{ id: string; name: string }>;
};

export async function getInventoryFilterContext(): Promise<InventoryFilterContext> {
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const supabase = await createClient();

  const [{ data: branchRow }, { data: branchesRows }] = await Promise.all([
    profile?.branch_id
      ? supabase.from("branches").select("name").eq("id", profile.branch_id).maybeSingle()
      : Promise.resolve({ data: null } as { data: { name?: string } | null }),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
  ]);

  const branchName = (branchRow?.name ?? null) as string | null;
  const branchObjects = (branchesRows ?? [])
    .filter((row) => Boolean(row.name) && !isVirtualBranch(row.name))
    .map((row) => ({ id: row.id as string, name: (row.name ?? "").trim() }));
  const branches = branchObjects.map((b) => b.name);

  return {
    isGeneralManager: capabilities.isGeneralManager,
    isManager: capabilities.isManager,
    branchId: profile?.branch_id ?? null,
    branchName,
    isMuallimBranch: isMuallim,
    branches,
    branchObjects,
  };
}

export async function getRecentCustomers(limit = 8): Promise<CustomerItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const recentCustomersQuery = supabase
    .from("customers")
    .select(
      "id, full_name, nickname, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, operation_type, metadata, branches(name), app_users(full_name)",
    );
  const { data } = await (applyBranchScope(
    recentCustomersQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
    isMuallim,
    "customers"
  ) as typeof recentCustomersQuery)
    .order("created_at", { ascending: false })
    .limit(limit);

  const baseCustomers = (data ?? []).map(mapCustomerRow);
  return enrichCustomersWithSaleOfferInReport(baseCustomers, supabase);
}

export async function getCustomersDirectory(
  limit = 120,
  options?: { onlyAssignedToCurrentUser?: boolean },
): Promise<CustomerItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const userId = profile?.id ?? null;
  const customersDirectoryQuery = supabase
    .from("customers")
    .select(
      "id, full_name, nickname, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, operation_type, metadata, branches(name), app_users(full_name)",
    );
  const branchScoped = applyBranchScope(
    customersDirectoryQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
    isMuallim,
    "customers"
  ) as typeof customersDirectoryQuery;
  const fullyScoped =
    options?.onlyAssignedToCurrentUser && userId
      ? (branchScoped.eq("assigned_user_id", userId) as typeof branchScoped)
      : branchScoped;
  const { data } = await fullyScoped
    .order("updated_at", { ascending: false })
    .limit(limit);

  const baseCustomers = (data ?? []).map(mapCustomerRow);
  return enrichCustomersWithSaleOfferInReport(baseCustomers, supabase);
}

export async function getCustomersSearchResults(query: string, limit = 120): Promise<CustomerItem[]> {
  if (!hasSupabaseEnv()) return [];

  const normalized = query.trim();
  if (!normalized) return [];

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const customersSearchQuery = supabase
    .from("customers")
    .select(
      "id, full_name, nickname, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, operation_type, metadata, branches(name), app_users(full_name)",
    );

  const scoped = applyBranchScope(
    customersSearchQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
    isMuallim,
    "customers"
  ) as typeof customersSearchQuery;

  // نحذف أحرف wildcards الخاصة بـ SQL لمنع تحريف نتائج البحث
  const likeValue = `%${normalized.replace(/[%_\\]/g, "")}%`;
  const { data } = await scoped
    .or(
      [
        `full_name.ilike.${likeValue}`,
        `phone.ilike.${likeValue}`,
        `requested_car.ilike.${likeValue}`,
        `status.ilike.${likeValue}`,
        `notes.ilike.${likeValue}`,
      ].join(","),
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  const baseCustomers = (data ?? []).map(mapCustomerRow);
  return enrichCustomersWithSaleOfferInReport(baseCustomers, supabase);
}

export async function getRecentInventory(limit = 8): Promise<InventoryItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const recentInventoryQuery = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, photo_urls, source_customer_id, branches(name)");
  const { data } = await (applyBranchScope(
    recentInventoryQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
    isMuallim,
    "inventory"
  ) as typeof recentInventoryQuery)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((item) => ({
    id: item.id,
    model: item.model,
    owner_name: item.owner_name,
    deal_type: item.deal_type ?? null,
    chassis_no: item.chassis_no ?? null,
    condition_label: item.condition_label ?? null,
    availability_status: item.availability_status,
    price: item.price,
    production_year: item.production_year,
    color: item.color,
    gearbox: item.gearbox ?? null,
    fuel_type: item.fuel_type ?? null,
    mileage: item.mileage ?? null,
    specs: item.specs ?? null,
    inspection: item.inspection ?? null,
    photo_urls: Array.isArray(item.photo_urls) ? (item.photo_urls as string[]) : [],
    source_customer_id: (item as { source_customer_id?: string | null }).source_customer_id ?? null,
    branch_name: getRelationshipName(item.branches),
  }));
}

/**
 * يجلب صور السيارة من مصدرين:
 * 1. inventory.photo_urls (رفع مباشر مستقبلاً)
 * 2. customer_attachments حيث file_category = 'trade_photo' عبر source_customer_id
 */
export async function getInventoryCarPhotos(
  inventoryId: string,
  sourceCustomerId: string | null | undefined,
  existingPhotoUrls: string[],
): Promise<string[]> {
  const attachments = await getInventoryCarAttachments(inventoryId, sourceCustomerId, existingPhotoUrls);
  return attachments.filter((item) => item.isImage).map((item) => item.url);
}

export async function getInventoryCarAttachments(
  inventoryId: string,
  sourceCustomerId: string | null | undefined,
  existingPhotoUrls: string[],
): Promise<InventoryCarAttachment[]> {
  if (!hasSupabaseEnv()) {
    return existingPhotoUrls.filter(Boolean).map((url) => ({
      url,
      fileName: null,
      mimeType: null,
      category: "inventory_photo",
      isImage: true,
    }));
  }

  const combined: InventoryCarAttachment[] = [...existingPhotoUrls.filter(Boolean).map((url) => ({
    url,
    fileName: null,
    mimeType: null,
    category: "inventory_photo",
    isImage: true,
  }))];
  const seen = new Set(combined.map((item) => item.url));

  const isLikelyImage = (fileName: string | null | undefined, mimeType: string | null | undefined) => {
    const mime = (mimeType ?? "").toLowerCase().trim();
    if (mime.startsWith("image/")) return true;
    const name = (fileName ?? "").toLowerCase().trim();
    return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg", ".avif", ".heic", ".heif", ".jfif"].some((ext) => name.endsWith(ext));
  };

  if (sourceCustomerId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customer_attachments")
      .select("public_url, storage_path, file_name, mime_type, file_category")
      .eq("customer_id", sourceCustomerId)
      .in("file_category", ["trade_photo", "trade_files_photos", "trade_inspection", "trade_license", "trade_insurance"])
      .order("created_at", { ascending: true });

    if (data) {
      for (const row of data as Array<{
        public_url: string | null;
        storage_path: string | null;
        file_name: string | null;
        mime_type: string | null;
        file_category: string | null;
      }>) {
        let resolvedUrl = row.public_url;
        if (!resolvedUrl && row.storage_path) {
          const signed = await supabase.storage
            .from("customer-attachments")
            .createSignedUrl(row.storage_path, 60 * 60);
          if (!signed.error) {
            resolvedUrl = signed.data.signedUrl;
          }
        }

        if (!resolvedUrl || seen.has(resolvedUrl)) continue;
        seen.add(resolvedUrl);
        combined.push({
          url: resolvedUrl,
          fileName: row.file_name,
          mimeType: row.mime_type,
          category: row.file_category,
          isImage: isLikelyImage(row.file_name, row.mime_type),
        });
      }
    }
  }

  if (!sourceCustomerId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customer_attachments")
      .select("public_url, storage_path, file_name, mime_type, file_category, metadata")
      .contains("metadata", { inventory_id: inventoryId })
      .order("created_at", { ascending: true });

    if (data) {
      for (const row of data as Array<{
        public_url: string | null;
        storage_path: string | null;
        file_name: string | null;
        mime_type: string | null;
        file_category: string | null;
      }>) {
        let resolvedUrl = row.public_url;
        if (!resolvedUrl && row.storage_path) {
          const signed = await supabase.storage
            .from("customer-attachments")
            .createSignedUrl(row.storage_path, 60 * 60);
          if (!signed.error) {
            resolvedUrl = signed.data.signedUrl;
          }
        }

        if (!resolvedUrl || seen.has(resolvedUrl)) continue;
        seen.add(resolvedUrl);
        combined.push({
          url: resolvedUrl,
          fileName: row.file_name,
          mimeType: row.mime_type,
          category: row.file_category,
          isImage: isLikelyImage(row.file_name, row.mime_type),
        });
      }
    }
  }

  return combined;
}

/**
 * يُثري عناصر المخزون باسم/معرّف الموظف الذي أدخل العميل المرتبط بالسيارة.
 * الربط عبر source_customer_id → customers.assigned_user_id → app_users.full_name.
 * يُستخدم admin client (إن توفّر) لتجاوز RLS عند سيارات الفروع الأخرى.
 */
async function enrichInventoryAssignees(items: InventoryItem[]): Promise<InventoryItem[]> {
  const customerIds = [
    ...new Set(items.map((i) => i.source_customer_id).filter((id): id is string => Boolean(id))),
  ];
  if (customerIds.length === 0) return items;

  const reader = hasSupabaseServiceRoleEnv() ? createAdminClient() : await createClient();
  const { data } = await reader
    .from("customers")
    .select("id, assigned_user_id, app_users(full_name)")
    .in("id", customerIds);

  const map = new Map<string, { id: string | null; name: string | null }>();
  for (const row of data ?? []) {
    map.set(String(row.id), {
      id: (row.assigned_user_id as string | null) ?? null,
      name: getRelationshipFullName(
        (row as { app_users?: Record<string, unknown> | Record<string, unknown>[] | null }).app_users,
      ),
    });
  }

  return items.map((item) => {
    const found = item.source_customer_id ? map.get(item.source_customer_id) : null;
    return found
      ? { ...item, assigned_user_id: found.id, assigned_user_name: found.name }
      : item;
  });
}

export async function getInventoryDirectory(
  limit = 120,
  options?: { includeCrossBranchForMuallim?: boolean },
): Promise<InventoryItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const inventoryDirectoryQuery = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, photo_urls, source_customer_id, branch_id, branches(name)");
  const { data } = await (applyBranchScope(
    inventoryDirectoryQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
    isMuallim,
    "inventory"
  ) as typeof inventoryDirectoryQuery)
    .order("updated_at", { ascending: false })
    .limit(limit);

  const scopedItems: InventoryItem[] = (data ?? []).map((item) => ({
    id: item.id,
    model: item.model,
    owner_name: item.owner_name,
    deal_type: item.deal_type ?? null,
    chassis_no: item.chassis_no ?? null,
    condition_label: item.condition_label ?? null,
    availability_status: item.availability_status,
    price: item.price,
    production_year: item.production_year,
    color: item.color,
    gearbox: item.gearbox ?? null,
    fuel_type: item.fuel_type ?? null,
    mileage: item.mileage ?? null,
    specs: item.specs ?? null,
    inspection: item.inspection ?? null,
    photo_urls: Array.isArray(item.photo_urls) ? (item.photo_urls as string[]) : [],
    source_customer_id: (item as { source_customer_id?: string | null }).source_customer_id ?? null,
    branch_id: (item as { branch_id?: string | null }).branch_id ?? null,
    branch_name: getRelationshipName(item.branches),
  }));

  const normalizeStatus = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
  const isAvailableStatus = (value: string | null | undefined) => {
    const status = normalizeStatus(value);
    return (
      !status.includes("مباع") &&
      !status.includes("مباعة") &&
      !status.includes("محجوز") &&
      !status.includes("مسحوب") &&
      status !== "sold" &&
      status !== "reserved" &&
      status !== "withdrawn"
    );
  };
  const isCrossDealType = (value: string | null | undefined) => {
    const deal = (value ?? "").trim();
    return deal.includes("استبدال") || deal.includes("حيازة") || deal.includes("برسم البيع");
  };

  const includeCrossBranchForMuallim = options?.includeCrossBranchForMuallim === true;
  if (!includeCrossBranchForMuallim || !profile?.branch_id) {
    return enrichInventoryAssignees(scopedItems);
  }

  const { data: branchRow } = await supabase
    .from("branches")
    .select("name")
    .eq("id", profile.branch_id)
    .maybeSingle();
  const branchName = (branchRow?.name ?? "").trim();
  const isMuallimBranch = branchName.includes("المعلم");
  if (!isMuallimBranch) {
    return scopedItems;
  }

  // Special handling for Muallim when the viewer is a general manager:
  // items from other branches should be shown as "برسم البيع" in حالة/الصفقة.
  if (capabilities.isGeneralManager) {
    return enrichInventoryAssignees(
      scopedItems
        .filter((item) => isAvailableStatus(item.availability_status))
        .map((item) => {
          const fromOtherBranch = (item.branch_name ?? "").trim() !== branchName;
          if (fromOtherBranch && isCrossDealType(item.deal_type)) {
            return { ...item, deal_type: "برسم البيع" };
          }
          return item;
        }),
    );
  }

  const externalInventoryQuery = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, photo_urls, source_customer_id, branches(name), branch_id")
    .neq("branch_id", profile.branch_id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  let externalRows: Array<{
    id: string;
    model: string;
    owner_name: string | null;
    deal_type: string | null;
    chassis_no: string | null;
    condition_label: string | null;
    availability_status: string;
    price: number | null;
    production_year: number | null;
    color: string | null;
    gearbox: string | null;
    fuel_type: string | null;
    mileage: number | null;
    specs: string | null;
    inspection: string | null;
    photo_urls: string[] | null;
    source_customer_id: string | null;
    branches: { name?: string } | { name?: string }[] | null;
    branch_id: string | null;
  }> = [];

  if (hasSupabaseServiceRoleEnv()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("inventory")
      .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, photo_urls, source_customer_id, branches(name), branch_id")
      .neq("branch_id", profile.branch_id)
      .order("updated_at", { ascending: false })
      .limit(limit);
    externalRows = (data ?? []) as typeof externalRows;
  } else {
    const { data } = await externalInventoryQuery;
    externalRows = (data ?? []) as typeof externalRows;
  }

  const externalItems: InventoryItem[] = (externalRows ?? [])
    .filter((item) => {
      return isCrossDealType(item.deal_type) && isAvailableStatus(item.availability_status);
    })
    .map((item) => ({
      id: item.id,
      model: item.model,
      owner_name: item.owner_name,
      deal_type: "برسم البيع",
      chassis_no: item.chassis_no ?? null,
      condition_label: item.condition_label ?? null,
      availability_status: item.availability_status,
      price: item.price,
      production_year: item.production_year,
      color: item.color,
      gearbox: item.gearbox ?? null,
      fuel_type: item.fuel_type ?? null,
      mileage: item.mileage ?? null,
      specs: item.specs ?? null,
      inspection: item.inspection ?? null,
      photo_urls: Array.isArray(item.photo_urls) ? (item.photo_urls as string[]) : [],
      branch_name: getRelationshipName(item.branches),
    }));

  const seen = new Set<string>();
  const merged = [...scopedItems, ...externalItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return enrichInventoryAssignees(merged);
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  if (!hasSupabaseEnv()) {
    return {
      metrics: buildFallbackMetrics(),
      customerStatus: [],
      inventoryStatus: [],
      branches: [],
      notifications: [],
      reminders: [],
      followUps: [],
      recentCustomers: [],
      recentInventory: [],
      unavailableRequests: [],
    };
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;

  // نحسب حدود اليوم بتوقيت إسرائيل/فلسطين (UTC+3) — السيرفر UTC
  const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
  const localNow = new Date(Date.now() + TZ_OFFSET_MS);
  const todayStr = localNow.toISOString().slice(0, 10);
  const todayEndIso = new Date(new Date(todayStr + "T23:59:59.999Z").getTime() - TZ_OFFSET_MS).toISOString();

  // ── استعلام المتابعات (بيانات كاملة، مُفلترة من DB للأداء) ──────────────
  const dashboardFollowUpsQuery = supabase
    .from("customers")
    .select(
      "id, full_name, nickname, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, operation_type, metadata, branches(name), app_users(full_name)",
    )
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", todayEndIso)
    .eq("is_active", true)
    .order("next_follow_up_at", { ascending: true });

  const dashboardNotificationsQuery = supabase
    .from("notifications")
    .select("id, message, status, created_at, recipient_label")
    .order("created_at", { ascending: false });
  const dashboardRemindersQuery = supabase
    .from("reminders")
    .select(
      "id, title, message, due_at, status, assigned_user_id, branch_id, branches(name), customers(full_name), app_users(full_name)",
    )
    .order("due_at", { ascending: true });

  const [
    metrics,
    { data: followUpRows },
    { data: notificationRows },
    { data: reminderRows },
  ] = await Promise.all([
    getDashboardMetrics(),
    (applyStaffScope(
      applyBranchScope(dashboardFollowUpsQuery, branchId, capabilities.isGeneralManager, isMuallim, "customers") as typeof dashboardFollowUpsQuery,
      userId,
      capabilities.isManager,
    ) as typeof dashboardFollowUpsQuery).limit(6),
    (applyStaffScope(
      applyBranchScope(
        dashboardNotificationsQuery,
        branchId,
        capabilities.isGeneralManager,
        isMuallim,
        "other",
        "recipient_branch_id"
      ) as typeof dashboardNotificationsQuery,
      userId,
      capabilities.isManager,
      "recipient_user_id",
    ) as typeof dashboardNotificationsQuery).limit(6),
    (applyStaffScope(
      applyBranchScope(dashboardRemindersQuery, branchId, capabilities.isGeneralManager, isMuallim, "customers") as typeof dashboardRemindersQuery,
      userId,
      capabilities.isManager,
    ) as typeof dashboardRemindersQuery).limit(8),
  ]);

  // المتابعات جاءت مُفلترة مسبقاً من DB — نحوّلها مباشرة
  const followUps = (followUpRows ?? []).map(mapCustomerRow);

  return {
    metrics,
    customerStatus: [],   // غير مستخدمة حالياً — مجال لتوسع مستقبلي
    inventoryStatus: [],  // غير مستخدمة حالياً
    branches: [],         // غير مستخدمة حالياً
    notifications: (notificationRows ?? []).map((item) => ({
      id: item.id,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      recipient_label: item.recipient_label,
    })),
    reminders: (reminderRows ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      due_at: item.due_at,
      status: item.status,
      branch_name: getRelationshipName(item.branches),
      customer_name: getRelationshipFullName(item.customers),
      assigned_user_name: getRelationshipFullName(item.app_users),
      assigned_user_id: item.assigned_user_id ?? null,
      branch_id: item.branch_id ?? null,
    })),
    followUps,
    recentCustomers: [],
    recentInventory: [],
    unavailableRequests: [],
  };
}

export type EmployeeDashboardStats = {
  myActiveCustomers: number;
  myClosedCustomers: number;
  mySales: number;
  myFollowupsToday: number;
  myOverdueFollowups: number;
  myPendingReminders: number;
  conversionRate: number;
  myRecentCustomers: { id: string; full_name: string; status: string; next_follow_up_at: string | null }[];
  myOverdueList: { id: string; full_name: string; status: string; next_follow_up_at: string | null; phone: string }[];
};

export async function getEmployeeDashboardStats(): Promise<EmployeeDashboardStats> {
  const empty: EmployeeDashboardStats = {
    myActiveCustomers: 0, myClosedCustomers: 0, mySales: 0,
    myFollowupsToday: 0, myOverdueFollowups: 0, myPendingReminders: 0,
    conversionRate: 0, myRecentCustomers: [], myOverdueList: [],
  };
  if (!hasSupabaseEnv()) return empty;

  const supabase = await createClient();
  const { profile } = await getScopedProfile();
  const userId = profile?.id;
  if (!userId) return empty;

  const now = new Date().toISOString();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayEndIso = todayEnd.toISOString();

  const [
    { count: myActive },
    { count: myClosed },
    { count: mySales },
    { count: myToday },
    { count: myOverdue },
    { count: myReminders },
    { data: recentRows },
    { data: overdueRows },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("assigned_user_id", userId).eq("is_active", true),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("assigned_user_id", userId).eq("is_active", false),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("assigned_user_id", userId).ilike("status", "%تمت عملية البيع%"),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("assigned_user_id", userId).eq("is_active", true).not("next_follow_up_at", "is", null).lte("next_follow_up_at", todayEndIso),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("assigned_user_id", userId).eq("is_active", true).not("next_follow_up_at", "is", null).lt("next_follow_up_at", now),
    supabase.from("reminders").select("*", { count: "exact", head: true }).eq("assigned_user_id", userId).eq("status", "pending"),
    supabase.from("customers").select("id, full_name, status, next_follow_up_at").eq("assigned_user_id", userId).eq("is_active", true).order("updated_at", { ascending: false }).limit(5),
    supabase.from("customers").select("id, full_name, status, next_follow_up_at, phone").eq("assigned_user_id", userId).eq("is_active", true).not("next_follow_up_at", "is", null).lt("next_follow_up_at", now).order("next_follow_up_at", { ascending: true }).limit(10),
  ]);

  const active = myActive ?? 0;
  const sales = mySales ?? 0;
  const total = active + (myClosed ?? 0);

  return {
    myActiveCustomers: active,
    myClosedCustomers: myClosed ?? 0,
    mySales: sales,
    myFollowupsToday: myToday ?? 0,
    myOverdueFollowups: myOverdue ?? 0,
    myPendingReminders: myReminders ?? 0,
    conversionRate: total > 0 ? Math.round((sales / total) * 100) : 0,
    myRecentCustomers: (recentRows ?? []).map((r) => ({
      id: r.id as string,
      full_name: (r.full_name ?? "") as string,
      status: (r.status ?? "") as string,
      next_follow_up_at: r.next_follow_up_at as string | null,
    })),
    myOverdueList: (overdueRows ?? []).map((r) => ({
      id: r.id as string,
      full_name: (r.full_name ?? "") as string,
      status: (r.status ?? "") as string,
      next_follow_up_at: r.next_follow_up_at as string | null,
      phone: (r.phone ?? "") as string,
    })),
  };
}

export async function getStaffOverview(): Promise<StaffOverviewItem[]> {
  if (!hasSupabaseEnv()) return [];

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();

  const staffQuery = supabase
    .from("app_users")
    .select("id, full_name, role, status, is_active, telegram_chat_id, branch_id, branches(name)")
    .order("full_name");
  const customersQuery = supabase.from("customers").select("assigned_user_id, status, next_follow_up_at");

  const [{ data: staffRows }, { data: customerRows }] = await Promise.all([
    applyBranchScope(staffQuery, profile?.branch_id, capabilities.isGeneralManager, isMuallim, "other") as typeof staffQuery,
    applyBranchScope(customersQuery, profile?.branch_id, capabilities.isGeneralManager, isMuallim, "customers") as typeof customersQuery,
  ]);

  const customerStats = new Map<string, { total: number; sold: number; followups: number }>();

  for (const row of customerRows ?? []) {
    if (!row.assigned_user_id) continue;

    const current = customerStats.get(row.assigned_user_id) ?? { total: 0, sold: 0, followups: 0 };
    current.total += 1;

    if (String(row.status ?? "").includes("تم البيع") || String(row.status ?? "").includes("مباعة")) {
      current.sold += 1;
    }

    if (row.next_follow_up_at) {
      current.followups += 1;
    }

    customerStats.set(row.assigned_user_id, current);
  }

  return (staffRows ?? []).map((item) => {
    const stats = customerStats.get(item.id) ?? { total: 0, sold: 0, followups: 0 };

    return {
      id: item.id,
      full_name: item.full_name,
      role: item.role,
      status: item.status,
      is_active: item.is_active,
      branch_name: getRelationshipName(item.branches),
      branch_id: item.branch_id ?? null,
      telegram_chat_id: item.telegram_chat_id,
      total_customers: stats.total,
      total_sales: stats.sold,
      open_followups: stats.followups,
    };
  });
}

export async function getAgendaOverview(): Promise<AgendaOverview> {
  if (!hasSupabaseEnv()) {
    return {
      dueToday: 0,
      overdue: 0,
      reminders: [],
      followUps: [],
      notifications: [],
      incompleteCustomers: [],
    };
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;
  const now = Date.now();
  // حدود اليوم بتوقيت إسرائيل/فلسطين (UTC+3)
  const TZ_OFFSET_MS_AG = 3 * 60 * 60 * 1000;
  const localNowAG = new Date(Date.now() + TZ_OFFSET_MS_AG);
  const todayStrAG = localNowAG.toISOString().slice(0, 10);
  const todayEndMs = new Date(todayStrAG + "T23:59:59.999Z").getTime() - TZ_OFFSET_MS_AG;
  const todayTs = todayEndMs;
  const todayEndIso = new Date(todayEndMs).toISOString();

  const agendaRemindersQuery = supabase
    .from("reminders")
    .select(
      "id, customer_id, title, message, due_at, status, assigned_user_id, branch_id, branches(name), customers(full_name), app_users(full_name)",
    )
    .eq("status", "pending")
    .lte("due_at", todayEndIso);  // فلتر في DB — نجلب فقط التذكيرات المستحقة اليوم أو قبله
  const agendaFollowupsQuery = supabase
    .from("customers")
    .select(
      "id, full_name, status, requested_car, notes, next_follow_up_at, assigned_user_id, branch_id, branches(name), app_users(full_name), customer_logs(actor_name, action, details, created_at)",
    )
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", todayEndIso)  // فلتر في DB — ليس في JS
    .eq("is_active", true);                 // العملاء النشطون فقط
  const agendaNotificationsQuery = supabase
    .from("notifications")
    .select("id, message, status, created_at, recipient_user_id, recipient_branch_id, recipient_label")
    .eq("status", "unread");

  const agendaIncompleteQuery = supabase
    .from("customers")
    .select("id, full_name, phone, created_at, branch_id, assigned_user_id, branches(name), app_users(full_name)")
    .eq("status", "غير مكتمل")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const [{ data: reminderRows }, { data: followUpRows }, { data: notificationRows }, { data: incompleteRows }] = await Promise.all([
    (applyStaffScope(
      applyBranchScope(
        agendaRemindersQuery,
        branchId,
        capabilities.isGeneralManager,
        isMuallim,
        "customers"
      ) as typeof agendaRemindersQuery,
      userId,
      capabilities.isManager,
    ) as typeof agendaRemindersQuery)
      .order("due_at", { ascending: true })
      .limit(50),
    (applyStaffScope(
      applyBranchScope(
        agendaFollowupsQuery,
        branchId,
        capabilities.isGeneralManager,
        isMuallim,
        "customers"
      ) as typeof agendaFollowupsQuery,
      userId,
      capabilities.isManager,
    ) as typeof agendaFollowupsQuery)
      .order("next_follow_up_at", { ascending: true })
      .limit(50),
    (applyStaffScope(
      applyBranchScope(
        agendaNotificationsQuery,
        branchId,
        capabilities.isGeneralManager,
        isMuallim,
        "other",
        "recipient_branch_id"
      ) as typeof agendaNotificationsQuery,
      userId,
      capabilities.isManager,
      "recipient_user_id",
    ) as typeof agendaNotificationsQuery)
      .order("created_at", { ascending: false })
      .limit(10),
    (applyStaffScope(
      applyBranchScope(
        agendaIncompleteQuery,
        branchId,
        capabilities.isGeneralManager,
        isMuallim,
        "inventory"
      ) as typeof agendaIncompleteQuery,
      userId,
      capabilities.isManager,
    ) as typeof agendaIncompleteQuery),
  ]);

  const reminders: AgendaTaskItem[] = (reminderRows ?? [])
    .map((item) => ({
      id: item.id,
      source: "reminder" as const,
      label: "مهمة أجندة",
      customer_id: item.customer_id ?? null,
      customer_name: getRelationshipFullName(item.customers),
      branch_name: getRelationshipName(item.branches),
      staff_name: getRelationshipFullName(item.app_users),
      status: item.status,
      message: item.message ?? item.title ?? "مهمة بدون وصف",
      due_at: item.due_at,
      recipient_user_id: item.assigned_user_id ?? null,
      recipient_branch_id: item.branch_id ?? null,
      recipient_label: getRelationshipFullName(item.app_users) ?? getRelationshipName(item.branches),
    }))
    .filter((item) => {
      if (!item.due_at) return true;
      const time = new Date(item.due_at).getTime();
      return !Number.isNaN(time) && time <= todayTs;
    });

  const followUps: AgendaTaskItem[] = (followUpRows ?? [])
    // نعرض جميع العملاء النشطين (غير المغلقة ملفاتهم) بغض النظر عن الحالة
    .filter((item) => !isClosedStatus(String(item.status ?? "")))
    .filter((item) => {
      if (!item.next_follow_up_at) return false;
      const time = new Date(item.next_follow_up_at).getTime();
      return !Number.isNaN(time) && time <= todayTs;
    })
    .map((item) => ({
      id: item.id,
      source: "followup" as const,
      label: "تواصل اليوم",
      customer_id: item.id,
      customer_name: item.full_name,
      branch_name: getRelationshipName(item.branches),
      staff_name: getRelationshipFullName(item.app_users),
      status: item.status,
      message: item.requested_car ?? "ملف بدون سيارة محددة",
      due_at: item.next_follow_up_at,
      recipient_user_id: item.assigned_user_id ?? null,
      recipient_branch_id: item.branch_id ?? null,
      recipient_label: getRelationshipFullName(item.app_users) ?? getRelationshipName(item.branches),
      requested_car: item.requested_car ?? null,
      notes: item.notes ?? null,
      logs: Array.isArray(item.customer_logs)
        ? (item.customer_logs as any[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((l) => ({
            actor_name: l.actor_name,
            action: l.action,
            details: l.details,
            created_at: l.created_at,
          }))
        : [],
    }));

  const notifications: AgendaTaskItem[] = (notificationRows ?? []).map((item) => ({
    id: item.id,
    source: "notification",
    label: "تنبيه غير مقروء",
    customer_id: null,
    customer_name: null,
    branch_name: item.recipient_label,
    staff_name: item.recipient_label,
    status: item.status,
    message: item.message,
    due_at: item.created_at,
    recipient_user_id: item.recipient_user_id ?? null,
    recipient_branch_id: item.recipient_branch_id ?? null,
    recipient_label: item.recipient_label ?? null,
  }));

  const todayStartMs_AG = new Date(todayStrAG + "T00:00:00.000Z").getTime() - TZ_OFFSET_MS_AG;
  const dueToday = [...reminders, ...followUps].filter((item) => {
    if (!item.due_at) return false;
    const time = new Date(item.due_at).getTime();
    return !Number.isNaN(time) && time <= todayTs && time >= todayStartMs_AG;
  }).length;

  const overdue = [...reminders, ...followUps].filter((item) => {
    if (!item.due_at) return false;
    const time = new Date(item.due_at).getTime();
    return !Number.isNaN(time) && time < now;
  }).length;

  const incompleteCustomers: IncompleteCustomerItem[] = (incompleteRows ?? []).map((item) => ({
    id: item.id,
    full_name: item.full_name,
    phone: item.phone,
    branch_name: getRelationshipName(item.branches),
    staff_name: getRelationshipFullName(item.app_users),
    created_at: item.created_at,
  }));

  return {
    dueToday,
    overdue,
    reminders,
    followUps,
    notifications,
    incompleteCustomers,
  };
}

export async function getNotificationsCenter(limit = 120): Promise<{
  unreadCount: number;
  items: NotificationsCenterItem[];
}> {
  if (!hasSupabaseEnv()) {
    return { unreadCount: 0, items: [] };
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;

  const unreadCountQuery = supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("status", "unread");

  const centerQuery = supabase
    .from("notifications")
    .select("id, title, message, status, notification_type, payload, recipient_user_id, recipient_branch_id, recipient_label, created_at");

  const scopedUnread = applyBranchScope(
    unreadCountQuery,
    branchId,
    capabilities.isGeneralManager,
    isMuallim,
    "other",
    "recipient_branch_id"
  ) as typeof unreadCountQuery;
  const scopedCenter = applyBranchScope(
    centerQuery,
    branchId,
    capabilities.isGeneralManager,
    isMuallim,
    "other",
    "recipient_branch_id"
  ) as typeof centerQuery;

  const userScopedCenter = applyStaffScope(
    scopedCenter,
    userId,
    capabilities.isManager,
    "recipient_user_id",
  ) as typeof scopedCenter;

  const userScopedUnread = applyStaffScope(
    scopedUnread,
    userId,
    capabilities.isManager,
    "recipient_user_id",
  ) as typeof scopedUnread;

  const [{ count }, { data }] = await Promise.all([
    userScopedUnread,
    userScopedCenter.order("created_at", { ascending: false }).limit(limit),
  ]);

  return {
    unreadCount: count ?? 0,
    items: (data ?? []).map((item) => ({
      id: item.id,
      title: item.title ?? null,
      message: item.message,
      status: item.status,
      notification_type: item.notification_type ?? null,
      payload: (item as { payload?: Record<string, unknown> | null }).payload ?? null,
      recipient_label: item.recipient_label ?? null,
      created_at: item.created_at,
    })),
  };
}

export async function getCustomerFormOptions(): Promise<CustomerFormOptions> {
  if (!hasSupabaseEnv()) {
    return {
      branches: [],
      staff: [],
      inventoryOptions: [],
      statuses: CUSTOMER_STATUSES,
      statusesByType: STATUS_BY_TYPE,
      sources: CUSTOMER_SOURCES,
      profile: null,
      capabilities: { isGeneralManager: false, isManager: false },
    };
  }

  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const supabase = await createClient();
  const inventoryBaseQuery = supabase
    .from("inventory")
    .select("id, model, chassis_no, production_year, availability_status, deal_type, condition_label, color, owner_name, branch_id, branches(name)")
    .order("model");
  const [{ data: branches }, { data: staff }, { data: inventoryScoped }] = await Promise.all([
    supabase.from("branches").select("id, name, whatsapp_number, whatsapp_prefix").eq("is_active", true).order("name"),
    supabase
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("is_active", true)
      .order("full_name"),
    (applyBranchScope(
      inventoryBaseQuery,
      profile?.branch_id,
      capabilities.isGeneralManager,
      isMuallim,
      "inventory"
    ) as typeof inventoryBaseQuery),
  ]);

  const normalizeStatus = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
  const AR_SOLD = "مباع";
  const AR_SOLD_F = "مباعة";
  const AR_RESERVED = "محجوز";
  const AR_WITHDRAWN = "مسحوب";
  const AR_MUALLIM = "المعلم";
  const AR_DEAL_SWAP = "استبدال";
  const AR_DEAL_HIAZA = "حيازة";
  const AR_DEAL_CONSIGN = "برسم البيع";
  const AR_USED = "مستعملة";
  const isAvailable = (value: string | null | undefined) => {
    const status = normalizeStatus(value);
    if (!status) return true;
    if (status.includes(AR_SOLD) || status.includes(AR_SOLD_F)) return false;
    if (status.includes(AR_RESERVED)) return false;
    if (status.includes(AR_WITHDRAWN)) return false;
    if (status === "sold" || status === "reserved" || status === "withdrawn") return false;
    return true;
  };
  const branchNameSet = new Set((branches ?? []).map((b) => (b.name ?? "").trim().toLowerCase()));
  const toOption = (item: { id: string; model: string; production_year: number | null; chassis_no: string | null; deal_type?: string | null; owner_name?: string | null; condition_label?: string | null }) => {
    const owner = (item.owner_name ?? "").trim().toLowerCase();
    const isCustomer = Boolean(owner) && !branchNameSet.has(owner);
    // التسمية المختصرة: النوع — السنة — الحالة — اللون (بدون شاصي)
    const label = [
      item.model,
      item.production_year ? String(item.production_year) : null,
      item.condition_label ?? null,
      (item as { color?: string | null }).color ?? null,
    ].filter(Boolean).join(" — ");
    return {
      id: item.id,
      label,
      chassis_no: item.chassis_no ?? null,
      category: (isCustomer ? "customer" : "showroom") as "customer" | "showroom",
    };
  };

  let inventoryOptions = (inventoryScoped ?? [])
    .filter((item) => isAvailable(item.availability_status))
    .map(toOption);

  if (!capabilities.isGeneralManager && profile?.branch_id) {
    // نستخدم قائمة الفروع المجلوبة مسبقاً بدل استعلام إضافي
    const currentBranch = (branches ?? []).find((b) => b.id === profile!.branch_id);
    const isMuallimBranch = (currentBranch?.name ?? "").includes(AR_MUALLIM);
    if (isMuallimBranch) {
      let externalRows: Array<{
        id: string;
        model: string;
        chassis_no: string | null;
        production_year: number | null;
        availability_status: string;
        deal_type: string | null;
        condition_label: string | null;
        color: string | null;
        owner_name: string | null;
        branch_id: string | null;
      }> = [];

      if (hasSupabaseServiceRoleEnv()) {
        const admin = createAdminClient();
        const { data } = await admin
          .from("inventory")
          .select("id, model, chassis_no, production_year, availability_status, deal_type, condition_label, color, owner_name, branch_id")
          .neq("branch_id", profile.branch_id)
          .order("model");
        externalRows = (data ?? []) as typeof externalRows;
      } else {
        const { data } = await supabase
          .from("inventory")
          .select("id, model, chassis_no, production_year, availability_status, deal_type, condition_label, color, owner_name, branch_id")
          .neq("branch_id", profile.branch_id)
          .order("model");
        externalRows = (data ?? []) as typeof externalRows;
      }

      const externalOptions = (externalRows ?? [])
        .filter((item) => isAvailable(item.availability_status))
        .filter((item) => {
          const deal = (item.deal_type ?? "").trim();
          return deal.includes(AR_DEAL_SWAP) || deal.includes(AR_DEAL_HIAZA) || deal.includes(AR_DEAL_CONSIGN);
        })
        .map(toOption);

      const seen = new Set<string>();
      inventoryOptions = [...inventoryOptions, ...externalOptions].filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    }
  }

  return {
    branches: (branches ?? [])
      .filter((item) => !isVirtualBranch(item.name))
      .map((item) => ({
        id: item.id,
        name: item.name,
        whatsapp_number: (item.whatsapp_number as string | null) ?? null,
        whatsapp_prefix: (item.whatsapp_prefix as string | null) ?? "+966",
      })),
    staff: (staff ?? []).map((item) => ({
      id: item.id,
      full_name: item.full_name,
      role: item.role,
      branch_id: item.branch_id ?? null,
    })),
    inventoryOptions,
    statuses: CUSTOMER_STATUSES,
    statusesByType: STATUS_BY_TYPE,
    sources: CUSTOMER_SOURCES,
    profile,
    capabilities,
  };
}

export async function getCustomerById(customerId: string): Promise<CustomerDetail | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const customerQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, nickname, address, whatsapp_prefix, attachment_notes, metadata, operation_type, cycle_number, parent_customer_id, branches(name), app_users(full_name)",
    )
    .eq("id", customerId);

  const [{ data: customer }, { data: logs }, { data: reminders }, { data: attachments }, { data: tradeIns }] =
    await Promise.all([
      (applyBranchScope(customerQuery, branchId, capabilities.isGeneralManager, isMuallim, "customers") as typeof customerQuery).maybeSingle(),
      // admin لتجاوز RLS — السجلات المُدخلة من البوت/المني-آب قد لا تكون مرئية للـ RLS العادي
      (hasSupabaseServiceRoleEnv() ? createAdminClient() : supabase)
        .from("customer_logs")
        .select("id, action, details, actor_name, next_follow_up_at, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("reminders")
        .select(
          "id, title, message, due_at, status, assigned_user_id, branch_id, customer_id, branches(name), customers(full_name), app_users(full_name)",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(12),
      // استخدام admin لتجاوز RLS — المرفقات المُدخلة من البوت/المني-آب تكون بـ app_users.id وليس auth.uid
      (hasSupabaseServiceRoleEnv() ? createAdminClient() : supabase)
        .from("customer_attachments")
        .select("id, file_name, file_category, public_url, storage_path, mime_type, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("trade_ins")
        .select(
          "id, owner_name, model, price, chassis_no, color, production_year, mileage, specs, inspection, status, condition_label, deal_type, license_expiry, is_active, metadata, notes",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (!customer) return null;

  const parentCustomerId = (customer as Record<string, unknown>).parent_customer_id as string | null ?? null;
  const cycleNumber = (customer as Record<string, unknown>).cycle_number as number ?? 1;

  // ── 1. جلب الدورات اللاحقة (متوازٍ مع traversal الأجداد) ───────────────────
  const childCyclesPromise = supabase
    .from("customers")
    .select("id, status, cycle_number, created_at")
    .eq("parent_customer_id", customerId)
    .order("cycle_number", { ascending: true })
    .limit(10);

  // ── 2. Traversal متسلسل لكل سلسلة الأجداد (max 8 دورات) ─────────────────
  type AncestorInfo = { id: string; status: string; cycle_number: number };
  const ancestorInfos: AncestorInfo[] = [];
  const visitedIds = new Set<string>([customerId]);
  let traverseId: string | null = parentCustomerId;

  while (traverseId && !visitedIds.has(traverseId) && ancestorInfos.length < 8) {
    visitedIds.add(traverseId);
    const { data: anc } = await supabase
      .from("customers")
      .select("id, status, cycle_number, parent_customer_id")
      .eq("id", traverseId)
      .maybeSingle();
    if (!anc) break;
    ancestorInfos.push({
      id: anc.id,
      status: anc.status ?? "",
      cycle_number: (anc as Record<string, unknown>).cycle_number as number ?? 1,
    });
    traverseId = (anc as Record<string, unknown>).parent_customer_id as string | null;
  }

  // ── 3. Batch fetch سجلات كل الأجداد بطلب واحد ────────────────────────────
  const ancestorIds = ancestorInfos.map((a) => a.id);
  const [{ data: childCyclesRows }, { data: ancestorLogsRows }] = await Promise.all([
    childCyclesPromise,
    ancestorIds.length > 0
      ? supabase
          .from("customer_logs")
          .select("id, action, details, actor_name, next_follow_up_at, created_at, customer_id")
          .in("customer_id", ancestorIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ id: string; action: string; details: string | null; actor_name: string | null; next_follow_up_at: string | null; created_at: string; customer_id: string }> }),
  ]);

  // ── 4. تجميع السجلات حسب الدورة ──────────────────────────────────────────
  const logsByAncestorId = new Map<string, CustomerLogItem[]>();
  for (const row of ancestorLogsRows ?? []) {
    const entry: CustomerLogItem = {
      id: row.id,
      action: row.action,
      details: row.details,
      actor_name: row.actor_name,
      next_follow_up_at: row.next_follow_up_at,
      created_at: row.created_at,
    };
    const arr = logsByAncestorId.get(row.customer_id) ?? [];
    arr.push(entry);
    logsByAncestorId.set(row.customer_id, arr);
  }

  // الدورة الأم المباشرة (للتنقل)
  const parentCycleRow = ancestorInfos[0] ?? null;

  const base = mapCustomerRow(customer);

  // ── توقيع URLs دفعةً واحدة بدل حلقة متسلسلة (batch signed URLs) ──────────
  const pathsNeedingSigning = (attachments ?? [])
    .filter((item) => !item.public_url && item.storage_path)
    .map((item) => item.storage_path as string);

  const signedUrlMap = new Map<string, string>();
  if (pathsNeedingSigning.length > 0) {
    const { data: signedBatch } = await supabase.storage
      .from("customer-attachments")
      .createSignedUrls(pathsNeedingSigning, 60 * 60);
    for (const s of signedBatch ?? []) {
      if (s.signedUrl) signedUrlMap.set(s.path ?? "", s.signedUrl);
    }
  }

  const attachmentsWithUrls = (attachments ?? []).map((item) => ({
    id: item.id,
    file_name: item.file_name,
    file_category: item.file_category,
    public_url: item.public_url ?? signedUrlMap.get(item.storage_path ?? "") ?? null,
    storage_path: item.storage_path ?? null,
    created_at: item.created_at,
  }));

  return {
    ...base,
    nickname: customer.nickname ?? null,
    address: customer.address ?? null,
    whatsapp_prefix: customer.whatsapp_prefix ?? null,
    attachment_notes: customer.attachment_notes ?? null,
    metadata: (customer.metadata as Record<string, unknown> | null) ?? {},
    cycle_number: cycleNumber,
    parent_customer_id: parentCustomerId,
    parent_cycle: parentCycleRow
      ? { id: parentCycleRow.id, status: parentCycleRow.status, cycle_number: parentCycleRow.cycle_number }
      : null,
    ancestor_cycles: ancestorInfos.map((a) => ({
      id: a.id,
      status: a.status,
      cycle_number: a.cycle_number,
      logs: logsByAncestorId.get(a.id) ?? [],
    })),
    child_cycles: (childCyclesRows ?? []).map((r) => ({
      id: r.id,
      status: r.status ?? "",
      cycle_number: (r as Record<string, unknown>).cycle_number as number ?? 1,
      created_at: r.created_at ?? "",
    })),
    logs: (logs ?? []).map((item) => ({
      id: item.id,
      action: item.action,
      details: item.details,
      actor_name: item.actor_name,
      next_follow_up_at: item.next_follow_up_at,
      created_at: item.created_at,
    })),
    reminders: (reminders ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      due_at: item.due_at,
      status: item.status,
      branch_name: getRelationshipName(item.branches),
      customer_name: getRelationshipFullName(item.customers),
      assigned_user_name: getRelationshipFullName(item.app_users),
      assigned_user_id: item.assigned_user_id ?? null,
      branch_id: item.branch_id ?? null,
      customer_id: item.customer_id ?? null,
    })),
    attachments: attachmentsWithUrls,
    tradeIns: (tradeIns ?? []).map((item) => ({
      id: item.id,
      owner_name: item.owner_name,
      model: item.model,
      price: item.price,
      chassis_no: item.chassis_no ?? null,
      color: item.color,
      production_year: item.production_year,
      mileage: item.mileage ?? null,
      specs: item.specs ?? null,
      inspection: item.inspection ?? null,
      status: item.status,
      condition_label: item.condition_label,
      deal_type: item.deal_type,
      license_expiry: item.license_expiry ?? null,
      is_active: item.is_active ?? true,
      metadata: (item.metadata as Record<string, unknown> | null) ?? {},
      notes: item.notes,
    })),
  };
}

function getTradeMissingFields(item: {
  model?: string | null;
  color?: string | null;
  production_year?: number | null;
  mileage?: number | null;
  specs?: string | null;
  inspection?: string | null;
  price?: number | null;
  chassis_no?: string | null;
  license_expiry?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const missing: string[] = [];
  const valueOrEmpty = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const numberMissing = (value: number | null | undefined) => value == null || Number.isNaN(value) || value <= 0;

  if (!valueOrEmpty(item.model)) missing.push("نوع السيارة");
  if (!valueOrEmpty(item.color)) missing.push("اللون");
  if (numberMissing(item.production_year)) missing.push("سنة التصنيع");
  if (numberMissing(item.mileage)) missing.push("العداد");
  if (!valueOrEmpty(item.specs)) missing.push("المواصفات");
  if (!valueOrEmpty(item.inspection)) missing.push("الفحص");
  if (numberMissing(item.price)) missing.push("سعر التقييم");
  if (!valueOrEmpty(item.chassis_no)) missing.push("الشاصي");
  if (!valueOrEmpty(item.license_expiry)) missing.push("تاريخ انتهاء الرخصة");

  const fuel = valueOrEmpty(item.metadata?.fuel);
  const gear = valueOrEmpty(item.metadata?.gear);
  if (!fuel) missing.push("نوع الوقود");
  if (!gear) missing.push("ناقل الحركة");

  return missing;
}

export function getLicenseAlertText(licenseExpiry: string | null) {
  if (!licenseExpiry) return null;

  const target = new Date(licenseExpiry);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return `الرخصة منتهية منذ ${Math.abs(days)} يوم`;
  if (days <= 30) return `الرخصة تنتهي خلال ${days} يوم`;
  return null;
}

/**
 * إحصائيات جودة البيانات — queries خفيفة بدلاً من جلب آلاف السجلات
 */
export async function getDataQualityCounts(): Promise<{
  active: number;
  closed: number;
  missingFollowup: number;
  missingRequestedCar: number;
}> {
  if (!hasSupabaseEnv()) return { active: 0, closed: 0, missingFollowup: 0, missingRequestedCar: 0 };

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;

  const createBase = () => supabase.from("customers").select("*", { count: "exact", head: true });
  const scoped = (q: ReturnType<typeof createBase>) =>
    applyBranchScope(q, branchId, capabilities.isGeneralManager, isMuallim, "customers") as ReturnType<typeof createBase>;

  const [
    { count: active },
    { count: closed },
    { count: missingFollowup },
    { count: missingRequestedCar },
  ] = await Promise.all([
    scoped(createBase().eq("is_active", true)),
    scoped(createBase().eq("is_active", false)),
    scoped(createBase().eq("is_active", true).is("next_follow_up_at", null)),
    scoped(createBase().eq("is_active", true).or("requested_car.is.null,requested_car.eq.")),
  ]);

  return {
    active: active ?? 0,
    closed: closed ?? 0,
    missingFollowup: missingFollowup ?? 0,
    missingRequestedCar: missingRequestedCar ?? 0,
  };
}

export async function getOperationalAlerts(): Promise<{
  incompleteTrades: OperationalAlertItem[];
  licenseDue: OperationalAlertItem[];
}> {
  if (!hasSupabaseEnv()) {
    return {
      incompleteTrades: [],
      licenseDue: [],
    };
  }

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;

  const customersQuery = supabase
    .from("customers")
    .select(
      "id, full_name, status, requested_car, branch_id, assigned_user_id, branches(name), app_users(full_name), trade_ins(id, model, status, license_expiry, color, production_year, mileage, specs, inspection, price, chassis_no, is_active, metadata)",
    );

  const { data } = await (applyStaffScope(
    applyBranchScope(customersQuery, branchId, capabilities.isGeneralManager, isMuallim, "customers") as typeof customersQuery,
    userId,
    capabilities.isManager,
  ) as typeof customersQuery).limit(250);

  const incompleteTrades: OperationalAlertItem[] = [];
  const licenseDue: OperationalAlertItem[] = [];
  const REJECT_WORD = "رفض";
  const BACK_OUT_WORD = "تراجع";
  const SOLD_OUT_WORD = "بيع السيارة لعميل خارجي";

  for (const customer of data ?? []) {
    const tradeList = Array.isArray(customer.trade_ins) ? customer.trade_ins : [];

    for (const trade of tradeList) {
      if (!trade?.id) continue;

      const alertBase: OperationalAlertItem = {
        customer_id: customer.id,
        customer_name: customer.full_name,
        branch_id: customer.branch_id ?? null,
        branch_name: getRelationshipName(customer.branches),
        staff_id: customer.assigned_user_id ?? null,
        staff_name: getRelationshipFullName(customer.app_users),
        customer_status: customer.status,
        requested_car: customer.requested_car ?? null,
        trade_in_id: trade.id,
        trade_in_model: trade.model,
        trade_in_status: trade.status ?? null,
        trade_in_license_expiry: trade.license_expiry ?? null,
        trade_in_missing_fields: getTradeMissingFields(trade),
      };

      const isActiveTrade = Boolean(trade?.is_active);
      const tradeStatus = (trade.status ?? "").trim();
      const isClosedForMissingFlow =
        tradeStatus.includes(REJECT_WORD) || tradeStatus.includes(BACK_OUT_WORD) || tradeStatus.includes(SOLD_OUT_WORD);

      if (isActiveTrade && !isClosedForMissingFlow && alertBase.trade_in_missing_fields.length > 0) {
        incompleteTrades.push(alertBase);
      }

      // License alerts should remain visible until the license-expiry date itself changes.
      // Do not hide them based on trade activity/status updates.
      if (getLicenseAlertText(trade.license_expiry ?? null)) {
        licenseDue.push(alertBase);
      }
    }
  }

  return {
    incompleteTrades,
    licenseDue,
  };
}

// ─── Branch Admin ─────────────────────────────────────────────────────────────

export type BranchAdminItem = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  whatsapp_number: string | null;
  whatsapp_prefix: string | null;
  is_active: boolean;
  created_at: string | null;
  total_staff: number;
  total_customers: number;
};

/**
 * جلب كل المعارض مع إحصائيات الموظفين والعملاء — للمدير العام فقط
 */
export async function getBranchesAdmin(): Promise<BranchAdminItem[]> {
  if (!hasSupabaseEnv()) return [];

  // نستخدم admin إن توفّر، وإلا نستخدم العميل العادي
  const client = hasSupabaseServiceRoleEnv() ? createAdminClient() : await createClient();

  // نجرّب أولاً مع الأعمدة الكاملة (بعد Migration)
  // وإن فشلت نعيد المحاولة بالأعمدة الأساسية فقط
  let branchData: { id: string; name: string; is_active: boolean | null; city?: string | null; address?: string | null; whatsapp_number?: string | null; whatsapp_prefix?: string | null; created_at?: string | null }[] = [];

  const fullQuery = await client
    .from("branches")
    .select("id, name, city, address, whatsapp_number, whatsapp_prefix, is_active, created_at")
    .order("is_active", { ascending: false })
    .order("name");

  if (fullQuery.error) {
    // فشلت — نحاول بالأعمدة الأساسية فقط
    const basicQuery = await client
      .from("branches")
      .select("id, name, is_active")
      .order("is_active", { ascending: false })
      .order("name");
    branchData = (basicQuery.data ?? []) as typeof branchData;
  } else {
    branchData = (fullQuery.data ?? []) as typeof branchData;
  }

  const [{ data: staffRows }, { data: customerRows }] = await Promise.all([
    client.from("app_users").select("branch_id").eq("is_active", true),
    client.from("customers").select("branch_id").eq("is_active", true),
  ]);

  const staffCount = new Map<string, number>();
  (staffRows ?? []).forEach((r) => {
    if (r.branch_id) staffCount.set(r.branch_id, (staffCount.get(r.branch_id) ?? 0) + 1);
  });

  const custCount = new Map<string, number>();
  (customerRows ?? []).forEach((r) => {
    if (r.branch_id) custCount.set(r.branch_id, (custCount.get(r.branch_id) ?? 0) + 1);
  });

  return branchData.map((b) => ({
    id: b.id as string,
    name: (b.name ?? "") as string,
    city: (b.city as string | null) ?? null,
    address: (b.address as string | null) ?? null,
    whatsapp_number: (b.whatsapp_number as string | null) ?? null,
    whatsapp_prefix: (b.whatsapp_prefix as string | null) ?? "+966",
    is_active: b.is_active !== false,
    created_at: (b.created_at as string | null) ?? null,
    total_staff: staffCount.get(b.id as string) ?? 0,
    total_customers: custCount.get(b.id as string) ?? 0,
  }));
}

// ─── سيارات بانتظار التقييم — بطاقة كاملة ───────────────────────────────────

export type EvaluationStaffMember = {
  id: string;
  full_name: string;
  role: string;
};

export type PendingEvaluationItem = {
  id: string;
  full_name: string;
  phone: string | null;
  status: string;
  operation_type: string | null;
  requested_car: string | null;
  notes: string | null;
  branch_id: string | null;
  branch_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  // تفاصيل سيارة العميل (trade-in / بيع بالوكالة)
  trade_in_id: string | null;
  trade_in_model: string | null;
  trade_in_color: string | null;
  trade_in_year: number | null;
  trade_in_mileage: number | null;
  trade_in_price: number | null;
  trade_in_chassis: string | null;
  trade_in_inspection: string | null;
  trade_in_status: string | null;
  // صور سيارة العميل
  photos: Array<{ id: string; public_url: string; file_name: string }>;
  // موظفو الفرع (لزر التذكير) — يشمل مدير الفرع والموظفين والمدير العام
  branch_staff: EvaluationStaffMember[];
  // السجل التاريخي للعميل
  logs: Array<{ actor_name: string | null; action: string | null; details: string | null; created_at: string }>;
};

export async function getPendingEvaluationWithDetails(): Promise<PendingEvaluationItem[]> {
  if (!hasSupabaseEnv()) return [];

  const supabase = await createClient();
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;

  const query = supabase
    .from("customers")
    .select(
      "id, full_name, phone, status, operation_type, requested_car, notes, branch_id, assigned_user_id, branches(name), app_users(full_name), trade_ins(id, model, color, production_year, mileage, price, chassis_no, inspection, status, is_active), customer_logs(actor_name, action, details, created_at)",
    )
    .or("status.ilike.%التقييم%")
    .eq("is_active", true);

  const scoped = applyStaffScope(
    applyBranchScope(query, branchId, capabilities.isGeneralManager, isMuallim, "customers", "branch_id", true) as typeof query,
    userId,
    capabilities.isManager,
  ) as typeof query;

  const { data } = await scoped.order("updated_at", { ascending: false }).limit(100);

  if (!data || data.length === 0) return [];

  // ── جلب الصور ──────────────────────────────────────────────────────────────
  const customerIds = data.map((c) => c.id);
  const { data: attachments } = await supabase
    .from("customer_attachments")
    .select("id, customer_id, public_url, file_name, file_category, mime_type")
    .in("customer_id", customerIds)
    .not("file_category", "eq", "voice_note")
    .order("created_at", { ascending: false });

  const photosByCustomer = new Map<string, Array<{ id: string; public_url: string; file_name: string }>>();
  for (const att of attachments ?? []) {
    if (att.mime_type?.startsWith("audio/")) continue;
    const arr = photosByCustomer.get(att.customer_id) ?? [];
    arr.push({ id: att.id, public_url: att.public_url, file_name: att.file_name });
    photosByCustomer.set(att.customer_id, arr);
  }

  // ── جلب موظفي الفروع المعنية (لزر التذكير) ─────────────────────────────────
  const branchIds = [...new Set(data.map((c) => c.branch_id).filter(Boolean))] as string[];
  const { data: staffRows } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("is_active", true)
    .or(
      branchIds.length > 0
        ? `branch_id.in.(${branchIds.map((b) => `"${b}"`).join(",")}),role.eq.general_manager`
        : "role.eq.general_manager",
    );

  // تجميع الموظفين حسب الفرع (+ المدير العام يُضاف لكل الفروع)
  const gmStaff: EvaluationStaffMember[] = (staffRows ?? [])
    .filter((u) => getRoleCapabilities(u.role as string, u.full_name as string).isGeneralManager)
    .map((u) => ({ id: u.id as string, full_name: (u.full_name as string) ?? "", role: u.role as string }));

  const staffByBranch = new Map<string, EvaluationStaffMember[]>();
  for (const u of staffRows ?? []) {
    if (getRoleCapabilities(u.role as string, u.full_name as string).isGeneralManager) continue;
    const bid = u.branch_id as string | null;
    if (!bid) continue;
    const arr = staffByBranch.get(bid) ?? [];
    arr.push({ id: u.id as string, full_name: (u.full_name as string) ?? "", role: u.role as string });
    staffByBranch.set(bid, arr);
  }

  const items = data.map((customer) => {
    const trades = Array.isArray(customer.trade_ins) ? customer.trade_ins : [];
    const activeTrade = trades.find((t) => (t as Record<string, unknown>).is_active) ?? trades[0] ?? null;
    const t = activeTrade as Record<string, unknown> | null;
    const bid = customer.branch_id ?? null;
    const branchStaff = bid ? (staffByBranch.get(bid) ?? []) : [];
    const allStaff = [...branchStaff, ...gmStaff];
    // إزالة المكررين (المدير العام قد يكون في الفرع أيضاً)
    const uniqueStaff = allStaff.filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx);

    return {
      id: customer.id,
      full_name: customer.full_name,
      phone: customer.phone ?? null,
      status: customer.status ?? "",
      operation_type: (customer.operation_type as string | null) ?? null,
      requested_car: customer.requested_car ?? null,
      notes: (customer.notes as string | null) ?? null,
      branch_id: bid,
      branch_name: getRelationshipName(customer.branches),
      assigned_user_id: customer.assigned_user_id ?? null,
      assigned_user_name: getRelationshipFullName(customer.app_users),
      trade_in_id: (t?.id as string | null) ?? null,
      trade_in_model: (t?.model as string | null) ?? null,
      trade_in_color: (t?.color as string | null) ?? null,
      trade_in_year: (t?.production_year as number | null) ?? null,
      trade_in_mileage: (t?.mileage as number | null) ?? null,
      trade_in_price: (t?.price as number | null) ?? null,
      trade_in_chassis: (t?.chassis_no as string | null) ?? null,
      trade_in_inspection: (t?.inspection as string | null) ?? null,
      trade_in_status: (t?.status as string | null) ?? null,
      photos: photosByCustomer.get(customer.id) ?? [],
      branch_staff: uniqueStaff,
      logs: Array.isArray(customer.customer_logs)
        ? (customer.customer_logs as any[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((l) => ({
            actor_name: l.actor_name,
            action: l.action,
            details: l.details,
            created_at: l.created_at,
          }))
        : [],
    };
  });

  // ── فلتر: يظهر في الأجندة فقط إذا لم يُدخل سعر التقييم بعد ──────────────
  return items.filter((item) => item.trade_in_price === null || item.trade_in_price === undefined);
}

