/**
 * WhatsApp Cloud API — outbound helpers. SERVER-ONLY.
 *
 * Sends messages back to customers via Meta's Graph API. Requires two env vars:
 *   WHATSAPP_PHONE_NUMBER_ID  — the "Phone number ID" from the Meta dashboard
 *   WHATSAPP_ACCESS_TOKEN     — a permanent (System User) access token
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

const GRAPH_VERSION = "v21.0";

function graphUrl() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
}

function accessToken() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not set");
  return token;
}

export type SendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Send a plain-text WhatsApp message.
 *
 * NOTE: free-form text only works inside the 24-hour customer service window
 * (i.e. the customer messaged you within the last 24h). Outside that window
 * you must use an approved template — see sendTemplate() below.
 *
 * @param to   Recipient number in international format WITHOUT '+', e.g. "923001234567"
 * @param body The message text.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  try {
    const res = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: JSON.stringify(data?.error ?? data) };
    }
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send an approved template message (needed to start a conversation OUTSIDE the
 * 24-hour window). Create & approve templates in the Meta dashboard first.
 *
 * @param to           Recipient number, international format without '+'.
 * @param templateName The template's exact name.
 * @param languageCode e.g. "en_US".
 * @param bodyParams   Ordered values for the template's {{1}}, {{2}} ... placeholders.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = "en_US",
  bodyParams: string[] = []
): Promise<SendResult> {
  try {
    const components =
      bodyParams.length > 0
        ? [
            {
              type: "body",
              parameters: bodyParams.map((text) => ({ type: "text", text })),
            },
          ]
        : [];

    const res = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        "Content-Type": "application/json",
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

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: JSON.stringify(data?.error ?? data) };
    }
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
