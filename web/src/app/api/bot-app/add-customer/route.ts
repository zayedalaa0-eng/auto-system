import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { PHONE_ERROR_MESSAGE, isValidPhone, normalizePhone } from "@/lib/phone";
import { isClosedStatus } from "@/lib/statuses";
import { pushNewCustomerToManagers, pushEvaluationRequestToMaalamManager } from "@/lib/telegram/push";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      chat_id,
      full_name,
      phone,
      nickname,
      address,
      whatsapp_prefix,
      operation_type,
      status,
      requested_car,
      trade_in,
      notes,
      next_follow_up_at,
      assigned_user_id,
      branch_id: bodyBranchId,
      payment_method,
    } = body;
    // Support legacy trade_in_model field
    const tradeInModel = (trade_in as { model?: string } | null)?.model ?? (body.trade_in_model as string | null) ?? null;

    if (!chat_id || !full_name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "الاسم ورقم الهاتف مطلوبان" }, { status: 400 });
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: PHONE_ERROR_MESSAGE }, { status: 400 });
    }
    const normalizedPhone = normalizePhone(phone);

    const admin = createAdminClient();

    const { data: user } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("telegram_chat_id", String(chat_id))
      .eq("is_active", true)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const caps = getRoleCapabilities(user.role, user.full_name);

    // للمدير العام: يمكنه تحديد المعرض يدوياً
    const resolvedBranchId = caps.isGeneralManager
      ? (bodyBranchId as string | null | undefined) ?? null
      : user.branch_id ?? null;

    // Duplicate phone check — نبحث في كل الملفات (نشطة ومغلقة) لنفس المعرض
    const dupQuery = admin
      .from("customers")
      .select("id, full_name, status, is_active")
      .eq("phone", normalizedPhone);

    const { data: dupCustomer } = await (resolvedBranchId
      ? dupQuery.eq("branch_id", resolvedBranchId)
      : dupQuery.is("branch_id", null)
    ).order("is_active", { ascending: false }) // الملفات النشطة أولاً
     .limit(1)
     .maybeSingle();

    if (dupCustomer?.id) {
      const isActive = dupCustomer.is_active !== false;
      return NextResponse.json(
        {
          error: isActive
            ? "يوجد عميل نشط بنفس رقم الهاتف في هذا المعرض"
            : "يوجد ملف مغلق بنفس رقم الهاتف — يمكنك فتح الملف القديم أو إدخاله كعميل جديد",
          customer_id: dupCustomer.id,
          customer_name: dupCustomer.full_name ?? null,
          customer_status: dupCustomer.status ?? null,
          is_closed: !isActive,
        },
        { status: 409 },
      );
    }

    const resolvedAssignedUser =
      caps.isManager && assigned_user_id ? assigned_user_id : user.id;

    // ── نوع العملية — رمز + تسمية عربية ──
    const opCode =
      operation_type === "buyer" || operation_type === "buyer_tradein_pending" || operation_type === "sell_on_behalf"
        ? operation_type
        : "buyer";
    const opLabel =
      opCode === "buyer" ? "مشتري" :
      opCode === "buyer_tradein_pending" ? "مشتري + استبدال" :
      "بيع بالوكالة";

    // الحالة الافتتاحية تتبع نوع العملية إذا لم يُحدد المستخدم حالة
    const defaultStatus =
      opCode === "sell_on_behalf"        ? "عرض سيارة للبيع" :
      opCode === "buyer_tradein_pending" ? "استبدال — تحت التقييم" :
      "جديد";
    const resolvedStatus = status?.trim() || defaultStatus;
    const closed = isClosedStatus(resolvedStatus);

    const { data: inserted, error } = await admin
      .from("customers")
      .insert({
        full_name: full_name.trim(),
        phone: normalizedPhone,
        nickname: nickname?.trim() || null,
        address: address?.trim() || null,
        whatsapp_prefix: whatsapp_prefix?.trim() || "+970",
        // نُخزّن التسمية العربية في العمود (مطابق لمسار الويب) + الكود الإنجليزي في metadata
        operation_type: opLabel,
        status: resolvedStatus,
        requested_car: requested_car?.trim() || null,
        notes: notes?.trim() || null,
        next_follow_up_at:
          !closed && next_follow_up_at ? new Date(next_follow_up_at).toISOString() : null,
        branch_id: resolvedBranchId,
        assigned_user_id: resolvedAssignedUser,
        is_active: !closed,
        metadata: {
          operation_type_code: opCode,
          operation_type: opLabel,
          source: "telegram_miniapp",
          ...(payment_method ? { payment_method } : {}),
        },
      })
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Create trade_ins record if applicable
    if (inserted?.id && trade_in && (opCode === "buyer_tradein_pending" || opCode === "sell_on_behalf")) {
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
      };
      const { data: insertedTi } = await admin.from("trade_ins").insert({
        customer_id: inserted.id,
        branch_id: resolvedBranchId,
        owner_name: full_name.trim(),
        model: ti.model?.trim() ?? "",
        price: ti.price ?? null,
        chassis_no: ti.chassis_no?.trim() ?? null,
        color: ti.color?.trim() ?? null,
        production_year: ti.production_year ?? null,
        mileage: ti.mileage ?? null,
        license_expiry: ti.license_expiry ?? null,
        specs: ti.specs?.trim() ?? null,
        inspection: ti.inspection?.trim() ?? null,
        status: opCode === "sell_on_behalf" ? "برسم البيع" : "استبدال (بانتظار التقييم)",
        condition_label: "مستعملة",
        deal_type: opCode === "sell_on_behalf" ? "بيع بالوكالة" : "استبدال",
        is_active: true,
        notes: ti.notes?.trim() ?? null,
        metadata: { gear: ti.gear ?? null, fuel: ti.fuel ?? null, source: "telegram_miniapp" },
      }).select("id").maybeSingle();

      // إضافة سجل في المخزون لعمليات بيع بالوكالة
      if (opCode === "sell_on_behalf" && ti.model?.trim()) {
        const { error: invErr } = await admin.from("inventory").insert({
          branch_id: resolvedBranchId,
          source_customer_id: inserted.id,
          model: ti.model.trim(),
          owner_name: full_name.trim(),
          deal_type: "برسم البيع",
          chassis_no: ti.chassis_no?.trim() ?? null,
          condition_label: "مستعملة",
          availability_status: "متوفرة",
          price: ti.price ?? null,
          color: ti.color?.trim() ?? null,
          production_year: ti.production_year ?? null,
          mileage: ti.mileage ?? null,
          specs: ti.specs?.trim() ?? null,
          inspection: ti.inspection?.trim() ?? null,
          is_active: true,
          metadata: { gear: ti.gear ?? null, fuel: ti.fuel ?? null, source: "telegram_miniapp" },
        });
        if (invErr) console.error("[add-customer] inventory insert failed:", invErr.message);
      }

      // ── إرسال طلب التقييم لمدير معرض المعلم (للاستبدال فقط) ─────────────
      if (opCode === "buyer_tradein_pending" && ti.model?.trim() && inserted?.id) {
        // جلب اسم المعرض
        let branchNameStr: string | null = null;
        if (resolvedBranchId) {
          const { data: branchRow } = await admin.from("branches").select("name").eq("id", resolvedBranchId).maybeSingle();
          branchNameStr = branchRow?.name ?? null;
        }
        void pushEvaluationRequestToMaalamManager({
          tradeInId: insertedTi?.id ?? inserted.id,
          customerId: inserted.id,
          customerName: full_name.trim(),
          customerPhone: normalizedPhone,
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
          opCode,
        });
      }
    }

    // Log
    await admin.from("customer_logs").insert({
      customer_id: inserted?.id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action: "customer_created",
      details: `تم إنشاء ملف العميل ${full_name.trim()} عبر بوت Telegram.`,
    });

    // #16: إشعار المديرين (notifications + Telegram)
    if (inserted?.id) {
      // جلب اسم الفرع للإشعار
      let notifBranchName: string | null = null;
      if (resolvedBranchId) {
        const { data: branchRow } = await admin.from("branches").select("name").eq("id", resolvedBranchId).maybeSingle();
        notifBranchName = branchRow?.name ?? null;
      }

      // إشعارات الويب للمديرين
      if (!caps.isManager) {
        const { data: managers } = await admin
          .from("app_users")
          .select("id")
          .eq("branch_id", resolvedBranchId ?? "")
          .in("role", ["manager", "general_manager"])
          .eq("is_active", true);

        if (managers && managers.length > 0) {
          const notifTitle = opCode === "sell_on_behalf"
            ? "ملف بيع بالوكالة جديد"
            : opCode === "buyer_tradein_pending"
              ? "عميل جديد — مشتري مع استبدال"
              : "عميل مشتري جديد";
          const notifMsg = opCode === "sell_on_behalf"
            ? `سجّل ${user.full_name} ملف بيع بالوكالة لـ ${full_name.trim()}${tradeInModel ? ` — ${tradeInModel.trim()}` : ""} | ${resolvedStatus}`
            : `سجّل ${user.full_name} عميلاً جديداً: ${full_name.trim()}${requested_car ? ` — ${requested_car.trim()}` : ""} | ${resolvedStatus}`;
          await admin.from("notifications").insert(
            managers.map((m) => ({
              recipient_user_id: m.id,
              recipient_branch_id: resolvedBranchId ?? null,
              title: notifTitle,
              message: notifMsg,
              notification_type: "customer_activity",
              status: "unread",
              created_by_user_id: user.id,
              payload: { source: "mini_app", customer_id: inserted.id, actor_name: user.full_name },
            })),
          );
        }
      }

      // إشعار تيليغرام للمديرين (احترافي مع أزرار)
      void pushNewCustomerToManagers({
        branchId: user.branch_id,
        customerId: inserted.id,
        opCode,
        customerName: full_name.trim(),
        customerPhone: normalizedPhone,
        staffName: user.full_name,
        staffUserId: user.id,
        branchName: notifBranchName,
        status: resolvedStatus,
        requestedCar: requested_car?.trim() ?? null,
        tradeInModel: tradeInModel?.trim() ?? null,
        nextFollowUp: (!closed && next_follow_up_at) ? new Date(next_follow_up_at).toISOString() : null,
      });
    }

    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch (err) {
    console.error("[bot-app/add-customer]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
