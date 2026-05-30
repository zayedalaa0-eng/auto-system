import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { sendMessage } from "@/lib/telegram/api";

/**
 * GET  /api/reports/overdue-escalation  ← Vercel Cron يُرسل GET
 * POST /api/reports/overdue-escalation  ← للاختبار اليدوي
 * يُرسل تنبيهاً عاجلاً للمديرين عن المتابعات المتأخرة أكثر من 48 ساعة
 * يُشغَّل كل يوم صباحاً (9:00 UTC = 12:00 بتوقيت فلسطين UTC+3)
 * مؤمَّن بـ: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}

async function handler(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now = new Date();

    // حد الـ 48 ساعة
    const threshold48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // ── جلب العملاء ذوو متابعات متأخرة +48 ساعة ─────────────────────────
    const { data: overdueCustomers } = await admin
      .from("customers")
      .select("id, full_name, nickname, phone, status, next_follow_up_at, branch_id, assigned_user_id, app_users(full_name)")
      .eq("is_active", true)
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", threshold48h.toISOString())
      .order("next_follow_up_at", { ascending: true })
      .limit(200);

    if (!overdueCustomers || overdueCustomers.length === 0) {
      return NextResponse.json({ sent: 0, overdue: 0 });
    }

    // ── جلب المديرين ─────────────────────────────────────────────────────
    const { data: managers } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id, telegram_chat_id, is_active")
      .not("telegram_chat_id", "is", null)
      .eq("is_active", true);

    const recipients = (managers ?? []).filter((u) => {
      const caps = getRoleCapabilities(u.role);
      return caps.isManager;
    });

    if (recipients.length === 0) return NextResponse.json({ sent: 0, overdue: overdueCustomers.length });

    const { data: allBranches } = await admin.from("branches").select("id, name").eq("is_active", true);
    const branchNameMap = new Map<string, string>((allBranches ?? []).map((b) => [b.id, b.name]));

    let sent = 0;

    for (const manager of recipients) {
      const caps = getRoleCapabilities(manager.role);
      const isGM = caps.isGeneralManager;
      const branchId = manager.branch_id;

      const myOverdue = overdueCustomers.filter((c) =>
        isGM ? true : c.branch_id === branchId,
      );

      if (myOverdue.length === 0) continue;

      // العملاء المتأخرون أكثر من 7 أيام: خطر عالٍ
      const criticalOverdue = myOverdue.filter(
        (c) => (now.getTime() - new Date(c.next_follow_up_at!).getTime()) > 7 * 24 * 60 * 60 * 1000,
      );

      const branchLabel = isGM ? "جميع المعارض" : (branchId ? (branchNameMap.get(branchId) ?? "المعرض") : "المعرض");

      let msg = `🚨 <b>تنبيه عاجل — متابعات متأخرة +48 ساعة</b>\n`;
      msg += `مرحباً <b>${manager.full_name}</b>\n`;
      msg += `🏢 ${branchLabel}\n\n`;
      msg += `⚠️ يوجد <b>${myOverdue.length}</b> عميل لم تُنجز متابعته:\n`;
      if (criticalOverdue.length > 0) {
        msg += `🔴 منهم <b>${criticalOverdue.length}</b> متأخر أكثر من 7 أيام!\n`;
      }
      msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      myOverdue.slice(0, 10).forEach((c, i) => {
        const daysAgo = Math.floor((now.getTime() - new Date(c.next_follow_up_at!).getTime()) / 86400000);
        const display = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name;
        const urgency = daysAgo >= 7 ? "🔴" : daysAgo >= 3 ? "🟠" : "🟡";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assignedName = (c.app_users as any)?.full_name ?? "غير محدد";
        msg += `${urgency} <b>${i + 1}. ${display}</b>\n`;
        msg += `   📱 ${c.phone}\n`;
        msg += `   📌 ${c.status ?? "—"}\n`;
        msg += `   ⏰ متأخر <b>${daysAgo} يوم</b>\n`;
        msg += `   👤 ${assignedName}\n`;
      });

      if (myOverdue.length > 10) {
        msg += `   ... و${myOverdue.length - 10} عميلاً آخر\n`;
      }

      msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `💡 <i>راجع ملفات هؤلاء العملاء فوراً وحدّث مواعيد المتابعة أو أغلق الملف.</i>\n`;
      msg += `🤖 <i>نظام المعرض الذكي — تنبيه تصعيد تلقائي</i>`;

      await sendMessage(manager.telegram_chat_id as string, msg);
      sent++;
    }

    // ── إنشاء إشعار داخلي في قاعدة البيانات للمدير العام ──────────────────
    const gmManagers = recipients.filter((u) => getRoleCapabilities(u.role).isGeneralManager);
    if (gmManagers.length > 0 && overdueCustomers.length > 0) {
      const rows = gmManagers.map((gm) => ({
        recipient_user_id: gm.id,
        recipient_branch_id: null,
        recipient_label: gm.full_name,
        notification_type: "overdue_escalation",
        title: `🚨 ${overdueCustomers.length} متابعة متأخرة +48 ساعة`,
        message: `يوجد ${overdueCustomers.length} عميل لم تُنجز متابعاتهم منذ أكثر من 48 ساعة. راجع التقرير الصباحي للتفاصيل.`,
        status: "unread",
        created_by_user_id: null,
        payload: {
          source: "overdue_escalation",
          overdue_count: overdueCustomers.length,
          generated_at: now.toISOString(),
        },
      }));
      await admin.from("notifications").insert(rows);
    }

    return NextResponse.json({ sent, overdue: overdueCustomers.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
