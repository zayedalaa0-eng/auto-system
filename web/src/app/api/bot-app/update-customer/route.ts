import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { isClosedStatus } from "@/lib/statuses";
import { isValidPhone, normalizePhone, PHONE_ERROR_MESSAGE } from "@/lib/phone";
import { pushCustomerUpdateToManagers, pushEvaluationRequestToMaalamManager } from "@/lib/telegram/push";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      chat_id,
      customer_id,
      // الحقول الأساسية
      status,
      note,
      next_follow_up_at,
      requested_car,
      // المعلومات الشخصية
      full_name,
      phone,
      nickname,
      address,
      whatsapp_prefix,
      // سيارة الاستبدال / بيع بالوكالة
      trade_in,
      // ربط المخزون (للمشتري عند الحجز/البيع)
      inventory_id,
      // طريقة الدفع
      payment_method,
      // قيمة الصفقة
      deal_value,
      // نوع العملية
      operation_type: new_operation_type,
      // تحويل خاص
      convert_action,
      // عداد التفاعل
      count_as_interaction,
      // استثنائي
      allow_exceptional_edit,
    } = body;

    if (!chat_id || !customer_id) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const admin = createAdminClient();

    // ── التحقق من المستخدم ──────────────────────────────────────────────────
    const { data: user } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("telegram_chat_id", String(chat_id))
      .eq("is_active", true)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const caps = getRoleCapabilities(user.role, user.full_name);

    // ── جلب بيانات العميل الحالية ───────────────────────────────────────────
    const { data: customer } = await admin
      .from("customers")
      .select("id, full_name, phone, status, operation_type, metadata, notes, is_active, branch_id, assigned_user_id, next_follow_up_at, visit_count")
      .eq("id", customer_id)
      .maybeSingle();

    if (!customer) return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });

    // ── #20: حماية الملفات المغلقة ──────────────────────────────────────────
    if (customer.is_active === false) {
      const isSoldComplete = !customer.is_active && (customer.status ?? "").includes("تمت عملية البيع");
      // تعديل استثنائي: مسموح فقط للمدير أو عند تمرير allow_exceptional_edit
      if (isSoldComplete && !caps.isManager && !allow_exceptional_edit) {
        return NextResponse.json(
          { error: "الملف مغلق نهائياً (تمت عملية البيع) — يتطلب تعديلاً استثنائياً" },
          { status: 403 }
        );
      }
      if (!isSoldComplete && !caps.isManager) {
        return NextResponse.json(
          { error: "لا يمكن تعديل ملف مغلق — تواصل مع المدير لإعادة فتحه" },
          { status: 403 }
        );
      }
    }

    // ── فحص صلاحية التعديل ──────────────────────────────────────────────────
    // • المدير العام   : يعدّل كل العملاء في جميع المعارض
    // • مدير + موظف   : يعدّلون أي عميل في نفس المعرض
    // • موظف معيَّن    : يعدّل عملاءه حتى لو من معرض آخر (حالة استثنائية)
    const isGeneralManager = caps.isGeneralManager;
    const canEditCustomer =
      isGeneralManager ||
      customer.branch_id === user.branch_id ||
      customer.assigned_user_id === user.id;

    if (!canEditCustomer) {
      return NextResponse.json(
        { error: "غير مصرح — لا تملك صلاحية تعديل هذا العميل" },
        { status: 403 }
      );
    }

    // ── استخراج كود نوع العملية ─────────────────────────────────────────────
    const opCode = (() => {
      const meta = (customer.metadata as Record<string, unknown> | null) ?? {};
      const code = meta.operation_type_code;
      if (code === "sell_on_behalf" || code === "buyer_tradein_pending") return String(code);
      const col = String(customer.operation_type ?? "");
      if (col === "sell_on_behalf" || col === "بيع بالوكالة") return "sell_on_behalf";
      if (col === "buyer_tradein_pending" || col.includes("استبدال")) return "buyer_tradein_pending";
      return "buyer";
    })();

    // ── الحقول المحدَّثة ────────────────────────────────────────────────────
    const updates: Record<string, unknown> = {
      last_contact_at: new Date().toISOString(),
    };

    // الحالة
    const newStatus = (status ?? "").trim();
    if (newStatus) {
      updates.status = newStatus;
      const closed = isClosedStatus(newStatus);
      updates.is_active = !closed;
      if (closed) updates.next_follow_up_at = null;
    }

    // موعد المتابعة (يُعيَّن فقط إذا الملف نشط)
    const isClosed = isClosedStatus(newStatus || String(customer.status ?? ""));
    if (!isClosed && next_follow_up_at !== undefined) {
      if (next_follow_up_at) {
        const followUpDate = new Date(next_follow_up_at);
        const nowPlus3 = new Date(Date.now() + 3 * 60 * 60 * 1000);
        const todayEnd = new Date(nowPlus3.toISOString().slice(0, 10) + "T23:59:59+03:00");
        // إذا كان الموعد اليوم أو قبله → صفّر (تم التعامل مع العميل)
        updates.next_follow_up_at = followUpDate <= todayEnd ? null : followUpDate.toISOString();
      } else {
        updates.next_follow_up_at = null;
      }
    }

    // السيارة المطلوبة
    if (requested_car !== undefined) {
      updates.requested_car = (requested_car ?? "").trim() || null;
    }

    // تحديث المعلومات الشخصية
    if (full_name !== undefined) {
      const trimmed = (full_name ?? "").trim();
      if (!trimmed) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
      updates.full_name = trimmed;
    }

    if (phone !== undefined) {
      if (!isValidPhone(phone)) return NextResponse.json({ error: PHONE_ERROR_MESSAGE }, { status: 400 });
      const normalized = normalizePhone(phone);
      const { data: dup } = await admin
        .from("customers")
        .select("id")
        .eq("phone", normalized)
        .eq("is_active", true)
        .neq("id", customer_id)
        .maybeSingle();
      if (dup) return NextResponse.json({ error: "رقم الهاتف مستخدم لعميل آخر" }, { status: 409 });
      updates.phone = normalized;
    }

    if (nickname !== undefined) updates.nickname = (nickname ?? "").trim() || null;
    if (address !== undefined) updates.address = (address ?? "").trim() || null;
    if (whatsapp_prefix !== undefined) updates.whatsapp_prefix = (whatsapp_prefix ?? "+970").trim() || "+970";

    // نوع العملية — مشتري ↔ مشتري+استبدال فقط (بيع بالوكالة مقفل)
    const currentOpCode = (() => {
      const meta = (customer.metadata as Record<string, unknown> | null) ?? {};
      const code = meta.operation_type_code;
      if (code === "sell_on_behalf" || code === "buyer_tradein_pending" || code === "buyer") return String(code);
      return "buyer";
    })();
    if (new_operation_type && currentOpCode !== "sell_on_behalf") {
      const ALLOWED_OP_CODES = ["buyer", "buyer_tradein_pending"];
      if (ALLOWED_OP_CODES.includes(new_operation_type)) {
        const opLabelMap: Record<string, string> = {
          buyer: "مشتري",
          buyer_tradein_pending: "مشتري + استبدال",
        };
        updates.operation_type = opLabelMap[new_operation_type];
        const currentMeta0 = (customer.metadata as Record<string, unknown> | null) ?? {};
        updates.metadata = { ...currentMeta0, operation_type_code: new_operation_type, operation_type: opLabelMap[new_operation_type] };
      }
    }

    // طريقة الدفع + قيمة الصفقة — تُحفظ في metadata
    if (payment_method !== undefined || deal_value !== undefined) {
      const currentMeta2 = (customer.metadata as Record<string, unknown> | null) ?? {};
      updates.metadata = {
        ...currentMeta2,
        ...(payment_method !== undefined ? { payment_method: payment_method || null } : {}),
        ...(deal_value !== undefined ? { deal_value: deal_value ? Number(deal_value) : null } : {}),
      };
    }

    // تحويل نوع العملية الخاص (استبدال ↔ بيع بالوكالة)
    if (convert_action === "to_tradein" || convert_action === "to_sell_on_behalf") {
      const newCode = convert_action === "to_tradein" ? "buyer_tradein_pending" : "sell_on_behalf";
      const newLabel = convert_action === "to_tradein" ? "مشتري + استبدال" : "بيع بالوكالة";
      const newDefaultStatus = convert_action === "to_tradein" ? "استبدال — تحت التقييم" : "عرض سيارة للبيع";
      const currentMeta3 = (customer.metadata as Record<string, unknown> | null) ?? {};
      updates.operation_type = newLabel;
      updates.metadata = { ...(updates.metadata as Record<string,unknown> ?? currentMeta3), operation_type_code: newCode, operation_type: newLabel };
      if (newStatus === "") updates.status = newDefaultStatus;
    }

    // ── الملاحظة: إلحاق للملاحظات الموجودة ──────────────────────────────────
    const noteText = (note ?? "").trim();
    if (noteText) {
      const existing = (customer.notes ?? "").trim();
      const _now = new Date(Date.now() + 3*60*60*1000);
      const timestamp = `${String(_now.getUTCDate()).padStart(2,"0")}/${String(_now.getUTCMonth()+1).padStart(2,"0")}/${_now.getUTCFullYear()} ${String(_now.getUTCHours()).padStart(2,"0")}:${String(_now.getUTCMinutes()).padStart(2,"0")}`;
      const prefix = `[${timestamp} - ${user.full_name}]: `;
      updates.notes = existing ? `${existing}\n${prefix}${noteText}` : `${prefix}${noteText}`;
    }

    // ── #14: زيادة عدد التفاعلات (فقط إذا count_as_interaction !== false) ────
    if (count_as_interaction !== false) {
      updates.visit_count = ((customer.visit_count as number | null) ?? 0) + 1;
    }

    // ── تحديث العميل ────────────────────────────────────────────────────────
    const { error: updateErr } = await admin
      .from("customers")
      .update(updates)
      .eq("id", customer_id);

    if (updateErr) {
      console.error("[update-customer] update failed:", updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // ── سيارة الاستبدال / بيع بالوكالة ──────────────────────────────────────
    let tradeInSaved = false;
    if (trade_in && (opCode === "buyer_tradein_pending" || opCode === "sell_on_behalf")) {
      const ti = trade_in as {
        model?: string | null;
        chassis_no?: string | null;
        price?: number | null;
        color?: string | null;
        production_year?: number | null;
        mileage?: number | null;
        license_expiry?: string | null;
        specs?: string | null;
        inspection?: string | null;
        gear?: string | null;
        fuel?: string | null;
        notes?: string | null;
        id?: string | null;
      };

      const tradePayload = {
        customer_id,
        branch_id: customer.branch_id,
        owner_name: String(updates.full_name ?? customer.full_name),
        model: ti.model?.trim() ?? "",
        price: ti.price ?? null,
        chassis_no: ti.chassis_no?.trim() ?? null,
        color: ti.color?.trim() ?? null,
        production_year: ti.production_year ?? null,
        mileage: ti.mileage ?? null,
        license_expiry: ti.license_expiry ?? null,
        specs: ti.specs?.trim() ?? null,
        inspection: ti.inspection?.trim() ?? null,
        // #6: الحالة الصحيحة لكل نوع
        status: opCode === "sell_on_behalf" ? "برسم البيع" : "استبدال (بانتظار التقييم)",
        condition_label: "مستعملة",
        deal_type: opCode === "sell_on_behalf" ? "بيع بالوكالة" : "استبدال",
        is_active: true,
        notes: ti.notes?.trim() ?? null,
        metadata: { gear: ti.gear ?? null, fuel: ti.fuel ?? null, source: "telegram_miniapp" },
      };

      // #7: البحث عن سجل موجود بـ id أو بـ customer_id قبل الإدراج
      let existingTradeInId = ti.id ?? null;
      if (!existingTradeInId) {
        const { data: existingTi } = await admin
          .from("trade_ins")
          .select("id")
          .eq("customer_id", customer_id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        existingTradeInId = existingTi?.id ?? null;
      }

      let newTradeInId: string | null = null;
      if (existingTradeInId) {
        await admin.from("trade_ins").update(tradePayload).eq("id", existingTradeInId);
      } else {
        const { data: newTiRow } = await admin.from("trade_ins").insert(tradePayload).select("id").maybeSingle();
        newTradeInId = newTiRow?.id ?? null;
      }
      tradeInSaved = true;

      // ── مزامنة المخزون لبيع بالوكالة ─────────────────────────────────────
      if (opCode === "sell_on_behalf" && ti.model?.trim()) {
        // #8: البحث بالشاصي أولاً، ثم بـ source_customer_id
        let existingInvId: string | null = null;
        if (ti.chassis_no?.trim()) {
          const { data: invByChassis } = await admin
            .from("inventory")
            .select("id")
            .eq("chassis_no", ti.chassis_no.trim())
            .maybeSingle();
          existingInvId = invByChassis?.id ?? null;
        }
        if (!existingInvId) {
          const { data: invByCustomer } = await admin
            .from("inventory")
            .select("id")
            .eq("source_customer_id", customer_id)
            .maybeSingle();
          existingInvId = invByCustomer?.id ?? null;
        }

        const invStatus = newStatus.includes("تمت عملية البيع") ? "مباعة"
          : newStatus.includes("حجز")                            ? "محجوزة"
          : newStatus.includes("سحب") || newStatus.includes("رفض") ? "مسحوبة من المعرض"
          : "متوفرة";

        const invPayload = {
          branch_id: customer.branch_id,
          source_customer_id: customer_id,
          model: ti.model.trim(),
          owner_name: String(updates.full_name ?? customer.full_name),
          deal_type: "برسم البيع",
          chassis_no: ti.chassis_no?.trim() ?? null,
          condition_label: "مستعملة",
          availability_status: invStatus,
          price: ti.price ?? null,
          color: ti.color?.trim() ?? null,
          production_year: ti.production_year ?? null,
          mileage: ti.mileage ?? null,
          specs: ti.specs?.trim() ?? null,
          inspection: ti.inspection?.trim() ?? null,
          is_active: true,
          metadata: { gear: ti.gear ?? null, fuel: ti.fuel ?? null, source: "telegram_miniapp" },
        };

        if (existingInvId) {
          await admin.from("inventory").update(invPayload).eq("id", existingInvId);
        } else {
          await admin.from("inventory").insert(invPayload);
        }
      }

      // ── إرسال طلب التقييم لمدير معرض المعلم (استبدال جديد فقط) ─────────────
      if (opCode === "buyer_tradein_pending" && ti.model?.trim() && !existingTradeInId) {
        let branchNameStr: string | null = null;
        if (customer.branch_id) {
          const { data: branchRow } = await admin.from("branches").select("name").eq("id", customer.branch_id).maybeSingle();
          branchNameStr = branchRow?.name ?? null;
        }
        void pushEvaluationRequestToMaalamManager({
          tradeInId: newTradeInId ?? customer_id,
          customerId: customer_id,
          customerName: String(updates.full_name ?? customer.full_name),
          customerPhone: customer.phone ?? null,
          submitterUserId: user.id,
          submitterName: user.full_name,
          submitterChatId: String(chat_id),
          branchName: branchNameStr,
          car: {
            model: ti.model.trim(),
            color: ti.color?.trim() ?? null,
            production_year: ti.production_year ?? null,
            mileage: ti.mileage ?? null,
            chassis_no: ti.chassis_no?.trim() ?? null,
            inspection: ti.inspection?.trim() ?? null,
            specs: ti.specs?.trim() ?? null,
          },
        });
      }

      // ── #9: مزامنة المخزون لمشتري استبدال (تحديث حالة سيارة الاستبدال) ────
      if (opCode === "buyer_tradein_pending" && newStatus) {
        const { data: existingTiInv } = await admin
          .from("inventory")
          .select("id")
          .eq("source_customer_id", customer_id)
          .maybeSingle();

        if (existingTiInv?.id) {
          const tiInvStatus = newStatus.includes("تمت عملية البيع") ? "مباعة"
            : newStatus.includes("حجز")                              ? "محجوزة"
            : newStatus.includes("سحب") || newStatus.includes("رفض")  ? "مسحوبة من المعرض"
            : null;
          if (tiInvStatus) {
            await admin.from("inventory")
              .update({ availability_status: tiInvStatus })
              .eq("id", existingTiInv.id);
          }
        }
      }
    }

    // ── ربط سيارة مخزون للمشتري عند الحجز/البيع ─────────────────────────────
    if (inventory_id && opCode === "buyer" && newStatus &&
        (newStatus.includes("تمت عملية البيع") || newStatus.includes("حجز"))) {
      const invStatus = newStatus.includes("تمت عملية البيع") ? "مباعة" : "محجوزة";

      // #10: تحرير السيارة المرتبطة سابقاً إذا تغيرت
      const currentMeta = (customer.metadata as Record<string, unknown> | null) ?? {};
      const prevInventoryId = currentMeta.selected_inventory_id as string | undefined;
      if (prevInventoryId && prevInventoryId !== inventory_id) {
        await admin.from("inventory")
          .update({ availability_status: "متوفرة" })
          .eq("id", prevInventoryId);
      }

      const { data: invItem } = await admin
        .from("inventory")
        .select("id, model, chassis_no")
        .eq("id", inventory_id)
        .maybeSingle();

      if (invItem) {
        await admin.from("inventory")
          .update({ availability_status: invStatus })
          .eq("id", inventory_id);

        await admin.from("customers")
          .update({
            metadata: { ...currentMeta, selected_inventory_id: inventory_id },
            requested_car: `${invItem.model ?? ""}${invItem.chassis_no ? ` - شاصي:${invItem.chassis_no}` : ""}`.trim(),
          })
          .eq("id", customer_id);
      }
    }

    // ── #17: مزامنة تذكير المتابعة (مطابق للويب) ────────────────────────────
    if (!isClosed) {
      const followupAt = (updates.next_follow_up_at ?? customer.next_follow_up_at) as string | null;
      if (followupAt) {
        // إلغاء التذكير القديم وإنشاء الجديد
        await admin.from("reminders")
          .update({ status: "cancelled" })
          .eq("customer_id", customer_id)
          .eq("status", "pending");

        await admin.from("reminders").insert({
          customer_id,
          assigned_user_id: customer.assigned_user_id,
          branch_id: customer.branch_id,
          title: `متابعة: ${String(updates.full_name ?? customer.full_name)}`,
          message: `موعد متابعة العميل ${String(updates.full_name ?? customer.full_name)}`,
          due_at: followupAt,
          status: "pending",
        });
      } else if (next_follow_up_at === null) {
        // حُذف موعد المتابعة — إلغاء التذكيرات المعلقة
        await admin.from("reminders")
          .update({ status: "cancelled" })
          .eq("customer_id", customer_id)
          .eq("status", "pending");
      }
    } else {
      // ملف مغلق — إلغاء كل التذكيرات المعلقة
      await admin.from("reminders")
        .update({ status: "cancelled" })
        .eq("customer_id", customer_id)
        .eq("status", "pending");
    }

    // ── #15: تسجيل النشاط بأسماء دقيقة مطابقة للويب ───────────────────────
    const changedParts: string[] = [];
    const statusChanged = newStatus && newStatus !== customer.status;
    if (statusChanged) changedParts.push(`الحالة: ${newStatus}`);
    if (noteText) changedParts.push(`ملاحظة: ${noteText.slice(0, 60)}${noteText.length > 60 ? "…" : ""}`);
    if (updates.requested_car !== undefined) changedParts.push("السيارة المطلوبة");
    if (updates.operation_type) changedParts.push(`نوع العملية: ${String(updates.operation_type)}`);
    if (tradeInSaved) changedParts.push("بيانات السيارة");
    if (updates.full_name) changedParts.push("الاسم");
    if (updates.phone) changedParts.push("الهاتف");

    // إدراج سجل الحالة
    if (statusChanged) {
      await admin.from("customer_logs").insert({
        customer_id,
        actor_user_id: user.id,
        actor_name: user.full_name,
        action: "status_updated",
        details: `تغيير الحالة: ${customer.status} ← ${newStatus} — بواسطة ${user.full_name} (Mini App)`,
      });
    }

    // إدراج سجل تغيير نوع العملية
    if (updates.operation_type) {
      await admin.from("customer_logs").insert({
        customer_id,
        actor_user_id: user.id,
        actor_name: user.full_name,
        action: "customer_updated",
        details: `تغيير نوع العملية إلى: ${String(updates.operation_type)} — بواسطة ${user.full_name} (Mini App)`,
      });
    }

    // إدراج سجل سيارة الاستبدال
    if (tradeInSaved) {
      await admin.from("customer_logs").insert({
        customer_id,
        actor_user_id: user.id,
        actor_name: user.full_name,
        action: "trade_in_saved",
        details: `تم حفظ بيانات السيارة عبر Mini App — بواسطة ${user.full_name}`,
      });
    }

    // إدراج سجل التعديل العام (إذا كان هناك تعديلات أخرى)
    const otherParts = changedParts.filter(p => !p.startsWith("الحالة:") && p !== "بيانات السيارة");
    if (otherParts.length > 0) {
      await admin.from("customer_logs").insert({
        customer_id,
        actor_user_id: user.id,
        actor_name: user.full_name,
        action: "customer_updated",
        details: `تم التعديل عبر Mini App — ${otherParts.join(" | ")} — بواسطة ${user.full_name}`,
      });
    }

    // ── #16: إشعار في قاعدة البيانات (notifications) + Telegram ────────────
    if (!caps.isManager && statusChanged) {
      const customerDisplayName = String(updates.full_name ?? customer.full_name);
      const opTitle = opCode === "sell_on_behalf"
        ? "تحديث ملف بيع بالوكالة"
        : opCode === "buyer_tradein_pending"
          ? "تحديث ملف استبدال"
          : "تحديث ملف مشتري";

      // جلب مدراء الفرع لإشعارهم
      const { data: managers } = await admin
        .from("app_users")
        .select("id")
        .eq("branch_id", user.branch_id ?? "")
        .in("role", ["manager", "general_manager"])
        .eq("is_active", true);

      if (managers && managers.length > 0) {
        await admin.from("notifications").insert(
          managers.map((m) => ({
            recipient_user_id: m.id,
            recipient_branch_id: user.branch_id ?? null,
            title: opTitle,
            message: `حدَّث ${user.full_name} ملف ${customerDisplayName} — الحالة: ${customer.status} ← ${newStatus}`,
            notification_type: "customer_activity",
            status: "unread",
            created_by_user_id: user.id,
            payload: { source: "mini_app", customer_id, actor_name: user.full_name },
          })),
        );
      }

      void pushCustomerUpdateToManagers({
        branchId: user.branch_id,
        customerId: customer_id,
        opCode,
        customerName: customerDisplayName,
        staffName: user.full_name,
        staffUserId: user.id,
        oldStatus: String(customer.status ?? ""),
        newStatus,
        nextFollowUp: updates.next_follow_up_at ?? customer.next_follow_up_at ?? null,
        note: note ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[update-customer]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
