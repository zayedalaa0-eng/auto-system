/**
 * WhatsApp Business Cloud API — Meta
 * توثيق: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 */

const BASE_URL = "https://graph.facebook.com/v19.0";

function getToken() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN غير موجود في .env");
  return token;
}

/** إرسال رسالة نصية حرة (تعمل فقط خلال 24 ساعة من آخر رسالة من العميل) */
export async function sendTextMessage({
  phoneNumberId,
  to,
  text,
}: {
  phoneNumberId: string;
  to: string; // رقم الهاتف بصيغة دولية بدون + مثل 966501234567
  text: string;
}) {
  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text, preview_url: false },
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      json?.error?.message ?? `WhatsApp API error: ${res.status}`
    );
  }

  return json as { messages: { id: string }[] };
}

/** إرسال رسالة قالب معتمد من Meta */
export async function sendTemplateMessage({
  phoneNumberId,
  to,
  templateName,
  languageCode = "ar",
  components = [],
}: {
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode?: string;
  components?: object[];
}) {
  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      json?.error?.message ?? `WhatsApp API error: ${res.status}`
    );
  }

  return json as { messages: { id: string }[] };
}
