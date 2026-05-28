"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasSupabaseEnv } from "@/lib/env";
import { getRoleCapabilities } from "@/lib/roles";
import { createAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pushTelegramToManagers } from "@/lib/telegram/push";

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

function isClosedStatus(status: string) {
  return (
    status.includes("العميل غير فعال") ||
    status.includes("تم البيع") ||
    status.includes("تمت صفقة استبدال") ||
    status.includes("شراء من قبل المعرض") ||
    status.includes("رفض من قبل المعرض") ||
    status.includes("رفض من قبل العميل") ||
    status.includes("رفض")
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

function isGeneralManagerRole(role: string | null | undefined) {
  const value = normalizeRole(role);
  return value.includes("المدير العام") || (value.includes("مدير") && value.includes("عام")) || value.includes("admin") || value.includes("owner");
}

function isBranchManagerRole(role: string | null | undefined) {
  const value = normalizeRole(role);
  return value.includes("مدير معرض") || (value.includes("manager") && value.includes("branch"));
}

async function sendManagementActivityNotification({
  supabase,
  actorProfile,
  branchId,
  title,
  message,
  payload,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actorProfile: Awaited<ReturnType<typeof getCurrentProfile>>;
  branchId: string | null;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
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
    notification_type: "customer_activity",
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

  // Fire-and-forget Telegram push to managers with linked accounts
  void pushTelegramToManagers({ branchId, title, message });
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

  const { data: directInterestedCustomers } = await reader
    .from("customers")
    .select("id, full_name, phone, requested_car, is_active")
    .eq("is_active", true)
    .ilike("requested_car", `%${cleanModel}%`)
    .limit(80);

  let interestedCustomers = directInterestedCustomers ?? [];
  if (interestedCustomers.length === 0) {
    const modelTokens = cleanModel
      .toLowerCase()
      .split(/[\s\-_/|]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);
    const { data: fallbackCandidates } = await reader
      .from("customers")
      .select("id, full_name, phone, requested_car, is_active")
      .eq("is_active", true)
      .not("requested_car", "is", null)
      .limit(400);
    interestedCustomers = (fallbackCandidates ?? []).filter((row) => {
      const requested = String(row.requested_car ?? "").toLowerCase();
      if (!requested) return false;
      return modelTokens.some((token) => requested.includes(token));
    });
  }

  if (!interestedCustomers || interestedCustomers.length === 0) return;

  const leadsText = interestedCustomers
    .map((c, idx) => `${idx + 1}) ${c.full_name} - ${c.phone}`)
    .join(" | ");

  const carText = `${cleanModel}${chassisNo ? ` - شاصي:${chassisNo}` : ""}`;
  const message = `فرصة بيع سيارة متاحة الآن: ${carText}. الجهة العارضة: ${ownerName ?? "غير محدد"}. العملاء المهتمون: ${leadsText}`;

  await sendManagementActivityNotification({
    supabase,
    actorProfile,
    branchId,
    title: "فرصة بيع سيارة متاحة",
    message,
    payload: {
      source: "inventory_opportunity",
      model: cleanModel,
      chassis_no: chassisNo,
      owner_name: ownerName,
      interested_customers_count: interestedCustomers.length,
      interested_customers: interestedCustomers.map((c) => ({ id: c.id, name: c.full_name, phone: c.phone })),
    },
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
  } else if (capabilities.isManager && branchId) {
    await writer.from("notifications").delete().eq("recipient_branch_id", branchId);
  } else if (userId) {
    await writer.from("notifications").delete().eq("recipient_user_id", userId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/notifications");

  redirect(appendNoticeParam("/dashboard/notifications", "تم حذف التنبيهات بنجاح"));
}

function toSafeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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
}) {
  for (const file of files) {
    if (!file || file.size <= 0) continue;

    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const baseName = toSafeFileName(file.name.replace(/\.[^.]+$/, ""));
    const path = `${customerId}/${Date.now()}-${baseName}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await supabase.storage.from("customer-attachments").upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const insertAttachment = await supabase.from("customer_attachments").insert({
      customer_id: customerId,
      file_name: file.name,
      file_category: category,
      storage_path: path,
      public_url: null,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      uploaded_by_user_id: uploadedByUserId,
      metadata: {
        source: "profile_modal",
      },
    });

    if (insertAttachment.error) {
      throw new Error(insertAttachment.error.message);
    }
  }
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
  const isCompletedSwap = statusLabel.includes("تم الاتفاق والاستبدال");
  const isShowroomPurchase = statusLabel.includes("شراء السيارة للمعرض");
  const isExternalSold = statusLabel.includes("تم بيع السيارة لعميل خارجي");
  const isWithdrawn = statusLabel.includes("تراجع العميل عن البيع") || statusLabel.includes("رفض من قبل المعرض");
  const shouldBeSaleOnBehalf =
    statusLabel.includes("عرض سيارة") ||
    statusLabel.includes("برسم البيع") ||
    statusLabel.includes("دراسة") ||
    statusLabel.includes("تقييم") ||
    statusLabel.includes("تم التقييم");

  let ownerName = customerName;
  let dealType = shouldBeSaleOnBehalf ? "برسم البيع" : "استبدال";
  let availabilityStatus = "متوفرة";

  if (isCompletedSwap || isShowroomPurchase) {
    dealType = isShowroomPurchase ? "حيازة" : "استبدال";
    if (branchId) {
      const { data: branch } = await supabase.from("branches").select("name").eq("id", branchId).maybeSingle();
      ownerName = branch?.name ?? customerName;
    }
  }

  if (isExternalSold) {
    availabilityStatus = "مباعة";
  } else if (isWithdrawn) {
    availabilityStatus = "مسحوبة من المعرض";
  }

  const existingQuery = supabase
    .from("inventory")
    .select("id")
    .eq("source_customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const { data: existing } = tradeChassis
    ? await existingQuery.eq("chassis_no", tradeChassis).maybeSingle()
    : await existingQuery.maybeSingle();

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

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", notificationId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

export async function completeReminderAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const reminderId = getText(formData, "reminder_id");
  if (!reminderId) return;

  const supabase = await createClient();
  await supabase
    .from("reminders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", reminderId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

export async function sendQuickReminderAction(formData: FormData) {
  if (!hasSupabaseEnv()) return;

  const recipientUserId = getNullableText(formData, "recipient_user_id");
  const recipientBranchId = getNullableText(formData, "recipient_branch_id");
  const recipientLabel = getNullableText(formData, "recipient_label");
  const title = getNullableText(formData, "title") ?? "تذكير";
  const message = getText(formData, "message");

  if (!message) return;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/staff");
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
    recipients = recipients.filter((item) => item.branch_id === currentBranchId && !isGeneralManagerRole(item.role));
  }

  if (recipients.length === 0) return;
  const recipientIds = recipients.filter((item) => !isGeneralManagerRole(item.role)).map((item) => item.id);
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
    const { error } = await supabase.from("app_users").insert({
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
  const phone = getText(formData, "phone");

  if (!fullName || !phone) {
    redirect(
      customerId
        ? `/dashboard/customers/${customerId}/edit`
        : `/dashboard/customers/new?error=${encodeRedirectError("أدخل الاسم ورقم الهاتف قبل الحفظ.")}`,
    );
  }

  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);
  const requestedAssignedUserId = getNullableText(formData, "assigned_user_id");

  const branchId = capabilities.isGeneralManager ? getNullableText(formData, "branch_id") : profile?.branch_id ?? null;
  const assignedUserId = !capabilities.isManager
    ? profile?.id ?? null
    : requestedAssignedUserId ?? profile?.id ?? null;
  const requestedCarInput = getNullableText(formData, "requested_car");
  const paymentPlan = getNullableText(formData, "payment_plan");
  const status = getText(formData, "status") || "قيد المتابعة";
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

  const inventoryIdForStatus = getNullableText(formData, "inventory_id_for_status");
  const isActive = isClosedStatus(status) ? false : requestedActive;
  const resolvedNextFollowup = isActive ? nextFollowUpAt : null;

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
            ? "عرض سيارة للبيع"
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

  const payload = {
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
      redirect(`/dashboard/customers/new?error=${encodeRedirectError(`تعذر تحديث الملف: ${error.message}`)}`);
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
      title: "تعديل بيانات عميل",
      message: `تم تعديل بيانات العميل: ${fullName}. الحالة الحالية: ${status}.`,
      payload: { source: "customer_update", customer_id: customerId },
    });
  } else {
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

      redirect(
        `/dashboard/management?customer=${existingCustomerBeforeInsert.id}&mode=view&notice=${encodeURIComponent("هذا العميل موجود مسبقًا. يمكنك تفعيل دورة جديدة من ملفه بعد الإغلاق.")}`,
      );
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
        redirect(`/dashboard/management?customer=${existingCustomer.id}&mode=view`);
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
      await sendManagementActivityNotification({
        supabase,
        actorProfile: profile,
        branchId,
        title: "إضافة عميل جديد",
        message: `تم إدخال عميل جديد: ${fullName} (${phone}).`,
        payload: { source: "customer_create", customer_id: savedId },
      });
    }
  }

  if (savedId && inventoryIdForStatus && (status.includes("تم البيع") || status.includes("حجز"))) {
    const inventoryStatus = status.includes("تم البيع") ? "مباعة" : "محجوزة";
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
        details: `تم إنشاء سيارة للمخزون من مسار عرض سيارة للبيع: ${inventoryModel}.`,
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
      tradeStatus: getNullableText(formData, "trade_in_status"),
      tradeChassis: getNullableText(formData, "trade_in_chassis"),
      tradePrice: parseNumber(getNullableText(formData, "trade_in_price")),
      tradeColor: getNullableText(formData, "trade_in_color"),
      tradeYear: tradeYearInput,
      tradeMileage: parseNumber(getNullableText(formData, "trade_in_mileage")),
      tradeSpecs: getNullableText(formData, "trade_in_specs"),
      tradeInspection: getNullableText(formData, "trade_in_inspection"),
    });
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
      await uploadCustomerAttachmentFiles({
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر رفع أحد الملفات";
      redirect(`/dashboard/customers/new?error=${encodeRedirectError(message)}`);
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
    const success = encodeURIComponent("تم حفظ الملف بنجاح.");
    redirect(`/dashboard/customers/new?success=${success}&saved_id=${savedId}`);
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
  await sendManagementActivityNotification({
    supabase,
    actorProfile: profile,
    branchId,
    title: "تذكير جديد",
    message: `تم إنشاء تذكير جديد للعميل (ID: ${customerId}).`,
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
  await sendManagementActivityNotification({
    supabase,
    actorProfile: profile,
    branchId,
    title: "تحديث ملف عميل",
    message: `تم تحديث ملف العميل: ${fullName || "غير محدد"} (الحالة: ${status}).`,
    payload: { source: "customer_profile_update", customer_id: customerId },
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
  await sendManagementActivityNotification({
    supabase,
    actorProfile: profile,
    branchId,
    title: "إعادة تفعيل عميل",
    message: `تمت إعادة تفعيل ملف العميل: ${fullName || customerId}.`,
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
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("notes, requested_car, metadata, last_contact_at")
    .eq("id", customerId)
    .maybeSingle();

  const requiresInventory = status.includes("تم البيع") || status.includes("حجز");
  if (requiresInventory && !inventoryIdForStatus) {
    redirect(
      `/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError("يرجى اختيار الشاصي عند حالة تم البيع أو الحجز.")}`,
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
    ? `${existingNotes ? `${existingNotes}\n\n` : ""}[تحديث ${new Date().toLocaleString("ar-EG")}]\n${note}${closureAutoNote ? `\n${closureAutoNote}` : ""}`
    : closureAutoNote
      ? `${existingNotes ? `${existingNotes}\n\n` : ""}[تحديث ${new Date().toLocaleString("ar-EG")}]\n${closureAutoNote}`
      : existingNotes;

  const customerPayload: Record<string, unknown> = {
    requested_car: requestedCar,
    status,
    notes: mergedNotes,
    next_follow_up_at: isActive ? nextFollowUpAt : null,
    is_active: isActive,
    metadata: {
      ...currentMetadata,
      selected_inventory_id: selectedInventoryMeta.id,
      selected_inventory_chassis: selectedInventoryMeta.chassis,
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

  const newInventoryStatus = status.includes("تم البيع") ? "مباعة" : status.includes("حجز") ? "محجوزة" : null;
  const selectedInventoryId = selectedInventoryMeta.id;
  if (newInventoryStatus && selectedInventoryId) {
    const markSelectedInventory = await supabase
      .from("inventory")
      .update({ availability_status: newInventoryStatus })
      .eq("id", selectedInventoryId);
    if (markSelectedInventory.error) {
      redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(markSelectedInventory.error.message)}`);
    }
  }

  if (previousSelectedInventoryId && previousSelectedInventoryId !== selectedInventoryId) {
    const releasePreviousInventory = await supabase
      .from("inventory")
      .update({ availability_status: "متوفرة" })
      .eq("id", previousSelectedInventoryId);
    if (releasePreviousInventory.error) {
      redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(releasePreviousInventory.error.message)}`);
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

  if (hasTradeIn) {
    await syncTradeInventoryFromCustomer({
      supabase,
      customerId,
      branchId,
      customerName: fullName || phone || "مالك",
      tradeModel: tradeModelInput,
      tradeStatus: getNullableText(formData, "trade_in_status"),
      tradeChassis: getNullableText(formData, "trade_in_chassis"),
      tradePrice: parseNumber(getNullableText(formData, "trade_in_price")),
      tradeColor: getNullableText(formData, "trade_in_color"),
      tradeYear: tradeYearInput,
      tradeMileage: parseNumber(getNullableText(formData, "trade_in_mileage")),
      tradeSpecs: getNullableText(formData, "trade_in_specs"),
      tradeInspection: getNullableText(formData, "trade_in_inspection"),
    });
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
    await uploadCustomerAttachmentFiles({
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر رفع أحد الملفات";
    redirect(`/dashboard/customers?customer=${customerId}&mode=view&error=${encodeRedirectError(message)}`);
  }

  await insertCustomerLog({
    customerId,
    action: "customer_updated",
    details: note ? `تم التحديث من نافذة التفاصيل. ${note}` : "تم التحديث من نافذة التفاصيل.",
    nextFollowUpAt: isActive ? nextFollowUpAt : null,
  });
  await incrementCustomerInteractions(supabase, customerId);
  await completeCustomerPendingReminders(supabase, customerId);

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
