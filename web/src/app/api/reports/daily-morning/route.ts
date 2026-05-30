import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { sendMessage } from "@/lib/telegram/api";

/**
 * POST /api/reports/daily-morning
 * يُشغَّل كل صباح — يُرسل تقريراً احترافياً شاملاً لكل مدير عبر تيليجرام
 * مؤمَّن بـ: Authorization: Bearer {CRON_SECRET}
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[daily-morning] CRON_SECRET غير مضبوط — الوصول محظور");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now = new Date();

    // نطاق اليوم بتوقيت الرياض (UTC+3)
    const riyadhOffset = 3 * 60 * 60 * 1000;
    const riyadhNow = new Date(now.getTime() + riyadhOffset);
    const todayRiyadhStart = new Date(
      Date.UTC(riyadhNow.getUTCFullYear(), riyadhNow.getUTCMonth(), riyadhNow.getUTCDate()) - riyadhOffset,
    );
    const todayRiyadhEnd = new Date(todayRiyadhStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const dateLabel = now.toLocaleDateString("ar-SA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Riyadh",
    });

    // ── جلب المدراء ───────────────────────────────────────────────────────
    const { data: managers } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id, telegram_chat_id, is_active")
      .not("telegram_chat_id", "is", null)
      .eq("is_active", true);

    const recipients = (managers ?? []).filter((u) => {
      const caps = getRoleCapabilities(u.role, u.full_name);
      return caps.isGeneralManager || caps.isManager;
    });

    if (recipients.length === 0) return NextResponse.json({ sent: 0 });

    // ── جلب كل البيانات مرة واحدة قبل الـ loop ───────────────────────────
    const [{ data: allCustomers }, { data: allBranches }, { data: closedThisMonth }, { data: allStaff }] = await Promise.all([
      admin
        .from("customers")
        .select("id, full_name, nickname, phone, status, next_follow_up_at, branch_id, assigned_user_id")
        .eq("is_active", true),
      admin.from("branches").select("id, name").eq("is_active", true),
      // صفقات هذا الشهر (مغلقة بنجاح)
      admin
        .from("customers")
        .select("id, status, branch_id, assigned_user_id, metadata")
        .eq("is_active", false)
        .ilike("status", "%تمت عملية البيع%")
        .gte("updated_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
      admin.from("app_users").select("id, full_name, branch_id").eq("is_active", true),
    ]);

    const branchNameMap = new Map<string, string>(
      (allBranches ?? []).map((b) => [b.id, b.name]),
    );

    let sent = 0;

    for (const manager of recipients) {
      const caps = getRoleCapabilities(manager.role, manager.full_name);
      const isGM = caps.isGeneralManager;
      const branchId = manager.branch_id;

      // ── اسم المعرض من الـ map المُجلبة مسبقاً ────────────────────────
      const branchLabel = isGM
        ? "جميع المعارض"
        : (branchId ? (branchNameMap.get(branchId) ?? "المعرض") : "المعرض");

      // ── تصفية البيانات حسب الفرع ─────────────────────────────────────
      const all = (allCustomers ?? []).filter((c) =>
        isGM ? true : c.branch_id === branchId,
      );
      const myClosed = (closedThisMonth ?? []).filter((c) =>
        isGM ? true : c.branch_id === branchId,
      );
      // إجمالي إيرادات هذا الشهر من deal_value
      const monthlyRevenue = myClosed.reduce((sum, c) => {
        const meta = c.metadata as Record<string, unknown> | null;
        const dv = typeof meta?.deal_value === "number" ? meta.deal_value : 0;
        return sum + dv;
      }, 0);
      // معدل التحويل: صفقات مكتملة / إجمالي ملفات الشهر (تقريبي)
      const totalCustomers = all.length + myClosed.length;
      const conversionRate = totalCustomers > 0 ? Math.round((myClosed.length / totalCustomers) * 100) : 0;
      // أفضل موظف أداءً هذا الشهر
      const staffSales: Record<string, number> = {};
      myClosed.forEach((c) => {
        const uid = c.assigned_user_id ?? "unknown";
        staffSales[uid] = (staffSales[uid] ?? 0) + 1;
      });
      const topStaffEntry = Object.entries(staffSales).sort((a, b) => b[1] - a[1])[0];
      const topStaff = topStaffEntry
        ? (allStaff ?? []).find((s) => s.id === topStaffEntry[0])
        : null;

      // ── تصنيف العملاء ─────────────────────────────────────────────────
      const followupsToday = all.filter((c) => {
        if (!c.next_follow_up_at) return false;
        const d = new Date(c.next_follow_up_at);
        return d >= todayRiyadhStart && d <= todayRiyadhEnd;
      });

      const overdueFollowups = all.filter((c) => {
        if (!c.next_follow_up_at) return false;
        return new Date(c.next_follow_up_at) < todayRiyadhStart;
      });

      const openReservations = all.filter((c) =>
        (c.status ?? "").includes("حجز"),
      );

      const awaitingAssessment = all.filter((c) =>
        (c.status ?? "").includes("بانتظار التقييم"),
      );

      const noFollowup = all.filter(
        (c) => !c.next_follow_up_at && !isGM,
      );

      // ── بناء الرسالة ───────────────────────────────────────────────────
      const greeting = isGM
        ? `صباح الخير، <b>${manager.full_name}</b> — المدير العام`
        : `صباح الخير، <b>${manager.full_name}</b> — مدير ${branchLabel}`;

      let msg = "";
      msg += `☀️ <b>التقرير الصباحي اليومي</b>\n`;
      msg += `${greeting}\n`;
      msg += `📅 ${dateLabel}\n`;
      msg += `🏢 النطاق: ${branchLabel}\n\n`;

      // ── ملخص أرقام ────────────────────────────────────────────────────
      msg += `📊 <b>ملخص اليوم</b>\n`;
      msg += `┌ إجمالي العملاء النشطين: <b>${all.length}</b>\n`;
      msg += `├ متابعات مجدولة اليوم: <b>${followupsToday.length}</b>\n`;
      msg += `├ متابعات متأخرة (لم تُنجز): <b>${overdueFollowups.length}</b>\n`;
      msg += `├ حجوزات مفتوحة: <b>${openReservations.length}</b>\n`;
      msg += `└ سيارات بانتظار التقييم: <b>${awaitingAssessment.length}</b>\n\n`;

      // ── KPIs الشهرية ─────────────────────────────────────────────────
      msg += `📈 <b>أداء هذا الشهر</b>\n`;
      msg += `┌ صفقات مكتملة: <b>${myClosed.length}</b>\n`;
      msg += `├ معدل التحويل: <b>${conversionRate}%</b>\n`;
      if (monthlyRevenue > 0) {
        msg += `├ إجمالي الإيرادات: <b>${monthlyRevenue.toLocaleString("ar-SA")} شيقل</b>\n`;
      }
      if (topStaff && topStaffEntry) {
        msg += `└ أفضل موظف: <b>${topStaff.full_name}</b> (${topStaffEntry[1]} صفقة)\n`;
      } else {
        msg += `└ أفضل موظف: <b>—</b>\n`;
      }
      msg += "\n";

      // ── متابعات اليوم ─────────────────────────────────────────────────
      if (followupsToday.length > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📞 <b>متابعات اليوم (${followupsToday.length})</b>\n`;
        followupsToday.slice(0, 10).forEach((c, i) => {
          const timeStr = new Date(c.next_follow_up_at!).toLocaleTimeString("ar-SA", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Riyadh",
          });
          const display = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name;
          msg += `${i + 1}. ${display} — ${timeStr}\n`;
          msg += `   📱 ${c.phone}\n`;
        });
        if (followupsToday.length > 10)
          msg += `   ... و${followupsToday.length - 10} عميلاً آخر\n`;
        msg += "\n";
      }

      // ── متابعات متأخرة ────────────────────────────────────────────────
      if (overdueFollowups.length > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `⚠️ <b>متابعات متأخرة تحتاج تدخلاً فورياً (${overdueFollowups.length})</b>\n`;
        overdueFollowups.slice(0, 7).forEach((c, i) => {
          const daysAgo = Math.floor(
            (now.getTime() - new Date(c.next_follow_up_at!).getTime()) / 86400000,
          );
          const display = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name;
          msg += `${i + 1}. ${display} — منذ <b>${daysAgo} يوم</b>\n`;
          msg += `   📱 ${c.phone}\n`;
        });
        if (overdueFollowups.length > 7)
          msg += `   ... و${overdueFollowups.length - 7} عميلاً آخر\n`;
        msg += "\n";
      }

      // ── حجوزات مفتوحة ─────────────────────────────────────────────────
      if (openReservations.length > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🔒 <b>حجوزات مفتوحة (${openReservations.length})</b>\n`;
        openReservations.slice(0, 5).forEach((c, i) => {
          const display = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name;
          msg += `${i + 1}. ${display}\n`;
          msg += `   📱 ${c.phone}\n`;
        });
        if (openReservations.length > 5)
          msg += `   ... و${openReservations.length - 5} آخرين\n`;
        msg += "\n";
      }

      // ── تذييل ─────────────────────────────────────────────────────────
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🤖 <i>نظام المعرض الذكي — تقرير تلقائي يومي</i>`;

      await sendMessage(manager.telegram_chat_id as string, msg);
      sent++;
    }

    // ── تقارير الموظفين ───────────────────────────────────────────────────────
    const { data: employees } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id, telegram_chat_id, is_active")
      .not("telegram_chat_id", "is", null)
      .eq("is_active", true);

    const employeeList = (employees ?? []).filter((u) => {
      const caps = getRoleCapabilities(u.role, u.full_name);
      return !caps.isManager; // موظف عادي فقط
    });

    // جلب التذكيرات المعلقة اليوم
    const { data: allReminders } = await admin
      .from("reminders")
      .select("id, customer_id, assigned_user_id, due_at, title, message, status")
      .eq("status", "pending")
      .lte("due_at", todayRiyadhEnd.toISOString());

    for (const emp of employeeList) {
      // عملاء هذا الموظف فقط
      const myCustomers = (allCustomers ?? []).filter(
        (c) => c.assigned_user_id === emp.id,
      );

      const myFollowupsToday = myCustomers.filter((c) => {
        if (!c.next_follow_up_at) return false;
        const d = new Date(c.next_follow_up_at);
        return d >= todayRiyadhStart && d <= todayRiyadhEnd;
      });

      const myOverdue = myCustomers.filter((c) => {
        if (!c.next_follow_up_at) return false;
        return new Date(c.next_follow_up_at) < todayRiyadhStart;
      });

      const myReservations = myCustomers.filter((c) =>
        (c.status ?? "").includes("حجز"),
      );

      const myReminders = (allReminders ?? []).filter(
        (r) => r.assigned_user_id === emp.id,
      );

      // لا نرسل للموظف إذا ليس لديه أي شيء
      const hasAnything =
        myFollowupsToday.length > 0 ||
        myOverdue.length > 0 ||
        myReservations.length > 0 ||
        myReminders.length > 0 ||
        myCustomers.length > 0;

      if (!hasAnything) continue;

      let msg = "";
      msg += `☀️ <b>صباح الخير، ${emp.full_name}!</b>\n`;
      msg += `📅 ${dateLabel}\n\n`;

      // ── ملخص سريع ────────────────────────────────────────────────────────
      msg += `📊 <b>نظرة عامة على عملائك</b>\n`;
      msg += `┌ إجمالي العملاء النشطين: <b>${myCustomers.length}</b>\n`;
      msg += `├ متابعات مجدولة اليوم: <b>${myFollowupsToday.length}</b>\n`;
      msg += `├ متابعات متأخرة: <b>${myOverdue.length}</b>\n`;
      msg += `├ حجوزات مفتوحة: <b>${myReservations.length}</b>\n`;
      msg += `└ تذكيرات معلقة: <b>${myReminders.length}</b>\n\n`;

      // ── متابعات اليوم ────────────────────────────────────────────────────
      if (myFollowupsToday.length > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📞 <b>متابعاتك لليوم (${myFollowupsToday.length})</b>\n`;
        myFollowupsToday.slice(0, 10).forEach((c, i) => {
          const timeStr = new Date(c.next_follow_up_at!).toLocaleTimeString("ar-SA", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Riyadh",
          });
          const display = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name;
          msg += `${i + 1}. ${display} — ${timeStr}\n`;
          msg += `   📱 ${c.phone}\n`;
        });
        if (myFollowupsToday.length > 10)
          msg += `   ... و${myFollowupsToday.length - 10} عميلاً آخر\n`;
        msg += "\n";
      }

      // ── متابعات متأخرة ───────────────────────────────────────────────────
      if (myOverdue.length > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `⚠️ <b>متابعات متأخرة تحتاج منك تدخلاً (${myOverdue.length})</b>\n`;
        myOverdue.slice(0, 7).forEach((c, i) => {
          const daysAgo = Math.floor(
            (now.getTime() - new Date(c.next_follow_up_at!).getTime()) / 86400000,
          );
          const display = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name;
          msg += `${i + 1}. ${display} — منذ <b>${daysAgo} يوم</b>\n`;
          msg += `   📱 ${c.phone}\n`;
        });
        if (myOverdue.length > 7)
          msg += `   ... و${myOverdue.length - 7} عميلاً آخر\n`;
        msg += "\n";
      }

      // ── التذكيرات المعلقة ────────────────────────────────────────────────
      if (myReminders.length > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🔔 <b>تذكيراتك المعلقة (${myReminders.length})</b>\n`;
        myReminders.slice(0, 5).forEach((r, i) => {
          const timeStr = new Date(r.due_at).toLocaleTimeString("ar-SA", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Riyadh",
          });
          msg += `${i + 1}. ${r.title ?? r.message ?? "تذكير"} — ${timeStr}\n`;
        });
        if (myReminders.length > 5)
          msg += `   ... و${myReminders.length - 5} تذكيرات أخرى\n`;
        msg += "\n";
      }

      // ── حجوزات مفتوحة ───────────────────────────────────────────────────
      if (myReservations.length > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🔒 <b>حجوزاتك المفتوحة (${myReservations.length})</b>\n`;
        myReservations.slice(0, 5).forEach((c, i) => {
          const display = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name;
          msg += `${i + 1}. ${display} — 📱 ${c.phone}\n`;
        });
        if (myReservations.length > 5)
          msg += `   ... و${myReservations.length - 5} آخرين\n`;
        msg += "\n";
      }

      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🤖 <i>نظام المعرض الذكي — تقريرك الصباحي الشخصي</i>`;

      await sendMessage(emp.telegram_chat_id as string, msg);
      sent++;
    }

    return NextResponse.json({ sent, date: dateLabel });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
