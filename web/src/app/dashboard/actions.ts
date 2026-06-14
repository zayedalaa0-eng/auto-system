"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasSupabaseEnv } from "@/lib/env";
import { getRoleCapabilities } from "@/lib/roles";
import { PHONE_LENGTH, PHONE_ERROR_MESSAGE, normalizePhone } from "@/lib/phone";
import { createAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pushTelegramToManagers, pushTelegramPhotosToManagers, pushTelegramToEmployee, pushNewCustomerToManagers, pushTelegramOpportunity } from "@/lib/telegram/push";

async function getCurrentProfile() {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  return profile;
}

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getNullableText(formData: FormData, key: string) {
  const value = getText(formData, key);
  return value || null;
}

function getBoolean(formData: FormData, key: string) {
  return String(formData.get(key) ?? "") === "on";
}

function parseDateTimeLocal(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRequestedCarFromTrade(tradeModel: string | null, tradeYear: number | null) {
  const model = (tradeModel ?? "").trim();
  if (!model) return null;
  return tradeYear ? `${model} - موديل:${tradeYear}` : model;
}

function normalizeRequestedCarsText(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parts = raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of parts) {
    const key = item.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.join(" | ");
}

/**
 * يُعيد التاريخ والوقت بالعربية بتوقيت غرينيتش+3 (توقيت السعودية/فلسطين)
 */
function arabicDateTime(date: Date = new Date()): string {
  const local = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const d = String(local.getUTCDate()).padStart(2, "0");
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const y = local.getUTCFullYear();
  const h = String(local.getUTCHours()).padStart(2, "0");
  const min = String(local.getUTCMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${h}:${min}`;
}

/**
 * يجلب بيانات العميل الكاملة لبناء رسالة إشعار احترافية
 */
async function fetchCustomerContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
): Promise<{
  fullName: string;
  nickname: string | null;
  phone: string;
  requestedCar: string | null;
  operationType: string | null;
  assignedUserName: string | null;
  branchName: string | null;
}> {
  const { data } = await supabase
    .from("customers")
    .select(
      "full_name, nickname, phone, requested_car, metadata, branch_id, assigned_user_id, " +
      "branches(name), app_users(full_name)",
    )
    .eq("id", customerId)
    .maybeSingle<{
      full_name: string | null;
      nickname: string | null;
      phone: string | null;
      requested_car: string | null;
      metadata: Record<string, unknown> | null;
      branches: { name?: string } | { name?: string }[] | null;
      app_users: { full_name?: string } | { full_name?: string }[] | null;
    }>();

  const meta = (data?.metadata as Record<string, unknown> | null) ?? {};
  const operationType =
    typeof meta.operation_type === "string" ? meta.operation_type : null;

  // branches و app_users قد يعودان كمصفوفة أو كائن واحد
  const branchesRaw = data?.branches;
  const usersRaw = data?.app_users;
  const branchName =
    (Array.isArray(branchesRaw) ? branchesRaw[0]?.name : (branchesRaw as { name?: string } | null)?.name) ?? null;
  const assignedUserName =
    (Array.isArray(usersRaw) ? usersRaw[0]?.full_name : (usersRaw as { full_name?: string } | null)?.full_name) ?? null;

  return {
    fullName: data?.full_name ?? "—",
    nickname: data?.nickname ?? null,
    phone: data?.phone ?? "—",
    requestedCar: data?.requested_car ?? null,
    operationType,
    assignedUserName,
    branchName,
  };
}

/**
 * يبني رسالة إشعار احترافية كاملة التفاصيل
 *
 * النتيجة: { title, message } — تُمرَّر مباشرة لـ sendManagementActivityNotification
 */
function buildStatusNotification({
  status,
  ctx,
  actorName,
  note,
  nextFollowUpAt,
  dealValue,
}: {
  status: string;
  ctx: Awaited<ReturnType<typeof fetchCustomerContext>>;
  actorName: string;
  note: string | null;
  nextFollowUpAt: string | null;
  dealValue?: number | null;
}): { title: string; message: string } {
  const now = arabicDateTime();
  const followUpStr = nextFollowUpAt ? arabicDateTime(new Date(nextFollowUpAt)) : null;

  const isSellOnBehalf = ctx.operationType === "بيع بالوكالة" || ctx.operationType === "sell_on_behalf";

  const customerBlock =
    `👤 <b>تفاصيل العميل:</b>\n` +
    `<blockquote><b>الاسم الكامل:</b> ${ctx.fullName}\n` +
    (ctx.nickname ? `<b>الكنية:</b> ${ctx.nickname}\n` : "") +
    `<b>الهاتف:</b> <code>${ctx.phone}</code>\n` +
    (ctx.operationType ? `<b>نوع العملية:</b> ${isSellOnBehalf ? "بيع بالوكالة" : ctx.operationType}\n` : "") +
    (ctx.requestedCar ? `<b>السيارة المطلوبة:</b> ${ctx.requestedCar}\n` : "") +
    `</blockquote>`;

  const footerBlock =
    `<blockquote>` +
    (ctx.assignedUserName ? `<b>الموظف المسؤول:</b> ${ctx.assignedUserName}\n` : "") +
    (ctx.branchName ? `<b>المعرض:</b> ${ctx.branchName}\n` : "") +
    (note ? `<b>الملاحظات:</b> ${note}\n` : "") +
    `</blockquote>` +
    `<i>🕐 ${now}</i>`;

  const dealValueStr = dealValue && dealValue > 0
    ? `<blockquote><b>💰 قيمة الصفقة:</b> ${dealValue.toLocaleString("en-US")} شيقل</blockquote>\n`
    : "";

  // ── تمت عملية البيع + استبدال ───────────────────────────────────────────
  if (status === "تمت عملية البيع + استبدال" || status === "تمت عملية البيع (للعميل)" || status === "شراء من قبل المعرض") {
    const isTradein = status === "تمت عملية البيع + استبدال";
    const isShowroom = status === "شراء من قبل المعرض";
    const emoji = isTradein ? "🔄" : isShowroom ? "🏢" : "🎉";
    
    let titleText = isTradein ? "تمّت صفقة البيع + الاستبدال بنجاح" : isShowroom ? "شراء سيارة من قبل المعرض" : "تمّت عملية بيع السيارة للعميل";
    if (isSellOnBehalf && status === "تمت عملية البيع (للعميل)") {
      titleText = "تمّت بيع السيارة المعروضة بالوكالة للعميل";
    }

    return {
      title: `${emoji} ${titleText}`,
      message:
        `${emoji} <b>${titleText}</b>\n` +
        `أتمّ الموظف <b>${actorName}</b> الصفقة بنجاح.\n\n` +
        customerBlock + `\n` +
        `📌 <b>تفاصيل الحالة والمبيعات:</b>\n` +
        `<blockquote><b>الحالة المُسجَّلة:</b> ${status}</blockquote>\n` +
        dealValueStr + `\n` +
        `🏢 <b>سياق العملية:</b>\n` +
        footerBlock,
    };
  }

  // ── تمت عملية البيع (مشتري عادي) ────────────────────────────────────────
  if (status === "تمت عملية البيع") {
    return {
      title: "🎉 تمّت عملية بيع بنجاح",
      message:
        `🎉 <b>تمّت عملية بيع بنجاح</b>\n` +
        `أتمّ الموظف <b>${actorName}</b> صفقة بيع ناجحة.\n\n` +
        customerBlock + `\n` +
        `📌 <b>تفاصيل الحالة والمبيعات:</b>\n` +
        `<blockquote><b>الحالة المُسجَّلة:</b> ${status}</blockquote>\n` +
        dealValueStr + `\n` +
        `🏢 <b>سياق العملية:</b>\n` +
        footerBlock,
    };
  }

  // ── حجز ─────────────────────────────────────────────────────────────────
  if (status === "حجز" || status === "حجز (استبدال)" || status === "حجز (سيارة العميل)") {
    const title = isSellOnBehalf ? "🔒 تسجيل حجز سيارة برسم البيع" : "🔒 تسجيل حجز سيارة";
    return {
      title,
      message:
        `🔒 <b>${title} جديد</b>\n` +
        `سجّل الموظف <b>${actorName}</b> حجزاً جديداً.\n\n` +
        customerBlock + `\n` +
        `📌 <b>تفاصيل الحالة والمتابعة:</b>\n` +
        `<blockquote><b>الحالة المُسجَّلة:</b> ${status}\n` +
        (followUpStr ? `<b>موعد المتابعة:</b> ${followUpStr}` : "") +
        `</blockquote>\n\n` +
        `🏢 <b>سياق العملية:</b>\n` +
        footerBlock,
    };
  }

  // ── تراجع / سحب ──────────────────────────────────────────────────────────
  if (status === "تراجع العميل عن الاستبدال" || status === "سحب السيارة من البيع") {
    const titleText = isSellOnBehalf ? "↩️ سحب السيارة المعروضة من البيع" : "↩️ تراجع العميل عن صفقة الاستبدال";
    return {
      title: titleText,
      message:
        `↩️ <b>${titleText}</b>\n` +
        `سجّل الموظف <b>${actorName}</b> الإجراء.\n\n` +
        customerBlock + `\n` +
        `📌 <b>تفاصيل الحالة:</b>\n` +
        `<blockquote><b>الحالة المُسجَّلة:</b> ${status}\n` +
        (note ? `<b>السبب:</b> ${note}` : "") +
        `</blockquote>\n\n` +
        `🏢 <b>سياق العملية:</b>\n` +
        footerBlock,
    };
  }

  // ── رفض ──────────────────────────────────────────────────────────────────
  if (status === "رفض من قبل العميل" || status === "رفض من قبل المعرض") {
    const byClient = status === "رفض من قبل العميل";
    return {
      title: byClient ? "⚠️ رفض من قبل العميل" : "⚠️ رفض من قبل المعرض",
      message:
        `⚠️ <b>${byClient ? "رفض العميل للعرض" : "رفض المعرض للطلب"} — يحتاج متابعة</b>\n` +
        `سجّل الموظف <b>${actorName}</b> حالة الرفض.\n\n` +
        customerBlock + `\n` +
        `📌 <b>تفاصيل الحالة:</b>\n` +
        `<blockquote><b>الحالة المُسجَّلة:</b> ${status}\n` +
        (note
          ? `<b>سبب الرفض:</b> ${note}`
          : `<b>سبب الرفض:</b> لم يُذكر — يُنصح بالتواصل مع الموظف.`) +
        `</blockquote>\n\n` +
        `🏢 <b>سياق العملية:</b>\n` +
        footerBlock,
    };
  }

  // ── حالة عامة ───────────────────────────────────────────────────────────
  const genericTitle = isSellOnBehalf ? "📝 تحديث سيارة برسم البيع" : "📋 تحديث ملف عميل";
  return {
    title: genericTitle,
    message:
      `📋 <b>${genericTitle}</b>\n` +
      `قام الموظف <b>${actorName}</b> بتحديث الملف.\n\n` +
      customerBlock + `\n` +
      `📌 <b>الحالة الجديدة:</b>\n` +
      `<blockquote>${status}</blockquote>\n\n` +
      `🏢 <b>سياق العملية:</b>\n` +
      footerBlock,
  };
}

function isClosedStatus(status: string) {
  return (
    status.includes("تمت عملية البيع") ||
    status.includes("شراء من قبل المعرض") ||
    status.includes("رفض من قبل العميل") ||
    status.includes("رفض من قبل المعرض") ||
    status.includes("تراجع العميل عن الاستبدال") ||
    status.includes("سحب السيارة من البيع") ||
    status === "إغلاق الملف"
  );
}

function encodeRedirectError(message: string) {
  return encodeURIComponent(message);
}

function appendNoticeParam(path: string, notice: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}notice=${encodeURIComponent(notice)}`;
}

function getAppBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

function normalizeRole(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * يرسل إشعار تقييم سيارة احترافي شامل:
 * 1) رسالة نصية بكل بيانات السيارة والعميل
 * 2) صور السيارة كألبوم (إن وُجدت)
 */
async function pushTradeAssessmentNotification({
  supabase,
  actorProfile,
  branchId,
  customerId,
  customerName,
  customerNickname,
  customerPhone,
  tradeModel,
  tradeStatus,
  tradeChassis,
  tradeColor,
  tradeYear,
  tradeMileage,
  tradePrice,
  tradeSpecs,
  tradeInspection,
  signedPhotoUrls,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actorProfile: Awaited<ReturnType<typeof getCurrentProfile>>;
  branchId: string | null;
  customerId: string;
  customerName: string;
  customerNickname: string | null;
  customerPhone: string;
  tradeModel: string | null;
  tradeStatus: string | null;
  tradeChassis: string | null;
  tradeColor: string | null;
  tradeYear: number | null;
  tradeMileage: number | null;
  tradePrice: number | null;
  tradeSpecs: string | null;
  tradeInspection: string | null;
  signedPhotoUrls: string[];
}) {
  const model = (tradeModel ?? "").trim();
  if (!model) return;

  const actorName = actorProfile?.full_name ?? "موظف";
  const isConsignment = (tradeStatus ?? "").includes("برسم البيع") || (tradeStatus ?? "").includes("وكالة") || (tradeStatus ?? "").includes("بيع");
  const isAwaitingAssessment = !isConsignment && ((tradeStatus ?? "").includes("بانتظار التقييم") || (tradeStatus ?? "").includes("تقييم"));
  const customerDisplay = customerNickname ? `${customerName} (${customerNickname})` : customerName;

  // ── الرسالة النصية الشاملة ─────────────────────────────────────────────
  const emoji = isConsignment ? "🏷️" : isAwaitingAssessment ? "🔍" : "🚗";
  const titleLine = isConsignment
    ? `🏷️ <b>سيارة جديدة برسم البيع (وكالة) — تفاصيل معروضة</b>`
    : isAwaitingAssessment
      ? `🔍 <b>طلب تقييم سيارة استبدال — يحتاج مراجعة فورية</b>`
      : `🚗 <b>سيارة مرتبطة بعملية استبدال</b>`;

  let msg = `${emoji} ${titleLine}\n\n`;

  msg += `👤 <b>بيانات العميل:</b>\n`;
  msg += `<blockquote><b>الاسم الكامل:</b> ${customerDisplay}\n`;
  msg += `<b>الهاتف:</b> <code>${customerPhone}</code></blockquote>\n\n`;

  msg += `🚗 <b>تفاصيل السيارة:</b>\n`;
  msg += `<blockquote><b>الطراز/الموديل:</b> ${model}\n`;
  if (tradeYear) msg += `<b>سنة الصنع:</b> ${tradeYear}\n`;
  if (tradeColor) msg += `<b>اللون:</b> ${tradeColor}\n`;
  if (tradeChassis) msg += `<b>رقم الشاصي:</b> <code>${tradeChassis}</code>\n`;
  if (tradeMileage) msg += `<b>عداد المسافة:</b> ${tradeMileage.toLocaleString("en-US")} كم\n`;
  if (tradePrice) msg += `<b>السعر التقديري:</b> ${tradePrice.toLocaleString("en-US")} شيقل\n`;
  if (tradeStatus) msg += `<b>الحالة الحالية:</b> ${tradeStatus}\n`;

  if (tradeSpecs && tradeSpecs.trim()) {
    msg += `\n<b>📋 المواصفات:</b>\n<i>${tradeSpecs.trim()}</i>\n`;
  }
  if (tradeInspection && tradeInspection.trim()) {
    msg += `\n<b>🔧 الفحص / الملاحظات الفنية:</b>\n<i>${tradeInspection.trim()}</i>\n`;
  }
  msg = msg.trim() + `</blockquote>\n\n`;

  if (signedPhotoUrls.length > 0) {
    msg += `📸 <b>الصور:</b> ${signedPhotoUrls.length} صورة مرفقة أدناه\n`;
  } else {
    msg += `📸 <i>لا توجد صور مرفقة حالياً</i>\n`;
  }
  msg += `\n👨‍💼 <b>بواسطة الموظف:</b> <b>${actorName}</b>\n`;
  msg += `🕐 <i>${arabicDateTime()}</i>`;

  // ── إرسال الرسالة النصية ──────────────────────────────────────────────
  await sendManagementActivityNotification({
    supabase,
    actorProfile,
    branchId,
    title: isConsignment ? `${emoji} سيارة برسم البيع` : isAwaitingAssessment ? `${emoji} طلب تقييم سيارة` : `${emoji} سيارة استبدال`,
    message: msg,
    notificationType: isConsignment ? "inventory_consignment" : "trade_assessment",
    payload: {
      source: isConsignment ? "inventory_consignment" : "trade_assessment",
      customer_id: customerId,
      trade_model: model,
      chassis_no: tradeChassis,
    },
  });

  // ── إرسال الصور كألبوم (بعد الرسالة النصية مباشرة) ───────────────────
  if (signedPhotoUrls.length > 0) {
    const photoCaption =
      `📸 <b>صور السيارة — ${model}</b>\n` +
      `👤 ${customerDisplay} | 📱 <code>${customerPhone}</code>`;
    void pushTelegramPhotosToManagers({ branchId, caption: photoCaption, photoUrls: signedPhotoUrls });
  }
}

async function sendManagementActivityNotification({
  supabase,
  actorProfile,
  branchId,
  title,
  message,
  notificationType,
  payload,
  customerId,
  skipTelegramPush = false,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actorProfile: Awaited<ReturnType<typeof getCurrentProfile>>;
  branchId: string | null;
  title: string;
  message: string;
  notificationType?: string;
  payload?: Record<string, unknown>;
  customerId?: string | null;
  skipTelegramPush?: boolean;
}) {
  const writer = hasSupabaseServiceRoleEnv() ? createAdminClient() : supabase;

  const { data: users } = await writer
    .from("app_users")
    .select("id, full_name, role, branch_id, is_active, status");

  const recipients = (users ?? []).filter((user) => {
    const isActive = user.is_active !== false && String(user.status ?? "active").toLowerCase() !== "inactive";
    if (!isActive) return false;
    const caps = getRoleCapabilities(user.role, user.full_name);
    if (caps.isGeneralManager) return true;
    if (caps.isManager && !caps.isGeneralManager && branchId && user.branch_id === branchId) return true;
    return false;
  });

  if (recipients.length === 0) return;

  const rows = recipients.map((recipient) => ({
    recipient_user_id: recipient.id,
    recipient_branch_id: recipient.branch_id ?? null,
    recipient_label: recipient.full_name ?? null,
    notification_type: notificationType ?? "customer_activity",
    title,
    message,
    status: "unread",
    created_by_user_id: actorProfile?.id ?? null,
    payload: {
      source: "customer_activity",
      actor_name: actorProfile?.full_name ?? "النظام",
      actor_role: actorProfile?.role ?? null,
      ...payload,
    },
  }));

  await writer.from("notifications").insert(rows);

  if (skipTelegramPush) return;

  // Fire-and-forget Telegram push to managers with linked accounts
  const resolvedCustomerId = customerId ?? (payload?.customer_id as string | null | undefined) ?? null;
  void pushTelegramToManagers({ branchId, title, message, customerId: resolvedCustomerId });
}

async function notifyOpportunityForModelAvailability({
  supabase,
  actorProfile,
  model,
  chassisNo,
  ownerName,
  branchId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actorProfile: Awaited<ReturnType<typeof getCurrentProfile>>;
  model: string;
  chassisNo: string | null;
  ownerName: string | null;
  branchId: string | null;
}) {
  const cleanModel = model.trim();
  if (!cleanModel) return;

  const reader = hasSupabaseServiceRoleEnv() ? createAdminClient() : supabase;

  // جلب آخر 1000 عميل نشط يمتلكون طلب سيارة
  const { data: candidates } = await reader
    .from("customers")
    .select("id, full_name, phone, requested_car, is_active")
    .eq("is_active", true)
    .not("requested_car", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);

  const normalizeForMatch = (s: string) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').trim();
  const invStr = normalizeForMatch(cleanModel);

  // قائمة الكلمات العامة والماركات التي لا تكفي وحدها لتأكيد التطابق
  const genericWords = new Set([
    'هونداي', 'هيونداي', 'hyundai', 'كيا', 'kia', 'تويوتا', 'toyota', 'نيسان', 'nissan',
    'سكودا', 'skoda', 'مرسيدس', 'mercedes', 'بيجو', 'peugeot', 'ستروين', 'سيتروين', 'citroen',
    'فولكس', 'فاج', 'volkswagen', 'vw', 'اودي', 'audi', 'ام', 'جي', 'mg', 'شانجان', 'changan',
    'هوندا', 'honda', 'فورد', 'ford', 'شيفروليه', 'شفروليه', 'chevrolet', 'لكزس', 'lexus',
    'مازدا', 'mazda', 'رينو', 'renault', 'فيات', 'fiat', 'بي', 'دبليو', 'bmw', 'جيب', 'jeep',
    'لاندروفر', 'لاند', 'روفر', 'land', 'rover', 'ميتسوبيشي', 'mitsubishi', 'سيات', 'seat',
    'سياره', 'طلب', 'خاص', 'موديل', 'سنه', 'سنة', 'لون', 'مستعمل', 'مستعمله', 'جديد', 'جديده',
    'بدون', 'فتحه', 'بانوراما', 'جير', 'اوتوماتيك', 'عادي', 'ديزل', 'بنزين', 'كهرباء', 'هايبرد'
  ]);

  const interestedCustomers = (candidates ?? []).filter((row) => {
    const reqStr = normalizeForMatch(String(row.requested_car ?? ""));
    if (!reqStr) return false;

    // 1. التطابق المباشر أو التضمين الكامل
    if (invStr.includes(reqStr) || reqStr.includes(invStr)) {
      // لا نعتبره تطابقاً إذا كان النص المطلوب هو مجرد كلمة عامة مثل "هونداي" أو سنة مثل "2024"
      if (genericWords.has(reqStr) || !isNaN(Number(reqStr))) return false;
      return true;
    }

    // 2. مطابقة الكلمات (الـ Tokens) للبحث عن الموديل الفعلي المشترك
    const invTokens = invStr.split(/[\s\-_/|]+/).filter(t => t.length >= 2);
    const reqTokens = reqStr.split(/[\s\-_/|]+/).filter(t => t.length >= 2);

    let nonGenericMatchFound = false;
    for (const rT of reqTokens) {
      // نبحث عن الكلمة في اسم السيارة المعروضة
      const matchedInvT = invTokens.find(iT => iT === rT || iT.includes(rT) || rT.includes(iT));
      if (matchedInvT) {
        // يجب ألا تكون الكلمة المطابقة مجرد اسم ماركة، أو رقم سنة، لتعتبر تطابقاً حقيقياً
        const isNum = !isNaN(Number(rT)) || !isNaN(Number(matchedInvT));
        if (!genericWords.has(rT) && !genericWords.has(matchedInvT) && !isNum) {
          nonGenericMatchFound = true;
          break;
        }
      }
    }

    return nonGenericMatchFound;
  });

  if (!interestedCustomers || interestedCustomers.length === 0) return;

  // ── بناء قائمة العملاء المهتمين بتفاصيل كاملة ──────────────────────────
  const topLeads = interestedCustomers.slice(0, 10);
  const remainingCount = interestedCustomers.length - topLeads.length;

  let leadsSection = "";
  topLeads.forEach((c, idx) => {
    leadsSection += `${idx + 1}. <b>${c.full_name}</b>\n`;
    leadsSection += `   📱 <code>${c.phone}</code>\n`;
    if (c.requested_car) {
      leadsSection += `   🚗 يبحث عن: ${c.requested_car}\n`;
    }
  });
  if (remainingCount > 0) {
    leadsSection += `\n   <i>... و${remainingCount} عميلاً آخر مهتماً بنفس الطراز</i>\n`;
  }

  const carText = `${cleanModel}${chassisNo ? ` — شاصي: <code>${chassisNo}</code>` : ""}`;
  const actorLabel = actorProfile?.full_name ?? "موظف";

  const message =
    `🚨 <b>فرصة بيع فورية — سيارة مطلوبة متاحة الآن!</b>\n\n` +
    `🚗 <b>تفاصيل السيارة المتوفرة:</b>\n` +
    `<blockquote><b>الطراز:</b> ${carText}\n` +
    (ownerName ? `<b>مصدر السيارة / المالك:</b> ${ownerName}` : "") +
    `</blockquote>\n\n` +
    `🎯 <b>العملاء المهتمون (${interestedCustomers.length}):</b>\n` +
    `<blockquote>${leadsSection}</blockquote>\n\n` +
    `⚡️ <i>تواصل مع هؤلاء العملاء فوراً قبل أن تُحجز السيارة!</i>\n\n` +
    `👨‍💼 <b>بواسطة الموظف:</b> ${actorLabel}\n` +
    `🕐 <i>${arabicDateTime()}</i>`;

  const writer = hasSupabaseServiceRoleEnv() ? createAdminClient() : supabase;
  const { data: maalamBranches } = await writer.from("branches").select("id").ilike("name", "%المعلم%");
  const maalamBranchIds = (maalamBranches ?? []).map(b => b.id);

  const { data: users } = await writer
    .from("app_users")
    .select("id, full_name, role, branch_id, is_active, status");

  const recipients = (users ?? []).filter((user) => {
    const isActive = user.is_active !== false && String(user.status ?? "active").toLowerCase() !== "inactive";
    if (!isActive) return false;
    
    const caps = getRoleCapabilities(user.role, user.full_name);
    // المدراء العامون
    if (caps.isGeneralManager) return true;
    // موظفي أو مدراء معرض المعلم تصلهم كافة الفرص
    if (user.branch_id && maalamBranchIds.includes(user.branch_id)) return true;
    // الموظفين والمدراء في نفس المعرض
    if (branchId && user.branch_id === branchId) return true;
    
    return false;
  });

  if (recipients.length > 0) {
    const rows = recipients.map((recipient) => ({
      recipient_user_id: recipient.id,
      recipient_branch_id: recipient.branch_id ?? null,
      recipient_label: recipient.full_name ?? null,
      notification_type: "inventory_opportunity",
      title: "🚨 فرصة بيع سيارة متاحة",
      message,
      status: "unread",
      created_by_user_id: actorProfile?.id ?? null,
      payload: {
        source: "inventory_opportunity",
        actor_name: actorProfile?.full_name ?? "النظام",
        actor_role: actorProfile?.role ?? null,
        model: cleanModel,
        chassis_no: chassisNo,
        owner_name: ownerName,
        interested_customers_count: interestedCustomers.length,
        interested_customers: interestedCustomers.map((c) => ({ id: c.id, name: c.full_name, phone: c.phone })),
      },
    }));

    await writer.from("notifications").insert(rows);
  }

  void pushTelegramOpportunity({
    branchId,
    title: "🚨 فرصة بيع سيارة متاحة",
    message,
  });
}

export async function clearNotificationsCenterAction() {
  if (!hasSupabaseEnv()) return;

  const supabase = await createClient();
  const writer = hasSupabaseServiceRoleEnv() ? createAdminClient() : supabase;
  const profile = await getCurrentProfile();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;
  if (capabilities.isGeneralManager) {
    await writer.from("notifications").delete().neq("id", "");
  } else {
    const scopedQuery = writer
      .from("notifications")
      .select("id, recipient_user_id, recipient_branch_id");

    let filteredQuery = scopedQuery;
    if (capabilities.isManager && branchId) {
      const conditions = [`recipient_branch_id.eq.${branchId}`];
      if (userId) conditions.push(`recipient_user_id.eq.${userId}`);
      filteredQuery = filteredQuery.or(conditions.join(","));
    } else if (userId) {
      filteredQuery = filteredQuery.eq("recipient_user_id", userId);
    }

    const { data: scopedRows } = await filteredQuery.limit(5000);
    const ids = (scopedRows ?? []).map((row) => row.id).filter(Boolean);
    if (ids.length > 0) {
      await writer.from("notifications").delete().in("id", ids);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/notifications");

  redirect(appendNoticeParam("/dashboard/notifications", "تم حذف التنبيهات بنجاح"));
}

function toSafeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** يرفع ملفات مرفقات العميل ويُرجع مسارات التخزين لكل ملف تم رفعه بنجاح */
async function uploadCustomerAttachmentFiles({
  supabase,
  customerId,
  uploadedByUserId,
  files,
  category,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  customerId: string;
  uploadedByUserId: string | null;
  files: File[];
  category: string;
}): Promise<string[]> {
  const uploadedPaths: string[] = [];

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  for (const file of files) {
    if (!file || file.size <= 0) continue;
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`حجم الملف "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB) يتجاوز الحد المسموح (50 MB).`);
    }

    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const baseName = toSafeFileName(file.name.replace(/\.[^.]+$/, ""));
    const path = `${customerId}/${Date.now()}-${baseName}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const cleanMime = (file.type || "application/octet-stream").split(";")[0].trim();

    // ── الصوتيات تذهب لـ bucket مستقل عام (voice-notes) ──────────
    const VOICE_BUCKET = "voice-notes";
    let storageBucket = "customer-attachments";
    let uploadPath = path;
    let uploadMime = cleanMime || "application/octet-stream";

    if (category === "voice_note" && hasSupabaseServiceRoleEnv()) {
      const adminClient = createAdminClient();
      // ضمان وجود الـ bucket العام للصوتيات
      try {
        const { data: bkt } = await adminClient.storage.getBucket(VOICE_BUCKET);
        if (!bkt) {
          await adminClient.storage.createBucket(VOICE_BUCKET, { public: true, fileSizeLimit: 52428800 });
        } else if (!bkt.public) {
          await adminClient.storage.updateBucket(VOICE_BUCKET, { public: true });
        }
      } catch { /* ignored */ }

      const uploadToVoice = await adminClient.storage
        .from(VOICE_BUCKET)
        .upload(path, buffer, { contentType: cleanMime || "audio/webm", upsert: false });

      if (uploadToVoice.error) throw new Error(uploadToVoice.error.message);

      storageBucket = VOICE_BUCKET;
      uploadPath = path;
      uploadMime = cleanMime || "audio/webm";

      const { data: { publicUrl: voicePublicUrl } } = adminClient.storage
        .from(VOICE_BUCKET)
        .getPublicUrl(path);

      const insertVoice = await supabase.from("customer_attachments").insert({
        customer_id: customerId,
        file_name: file.name,
        file_category: "voice_note",
        storage_path: `${VOICE_BUCKET}/${path}`,
        public_url: voicePublicUrl,
        mime_type: uploadMime,
        file_size_bytes: file.size,
        uploaded_by_user_id: uploadedByUserId,
        metadata: { source: "voice_recorder", bucket: VOICE_BUCKET },
      });
      if (insertVoice.error) throw new Error(insertVoice.error.message);
      uploadedPaths.push(path);
      continue; // تخطّ الـ insert العادي أدناه
    }

    const upload = await supabase.storage.from(storageBucket).upload(uploadPath, buffer, {
      contentType: uploadMime,
      upsert: false,
    });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const publicUrl: string | null = null;

    const insertAttachment = await supabase.from("customer_attachments").insert({
      customer_id: customerId,
      file_name: file.name,
      file_category: category,
      storage_path: path,
      public_url: publicUrl,
      mime_type: cleanMime || null,
      file_size_bytes: file.size,
      uploaded_by_user_id: uploadedByUserId,
      metadata: {
        source: category === "voice_note" ? "voice_recorder" : "profile_modal",
      },
    });

    if (insertAttachment.error) {
      throw new Error(insertAttachment.error.message);
    }

    uploadedPaths.push(path);
  }

  return uploadedPaths;
}

async function insertCustomerLog({
  customerId,
  action,
  details,
  nextFollowUpAt,
}: {
  customerId: string;
  action: string;
  details?: string | null;
  nextFollowUpAt?: string | null;
}) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  await supabase.from("customer_logs").insert({
    customer_id: customerId,
    actor_user_id: profile?.id ?? null,
    actor_name: profile?.full_name ?? "النظام",
    action,
    details: details ?? null,
    next_follow_up_at: nextFollowUpAt ?? null,
  });
}

async function incrementCustomerInteractions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
) {
  const { data: current } = await supabase
    .from("customers")
    .select("visit_count")
    .eq("id", customerId)
    .maybeSingle();

  const rawCount = current?.visit_count;
  const normalizedCount =
    typeof rawCount === "number" ? rawCount : typeof rawCount === "string" ? Number.parseInt(rawCount, 10) : 0;
  const nextCount = (Number.isFinite(normalizedCount) ? normalizedCount : 0) + 1;
  await supabase.from("customers").update({ visit_count: nextCount }).eq("id", customerId);
}

async function completeCustomerPendingReminders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
) {
  await supabase
    .from("reminders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("customer_id", customerId)
    .eq("status", "pending");
}

async function syncTradeInventoryFromCustomer({
  supabase,
  customerId,
  branchId,
  customerName,
  tradeModel,
  tradeStatus,
  tradeChassis,
  tradePrice,
  tradeColor,
  tradeYear,
  tradeMileage,
  tradeSpecs,
  tradeInspection,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  customerId: string;
  branchId: string | null;
  customerName: string;
  tradeModel: string | null;
  tradeStatus: string | null;
  tradeChassis: string | null;
  tradePrice: number | null;
  tradeColor: string | null;
  tradeYear: number | null;
  tradeMileage: number | null;
  tradeSpecs: string | null;
  tradeInspection: string | null;
}) {
  const model = (tradeModel ?? "").trim();
  if (!model) return;

  const statusLabel = (tradeStatus ?? "").trim();

  // ── الحالات المُغلقة التي تنقل ملكية السيارة للمعرض ──────────────────────
  const isCompletedTradein  = statusLabel === "تمت عملية البيع + استبدال";
  const isShowroomPurchase  = statusLabel === "شراء من قبل المعرض";
  // ── بيع سيارة العميل لمشترٍ خارجي (عرض للبيع) ───────────────────────────
  const isExternalSold      = statusLabel === "تمت عملية البيع (للعميل)";
  // ── حجز سيارة العميل بواسطة مشترٍ محتمل، أو حجز صفقة الاستبدال ──────────
  const isReserved =
    statusLabel === "حجز (سيارة العميل)" ||
    statusLabel === "حجز (استبدال)"; // سيارة المستبدِل تُصبح محجوزة أيضاً
  // ── حالات السحب / الرفض / الإغلاق ────────────────────────────────────────
  const isWithdrawn =
    statusLabel === "تراجع العميل عن الاستبدال" ||
    statusLabel === "رفض من قبل العميل"          ||
    statusLabel === "رفض من قبل المعرض"           ||
    statusLabel === "سحب السيارة من البيع"        ||
    statusLabel === "إغلاق الملف";

  // كل الحالات النشطة → برسم البيع
  let ownerName         = customerName;
  let dealType          = "برسم البيع";
  let availabilityStatus = "متوفرة";

  if (isCompletedTradein) {
    dealType = "استبدال";
    if (branchId) {
      const { data: branch } = await supabase.from("branches").select("name").eq("id", branchId).maybeSingle();
      ownerName = branch?.name ?? customerName;
    }
  } else if (isShowroomPurchase) {
    dealType = "شراء";
    if (branchId) {
      const { data: branch } = await supabase.from("branches").select("name").eq("id", branchId).maybeSingle();
      ownerName = branch?.name ?? customerName;
    }
  } else if (isExternalSold) {
    availabilityStatus = "مباعة";
  } else if (isReserved) {
    availabilityStatus = "محجوزة";
  } else if (isWithdrawn) {
    availabilityStatus = "مسحوبة من المعرض";
  }

  const existingQuery = supabase
    .from("inventory")
    .select("id")
    .eq("source_customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1);

  // أولاً: نبحث بالشاصي (إن وُجد) — ثم نعود للبحث بمعرّف العميل عند عدم الإيجاد
  // هذا يمنع إنشاء سجل مكرر عند تغيير رقم الشاصي بين عمليات الحفظ
  let existing: { id: string } | null = null;
  if (tradeChassis) {
    const { data } = await existingQuery.eq("chassis_no", tradeChassis).maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await existingQuery.maybeSingle();
    existing = data;
  }

  const payload = {
    branch_id: branchId,
    source_customer_id: customerId,
    model,
    owner_name: ownerName,
    deal_type: dealType,
    chassis_no: tradeChassis,
    condition_label: "مستعملة",
    availability_status: availabilityStatus,
    price: tradePrice,
    color: tradeColor,
    production_year: tradeYear,
    mileage: tradeMileage,
    specs: tradeSpecs,
    inspection: tradeInspection,
  };

  if (existing?.id) {
    const { data: beforeRow } = await supabase
      .from("inventory")
      .select("availability_status")
      .eq("id", existing.id)
      .maybeSingle();

    await supabase.from("inventory").update(payload).eq("id", existing.id);
    const wasAvailableBefore = String(beforeRow?.availability_status ?? "").includes("متوفرة");
    if (!wasAvailableBefore && availabilityStatus === "متوفرة") {
      const actorProfile = await getCurrentProfile();
      await notifyOpportunityForModelAvailability({
        supabase,
        actorProfile,
        model,
        chassisNo: tradeChassis,
        ownerName,
        branchId,
      });
    }
    return;
  }

  await supabase.from("inventory").insert(payload);
  if (availabilityStatus === "متوفرة") {
    const actorProfile = await getCurrentProfile();
    await notifyOpportunityForModelAvailability({
      supabase,
      actorProfile,
      model,
      chassisNo: tradeChassis,
      ownerName,
      branchId,
    });
  }
}

async function syncCustomerFollowupReminder({
  customerId,
  branchId,
  assignedUserId,
  nextFollowUpAt,
  status,
  fullName,
}: {
  customerId: string;
  branchId: string | null;
  assignedUserId: string | null;
  nextFollowUpAt: string | null;
  status: string;
  fullName: string;
}) {
  if (!hasSupabaseEnv()) return;

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const reminderType = status.includes("حجز") ? "reservation_auto" : status.includes("متابعة") ? "followup_auto" : null;

  const { data: existingReminders } = await supabase
    .from("reminders")
    .select("id")
    .eq("customer_id", customerId)
    .in("reminder_type", ["followup_auto", "reservation_auto"])
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!reminderType || !nextFollowUpAt) {
    if ((existingReminders ?? []).length > 0) {
      await supabase
        .from("reminders")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .in(
          "id",
          (existingReminders ?? []).map((item) => item.id),
        );
    }
    return;
  }

  const payload = {
    customer_id: customerId,
    branch_id: branchId,
    assigned_user_id: assignedUserId,
    created_by_user_id: profile?.id ?? null,
    reminder_type: reminderType,
    title: status.includes("حجز") ? `متابعة حجز: ${fullName}` : `متابعة عميل: ${fullName}`,
    message: status.includes("حجز")
      ? `ملف ${fullName} يحمل حالة حجز ويحتاج متابعة قبل الموعد المحدد.`
      : `ملف ${fullName} يحتاج متابعة قريبة حسب الموعد المحدد في ملف العميل.`,
    due_at: nextFollowUpAt,
    status: "pending",
    payload: {
      source: "customer_followup",
      customer_id: customerId,
    },
  };

  if ((existingReminders ?? []).length > 0) {
    await supabase.from("reminders").update(payload).eq("id", existingReminders![0].id);
    return;
  }

  await supabase.from("reminders").insert(payload);
}

export async function signOutAction() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}

export async function markNotificationReadAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const notificationId = getText(formData, "notification_id");
  if (!notificationId) return;

  // التحقق من المصادقة قبل التحديث
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const capabilities = getRoleCapabilities(profile.role);

  // التحقق من الملكية — الموظف يقرأ إشعاراته فقط، المدير يقرأ إشعارات فرعه
  const { data: notif } = await supabase
    .from("notifications")
    .select("recipient_user_id")
    .eq("id", notificationId)
    .maybeSingle();

  if (notif && !capabilities.isManager && notif.recipient_user_id !== profile.id) {
    return; // غير مصرح بقراءة إشعارات الآخرين
  }

  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", notificationId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/notifications");

  // الرجوع للصفحة المُرسَل منها إن وُجدت
  const redirectTo = getNullableText(formData, "redirect_to") ?? "/dashboard/notifications";
  redirect(redirectTo);
}

export async function sendEvaluationReplyAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  if (!hasSupabaseEnv()) return { error: "غير متاح" };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "غير مصرح" };

  const caps = getRoleCapabilities(profile.role, profile.full_name);
  if (!caps.isManager) return { error: "هذه الوظيفة للمديرين فقط" };

  const notificationId  = getText(formData, "notification_id");
  const customerId      = getText(formData, "customer_id");
  const actorUserId     = getNullableText(formData, "actor_user_id");
  const priceRaw        = getText(formData, "price");
  const price           = parseNumber(priceRaw);

  if (!customerId || !price || price <= 0) return { error: "أدخل قيمة تقييم صحيحة" };

  const admin = hasSupabaseServiceRoleEnv() ? createAdminClient() : await createClient();

  // 1. تحديث سعر التقييم في trade_ins
  const { data: tradeRow } = await admin
    .from("trade_ins")
    .select("id, model")
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tradeRow) return { error: "لم يُعثر على سيارة مرتبطة بهذا العميل" };

  await admin.from("trade_ins")
    .update({ price, status: "تم التقييم" })
    .eq("id", tradeRow.id);

  // 2. جلب بيانات العميل والموظف المُدخِل
  const { data: custRow } = await admin
    .from("customers")
    .select("full_name, assigned_user_id, app_users(id, full_name, telegram_chat_id)")
    .eq("id", customerId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custAny = custRow as any;
  const staffArr = Array.isArray(custAny?.app_users) ? custAny.app_users : (custAny?.app_users ? [custAny.app_users] : []);
  const staff = staffArr[0] ?? null;
  const recipientUserId = actorUserId ?? staff?.id ?? custRow?.assigned_user_id ?? null;
  const staffChatId     = staff?.telegram_chat_id ?? null;
  const customerName    = custRow?.full_name ?? "—";
  const priceFormatted  = price.toLocaleString("en-US");

  // 3. إشعار ويب للموظف المُدخِل
  if (recipientUserId) {
    await admin.from("notifications").insert({
      recipient_user_id: recipientUserId,
      notification_type: "evaluation",
      title: "💰 تم تقييم السيارة",
      message: `سيارة العميل ${customerName} — ${tradeRow.model} قُيِّمت بـ ${priceFormatted} ₪ بواسطة ${profile.full_name}`,
      status: "unread",
      created_by_user_id: profile.id,
      payload: { source: "evaluation_reply", customer_id: customerId, trade_id: tradeRow.id, price },
    });
  }

  // 4. إشعار Telegram للموظف إن كان لديه حساب
  if (staffChatId) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
    const inlineButtons: Array<Array<Record<string, unknown>>> = appUrl
      ? [[{ text: "📋 فتح بطاقة العميل", web_app: { url: `${appUrl}/bot-app/customer?id=${customerId}&chat_id=${staffChatId}` } }]]
      : [];
    inlineButtons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

    void fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: staffChatId,
        text:
          `💰 <b>تم تقييم السيارة بنجاح</b>\n\n` +
          `<blockquote>👤 <b>العميل:</b> ${customerName}\n` +
          `🚗 <b>السيارة:</b> ${tradeRow.model}\n` +
          `✅ <b>قيمة التقييم:</b> ${priceFormatted} ₪\n` +
          `👨‍💼 <b>المُقيِّم:</b> ${profile.full_name}</blockquote>\n\n` +
          `<i>تمّ تحديث الملف — اضغط لفتح بطاقة العميل 👇</i>`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineButtons },
      }),
    });
  }

  // 5. تحديث log العميل
  await admin.from("customer_logs").insert({
    customer_id: customerId,
    actor_user_id: profile.id,
    actor_name: profile.full_name,
    action: "trade_in_saved",
    details: `تم تقييم سيارة العميل ${customerName} بقيمة ${priceFormatted} ₪ — بواسطة ${profile.full_name}`,
  });

  // 6. تعليم التنبيه الأصلي كمقروء
  if (notificationId) {
    await admin.from("notifications")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("id", notificationId);
  }

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function completeReminderAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const reminderId = getText(formData, "reminder_id");
  if (!reminderId) return;

  // التحقق من المصادقة قبل التحديث
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const capabilities = getRoleCapabilities(profile.role);

  // التحقق من الملكية — الموظف يُكمل مهامه فقط، المدير يُكمل مهام فرعه
  const { data: reminder } = await supabase
    .from("reminders")
    .select("assigned_user_id")
    .eq("id", reminderId)
    .maybeSingle();

  if (reminder && !capabilities.isManager && reminder.assigned_user_id !== profile.id) {
    return; // غير مصرح بإكمال مهام الآخرين
  }

  await supabase
    .from("reminders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", reminderId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");

  // الرجوع للصفحة مع رسالة نجاح
  const redirectTo = getNullableText(formData, "redirect_to") ?? "/dashboard/agenda";
  redirect(appendNoticeParam(redirectTo, "تم تنفيذ المهمة وإغلاقها بنجاح"));
}

export async function sendQuickReminderAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const recipientUserId = getNullableText(formData, "recipient_user_id");
  const recipientBranchId = getNullableText(formData, "recipient_branch_id");
  const recipientLabel = getNullableText(formData, "recipient_label");
  const title = getNullableText(formData, "title") ?? "تذكير";
  const message = getText(formData, "message");
  // الصفحة التي يُعاد إليها بعد الإرسال (يُمرَّر كـ hidden input)
  const redirectTo = getNullableText(formData, "redirect_to") ?? "/dashboard/management";

  if (!message) return;

  const profile = await getCurrentProfile();

  // يُسمح بإرسال التذكيرات للمديرين فقط
  const capabilities = getRoleCapabilities(profile?.role);
  if (!profile || !capabilities.isManager) return;

  const supabase = await createClient();

  // ── 1. حفظ الإشعار في قاعدة البيانات ───────────────────────────
  await supabase.from("notifications").insert({
    recipient_user_id: recipientUserId,
    recipient_branch_id: recipientBranchId,
    recipient_label: recipientLabel,
    notification_type: "manual_reminder",
    title,
    message,
    status: "unread",
    created_by_user_id: profile?.id ?? null,
    payload: {
      source: "web_manual_reminder",
      sender_name: profile?.full_name ?? "النظام",
      sender_role: profile?.role ?? null,
    },
  });

  // ── 2. إرسال تيليغرام مباشر للموظف المعني ──────────────────────
  void pushTelegramToEmployee({
    userId: recipientUserId,
    senderName: profile?.full_name ?? "المدير",
    title,
    message,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/management");
  revalidatePath("/dashboard/customers");
  redirect(appendNoticeParam(redirectTo, "تم إرسال التذكير للموظف بنجاح"));
}

/**
 * إرسال تذكير تقييم سيارة لمستخدم محدد — بطاقة احترافية كاملة مع الصور
 */
export async function sendEvaluationReminderAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const profile = await getCurrentProfile();
  if (!profile) return;

  const customerId    = getNullableText(formData, "customer_id");
  const branchId      = getNullableText(formData, "branch_id");
  const recipientId   = getNullableText(formData, "recipient_user_id");
  const recipientName = getNullableText(formData, "recipient_name") ?? "";
  const photoUrls     = (getNullableText(formData, "photo_urls") ?? "")
    .split("||").map((u) => u.trim()).filter(Boolean);
  const redirectTo    = getNullableText(formData, "redirect_to") ?? "/dashboard/agenda";

  // منع الإرسال لنفس المستخدم
  if (!recipientId || recipientId === profile.id) return;

  const admin       = createAdminClient();
  const senderName  = profile.full_name ?? "المستخدم";
  const senderCaps  = getRoleCapabilities(profile.role, profile.full_name);
  const senderRole  =
    senderCaps.isGeneralManager ? "المدير العام"
    : senderCaps.isManager      ? "مدير المعرض"
    : "الموظف";

  // ── جلب بيانات العميل وسيارته من قاعدة البيانات ───────────────────────────
  const { data: customer } = await admin
    .from("customers")
    .select("full_name, status, operation_type, branch_id, branches(name), app_users(full_name)")
    .eq("id", customerId ?? "")
    .maybeSingle();

  const { data: tradeRows } = await admin
    .from("trade_ins")
    .select("model, color, production_year, mileage, price, chassis_no, inspection, status, deal_type, specs")
    .eq("customer_id", customerId ?? "")
    .order("updated_at", { ascending: false })
    .limit(1);

  const trade = tradeRows?.[0] ?? null;

  // ── جلب chat_id المستخدم المستهدف ─────────────────────────────────────────
  const { data: recipientUser } = await admin
    .from("app_users")
    .select("telegram_chat_id, full_name")
    .eq("id", recipientId)
    .eq("is_active", true)
    .maybeSingle();

  const chatId = recipientUser?.telegram_chat_id as string | null;

  // ── بناء الرسالة الاحترافية ────────────────────────────────────────────────
  const customerName  = customer?.full_name ?? "—";
  const branchName    = (() => {
    const b = customer?.branches;
    if (!b) return "—";
    if (Array.isArray(b)) return (b[0] as Record<string,unknown>)?.name as string ?? "—";
    return (b as Record<string,unknown>).name as string ?? "—";
  })();
  const staffName     = (() => {
    const u = customer?.app_users;
    if (!u) return "—";
    if (Array.isArray(u)) return (u[0] as Record<string,unknown>)?.full_name as string ?? "—";
    return (u as Record<string,unknown>).full_name as string ?? "—";
  })();
  const customerStatus = customer?.status ?? "—";
  const opType         = customer?.operation_type ?? "—";

  const isConsignment = opType === "بيع بالوكالة" || opType === "sell_on_behalf" || (trade?.deal_type === "بيع بالوكالة") || (trade?.deal_type === "برسم البيع");
  const titleText = isConsignment ? "سيارة برسم البيع — عاجل" : "طلب تقييم سيارة — عاجل";

  const carBlock = trade ? [
    `🚗 <b>بيانات السيارة:</b>`,
    `<blockquote>` +
    [
      trade.model        ? `<b>الموديل:</b> ${trade.model}`                         : null,
      trade.color        ? `<b>اللون:</b> ${trade.color}`                            : null,
      trade.production_year ? `<b>سنة الصنع:</b> ${trade.production_year}`          : null,
      trade.mileage      ? `<b>الممشى:</b> ${Number(trade.mileage).toLocaleString("en-US")} كم` : null,
      trade.chassis_no   ? `<b>رقم الشاصي:</b> <code>${trade.chassis_no}</code>`    : null,
      trade.specs        ? `<b>المواصفات:</b> ${trade.specs}`                        : null,
      trade.inspection   ? `<b>تقرير الفحص:</b> ${trade.inspection}`                : null,
      trade.deal_type    ? `<b>نوع الصفقة:</b> ${isConsignment ? "سيارة برسم البيع" : trade.deal_type}` : null,
      trade.status       ? `<b>الحالة الراهنة:</b> <i>${trade.status}</i>`           : null,
      trade.price != null ? `<b>السعر التقديري:</b> ${Number(trade.price).toLocaleString("en-US")} ₪` : `<b>سعر التقييم:</b> <i>لم يُحدَّد بعد</i>`,
    ].filter(Boolean).join("\n") +
    `</blockquote>`
  ].join("\n") : null;

  const fullMessage = [
    `🔔 <b>${titleText}</b>\n`,
    `السادة المحترمون،\n`,
    `تحيةً طيبةً وبعد؛\n`,
    isConsignment
      ? `يُشرفني التواصل معكم، وأودّ إحاطتكم علمًا بأنّ لدينا سيارة برسم البيع (بالوكالة) تستوجب مراجعتكم في النظام لتحديد السعر واتخاذ الإجراءات اللازمة.\n`
      : `يُشرفني التواصل معكم، وأودّ إحاطتكم علمًا بأنّ لدينا سيارةً تستوجب تقييمًا فنيًا دقيقًا في أقرب وقت ممكن، نظرًا لأهمية القرار وما يترتب عليه من تبعات مالية وإجرائية.\n`,
    `أرجو التكرم بمراجعة البيانات الواردة أدناه وإبداء رأيكم المهني.\n`,
    `👤 <b>بيانات العميل:</b>`,
    `<blockquote><b>الاسم:</b> ${customerName}`,
    `<b>المعرض:</b> ${branchName}`,
    `<b>الموظف المسؤول:</b> ${staffName}`,
    `<b>نوع العملية:</b> ${isConsignment ? "سيارة برسم البيع" : opType}`,
    `<b>الحالة الحالية:</b> ${customerStatus}</blockquote>\n`,
    carBlock ?? `🚗 <i>لا تتوفر بيانات سيارة مسجّلة حتى الآن</i>\n`,
    `⏰ <b>ملاحظة هامة:</b>`,
    `<blockquote>يُرجى إتمام الإجراء وتسجيل السعر في النظام في أقرب وقت ممكن لضمان سير العمل بصورة سليمة.</blockquote>\n`,
    `<i>— صادر من: ${senderName} | ${senderRole}</i>`,
  ].join("\n");

  // ── إرسال تيليغرام للمستخدم المستهدف ─────────────────────────────────────
  if (chatId) {
    const { sendMessage, sendPhoto, sendMediaGroup } = await import("@/lib/telegram/api");

    // 1. الرسالة النصية الاحترافية
    await sendMessage(chatId, fullMessage);

    // 2. الصور (إن وُجدت) مع caption مختصر
    if (photoUrls.length > 0) {
      const photoCaption =
        `📷 <b>صور سيارة العميل: ${customerName}</b>\n` +
        (trade?.model ? `🚗 ${trade.model}` : "") +
        `\n<i>— طلب تقييم من: ${senderName}</i>`;

      if (photoUrls.length === 1) {
        await sendPhoto(chatId, photoUrls[0], photoCaption);
      } else {
        // دفعات بحد أقصى 10 صور
        for (let i = 0; i < photoUrls.length; i += 10) {
          const batch = photoUrls.slice(i, i + 10);
          await sendMediaGroup(chatId, batch, i === 0 ? photoCaption : undefined);
        }
      }
    }
  }

  // ── حفظ الإشعار في قاعدة البيانات ────────────────────────────────────────
  const supabase = await createClient();
  await supabase.from("notifications").insert({
    recipient_user_id: recipientId,
    recipient_branch_id: branchId,
    recipient_label: recipientName,
    notification_type: "evaluation_reminder",
    title: `طلب تقييم سيارة العميل: ${customerName}`,
    message: `طلب تقييم سيارة ${trade?.model ?? ""} للعميل ${customerName} — من: ${senderName}`,
    status: "unread",
    created_by_user_id: profile.id,
    payload: {
      source: "evaluation_reminder",
      customer_id: customerId,
      sender_name: senderName,
      sender_role: profile.role,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  redirect(appendNoticeParam(redirectTo, `✅ تم إرسال طلب التقييم إلى ${recipientName} بنجاح`));
}

export async function dispatchStaffInstructionAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const profile = await getCurrentProfile();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);
  if (!capabilities.isManager) return;

  const supabase = await createClient();
  const recipientMode = getText(formData, "recipient_mode") || "single";
  const recipientUserId = getNullableText(formData, "recipient_user_id");
  const instructionType = getText(formData, "instruction_type") || "message";
  const targetRole = getNullableText(formData, "target_role");
  const targetBranchId = getNullableText(formData, "target_branch_id");
  const targetBranchName = getNullableText(formData, "target_branch_name");
  const isRoleChange = instructionType === "changeRole";
  const isBranchTransfer = instructionType === "transfer";
  const isCombinedAccess = instructionType === "access";
  const isAccessMutation = isRoleChange || isBranchTransfer || isCombinedAccess;
  const isBranchManagerOnly = capabilities.isManager && !capabilities.isGeneralManager;
  if (isAccessMutation && isBranchManagerOnly && !isRoleChange) return;
  if (isAccessMutation && !capabilities.isGeneralManager && !isBranchManagerOnly) return;
  if (isBranchManagerOnly && isRoleChange && targetRole) {
    const normalizedTargetRole = normalizeRole(targetRole);
    const allowedForBranchManager =
      normalizedTargetRole === normalizeRole("الموظف") || normalizedTargetRole === normalizeRole("مدير معرض");
    if (!allowedForBranchManager) return;
  }

  const rawMessage = getText(formData, "message");
  const message =
    (instructionType === "changeRole" || instructionType === "access") && targetRole
      ? `${rawMessage}\n\n[الصلاحية المطلوبة]: ${targetRole}`
      : (instructionType === "transfer" || instructionType === "access") && targetBranchName
        ? `${rawMessage}\n\n[المعرض المستهدف]: ${targetBranchName}`
        : rawMessage;
  if (!message) return;

  let recipients: Array<{ id: string; full_name: string; branch_id: string | null; role?: string | null }> = [];

  if (recipientMode === "all" || recipientUserId === "all") {
    let query = supabase.from("app_users").select("id, full_name, branch_id, role").eq("status", "active");
    if (!capabilities.isGeneralManager && profile?.branch_id) {
      query = query.eq("branch_id", profile.branch_id);
    }
    const { data } = await query;
    recipients = data ?? [];
  } else if (recipientUserId) {
    const { data } = await supabase
      .from("app_users")
      .select("id, full_name, branch_id, role")
      .eq("id", recipientUserId)
      .maybeSingle();
    if (data) recipients = [data];
  }

  if (isBranchManagerOnly) {
    const currentBranchId = profile?.branch_id ?? null;
    if (!currentBranchId) return;
    recipients = recipients.filter((item) => item.branch_id === currentBranchId && !getRoleCapabilities(item.role).isGeneralManager);
  }

  if (recipients.length === 0) return;
  const recipientIds = recipients.filter((item) => !getRoleCapabilities(item.role).isGeneralManager).map((item) => item.id);
  if (recipientIds.length === 0) return;

  if (instructionType === "changeRole" && targetRole) {
    await supabase.from("app_users").update({ role: targetRole }).in("id", recipientIds);
  }

  if (instructionType === "transfer" && targetBranchId) {
    await supabase.from("app_users").update({ branch_id: targetBranchId }).in("id", recipientIds);
  }

  if (instructionType === "access") {
    const patch: Record<string, string> = {};
    if (targetRole) patch.role = targetRole;
    if (targetBranchId) patch.branch_id = targetBranchId;
    if (Object.keys(patch).length > 0) {
      await supabase.from("app_users").update(patch).in("id", recipientIds);
    }
  }

  // ── تعليق الحساب: تعطيل المستخدم في قاعدة البيانات ──────────────────────
  if (instructionType === "suspend") {
    await supabase
      .from("app_users")
      .update({ is_active: false, status: "inactive" })
      .in("id", recipientIds);
  }

  const titleMap: Record<string, string> = {
    message: "توجيه إداري",
    access: "تحديث صلاحيات ومعرض",
    changeRole: "تنبيه تعديل الصلاحية",
    transfer: "تنبيه نقل معرض",
    suspend: "تنبيه حالة الحساب",
  };
  const title = titleMap[instructionType] ?? "توجيه إداري";

  const rows = recipients.map((recipient) => ({
    recipient_user_id: recipient.id,
    recipient_branch_id: recipient.branch_id,
    recipient_label: recipient.full_name,
    notification_type: "manual_reminder",
    title,
    message,
    status: "unread",
    created_by_user_id: profile?.id ?? null,
    payload: {
      source: "staff_admin_panel",
      instruction_type: instructionType,
      sender_name: profile?.full_name ?? "النظام",
      sender_role: profile?.role ?? null,
    },
  }));

  await supabase.from("notifications").insert(rows);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/staff");

  // ── رسالة نجاح حسب نوع الإجراء ──
  const count = recipientIds.length;
  const noticeMap: Record<string, string> = {
    message: `تم إرسال التوجيه إلى ${count} موظف.`,
    changeRole: targetRole
      ? `تم تعديل الصلاحية إلى «${targetRole}» بنجاح (${count} موظف).`
      : "تم تعديل الصلاحية بنجاح.",
    transfer: targetBranchName
      ? `تم نقل ${count} موظف إلى «${targetBranchName}» بنجاح.`
      : "تم نقل الموظف بنجاح.",
    access: "تم تحديث الصلاحية والمعرض بنجاح.",
    suspend: `تم إيقاف ${count} حساب بنجاح.`,
  };
  const notice = noticeMap[instructionType] ?? "تم تنفيذ الإجراء بنجاح.";
  redirect("/dashboard/staff?staff_notice=" + encodeURIComponent(notice));
}

export async function updateTelegramChatIdAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const profile = await getCurrentProfile();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);
  if (!capabilities.isManager) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("غير مصرح لك بهذا الإجراء."));
  }

  const staffId = getText(formData, "staff_id");
  const telegramChatId = getNullableText(formData, "telegram_chat_id");

  if (!staffId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ telegram_chat_id: telegramChatId })
    .eq("id", staffId);

  if (error) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent(`تعذر التحديث: ${error.message}`));
  }

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?staff_notice=" + encodeURIComponent("تم تحديث معرّف Telegram بنجاح."));
}

export async function inviteStaffMemberAction(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("إعدادات Supabase غير مكتملة."));
  }

  const profile = await getCurrentProfile();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);
  if (!capabilities.isGeneralManager) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("هذه العملية متاحة فقط للمدير العام."));
  }

  if (!hasSupabaseServiceRoleEnv()) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("أضف SUPABASE_SERVICE_ROLE_KEY في بيئة المشروع أولًا."));
  }

  const fullName = getText(formData, "full_name");
  const email = getText(formData, "email").toLowerCase();
  const role = getText(formData, "role");
  const branchId = getNullableText(formData, "branch_id");
  const phone = getNullableText(formData, "phone");

  if (!fullName || !email || !role) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("أكمل الاسم والإيميل والدور قبل الإرسال."));
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const appBaseUrl = getAppBaseUrl();

  const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appBaseUrl}/reset-password`,
    data: {
      full_name: fullName,
      role,
      branch_id: branchId,
    },
  });

  let authUserId = inviteResult.data.user?.id ?? null;
  if (inviteResult.error && !inviteResult.error.message.toLowerCase().includes("already")) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent(`تعذر إرسال الدعوة: ${inviteResult.error.message}`));
  }

  if (!authUserId) {
    const listed = await admin.auth.admin.listUsers();
    authUserId =
      listed.data.users.find((item) => (item.email ?? "").toLowerCase() === email)?.id ?? null;
  }

  if (!authUserId) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("تمت المحاولة لكن تعذر تحديد حساب المصادقة لهذا الإيميل."));
  }

  const { data: existingByAuth } = await supabase
    .from("app_users")
    .select("id, metadata")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const { data: existingByInviteEmail } = existingByAuth
    ? { data: null }
    : await supabase
        .from("app_users")
        .select("id, metadata")
        .contains("metadata", { invite_email: email })
        .limit(1)
        .maybeSingle();

  const baseMetadata =
    ((existingByAuth?.metadata ?? existingByInviteEmail?.metadata ?? {}) as Record<string, unknown>) || {};
  const mergedMetadata = {
    ...baseMetadata,
    invite_email: email,
    invited_at: new Date().toISOString(),
    invited_by: profile?.full_name ?? null,
  };

  const targetId = existingByAuth?.id ?? existingByInviteEmail?.id ?? null;
  if (targetId) {
    const { error } = await supabase
      .from("app_users")
      .update({
        auth_user_id: authUserId,
        full_name: fullName,
        phone,
        role,
        branch_id: branchId,
        status: "active",
        is_active: true,
        metadata: mergedMetadata,
      })
      .eq("id", targetId);

    if (error) {
      redirect("/dashboard/staff?staff_error=" + encodeURIComponent(`تم إرسال الدعوة لكن فشل تحديث سجل الموظف: ${error.message}`));
    }
  } else {
    const { error } = await admin.from("app_users").insert({
      auth_user_id: authUserId,
      full_name: fullName,
      phone,
      role,
      branch_id: branchId,
      status: "active",
      is_active: true,
      metadata: mergedMetadata,
    });

    if (error) {
      redirect("/dashboard/staff?staff_error=" + encodeURIComponent(`تم إرسال الدعوة لكن فشل إنشاء سجل الموظف: ${error.message}`));
    }
  }

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?staff_notice=" + encodeURIComponent("تم تعيين الموظف وإرسال رابط التفعيل بنجاح."));
}

export async function sendStaffPasswordRecoveryAction(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("إعدادات Supabase غير مكتملة."));
  }

  const profile = await getCurrentProfile();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);
  if (!capabilities.isGeneralManager) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("هذه العملية متاحة فقط للمدير العام."));
  }

  if (!hasSupabaseServiceRoleEnv()) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("أضف SUPABASE_SERVICE_ROLE_KEY في بيئة المشروع أولًا."));
  }

  const email = getText(formData, "email").toLowerCase();
  if (!email) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent("أدخل إيميل الموظف أولًا."));
  }

  const admin = createAdminClient();
  const appBaseUrl = getAppBaseUrl();
  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appBaseUrl}/reset-password`,
    },
  });

  if (error) {
    redirect("/dashboard/staff?staff_error=" + encodeURIComponent(`فشل إرسال رابط تغيير كلمة المرور: ${error.message}`));
  }

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?staff_notice=" + encodeURIComponent("تم إرسال رابط تغيير كلمة المرور بنجاح."));
}

export async function upsertCustomerAction(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/dashboard/customers");
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const returnTo = getNullableText(formData, "return_to");
  const customerId = getNullableText(formData, "customer_id");
  const fullName = getText(formData, "full_name");
  const phone = normalizePhone(getText(formData, "phone"));

  if (!fullName || !phone) {
    redirect(
      customerId
        ? `/dashboard/customers/${customerId}/edit`
        : `/dashboard/customers/new?error=${encodeRedirectError("أدخل الاسم ورقم الهاتف قبل الحفظ.")}`,
    );
  }

  if (phone.length !== PHONE_LENGTH) {
    redirect(
      customerId
        ? `/dashboard/customers/${customerId}/edit?error=${encodeRedirectError(PHONE_ERROR_MESSAGE)}`
        : `/dashboard/customers/new?error=${encodeRedirectError(PHONE_ERROR_MESSAGE)}`,
    );
  }

  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);
  const requestedAssignedUserId = getNullableText(formData, "assigned_user_id");

  const branchId = capabilities.isGeneralManager ? getNullableText(formData, "branch_id") : profile?.branch_id ?? null;
  const assignedUserId = !capabilities.isManager
    ? profile?.id ?? null
    : requestedAssignedUserId ?? profile?.id ?? null;
  const incompleteSave = formData.get("incomplete_save") === "1";
  const requestedCarInput = getNullableText(formData, "requested_car");
  const paymentPlan = getNullableText(formData, "payment_plan");
  const status = incompleteSave ? "غير مكتمل" : (getText(formData, "status") || "قيد المتابعة");
  const nickname = getNullableText(formData, "nickname");
  const address = getNullableText(formData, "address");
  const whatsappPrefix = getNullableText(formData, "whatsapp_prefix") ?? "+970";
  const nextFollowUpAt = parseDateTimeLocal(getNullableText(formData, "next_follow_up_at"));
  const lastContactAt = parseDateTimeLocal(getNullableText(formData, "last_contact_at"));
  const notes = getNullableText(formData, "notes");
  const attachmentNotes = getNullableText(formData, "attachment_notes");
  const source = getNullableText(formData, "source");
  const requestedActive = getBoolean(formData, "is_active");
  const workflowType = getNullableText(formData, "workflow_type");
  const operationType = getNullableText(formData, "operation_type");
  const hasOperationTypeInput = formData.has("operation_type");
  const hasTradeIn = getBoolean(formData, "has_trade_in");
  const tradeInId = getNullableText(formData, "trade_in_id");
  const parentCustomerId = getNullableText(formData, "parent_customer_id");

  const inventoryIdForStatus = getNullableText(formData, "inventory_id_for_status");
  const isActive = isClosedStatus(status) ? false : requestedActive;
  // إذا كان موعد المتابعة في الماضي أو اليوم → نصفّره (المهمة أُنجزت بالحفظ)
  // إذا كان مستقبلياً → يبقى لتظهر المهمة في يومها
  const resolvedNextFollowup = (() => {
    if (!isActive || !nextFollowUpAt) return null;
    const followUpDate = new Date(nextFollowUpAt);
    const nowPlus3 = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
    const todayEnd = new Date(nowPlus3.toISOString().slice(0, 10) + "T23:59:59+03:00");
    // إذا كان الموعد اليوم أو قبله → صفّر (تم التعامل مع العميل)
    if (followUpDate <= todayEnd) return null;
    return nextFollowUpAt;
  })();

  const tradeModelInput = getNullableText(formData, "trade_in_model");
  const tradeYearInput = parseNumber(getNullableText(formData, "trade_in_year"));
  const requestedCarResolved =
    requestedCarInput && requestedCarInput.trim().length > 0
      ? requestedCarInput
      : null;
  const normalizedRequestedCarResolved = normalizeRequestedCarsText(requestedCarResolved);

  const operationTypeLabel =
    operationType === "buyer"
      ? "مشتري"
      : operationType === "buyer_tradein_pending"
        ? "استبدال (بانتظار التقييم)"
        : operationType === "buyer_tradein_evaluated"
          ? "استبدال (تمت عملية التقييم)"
          : operationType === "sell_on_behalf"
            ? "بيع بالوكالة"
            : null;

  let existingMetadata: Record<string, unknown> = {};
  if (customerId) {
    const { data: existingCustomerRow } = await supabase
      .from("customers")
      .select("metadata")
      .eq("id", customerId)
      .maybeSingle();
    existingMetadata = ((existingCustomerRow?.metadata as Record<string, unknown> | null) ?? {});
  }

  const payload: Record<string, unknown> = {
    branch_id: branchId,
    assigned_user_id: assignedUserId,
    full_name: fullName,
    phone,
    requested_car: normalizedRequestedCarResolved,
    payment_plan: paymentPlan,
    status,
    nickname,
    address,
    whatsapp_prefix: whatsappPrefix,
    next_follow_up_at: resolvedNextFollowup,
    last_contact_at: lastContactAt,
    notes,
    attachment_notes: attachmentNotes,
    source,
    is_active: isActive,
    operation_type: hasOperationTypeInput
      ? operationType
      : ((existingMetadata.operation_type_code as string | null | undefined) ?? null),
    metadata: {
      ...existingMetadata,
      operation_type: hasOperationTypeInput ? operationTypeLabel : ((existingMetadata.operation_type as string | null | undefined) ?? null),
      operation_type_code: hasOperationTypeInput ? operationType : ((existingMetadata.operation_type_code as string | null | undefined) ?? null),
    },
  };

  let savedId = customerId;

  if (customerId) {
    const { error } = await supabase.from("customers").update(payload).eq("id", customerId);
    if (error) {
      // الرجوع لصفحة التعديل وليس لصفحة الإضافة
      const editPath = returnTo ?? `/dashboard/customers?customer=${customerId}&mode=edit`;
      redirect(appendNoticeParam(editPath, `تعذر تحديث الملف: ${error.message}`));
    }

    await insertCustomerLog({
      customerId,
      action: "customer_updated",
      details: `تم تحديث ملف العميل ${fullName} إلى حالة ${status}.`,
      nextFollowUpAt,
    });
    await incrementCustomerInteractions(supabase, customerId);
    await sendManagementActivityNotification({
      supabase,
      actorProfile: profile,
      branchId,
      title: "✏️ تحديث ملف عميل",
      notificationType: "customer_update",
      message:
        `✏️ <b>تحديث بيانات ملف عميل</b>\n` +
        `قام الموظف <b>${profile?.full_name ?? "موظف"}</b> بتعديل الملف.\n\n` +
        `👤 <b>تفاصيل العميل:</b>\n` +
        `<blockquote><b>الاسم الكامل:</b> ${fullName}\n` +
        (nickname ? `<b>الكنية:</b> ${nickname}\n` : "") +
        `<b>الهاتف:</b> <code>${phone}</code>\n` +
        (operationTypeLabel ? `<b>نوع العملية:</b> ${operationTypeLabel}\n` : "") +
        (normalizedRequestedCarResolved ? `<b>السيارة المطلوبة:</b> ${normalizedRequestedCarResolved}\n` : "") +
        `<b>الحالة بعد التعديل:</b> ${status}</blockquote>\n\n` +
        `<i>🕐 ${arabicDateTime()}</i>`,
      payload: { source: "customer_update", customer_id: customerId },
    });
  } else {
    // ── عميل عائد: تجاوز فحص التكرار وإضافة بيانات الدورة ──────────────
    if (parentCustomerId) {
      const { data: parentRow } = await supabase
        .from("customers")
        .select("id, cycle_number")
        .eq("id", parentCustomerId)
        .maybeSingle();

      if (parentRow) {
        payload.parent_customer_id = parentCustomerId;
        payload.cycle_number = (parentRow.cycle_number ?? 1) + 1;
        (payload.metadata as Record<string, unknown>).parent_customer_id = parentCustomerId;
      }
    } else {
      // ── عميل جديد: فحص التكرار ────────────────────────────────────────
      const existingCustomerQuery = supabase
        .from("customers")
        .select("id, is_active, status")
        .eq("phone", phone)
        .limit(1);

      const { data: existingCustomerBeforeInsert } = await (
        branchId
          ? existingCustomerQuery.eq("branch_id", branchId)
          : existingCustomerQuery.is("branch_id", null)
      ).maybeSingle();

      if (existingCustomerBeforeInsert?.id) {
        const cycleStillActive = existingCustomerBeforeInsert.is_active !== false && !isClosedStatus(existingCustomerBeforeInsert.status ?? "");
        if (cycleStillActive) {
          redirect(
            `/dashboard/customers/new?error=${encodeRedirectError("يوجد دورة نشطة لهذا العميل. يرجى إنهاؤها أولًا قبل بدء دورة جديدة.")}`,
          );
        }

        // توجيه حسب الصلاحية — الموظف لا يملك وصولاً لصفحة management
        const existingCustomerPath = capabilities.isManager
          ? `/dashboard/management?customer=${existingCustomerBeforeInsert.id}&mode=view&notice=${encodeURIComponent("هذا العميل موجود مسبقًا. يمكنك تفعيل دورة جديدة من ملفه بعد الإغلاق.")}`
          : `/dashboard/customers?customer=${existingCustomerBeforeInsert.id}&mode=view&notice=${encodeURIComponent("هذا العميل موجود مسبقًا. يمكنك تفعيل دورة جديدة من ملفه بعد الإغلاق.")}`;
        redirect(existingCustomerPath);
      }
    }

    const { data, error } = await supabase.from("customers").insert(payload).select("id").maybeSingle();

    if (error?.code === "23505") {
      const existingCustomerQuery = supabase
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .limit(1);

      const { data: existingCustomer } = await (
        branchId
          ? existingCustomerQuery.eq("branch_id", branchId)
          : existingCustomerQuery.is("branch_id", null)
      ).maybeSingle();

      if (existingCustomer?.id) {
        const fallbackPath = capabilities.isManager
          ? `/dashboard/management?customer=${existingCustomer.id}&mode=view`
          : `/dashboard/customers?customer=${existingCustomer.id}&mode=view`;
        redirect(fallbackPath);
      }

      redirect(`/dashboard/customers/new?error=${encodeRedirectError("هذا العميل موجود مسبقًا في نفس المعرض.")}`);
    }

    if (error) {
      redirect(`/dashboard/customers/new?error=${encodeRedirectError(`تعذر حفظ الملف: ${error.message}`)}`);
    }

    savedId = data?.id ?? null;

    if (!savedId) {
      const fallbackCustomerQuery = supabase
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .eq("full_name", fullName)
        .order("created_at", { ascending: false })
        .limit(1);

      const { data: fallbackCustomer } = await (
        branchId
          ? fallbackCustomerQuery.eq("branch_id", branchId)
          : fallbackCustomerQuery.is("branch_id", null)
      ).maybeSingle();

      savedId = fallbackCustomer?.id ?? null;
    }

    if (!savedId) {
      redirect(`/dashboard/customers/new?error=${encodeRedirectError("تمت محاولة الحفظ لكن لم نستطع تأكيد إنشاء الملف. جرّب مرة أخرى.")}`);
    }

    if (savedId) {
      await insertCustomerLog({
        customerId: savedId,
        action: "customer_created",
        details: `تم إنشاء ملف العميل ${fullName}.`,
        nextFollowUpAt: resolvedNextFollowup,
      });

      // إذا كانت هناك ملاحظات/تفاوض عند الإنشاء → نُضيفها كإدخال منفصل في السجل التاريخي
      if (notes && notes.trim()) {
        await insertCustomerLog({
          customerId: savedId,
          action: "general",
          details: notes.trim(),
        });
      }
      await sendManagementActivityNotification({
        supabase,
        actorProfile: profile,
        branchId,
        title: "➕ إضافة عميل جديد",
        notificationType: "customer_create",
        message:
          `➕ <b>تسجيل عميل جديد في النظام</b>\n` +
          `أضاف الموظف <b>${profile?.full_name ?? "موظف"}</b> ملف عميل جديد.\n\n` +
          `👤 <b>تفاصيل العميل:</b>\n` +
          `<blockquote><b>الاسم الكامل:</b> ${fullName}\n` +
          (nickname ? `<b>الكنية:</b> ${nickname}\n` : "") +
          `<b>الهاتف:</b> <code>${phone}</code>\n` +
          (operationTypeLabel ? `<b>نوع العملية:</b> ${operationTypeLabel}\n` : "") +
          (normalizedRequestedCarResolved ? `<b>السيارة المطلوبة:</b> ${normalizedRequestedCarResolved}\n` : "") +
          (paymentPlan ? `<b>خطة الدفع:</b> ${paymentPlan}\n` : "") +
          (source ? `<b>مصدر العميل:</b> ${source}\n` : "") +
          `<b>الحالة الأولية:</b> ${status}\n` +
          (nextFollowUpAt ? `<b>موعد المتابعة:</b> ${arabicDateTime(new Date(nextFollowUpAt))}\n` : "") +
          `</blockquote>\n\n` +
          `<i>🕐 ${arabicDateTime()}</i>`,
        payload: { source: "customer_create", customer_id: savedId },
        skipTelegramPush: true,
      });

      void pushNewCustomerToManagers({
        branchId,
        customerId: savedId,
        opCode: operationType ?? "buyer",
        customerName: fullName,
        customerPhone: phone,
        staffName: profile?.full_name ?? "موظف",
        staffUserId: profile?.id ?? null,
        status,
        requestedCar: normalizedRequestedCarResolved,
        tradeInModel: tradeModelInput ?? null,
        nextFollowUp: resolvedNextFollowup,
      });
    }
  }

  if (savedId && inventoryIdForStatus && (status.includes("تمت عملية البيع") || status.includes("حجز"))) {
    const inventoryStatus = status.includes("تمت عملية البيع") ? "مباعة" : "محجوزة";
    const { data: inventoryItem } = await supabase
      .from("inventory")
      .select("id, model, chassis_no")
      .eq("id", inventoryIdForStatus)
      .maybeSingle();
    if (inventoryItem) {
      await supabase.from("inventory").update({ availability_status: inventoryStatus }).eq("id", inventoryItem.id);
      await supabase
        .from("customers")
        .update({ requested_car: `${inventoryItem.model ?? ""}${inventoryItem.chassis_no ? ` - شاصي:${inventoryItem.chassis_no}` : ""}`.trim() })
        .eq("id", savedId);
    }
  }

  if (!customerId && savedId && workflowType === "sell") {
    const inventoryModel = getNullableText(formData, "sell_inventory_model");
    const inventoryChassis = getNullableText(formData, "sell_inventory_chassis");
    const inventoryPriceRaw = getNullableText(formData, "sell_inventory_price");
    const inventoryColor = getNullableText(formData, "sell_inventory_color");
    const inventoryYearRaw = getNullableText(formData, "sell_inventory_year");
    const inventoryMileageRaw = getNullableText(formData, "sell_inventory_mileage");
    const inventorySpecs = getNullableText(formData, "sell_inventory_specs");
    const inventoryInspection = getNullableText(formData, "sell_inventory_inspection");
    const inventoryDealType = getNullableText(formData, "sell_inventory_deal_type") ?? "برسم البيع";
    const inventoryCondition = getNullableText(formData, "sell_inventory_condition") ?? "مستعملة";

    if (inventoryModel) {
      const { error } = await supabase.from("inventory").insert({
        branch_id: branchId,
        source_customer_id: savedId,
        model: inventoryModel,
        owner_name: fullName,
        deal_type: inventoryDealType,
        chassis_no: inventoryChassis,
        condition_label: inventoryCondition,
        availability_status: "متوفرة",
        price: inventoryPriceRaw ? Number(inventoryPriceRaw) : null,
        color: inventoryColor,
        production_year: inventoryYearRaw ? Number(inventoryYearRaw) : null,
        mileage: inventoryMileageRaw ? Number(inventoryMileageRaw) : null,
        specs: inventorySpecs,
        inspection: inventoryInspection,
      });

      if (error) {
        redirect(`/dashboard/customers/new?error=${encodeRedirectError(`تم حفظ العميل لكن تعذر إنشاء سجل السيارة: ${error.message}`)}`);
      }

      await insertCustomerLog({
        customerId: savedId,
        action: "sell_inventory_created",
        details: `تم إنشاء سيارة للمخزون من مسار بيع بالوكالة: ${inventoryModel}.`,
      });
    }
  }

  if (savedId && (workflowType === "buy" || tradeInId || hasTradeIn)) {
    const tradeModel = getNullableText(formData, "trade_in_model");
    const tradePayload = {
      customer_id: savedId,
      branch_id: branchId,
      owner_name: fullName,
      model: tradeModel ?? "",
      price: parseNumber(getNullableText(formData, "trade_in_price")),
      chassis_no: getNullableText(formData, "trade_in_chassis"),
      color: getNullableText(formData, "trade_in_color"),
      production_year: parseNumber(getNullableText(formData, "trade_in_year")),
      mileage: parseNumber(getNullableText(formData, "trade_in_mileage")),
      specs: getNullableText(formData, "trade_in_specs"),
      inspection: getNullableText(formData, "trade_in_inspection"),
      status: getNullableText(formData, "trade_in_status") ?? "استبدال (بانتظار التقييم)",
      condition_label: "مستعملة",
      deal_type: "استبدال",
      license_expiry: getNullableText(formData, "trade_in_license_expiry"),
      notes: getNullableText(formData, "trade_in_notes"),
      is_active: hasTradeIn && Boolean(tradeModel),
      metadata: {
        gear: getNullableText(formData, "trade_in_gear"),
        fuel: getNullableText(formData, "trade_in_fuel"),
        source: "customer_wizard",
      },
    };

    const { data: existingTradeIn } = await supabase
      .from("trade_ins")
      .select("id")
      .eq("customer_id", savedId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const targetTradeInId = tradeInId ?? existingTradeIn?.id ?? null;

    if (tradeModel) {
      if (targetTradeInId) {
        const { error } = await supabase.from("trade_ins").update(tradePayload).eq("id", targetTradeInId);
        if (error) {
          redirect(`/dashboard/customers/new?error=${encodeRedirectError(`تم حفظ العميل لكن تعذر تحديث سيارة العميل: ${error.message}`)}`);
        }
      } else {
        const { error } = await supabase.from("trade_ins").insert(tradePayload);
        if (error) {
          redirect(`/dashboard/customers/new?error=${encodeRedirectError(`تم حفظ العميل لكن تعذر حفظ سيارة العميل: ${error.message}`)}`);
        }
      }

      await insertCustomerLog({
        customerId: savedId,
        action: "trade_in_saved",
        details: `تم حفظ سيارة العميل ضمن مسار الشراء/الاستبدال: ${tradeModel}.`,
      });

      // ── تنبيه مدراء معرض المعلم بطلب التقييم ────────────────────────────
      {
        const adminWriter = hasSupabaseServiceRoleEnv() ? createAdminClient() : supabase;
        const { data: maalamBranches } = await adminWriter
          .from("branches")
          .select("id")
          .ilike("name", "%المعلم%")
          .eq("is_active", true);

        if (maalamBranches && maalamBranches.length > 0) {
          const maalamBranchIds = maalamBranches.map((b) => b.id);
          const { data: maalamManagers } = await adminWriter
            .from("app_users")
            .select("id, full_name, role, branch_id")
            .in("branch_id", maalamBranchIds)
            .eq("is_active", true);

          const maalamRecipients = (maalamManagers ?? []).filter((u) => {
            const caps = getRoleCapabilities(u.role, u.full_name);
            return caps.isManager;
          });

          if (maalamRecipients.length > 0) {
            const branchLabel = branchId
              ? (await adminWriter.from("branches").select("name").eq("id", branchId).maybeSingle()).data?.name ?? ""
              : "";
            const notifTitle = "🔁 طلب تقييم سيارة — استبدال";
            const notifMsg =
              `طلب ${profile?.full_name ?? "موظف"} تقييم سيارة للعميل ${fullName}` +
              ` — ${tradeModel}` +
              (branchLabel ? ` | ${branchLabel}` : "");

            await adminWriter.from("notifications").insert(
              maalamRecipients.map((m) => ({
                recipient_user_id: m.id,
                recipient_branch_id: m.branch_id ?? null,
                notification_type: "trade_in_evaluation",
                title: notifTitle,
                message: notifMsg,
                status: "unread",
                created_by_user_id: profile?.id ?? null,
                payload: {
                  source: "customer_form",
                  customer_id: savedId,
                  actor_user_id: profile?.id ?? null,
                  actor_name: profile?.full_name ?? "النظام",
                  trade_model: tradeModel,
                },
              })),
            );
          }
        }
      }
    } else if (targetTradeInId && !hasTradeIn) {
      const { error } = await supabase
        .from("trade_ins")
        .update({
          is_active: false,
          archived_reason: "deactivated_from_customer_form",
          archived_at: new Date().toISOString(),
        })
        .eq("id", targetTradeInId);

      if (error) {
        redirect(`/dashboard/customers/new?error=${encodeRedirectError(`تم حفظ العميل لكن تعذر إيقاف سيارة العميل: ${error.message}`)}`);
      }

      await insertCustomerLog({
        customerId: savedId,
        action: "trade_in_archived",
        details: "تم إيقاف سيارة العميل من داخل ملف العميل.",
      });
    }
  }

  if (savedId && hasTradeIn) {
    await syncTradeInventoryFromCustomer({
      supabase,
      customerId: savedId,
      branchId,
      customerName: fullName,
      tradeModel: tradeModelInput,
      tradeStatus: status, // ← حالة العميل (لا حالة سيارة الاستبدال) لتحديث المخزون صحيحاً
      tradeChassis: getNullableText(formData, "trade_in_chassis"),
      tradePrice: parseNumber(getNullableText(formData, "trade_in_price")),
      tradeColor: getNullableText(formData, "trade_in_color"),
      tradeYear: tradeYearInput,
      tradeMileage: parseNumber(getNullableText(formData, "trade_in_mileage")),
      tradeSpecs: getNullableText(formData, "trade_in_specs"),
      tradeInspection: getNullableText(formData, "trade_in_inspection"),
    });
  }

  // ── ربط سيارة المخزون للمشتري (حجز / بيع) ──────────────────────────────────
  // upsertCustomerAction لم يكن يعالج هذا سابقاً — تم إضافته الآن
  if (savedId && inventoryIdForStatus) {
    const resolvedOpType = operationType ?? (existingMetadata.operation_type_code as string | undefined) ?? "buyer";
    const isBuyerType = resolvedOpType !== "sell_on_behalf";
    const requiresInv = isBuyerType && (status.includes("تمت عملية البيع") || status.includes("حجز"));

    if (requiresInv) {
      // جلب بيانات السيارة المختارة
      const { data: invItem } = await supabase
        .from("inventory")
        .select("id, model, chassis_no, source_customer_id")
        .eq("id", inventoryIdForStatus)
        .maybeSingle();

      if (invItem) {
        const newInvStatus = status.includes("تمت عملية البيع") ? "مباعة" : "محجوزة";

        // تحديث حالة السيارة في المخزون
        await supabase
          .from("inventory")
          .update({ availability_status: newInvStatus })
          .eq("id", invItem.id);

        // حفظ الربط في metadata العميل
        const updatedMeta = {
          ...(existingMetadata as Record<string, unknown>),
          selected_inventory_id: invItem.id,
          selected_inventory_chassis: invItem.chassis_no ?? null,
        };
        await supabase
          .from("customers")
          .update({ metadata: updatedMeta })
          .eq("id", savedId);

        await insertCustomerLog({
          customerId: savedId,
          action: "status_updated",
          details: `تم ربط الملف بسيارة المخزون: ${invItem.model ?? ""}${invItem.chassis_no ? ` — شاصي: ${invItem.chassis_no}` : ""}. حالة المخزون: ${newInvStatus}.`,
        });

        // الانعكاس العكسي: إذا كانت السيارة لعميل بيع بالوكالة → تحديث حالته
        if (invItem.source_customer_id && invItem.source_customer_id !== savedId) {
          const sellOnBehalfNewStatus =
            newInvStatus === "مباعة"  ? "تمت عملية البيع (للعميل)" :
            newInvStatus === "محجوزة" ? "حجز (سيارة العميل)"       : null;
          if (sellOnBehalfNewStatus) {
            await supabase
              .from("customers")
              .update({ status: sellOnBehalfNewStatus, last_contact_at: new Date().toISOString() })
              .eq("id", invItem.source_customer_id);
            await insertCustomerLog({
              customerId: invItem.source_customer_id,
              action: "status_updated",
              details: `تم تحديث الحالة تلقائياً إلى "${sellOnBehalfNewStatus}" بسبب ${newInvStatus === "مباعة" ? "بيع" : "حجز"} السيارة من عميل جديد (معرف: ${savedId}).`,
            });
          }
        }
      }
    }
  }

  if (savedId) {
    const photoFiles = formData
      .getAll("trade_files_photos")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const inspectFiles = formData
      .getAll("trade_files_inspection")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const licenseFiles = formData
      .getAll("trade_files_license")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const insuranceFiles = formData
      .getAll("trade_files_insurance")
      .filter((item): item is File => item instanceof File && item.size > 0);

    try {
      const photoPaths = await uploadCustomerAttachmentFiles({
        supabase,
        customerId: savedId,
        uploadedByUserId: profile?.id ?? null,
        files: photoFiles,
        category: "trade_photo",
      });
      await uploadCustomerAttachmentFiles({
        supabase,
        customerId: savedId,
        uploadedByUserId: profile?.id ?? null,
        files: inspectFiles,
        category: "trade_inspection",
      });
      await uploadCustomerAttachmentFiles({
        supabase,
        customerId: savedId,
        uploadedByUserId: profile?.id ?? null,
        files: licenseFiles,
        category: "trade_license",
      });
      await uploadCustomerAttachmentFiles({
        supabase,
        customerId: savedId,
        uploadedByUserId: profile?.id ?? null,
        files: insuranceFiles,
        category: "trade_insurance",
      });

      // ── إشعار تقييم السيارة الشامل (نص + صور) ─────────────────────────
      if (hasSupabaseServiceRoleEnv()) {
        let signedPhotoUrls: string[] = [];
        if (photoPaths.length > 0) {
          const admin = createAdminClient();
          const { data: signedData } = await admin.storage
            .from("customer-attachments")
            .createSignedUrls(photoPaths, 3600);
          signedPhotoUrls = (signedData ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
        }
        const tradeStatusVal = getNullableText(formData, "trade_in_status");
        const hasTradeData = Boolean(tradeModelInput?.trim());
        if (hasTradeData) {
          void pushTradeAssessmentNotification({
            supabase,
            actorProfile: profile,
            branchId,
            customerId: savedId,
            customerName: fullName || "غير محدد",
            customerNickname: nickname || null,
            customerPhone: phone,
            tradeModel: tradeModelInput,
            tradeStatus: tradeStatusVal,
            tradeChassis: getNullableText(formData, "trade_in_chassis"),
            tradeColor: getNullableText(formData, "trade_in_color"),
            tradeYear: tradeYearInput,
            tradeMileage: parseNumber(getNullableText(formData, "trade_in_mileage")),
            tradePrice: parseNumber(getNullableText(formData, "trade_in_price")),
            tradeSpecs: getNullableText(formData, "trade_in_specs"),
            tradeInspection: getNullableText(formData, "trade_in_inspection"),
            signedPhotoUrls,
          });
        } else if (signedPhotoUrls.length > 0) {
          // صور فقط بدون بيانات استبدال — إرسال مباشر
          const caption =
            `📸 <b>صور مرفقة من الموظف ${profile?.full_name ?? "موظف"}</b>\n` +
            `👤 ${fullName || "غير محدد"} | 📱 <code>${phone}</code>`;
          void pushTelegramPhotosToManagers({ branchId, caption, photoUrls: signedPhotoUrls });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر رفع أحد الملفات";
      redirect(`/dashboard/customers/new?error=${encodeRedirectError(message)}`);
    }
  }

  // ── رفع التسجيلات الصوتية (تفاوض + ملاحظات) ──────────────────────────
  if (savedId) {
    const voiceFiles = formData.getAll("voice_general_notes")
      .concat(
        ...[...formData.keys()]
          .filter((k) => k.startsWith("voice_negotiation_"))
          .map((k) => formData.getAll(k)),
      )
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (voiceFiles.length > 0) {
      try {
        await uploadCustomerAttachmentFiles({
          supabase,
          customerId: savedId,
          uploadedByUserId: profile?.id ?? null,
          files: voiceFiles,
          category: "voice_note",
        });
      } catch {
        // لا نوقف الحفظ بسبب فشل رفع الصوت
      }
    }
  }

  if (savedId) {
    await syncCustomerFollowupReminder({
      customerId: savedId,
      branchId,
      assignedUserId,
      nextFollowUpAt: resolvedNextFollowup,
      status,
      fullName,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/search");
  revalidatePath("/dashboard/management");

  if (savedId) {
    revalidatePath(`/dashboard/customers/${savedId}`);
    if (returnTo) {
      redirect(appendNoticeParam(returnTo, "تم الحفظ بنجاح"));
    }
    redirect(`/dashboard/customers/new?notice=${encodeURIComponent("تم الحفظ بنجاح")}&saved_id=${savedId}`);
  }

  redirect("/dashboard/customers");
}

export async function createCustomerReminderAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const customerId = getText(formData, "customer_id");
  const returnTo = getNullableText(formData, "return_to");
  if (!customerId) return;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const branchId = getNullableText(formData, "branch_id");
  const assignedUserId = getNullableText(formData, "assigned_user_id");
  const dueAt = parseDateTimeLocal(getNullableText(formData, "due_at"));
  const title = getNullableText(formData, "title");
  const message = getText(formData, "message");

  if (!message) return;

  await supabase.from("reminders").insert({
    customer_id: customerId,
    branch_id: branchId,
    assigned_user_id: assignedUserId,
    created_by_user_id: profile?.id ?? null,
    reminder_type: "manual_dashboard",
    title,
    message,
    due_at: dueAt,
    status: "pending",
    payload: {
      source: "customer_detail",
    },
  });

  await insertCustomerLog({
    customerId,
    action: "manual_reminder_created",
    details: title ? `${title}: ${message}` : message,
    nextFollowUpAt: dueAt,
  });
  const reminderCtx = await fetchCustomerContext(supabase, customerId);
  const reminderActorName = profile?.full_name ?? "موظف";
  const reminderCustomerDisplay = reminderCtx.nickname
    ? `${reminderCtx.fullName} (${reminderCtx.nickname})`
    : reminderCtx.fullName;

  await sendManagementActivityNotification({
    supabase,
    actorProfile: profile,
    branchId,
    title: "🔔 تذكير عميل جديد",
    notificationType: "manual_reminder",
    message:
      `🔔 <b>تم جدولة تذكير جديد</b>\n` +
      `بواسطة الموظف: <b>${reminderActorName}</b>\n\n` +
      `👤 <b>تفاصيل العميل:</b>\n` +
      `<blockquote><b>الاسم الكامل:</b> ${reminderCtx.fullName}\n` +
      (reminderCtx.nickname ? `<b>الكنية:</b> ${reminderCtx.nickname}\n` : "") +
      `<b>الهاتف:</b> <code>${reminderCtx.phone}</code>\n` +
      (reminderCtx.branchName ? `<b>المعرض:</b> ${reminderCtx.branchName}\n` : "") +
      (title ? `<b>عنوان التذكير:</b> ${title}\n` : "") +
      `<b>نص التذكير:</b> ${message}\n` +
      (dueAt ? `<b>موعد التذكير:</b> ${arabicDateTime(new Date(dueAt))}\n` : "") +
      (reminderCtx.requestedCar ? `<b>السيارة المطلوبة:</b> ${reminderCtx.requestedCar}\n` : "") +
      `</blockquote>\n\n` +
      `<i>🕐 ${arabicDateTime()}</i>`,
    payload: { source: "reminder_create", customer_id: customerId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/search");
  revalidatePath("/dashboard/management");
  revalidatePath(`/dashboard/customers/${customerId}`);

  if (returnTo) {
    redirect(appendNoticeParam(returnTo, "تم حفظ التذكير بنجاح"));
  }
}

export async function updateCustomerStatusAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const customerId = getText(formData, "customer_id");
  const returnTo = getNullableText(formData, "return_to");
  const fullName = getText(formData, "full_name");
  const status = getText(formData, "status");
  const branchId = getNullableText(formData, "branch_id");
  const assignedUserId = getNullableText(formData, "assigned_user_id");
  const nextFollowUpAt = parseDateTimeLocal(getNullableText(formData, "next_follow_up_at"));
  const isActive = !isClosedStatus(status);
  const note = getNullableText(formData, "note");

  if (!customerId || !status) return;

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  await supabase
    .from("customers")
    .update({
      status,
      is_active: isActive,
      next_follow_up_at: nextFollowUpAt,
      last_contact_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  await insertCustomerLog({
    customerId,
    action: "status_updated",
    details: note ? `تم تغيير الحالة إلى ${status}. ${note}` : `تم تغيير الحالة إلى ${status}.`,
    nextFollowUpAt,
  });
  await incrementCustomerInteractions(supabase, customerId);
  await completeCustomerPendingReminders(supabase, customerId);

  // ── إشعار احترافي شامل التفاصيل ─────────────────────────────────────────
  const actorName = profile?.full_name ?? "موظف";
  const ctx = await fetchCustomerContext(supabase, customerId);
  const { title: notifTitle, message: notifMessage } = buildStatusNotification({
    status,
    ctx,
    actorName,
    note,
    nextFollowUpAt,
  });

  await sendManagementActivityNotification({
    supabase,
    actorProfile: profile,
    branchId,
    title: notifTitle,
    notificationType: "customer_status_update",
    message: notifMessage,
    payload: { source: "customer_status_update", customer_id: customerId, status },
  });

  await syncCustomerFollowupReminder({
    customerId,
    branchId,
    assignedUserId,
    nextFollowUpAt,
    status,
    fullName,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/search");
  revalidatePath("/dashboard/management");
  revalidatePath(`/dashboard/customers/${customerId}`);

  if (returnTo) {
    redirect(appendNoticeParam(returnTo, "تم تحديث الحالة بنجاح"));
  }
}

/**
 * يفتح دورة جديدة للعميل العائد أو المغلق:
 * - يُنشئ سجلاً جديداً (لا يُعدّل القديم)
 * - يرث بيانات الاتصال الأساسية
 * - يربط السجل الجديد بالسابق عبر parent_customer_id
 */
export async function openNewCycleAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const parentId = getText(formData, "parent_customer_id");
  const operationType = getText(formData, "operation_type") || "buyer";
  const returnPath = getNullableText(formData, "return_to");
  const formBranchId = getNullableText(formData, "branch_id");

  if (!parentId) return;

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);

  // جلب بيانات الدورة الأم
  const { data: parent } = await supabase
    .from("customers")
    .select("id, full_name, phone, nickname, address, whatsapp_prefix, branch_id, assigned_user_id, cycle_number, is_active, status")
    .eq("id", parentId)
    .maybeSingle();

  if (!parent) return;

  // تحقق من أن الدورة الأم مغلقة فعلاً قبل فتح دورة جديدة
  // (يطابق نفس المنطق في الواجهة: is_active=false أو حالة إغلاق نصية)
  const CLOSED_HINTS = [
    "تمت عملية البيع",
    "شراء من قبل المعرض",
    "رفض من قبل العميل",
    "رفض من قبل المعرض",
    "تراجع العميل عن الاستبدال",
    "سحب السيارة من البيع",
    "إغلاق الملف",
  ];
  const isClosed =
    parent.is_active === false ||
    CLOSED_HINTS.some((hint) => (parent.status ?? "").includes(hint));
  if (!isClosed) {
    redirect(
      `/dashboard/customers?customer=${parentId}&mode=view&error=${encodeRedirectError("لا يمكن فتح دورة جديدة إلا للملفات المغلقة.")}`,
    );
  }

  const newCycleNumber = (parent.cycle_number ?? 1) + 1;
  // الحالة الافتتاحية تتبع نوع العملية
  const firstStatus =
    operationType === "sell_on_behalf"        ? "عرض سيارة للبيع" :
    operationType === "buyer_tradein_pending" ? "استبدال — تحت التقييم" :
    /* buyer */                                 "جديد";

  const { data: newCustomer, error } = await supabase
    .from("customers")
    .insert({
      full_name: parent.full_name,
      phone: parent.phone,
      nickname: parent.nickname ?? null,
      address: parent.address ?? null,
      whatsapp_prefix: parent.whatsapp_prefix ?? null,
      branch_id: (capabilities.isGeneralManager && formBranchId) ? formBranchId : (parent.branch_id ?? null),
      assigned_user_id: profile?.id ?? parent.assigned_user_id ?? null,
      status: firstStatus,
      is_active: true,
      source: "دورة جديدة",
      operation_type: operationType,
      parent_customer_id: parentId,
      cycle_number: newCycleNumber,
      metadata: { operation_type: operationType, operation_type_code: operationType, parent_customer_id: parentId },
      next_follow_up_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error || !newCustomer) {
    redirect(`/dashboard/customers?customer=${parentId}&mode=view&error=${encodeRedirectError(`تعذر إنشاء الدورة الجديدة: ${error?.message ?? "خطأ غير معروف"}`)}`);
  }

  // سجل النشاط (critical — لكن لا يجب أن يعطّل التوجيه إذا فشل)
  try {
    await insertCustomerLog({
      customerId: newCustomer.id,
      action: "customer_created",
      details: `تم فتح دورة جديدة (رقم ${newCycleNumber}) للعميل ${parent.full_name}. مرتبطة بالدورة السابقة #${parent.cycle_number ?? 1}.`,
      nextFollowUpAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[openNewCycle] insertCustomerLog failed:", e);
  }

  // الإشعارات والتذكيرات — لا يجب أن تعطّل التوجيه إذا فشلت
  try {
    const newCycleCtx = await fetchCustomerContext(supabase, newCustomer.id);
    const actorName = profile?.full_name ?? "موظف";

    await sendManagementActivityNotification({
      supabase,
      actorProfile: profile,
      branchId: parent.branch_id,
      title: "🔄 دورة جديدة لعميل عائد",
      notificationType: "customer_reactivate",
      message:
        `♻️ <b>عميل عائد — دورة جديدة رقم ${newCycleNumber}</b>\n` +
        `بواسطة: <b>${actorName}</b>\n\n` +
        `👤 <b>تفاصيل العميل:</b>\n` +
        `<blockquote><b>الاسم:</b> ${parent.full_name}\n` +
        `<b>الهاتف:</b> <code>${parent.phone}</code>\n` +
        (newCycleCtx.branchName ? `<b>المعرض:</b> ${newCycleCtx.branchName}\n` : "") +
        `<b>نوع العملية الجديدة:</b> ${operationType === "buyer" ? "مشتري" : operationType === "buyer_tradein_pending" ? "مشتري + استبدال" : "سيارة برسم البيع"}\n` +
        `<b>الحالة الابتدائية:</b> ${firstStatus}</blockquote>\n\n` +
        `<i>🕐 ${arabicDateTime()}</i>`,
      payload: { source: "customer_new_cycle", customer_id: newCustomer.id, parent_customer_id: parentId },
    });
  } catch (e) {
    console.error("[openNewCycle] notification failed:", e);
  }

  try {
    await syncCustomerFollowupReminder({
      customerId: newCustomer.id,
      branchId: parent.branch_id,
      assignedUserId: profile?.id ?? parent.assigned_user_id ?? null,
      nextFollowUpAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: firstStatus,
      fullName: parent.full_name,
    });
  } catch (e) {
    console.error("[openNewCycle] reminder sync failed:", e);
  }

  // ── رفع التسجيلات الصوتية من الويزارد ──────────────────────────────
  const voiceFiles = formData.getAll("voice_general_notes")
    .concat(
      ...[...formData.keys()]
        .filter((k) => k.startsWith("voice_negotiation_"))
        .map((k) => formData.getAll(k)),
    )
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (voiceFiles.length > 0) {
    try {
      await uploadCustomerAttachmentFiles({
        supabase,
        customerId: newCustomer.id,
        uploadedByUserId: profile?.id ?? null,
        files: voiceFiles,
        category: "voice_note",
      });
    } catch {
      // لا نوقف الحفظ بسبب فشل رفع الصوت
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/management");

  // نوجّه المستخدم لملف العميل الجديد — نستخدم customers لأنها تعمل لجميع الأدوار
  const destination = returnPath ?? `/dashboard/customers?customer=${newCustomer.id}&mode=view&notice=${encodeURIComponent("✅ تم فتح الدورة الجديدة بنجاح")}`;
  redirect(destination);
}

export async function reactivateCustomerAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const customerId = getText(formData, "customer_id");
  const returnTo = getNullableText(formData, "return_to");
  const fullName = getText(formData, "full_name");
  const branchId = getNullableText(formData, "branch_id");
  const assignedUserId = getNullableText(formData, "assigned_user_id");

  if (!customerId) return;

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  await supabase
    .from("customers")
    .update({
      status: "قيد المتابعة",
      is_active: true,
      next_follow_up_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    })
    .eq("id", customerId);

  await insertCustomerLog({
    customerId,
    action: "customer_reactivated",
    details: `تم فتح عملية جديدة للعميل ${fullName || ""}.`,
    nextFollowUpAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  });
  await incrementCustomerInteractions(supabase, customerId);
  const reactivateCtx = await fetchCustomerContext(supabase, customerId);
  const reactivateActorName = profile?.full_name ?? "موظف";

  await sendManagementActivityNotification({
    supabase,
    actorProfile: profile,
    branchId,
    title: "🔄 إعادة تفعيل ملف عميل",
    notificationType: "customer_reactivate",
    message:
      `🔄 <b>إعادة تفعيل دورة متابعة جديدة</b>\n` +
      `بواسطة الموظف: <b>${reactivateActorName}</b>\n\n` +
      `👤 <b>تفاصيل العميل:</b>\n` +
      `<blockquote><b>الاسم الكامل:</b> ${reactivateCtx.fullName || fullName}\n` +
      (reactivateCtx.nickname ? `<b>الكنية:</b> ${reactivateCtx.nickname}\n` : "") +
      `<b>الهاتف:</b> <code>${reactivateCtx.phone}</code>\n` +
      (reactivateCtx.branchName ? `<b>المعرض:</b> ${reactivateCtx.branchName}\n` : "") +
      `<b>الحالة الجديدة:</b> قيد المتابعة\n` +
      (reactivateCtx.requestedCar ? `<b>السيارة المطلوبة:</b> ${reactivateCtx.requestedCar}\n` : "") +
      (reactivateCtx.operationType ? `<b>نوع العملية:</b> ${reactivateCtx.operationType === "بيع بالوكالة" || reactivateCtx.operationType === "sell_on_behalf" ? "سيارة برسم البيع" : reactivateCtx.operationType}\n` : "") +
      `<b>موعد المتابعة الأول:</b> ${arabicDateTime(new Date(Date.now() + 1000 * 60 * 60 * 24))}\n` +
      `</blockquote>\n\n` +
      `<i>🕐 ${arabicDateTime()}</i>`,
    payload: { source: "customer_reactivate", customer_id: customerId },
  });

  await syncCustomerFollowupReminder({
    customerId,
    branchId,
    assignedUserId,
    nextFollowUpAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    status: "قيد المتابعة",
    fullName: fullName || "العميل",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/search");
  revalidatePath("/dashboard/management");
  revalidatePath(`/dashboard/customers/${customerId}`);

  if (returnTo) {
    redirect(appendNoticeParam(returnTo, "تم التفعيل بنجاح"));
  }
}

export async function saveCustomerProfileAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const customerId = getText(formData, "customer_id");
  const returnTo = getNullableText(formData, "return_to");
  if (!customerId) return;

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const fullName = getText(formData, "full_name");
  const phone = getText(formData, "phone");
  const requestedCarInput = getNullableText(formData, "requested_car");
  const status = getText(formData, "status") || "قيد المتابعة";
  const note = getNullableText(formData, "note");
  const nextFollowUpAt = parseDateTimeLocal(getNullableText(formData, "next_follow_up_at"));
  const branchId = getNullableText(formData, "branch_id");
  const assignedUserId = getNullableText(formData, "assigned_user_id");
  const isActive = !isClosedStatus(status);
  const hasTradeIn = getBoolean(formData, "has_trade_in");

  const inventoryIdForStatus = getNullableText(formData, "inventory_id_for_status");
  const dealValue = parseNumber(getNullableText(formData, "deal_value"));
  const paymentMethod = getNullableText(formData, "payment_method");
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("notes, requested_car, metadata, last_contact_at")
    .eq("id", customerId)
    .maybeSingle();

  const operationType = getNullableText(formData, "operation_type") ?? "buyer";
  const allowExceptionalEdit = formData.get("allow_exceptional_edit") === "true";

  // ── حماية سيرفر: ملفات البيع المكتملة محمية من التعديل بدون إذن صريح ─────
  const isSoldComplete =
    !(existingCustomer as unknown as { is_active?: boolean } | null)?.is_active &&
    ((existingCustomer as unknown as { status?: string } | null)?.status ?? "").includes("تمت عملية البيع");

  // نجلب is_active و status مباشرة من DB (existingCustomer لا يحملهما بعد)
  const { data: customerLockCheck } = await supabase
    .from("customers")
    .select("is_active, status")
    .eq("id", customerId)
    .maybeSingle();

  const isFileSoldLocked =
    customerLockCheck &&
    !customerLockCheck.is_active &&
    (customerLockCheck.status ?? "").includes("تمت عملية البيع");

  if (isFileSoldLocked && !allowExceptionalEdit) {
    redirect(
      `/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError("هذا الملف مغلق نهائياً (تمت عملية البيع). لا يمكن التعديل إلا عبر زر التعديل الاستثنائي.")}`,
    );
  }

  const requiresInventory =
    operationType !== "sell_on_behalf" &&
    (status.includes("تمت عملية البيع") || status.includes("حجز"));
  if (requiresInventory && !inventoryIdForStatus) {
    redirect(
      `/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError("يرجى اختيار السيارة / الشاصي عند حالة البيع أو الحجز.")}`,
    );
  }

  const currentMetadata = ((existingCustomer?.metadata as Record<string, unknown> | null) ?? {});
  const previousSelectedInventoryId =
    typeof currentMetadata.selected_inventory_id === "string" ? currentMetadata.selected_inventory_id : null;

  const tradeModelInput = getNullableText(formData, "trade_in_model");
  const tradeYearInput = parseNumber(getNullableText(formData, "trade_in_year"));
  let requestedCar =
    requestedCarInput && requestedCarInput.trim().length > 0
      ? requestedCarInput
      : existingCustomer?.requested_car ?? null;
  let selectedInventoryMeta: { id: string | null; chassis: string | null } = { id: null, chassis: null };
  if (inventoryIdForStatus) {
    const { data: inventoryItem } = await supabase
      .from("inventory")
      .select("id, model, chassis_no")
      .eq("id", inventoryIdForStatus)
      .maybeSingle();

    if (inventoryItem) {
      requestedCar = `${inventoryItem.model ?? ""}${inventoryItem.chassis_no ? ` - شاصي:${inventoryItem.chassis_no}` : ""}`.trim() || requestedCar;
      selectedInventoryMeta = { id: inventoryItem.id, chassis: inventoryItem.chassis_no ?? null };
    }
  }
  requestedCar = normalizeRequestedCarsText(requestedCar);

  const existingNotes = (existingCustomer?.notes as string | null) ?? null;
  const closureAutoNote = !isActive ? `تم إغلاق الملف تلقائيًا بسبب الحالة الحالية: ${status}.` : "";
  const mergedNotes = note
    ? `${existingNotes ? `${existingNotes}\n\n` : ""}[تحديث ${new Date().toLocaleString("en-US")}]\n${note}${closureAutoNote ? `\n${closureAutoNote}` : ""}`
    : closureAutoNote
      ? `${existingNotes ? `${existingNotes}\n\n` : ""}[تحديث ${new Date().toLocaleString("en-US")}]\n${closureAutoNote}`
      : existingNotes;

  // حفظ قيمة الصفقة في metadata إذا كانت موجودة وإذا كانت الحالة إغلاق
  const isClosingStatus = isClosedStatus(status);
  const dealValueToSave =
    dealValue && dealValue > 0 && isClosingStatus
      ? dealValue
      : (typeof currentMetadata.deal_value === "number" ? currentMetadata.deal_value : null);

  // تحويل كود نوع العملية إلى النص العربي
  const operationTypeLabel =
    operationType === "buyer" ? "مشتري" :
    operationType === "buyer_tradein_pending" ? "مشتري + استبدال" :
    operationType === "sell_on_behalf" ? "بيع بالوكالة" :
    (existingCustomer as unknown as { operation_type?: string } | null)?.operation_type ?? "مشتري";

  const customerPayload: Record<string, unknown> = {
    requested_car: requestedCar,
    status,
    notes: mergedNotes,
    next_follow_up_at: isActive ? nextFollowUpAt : null,
    is_active: isActive,
    operation_type: operationTypeLabel,
    metadata: {
      ...currentMetadata,
      operation_type_code: operationType,
      selected_inventory_id: selectedInventoryMeta.id,
      selected_inventory_chassis: selectedInventoryMeta.chassis,
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
      ...(dealValueToSave !== null ? { deal_value: dealValueToSave } : {}),
    },
  };

  customerPayload.last_contact_at = new Date().toISOString();

  const customerUpdate = await supabase
    .from("customers")
    .update(customerPayload)
    .eq("id", customerId);

  if (customerUpdate.error) {
    redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(customerUpdate.error.message)}`);
  }

  const newInventoryStatus = status.includes("تمت عملية البيع") ? "مباعة" : status.includes("حجز") ? "محجوزة" : null;
  const selectedInventoryId = selectedInventoryMeta.id;

  // ── تحديث حالة السيارة في المخزون + الانعكاس العكسي على عميل البيع بالوكالة ──
  if (newInventoryStatus && selectedInventoryId) {
    const markSelectedInventory = await supabase
      .from("inventory")
      .update({ availability_status: newInventoryStatus })
      .eq("id", selectedInventoryId);
    if (markSelectedInventory.error) {
      redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(markSelectedInventory.error.message)}`);
    }

    // إذا كانت السيارة تخص عميل بيع بالوكالة → تحديث حالته تلقائياً
    const { data: invCarOwner } = await supabase
      .from("inventory")
      .select("source_customer_id")
      .eq("id", selectedInventoryId)
      .maybeSingle();

    if (invCarOwner?.source_customer_id && invCarOwner.source_customer_id !== customerId) {
      const sellOnBehalfNewStatus =
        newInventoryStatus === "مباعة"  ? "تمت عملية البيع (للعميل)" :
        newInventoryStatus === "محجوزة" ? "حجز (سيارة العميل)"       : null;
      if (sellOnBehalfNewStatus) {
        await supabase
          .from("customers")
          .update({ status: sellOnBehalfNewStatus, last_contact_at: new Date().toISOString() })
          .eq("id", invCarOwner.source_customer_id);
        // سجل تدقيق: التحديث التلقائي لعميل الوكالة
        await insertCustomerLog({
          customerId: invCarOwner.source_customer_id,
          action: "status_updated",
          details: `تم تحديث الحالة تلقائياً إلى "${sellOnBehalfNewStatus}" بسبب ${newInventoryStatus === "مباعة" ? "بيع" : "حجز"} السيارة من قبل عميل آخر (معرف العميل: ${customerId}).`,
        });
      }
    }
  }

  // ── الإفراج عن السيارة السابقة إذا تغيّر الاختيار ─────────────────────────
  if (previousSelectedInventoryId && previousSelectedInventoryId !== selectedInventoryId) {
    const releasePreviousInventory = await supabase
      .from("inventory")
      .update({ availability_status: "متوفرة" })
      .eq("id", previousSelectedInventoryId);
    if (releasePreviousInventory.error) {
      redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(releasePreviousInventory.error.message)}`);
    }

    // إذا كانت السيارة المُفرَج عنها تخص عميل بيع بالوكالة → إعادة حالته لـ "برسم البيع"
    const { data: prevInvOwner } = await supabase
      .from("inventory")
      .select("source_customer_id")
      .eq("id", previousSelectedInventoryId)
      .maybeSingle();

    if (prevInvOwner?.source_customer_id && prevInvOwner.source_customer_id !== customerId) {
      const releaseResult = await supabase
        .from("customers")
        .update({ status: "برسم البيع", last_contact_at: new Date().toISOString() })
        .eq("id", prevInvOwner.source_customer_id)
        // نُعيد الحالة فقط إذا كانت في حجز أو بيع (لا نتجاوز حالة مغلقة)
        .in("status", ["حجز (سيارة العميل)", "تمت عملية البيع (للعميل)"]);
      if (!releaseResult.error) {
        // سجل تدقيق: الإفراج عن سيارة عميل الوكالة
        await insertCustomerLog({
          customerId: prevInvOwner.source_customer_id,
          action: "status_updated",
          details: `تم إعادة الحالة تلقائياً إلى "برسم البيع" بعد تراجع/تغيير العميل (معرف العميل: ${customerId}) عن حجز السيارة.`,
        });
      }
    }
  }

  const tradeInId = getNullableText(formData, "trade_in_id");
  const tradeModel = getNullableText(formData, "trade_in_model");
  const tradePayload = {
    customer_id: customerId,
    branch_id: branchId,
    owner_name: fullName || null,
    model: tradeModel ?? "",
    price: parseNumber(getNullableText(formData, "trade_in_price")),
    chassis_no: getNullableText(formData, "trade_in_chassis"),
    color: getNullableText(formData, "trade_in_color"),
    production_year: parseNumber(getNullableText(formData, "trade_in_year")),
    mileage: parseNumber(getNullableText(formData, "trade_in_mileage")),
    specs: getNullableText(formData, "trade_in_specs"),
    inspection: getNullableText(formData, "trade_in_inspection"),
    status: getNullableText(formData, "trade_in_status") ?? "استبدال (بانتظار التقييم)",
    condition_label: "مستعملة",
    deal_type: "استبدال",
    license_expiry: getNullableText(formData, "trade_in_license_expiry"),
    notes: getNullableText(formData, "trade_in_notes"),
    is_active: hasTradeIn && Boolean(tradeModel),
    metadata: {
      gear: getNullableText(formData, "trade_in_gear"),
      fuel: getNullableText(formData, "trade_in_fuel"),
      source: "profile_modal",
    },
  };

  if (hasTradeIn && tradeModel) {
    if (tradeInId) {
      const upd = await supabase.from("trade_ins").update(tradePayload).eq("id", tradeInId);
      if (upd.error) {
        redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(upd.error.message)}`);
      }
    } else {
      const ins = await supabase.from("trade_ins").insert(tradePayload);
      if (ins.error) {
        redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(ins.error.message)}`);
      }
    }
  }

  if (!hasTradeIn && tradeInId) {
    const archive = await supabase
      .from("trade_ins")
      .update({
        is_active: false,
        archived_reason: "disabled_from_profile_modal",
        archived_at: new Date().toISOString(),
      })
      .eq("id", tradeInId);

    if (archive.error) {
      redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(archive.error.message)}`);
    }
  }

  // ── مزامنة مخزون سيارة العميل ────────────────────────────────────────────
  // الخلل: has_trade_in مرتبط بزر "تعديل" لا بوجود السيارة؛
  // نُعالج مسارَين: (1) المستخدم فتح التعديل وأرسل البيانات،
  //                 (2) المستخدم غيّر الحالة فقط دون فتح التعديل
  const selectedSellTradeId = getNullableText(formData, "selected_trade_in_id");
  const AUTO_SYNC_OP_TYPES = ["sell_on_behalf", "buyer_tradein_pending", "buyer_tradein_evaluated"];

  if (hasTradeIn) {
    // المسار 1: بيانات السيارة مُرسَلة من الفورم
    let syncModel = tradeModelInput;
    let syncChassis = getNullableText(formData, "trade_in_chassis");
    let syncPrice = parseNumber(getNullableText(formData, "trade_in_price"));
    let syncColor = getNullableText(formData, "trade_in_color");
    let syncYear = tradeYearInput;
    let syncMileage = parseNumber(getNullableText(formData, "trade_in_mileage"));
    let syncSpecs = getNullableText(formData, "trade_in_specs");
    let syncInspection = getNullableText(formData, "trade_in_inspection");

    // sell_on_behalf متعدد: إذا اختار المستخدم سيارة محددة نجلب بياناتها من DB
    if (selectedSellTradeId && operationType === "sell_on_behalf") {
      const { data: selTrade } = await supabase
        .from("trade_ins")
        .select("model, chassis_no, price, color, production_year, mileage, specs, inspection")
        .eq("id", selectedSellTradeId)
        .maybeSingle();
      if (selTrade) {
        syncModel = selTrade.model ?? syncModel;
        syncChassis = selTrade.chassis_no ?? null;
        syncPrice = selTrade.price ?? null;
        syncColor = selTrade.color ?? null;
        syncYear = selTrade.production_year ?? null;
        syncMileage = selTrade.mileage ?? null;
        syncSpecs = selTrade.specs ?? null;
        syncInspection = selTrade.inspection ?? null;
      }
    }

    await syncTradeInventoryFromCustomer({
      supabase,
      customerId,
      branchId,
      customerName: fullName || phone || "مالك",
      tradeModel: syncModel,
      tradeStatus: status,
      tradeChassis: syncChassis,
      tradePrice: syncPrice,
      tradeColor: syncColor,
      tradeYear: syncYear,
      tradeMileage: syncMileage,
      tradeSpecs: syncSpecs,
      tradeInspection: syncInspection,
    });
  } else if (AUTO_SYNC_OP_TYPES.includes(operationType)) {
    // المسار 2: المستخدم لم يفتح التعديل → نجلب بيانات السيارة من قاعدة البيانات مباشرةً
    // (has_trade_in = false لأن الـ checkbox "تعديل" غير مُفعَّل، لا لأن السيارة غير موجودة)
    const syncSourceId = selectedSellTradeId || tradeInId;
    if (syncSourceId) {
      const { data: existingTrade } = await supabase
        .from("trade_ins")
        .select("model, chassis_no, price, color, production_year, mileage, specs, inspection")
        .eq("id", syncSourceId)
        .maybeSingle();
      if (existingTrade?.model) {
        await syncTradeInventoryFromCustomer({
          supabase,
          customerId,
          branchId,
          customerName: fullName || phone || "مالك",
          tradeModel: existingTrade.model,
          tradeStatus: status,
          tradeChassis: existingTrade.chassis_no ?? null,
          tradePrice: existingTrade.price ?? null,
          tradeColor: existingTrade.color ?? null,
          tradeYear: existingTrade.production_year ?? null,
          tradeMileage: existingTrade.mileage ?? null,
          tradeSpecs: existingTrade.specs ?? null,
          tradeInspection: existingTrade.inspection ?? null,
        });
      }
    }
  }

  const photoFiles = formData
    .getAll("trade_files_photos")
    .filter((item): item is File => item instanceof File && item.size > 0);
  const inspectFiles = formData
    .getAll("trade_files_inspection")
    .filter((item): item is File => item instanceof File && item.size > 0);
  const licenseFiles = formData
    .getAll("trade_files_license")
    .filter((item): item is File => item instanceof File && item.size > 0);
  const insuranceFiles = formData
    .getAll("trade_files_insurance")
    .filter((item): item is File => item instanceof File && item.size > 0);

  try {
    const photoPaths = await uploadCustomerAttachmentFiles({
      supabase,
      customerId,
      uploadedByUserId: profile?.id ?? null,
      files: photoFiles,
      category: "trade_photo",
    });
    await uploadCustomerAttachmentFiles({
      supabase,
      customerId,
      uploadedByUserId: profile?.id ?? null,
      files: inspectFiles,
      category: "trade_inspection",
    });
    await uploadCustomerAttachmentFiles({
      supabase,
      customerId,
      uploadedByUserId: profile?.id ?? null,
      files: licenseFiles,
      category: "trade_license",
    });
    await uploadCustomerAttachmentFiles({
      supabase,
      customerId,
      uploadedByUserId: profile?.id ?? null,
      files: insuranceFiles,
      category: "trade_insurance",
    });

    // ── إشعار تقييم السيارة الشامل (نص + صور) ───────────────────────────
    if (hasSupabaseServiceRoleEnv()) {
      let signedPhotoUrls: string[] = [];
      if (photoPaths.length > 0) {
        const admin = createAdminClient();
        const { data: signedData } = await admin.storage
          .from("customer-attachments")
          .createSignedUrls(photoPaths, 3600);
        signedPhotoUrls = (signedData ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
      }
      const tradeModelVal = getNullableText(formData, "trade_in_model");
      const tradeStatusVal = getNullableText(formData, "trade_in_status");
      const hasTradeData = Boolean(tradeModelVal?.trim()) && hasTradeIn;
      const profileNickname = getNullableText(formData, "nickname");
      if (hasTradeData) {
        void pushTradeAssessmentNotification({
          supabase,
          actorProfile: profile,
          branchId,
          customerId,
          customerName: fullName || "غير محدد",
          customerNickname: profileNickname,
          customerPhone: phone,
          tradeModel: tradeModelVal,
          tradeStatus: tradeStatusVal,
          tradeChassis: getNullableText(formData, "trade_in_chassis"),
          tradeColor: getNullableText(formData, "trade_in_color"),
          tradeYear: parseNumber(getNullableText(formData, "trade_in_year")),
          tradeMileage: parseNumber(getNullableText(formData, "trade_in_mileage")),
          tradePrice: parseNumber(getNullableText(formData, "trade_in_price")),
          tradeSpecs: getNullableText(formData, "trade_in_specs"),
          tradeInspection: getNullableText(formData, "trade_in_inspection"),
          signedPhotoUrls,
        });
      } else if (signedPhotoUrls.length > 0) {
        const caption =
          `📸 <b>صور مرفقة من الموظف ${profile?.full_name ?? "موظف"}</b>\n` +
          `👤 ${fullName || "غير محدد"} | 📱 <code>${phone}</code>`;
        void pushTelegramPhotosToManagers({ branchId, caption, photoUrls: signedPhotoUrls });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر رفع أحد الملفات";
    redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(message)}`);
  }

  // ── رفع التسجيلات الصوتية من صفحة التفاصيل ──────────────────────────
  const voiceFilesProfile = formData.getAll("voice_general_notes")
    .concat(
      ...[...formData.keys()]
        .filter((k) => k.startsWith("voice_negotiation_"))
        .map((k) => formData.getAll(k)),
    )
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (voiceFilesProfile.length > 0) {
    try {
      await uploadCustomerAttachmentFiles({
        supabase,
        customerId,
        uploadedByUserId: profile?.id ?? null,
        files: voiceFilesProfile,
        category: "voice_note",
      });
    } catch {
      // لا نوقف الحفظ بسبب فشل رفع الصوت
    }
  }

  await insertCustomerLog({
    customerId,
    action: "customer_updated",
    details: note ? `تم التحديث من نافذة التفاصيل. ${note}` : "تم التحديث من نافذة التفاصيل.",
    nextFollowUpAt: isActive ? nextFollowUpAt : null,
  });
  await incrementCustomerInteractions(supabase, customerId);
  await completeCustomerPendingReminders(supabase, customerId);

  // ── إشعار احترافي شامل لتحديث ملف العميل ───────────────────────────────
  const profileActorName = profile?.full_name ?? "موظف";
  const profileCtx = await fetchCustomerContext(supabase, customerId);
  const { title: profileNotifTitle, message: profileNotifMessage } = buildStatusNotification({
    status,
    ctx: {
      fullName: profileCtx.fullName || fullName,
      nickname: profileCtx.nickname,
      phone: profileCtx.phone || phone,
      requestedCar: profileCtx.requestedCar || requestedCar,
      operationType: profileCtx.operationType,
      assignedUserName: profileCtx.assignedUserName,
      branchName: profileCtx.branchName,
    },
    actorName: profileActorName,
    note,
    nextFollowUpAt: isActive ? nextFollowUpAt : null,
    dealValue: dealValueToSave,
  });
  await sendManagementActivityNotification({
    supabase,
    actorProfile: profile,
    branchId,
    title: profileNotifTitle,
    notificationType: "customer_profile_update",
    message: profileNotifMessage,
    payload: { source: "customer_profile_update", customer_id: customerId, status },
  });

  await syncCustomerFollowupReminder({
    customerId,
    branchId,
    assignedUserId,
    nextFollowUpAt: isActive ? nextFollowUpAt : null,
    status,
    fullName: fullName || phone || "العميل",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/search");
  revalidatePath("/dashboard/management");
  revalidatePath(`/dashboard/customers/${customerId}`);

  if (returnTo) {
    redirect(appendNoticeParam(returnTo, "تم التعديل بنجاح"));
  }
}

// ─── تعديل البيانات الأساسية للعميل (الاسم، الكنية، الهاتف، المدينة) ─────────
export async function updateCustomerBasicInfoAction(formData: FormData) {
  if (!hasSupabaseEnv()) return { error: "الخادم غير متاح" };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "غير مصرح" };

  const customerId = getText(formData, "customer_id");
  const fullName = getText(formData, "full_name");
  const phone = normalizePhone(getText(formData, "phone"));
  const nickname = getNullableText(formData, "nickname");
  const address = getNullableText(formData, "address");
  const whatsappPrefix = getNullableText(formData, "whatsapp_prefix") ?? "+970";

  if (!customerId) return { error: "معرّف العميل مفقود" };
  if (!fullName) return { error: "الاسم مطلوب" };
  if (!phone || phone.length !== PHONE_LENGTH) return { error: PHONE_ERROR_MESSAGE };

  const admin = createAdminClient();

  // Check for phone duplicate (exclude current customer)
  const { data: dup } = await admin
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .eq("is_active", true)
    .neq("id", customerId)
    .maybeSingle();

  if (dup) return { error: "يوجد عميل آخر نشط بنفس رقم الهاتف" };

  const { error } = await admin
    .from("customers")
    .update({ full_name: fullName, phone, nickname, address, whatsapp_prefix: whatsappPrefix, updated_at: new Date().toISOString() })
    .eq("id", customerId);

  if (error) return { error: error.message };

  await admin.from("customer_logs").insert({
    customer_id: customerId,
    actor_user_id: profile.id,
    actor_name: profile.full_name,
    action: "customer_updated",
    details: `تم تعديل البيانات الأساسية للعميل (الاسم، الكنية، الهاتف، المدينة).`,
  });

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true };
}

// ─── حذف عميل — جميع الموظفين (ضمن فرعهم) ──────────────────────────────────
export async function deleteCustomerAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const capabilities = getRoleCapabilities(profile.role);

  const customerId = getText(formData, "customer_id");
  const returnTo = getNullableText(formData, "return_to") ?? "/dashboard/customers";
  if (!customerId) return;

  // ── فحص ملكية الفرع: الجميع يحذف فقط عملاء فرعه ──
  if (!capabilities.isGeneralManager) {
    const { data: target } = await supabase
      .from("customers")
      .select("branch_id")
      .eq("id", customerId)
      .maybeSingle();
    if (!target || target.branch_id !== profile.branch_id) {
      redirect(appendNoticeParam(returnTo, "لا تملك صلاحية حذف عميل من معرض آخر."));
    }
  }

  // سجّل الحذف قبل التنفيذ
  try {
    await supabase.from("customer_logs").insert({
      customer_id: customerId,
      action: "customer_deleted",
      details: `تم حذف العميل بواسطة ${profile.full_name} (${profile.role})`,
      actor_user_id: profile.id,
      actor_name: profile.full_name,
    });
  } catch {
    // تجاهل خطأ السجل — الحذف يكمل بغض النظر
  }

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("customers")
    .delete({ count: "exact" })
    .eq("id", customerId);

  if (error) {
    redirect(appendNoticeParam(returnTo, `تعذّر الحذف: ${error.message}`));
  }
  if (!count || count === 0) {
    redirect(appendNoticeParam(returnTo, "لم يُعثر على العميل أو لا تملك صلاحية الحذف."));
  }

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/management");
  revalidatePath("/dashboard");

  redirect(appendNoticeParam("/dashboard/customers", "تم حذف ملف العميل نهائياً"));
}

// ─── تحويل بيع بالوكالة → مشتري + استبدال ──────────────────────────────────
export async function convertToTradeInAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const customerId = getText(formData, "customer_id");
  if (!customerId) return;

  // جلب بيانات العميل الحالية
  const { data: customer, error: fetchError } = await supabase
    .from("customers")
    .select("id, full_name, operation_type, metadata, branch_id, assigned_user_id")
    .eq("id", customerId)
    .maybeSingle();

  if (fetchError || !customer) redirect("/dashboard/customers");

  // التحقق أن العميل فعلاً بيع بالوكالة
  const currentMeta = (customer.metadata ?? {}) as Record<string, unknown>;
  const currentCode = typeof currentMeta.operation_type_code === "string" ? currentMeta.operation_type_code : "";
  if (currentCode !== "sell_on_behalf") redirect(`/dashboard/customers?customer=${customerId}&mode=view`);

  // تحديث نوع العملية والـ metadata
  const updatedMeta = {
    ...currentMeta,
    operation_type_code: "buyer_tradein_pending",
    converted_from: "sell_on_behalf",
    converted_at: new Date().toISOString(),
    converted_by: profile.id,
  };

  const { error } = await supabase
    .from("customers")
    .update({
      operation_type: "مشتري + استبدال",
      status: "قيد المتابعة — بانتظار التقييم",
      metadata: updatedMeta,
    })
    .eq("id", customerId);

  if (error) redirect(appendNoticeParam(`/dashboard/customers?customer=${customerId}&mode=view`, `تعذّر التحويل: ${error.message}`));

  // سجّل الحدث في customer_logs
  try {
    await supabase.from("customer_logs").insert({
      customer_id: customerId,
      action: "operation_type_converted",
      details: `تم تحويل نوع العملية من "بيع بالوكالة" إلى "مشتري + استبدال" بواسطة ${profile.full_name}`,
      actor_user_id: profile.id,
      actor_name: profile.full_name,
    });
  } catch { /* تجاهل */ }

  revalidatePath(`/dashboard/customers`);
  revalidatePath(`/dashboard/management`);
  redirect(appendNoticeParam(`/dashboard/customers?customer=${customerId}&mode=view`, `تم تحويل ملف العميل إلى "مشتري + استبدال" بنجاح ✓`));
}

// ─── تحويل مشتري + استبدال → بيع بالوكالة ──────────────────────────────────
export async function convertToSellOnBehalfAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const customerId = getText(formData, "customer_id");
  if (!customerId) return;

  // جلب بيانات العميل الحالية بما فيها requested_car
  const { data: customer, error: fetchError } = await supabase
    .from("customers")
    .select("id, full_name, operation_type, metadata, requested_car")
    .eq("id", customerId)
    .maybeSingle();

  if (fetchError || !customer) redirect("/dashboard/customers");

  // التحقق أن العميل فعلاً مشتري + استبدال
  const currentMeta = (customer.metadata ?? {}) as Record<string, unknown>;
  const currentCode = typeof currentMeta.operation_type_code === "string" ? currentMeta.operation_type_code : "";
  if (currentCode !== "buyer_tradein_pending") redirect(`/dashboard/customers?customer=${customerId}&mode=view`);

  // حفظ السيارات المطلوبة في metadata للتاريخ قبل إفراغها
  const updatedMeta = {
    ...currentMeta,
    operation_type_code: "sell_on_behalf",
    converted_from: "buyer_tradein_pending",
    converted_at: new Date().toISOString(),
    converted_by: profile.id,
    // حفظ السيارات المطلوبة للتاريخ
    archived_requested_car: customer.requested_car ?? null,
  };

  const { error } = await supabase
    .from("customers")
    .update({
      operation_type: "بيع بالوكالة",
      status: "عرض سيارة للبيع",
      requested_car: null,   // إفراغ السيارات المطلوبة
      metadata: updatedMeta,
    })
    .eq("id", customerId);

  if (error) redirect(appendNoticeParam(`/dashboard/customers?customer=${customerId}&mode=view`, `تعذّر التحويل: ${error.message}`));

  // سجّل الحدث في customer_logs مع حفظ السيارات المطلوبة
  try {
    const archivedCars = customer.requested_car ? ` (السيارات المطلوبة المؤرشفة: ${customer.requested_car})` : "";
    await supabase.from("customer_logs").insert({
      customer_id: customerId,
      action: "operation_type_converted",
      details: `تم تحويل نوع العملية من "مشتري + استبدال" إلى "بيع بالوكالة" بواسطة ${profile.full_name}${archivedCars}`,
      actor_user_id: profile.id,
      actor_name: profile.full_name,
    });
  } catch { /* تجاهل */ }

  revalidatePath(`/dashboard/customers`);
  revalidatePath(`/dashboard/management`);
  redirect(appendNoticeParam(`/dashboard/customers?customer=${customerId}&mode=view`, `تم تحويل ملف العميل إلى "بيع بالوكالة" بنجاح ✓`));
}

// ─── Branch Management Actions (GM only) ─────────────────────────────────────

function revalidateBranchPaths() {
  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/management");
  revalidatePath("/dashboard");
}

/** إنشاء معرض جديد — المدير العام فقط */
export async function createBranchAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const profile = await getCurrentProfile();
  if (!getRoleCapabilities(profile?.role).isGeneralManager) {
    redirect("/dashboard/unauthorized");
  }

  const name = getText(formData, "branch_name").trim();
  const city = getNullableText(formData, "branch_city");
  const address = getNullableText(formData, "branch_address");
  const whatsappRaw = getText(formData, "branch_whatsapp").replace(/[\s\-\(\)]/g, "");
  const whatsappPrefix = getNullableText(formData, "branch_whatsapp_prefix") ?? "+966";
  const whatsappNumber = whatsappRaw || null;

  if (!name) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent("اسم المعرض مطلوب."));
  }

  if (!hasSupabaseServiceRoleEnv()) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY غير مضبوط."));
  }

  const admin = createAdminClient();

  // فحص التكرار
  const { data: existing } = await admin
    .from("branches")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existing?.id) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent(`معرض باسم "${name}" موجود مسبقاً.`));
  }

  const { error } = await admin.from("branches").insert({
    name,
    city,
    address,
    whatsapp_number: whatsappNumber,
    whatsapp_prefix: whatsappPrefix,
    is_active: true,
  });

  if (error) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent(`تعذر إنشاء المعرض: ${error.message}`));
  }

  revalidateBranchPaths();
  redirect("/dashboard/branches?branch_notice=" + encodeURIComponent(`تم إنشاء معرض "${name}" بنجاح. ✅`));
}

/** تعديل بيانات معرض (اسم، واتساب، مدينة) — المدير العام فقط */
export async function updateBranchAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const profile = await getCurrentProfile();
  if (!getRoleCapabilities(profile?.role).isGeneralManager) {
    redirect("/dashboard/unauthorized");
  }

  const branchId = getText(formData, "branch_id");
  if (!branchId) return;

  const name = getText(formData, "branch_name").trim();
  const city = getNullableText(formData, "branch_city");
  const address = getNullableText(formData, "branch_address");
  const whatsappRaw = getText(formData, "branch_whatsapp").replace(/[\s\-\(\)]/g, "");
  const whatsappPrefix = getNullableText(formData, "branch_whatsapp_prefix") ?? "+966";
  const whatsappNumber = whatsappRaw || null;

  if (!name) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent("اسم المعرض لا يمكن أن يكون فارغاً."));
  }

  if (!hasSupabaseServiceRoleEnv()) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY غير مضبوط."));
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("branches")
    .update({ name, city, address, whatsapp_number: whatsappNumber, whatsapp_prefix: whatsappPrefix })
    .eq("id", branchId);

  if (error) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent(`تعذر التحديث: ${error.message}`));
  }

  revalidateBranchPaths();
  redirect("/dashboard/branches?branch_notice=" + encodeURIComponent("تم تحديث بيانات المعرض بنجاح. ✅"));
}

/** فتح أو إغلاق معرض — المدير العام فقط */
export async function toggleBranchStatusAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const profile = await getCurrentProfile();
  if (!getRoleCapabilities(profile?.role).isGeneralManager) {
    redirect("/dashboard/unauthorized");
  }

  const branchId = getText(formData, "branch_id");
  const newStatus = getText(formData, "new_status") === "true";

  if (!branchId) return;

  if (!hasSupabaseServiceRoleEnv()) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY غير مضبوط."));
  }

  const admin = createAdminClient();

  // حماية: لا تُغلق معرضاً فيه موظفون نشطون
  if (!newStatus) {
    const { data: activeStaff } = await admin
      .from("app_users")
      .select("id")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .limit(1);

    if ((activeStaff ?? []).length > 0) {
      redirect("/dashboard/branches?branch_error=" + encodeURIComponent(
        "لا يمكن إغلاق المعرض وفيه موظفون نشطون. انقل الموظفين أو عطّل حساباتهم أولاً."
      ));
    }
  }

  const { error } = await admin
    .from("branches")
    .update({ is_active: newStatus })
    .eq("id", branchId);

  if (error) {
    redirect("/dashboard/branches?branch_error=" + encodeURIComponent(`تعذر تغيير حالة المعرض: ${error.message}`));
  }

  revalidateBranchPaths();
  const msg = newStatus ? "تم فتح المعرض وتفعيله. ✅" : "تم إغلاق المعرض. المعرض لم يُحذف ويمكن فتحه مجدداً.";
  redirect("/dashboard/branches?branch_notice=" + encodeURIComponent(msg));
}
