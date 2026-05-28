import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { sendMessage, sendMediaGroup, sendPhoto, sendVoice } from "./api";

/** جلب قائمة المديرين المستحقين لتلقي الإشعار (مشتركة بين جميع دوال الـ push) */
async function getManagerChatIds(branchId: string | null): Promise<string[]> {
  const admin = createAdminClient();
  const { data: users } = await admin
    .from("app_users")
    .select("full_name, role, branch_id, telegram_chat_id")
    .not("telegram_chat_id", "is", null)
    .eq("is_active", true);

  return (users ?? [])
    .filter((user) => {
      const caps = getRoleCapabilities(user.role, user.full_name);
      if (caps.isGeneralManager) return true;
      if (caps.isManager && !caps.isGeneralManager && branchId && user.branch_id === branchId) return true;
      return false;
    })
    .map((r) => r.telegram_chat_id as string);
}

/**
 * يرسل رسالة تيليغرام مباشرة لموظف معين عبر user_id
 * يُستخدم عند إرسال التذكير من قِبل المدير للموظف المعني
 */
export async function pushTelegramToEmployee({
  userId,
  senderName,
  title,
  message,
}: {
  userId: string | null;
  senderName: string;
  title: string;
  message: string;
}) {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    const { data: user } = await admin
      .from("app_users")
      .select("telegram_chat_id, full_name")
      .eq("id", userId)
      .eq("is_active", true)
      .maybeSingle();

    const chatId = user?.telegram_chat_id as string | null;
    if (!chatId) return; // الموظف لا يملك تيليغرام مربوطاً

    const text =
      `📋 <b>${title}</b>\n\n` +
      `${message}\n\n` +
      `<i>— أرسله: ${senderName}</i>`;

    await sendMessage(chatId, text);
  } catch {
    // best-effort
  }
}

export async function pushTelegramToManagers({
  branchId,
  title,
  message,
}: {
  branchId: string | null;
  title: string;
  message: string;
}) {
  try {
    const chatIds = await getManagerChatIds(branchId);
    await Promise.allSettled(
      chatIds.map((chatId) =>
        sendMessage(chatId, `🔔 <b>${title}</b>\n\n${message}`),
      ),
    );
  } catch {
    // Telegram push is best-effort — never block the main flow
  }
}

/**
 * يرسل تسجيلاً صوتياً للمدير العام ومدير المعرض عبر تيليجرام
 * voiceUrl: رابط عام للملف الصوتي (من voice-notes bucket)
 */
export async function pushTelegramVoiceToManagers({
  branchId,
  caption,
  voiceUrl,
}: {
  branchId: string | null;
  caption: string;
  voiceUrl: string;
}) {
  if (!voiceUrl) return;

  try {
    const chatIds = await getManagerChatIds(branchId);
    await Promise.allSettled(
      chatIds.map((chatId) => sendVoice(chatId, voiceUrl, caption)),
    );
  } catch {
    // best-effort
  }
}

/**
 * يرسل صور السيارة للمدير العام ومدير المعرض عبر تيليجرام
 * - صورة واحدة → sendPhoto
 * - أكثر من واحدة → sendMediaGroup (ألبوم بحد أقصى 10 في المجموعة)
 */
export async function pushTelegramPhotosToManagers({
  branchId,
  caption,
  photoUrls,
}: {
  branchId: string | null;
  caption: string;
  photoUrls: string[];
}) {
  if (photoUrls.length === 0) return;

  try {
    const chatIds = await getManagerChatIds(branchId);

    await Promise.allSettled(
      chatIds.map(async (chatId) => {
        if (photoUrls.length === 1) {
          return sendPhoto(chatId, photoUrls[0], caption);
        }
        // إرسال على دفعات بحد أقصى 10 صور لكل ألبوم
        for (let i = 0; i < photoUrls.length; i += 10) {
          const batch = photoUrls.slice(i, i + 10);
          const batchCaption = i === 0 ? caption : undefined;
          await sendMediaGroup(chatId, batch, batchCaption);
        }
      }),
    );
  } catch {
    // best-effort — لا نوقف العملية الرئيسية
  }
}
