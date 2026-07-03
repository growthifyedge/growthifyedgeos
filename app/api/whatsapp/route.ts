/**
 * WhatsApp Cloud API webhook.
 *
 *   GET  /api/whatsapp  → verification handshake (Meta calls this once when you
 *                         save the webhook URL in the dashboard).
 *   POST /api/whatsapp  → receives every inbound message + status update, stores
 *                         it in Supabase, and sends an auto-reply.
 *
 * Env vars required (see .env.local.example):
 *   WHATSAPP_VERIFY_TOKEN       — any secret string you invent; must match the
 *                                 "Verify token" you type into the Meta dashboard.
 *   WHATSAPP_PHONE_NUMBER_ID     — used by lib/whatsapp/send.ts
 *   WHATSAPP_ACCESS_TOKEN        — used by lib/whatsapp/send.ts
 *   SUPABASE_SERVICE_ROLE_KEY    — used to write messages (bypasses RLS)
 *   NEXT_PUBLIC_SUPABASE_URL
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { buildAutoReply } from "@/lib/whatsapp/reply";

// This route must run on the Node.js runtime (uses the service-role key) and must
// never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET — webhook verification handshake.
// Meta sends: ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=12345
// We echo back hub.challenge as plain text IF the token matches.
// -----------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// -----------------------------------------------------------------------------
// POST — incoming events.
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed bodies
  }

  // Always ACK fast. Meta retries if we don't return 200 quickly, which can cause
  // duplicate deliveries. We process inline here (simple + fine for low volume);
  // for high volume, push to a queue and return 200 immediately.
  try {
    const supabase = createAdminClient();
    const entries = payload?.entry ?? [];

    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const contactsMeta = value?.contacts ?? [];
        const messages = value?.messages ?? [];

        // Map wa_id -> profile name from the contacts array Meta includes.
        const nameByWaId: Record<string, string> = {};
        for (const c of contactsMeta) {
          if (c?.wa_id) nameByWaId[c.wa_id] = c?.profile?.name ?? "";
        }

        for (const message of messages) {
          const waId: string = message?.from;
          if (!waId) continue;

          const wamid: string = message?.id;
          const msgType: string = message?.type ?? "text";
          const body: string =
            msgType === "text"
              ? message?.text?.body ?? ""
              : message?.button?.text ?? message?.interactive?.button_reply?.title ?? "";
          const profileName = nameByWaId[waId] || undefined;

          // --- Idempotency: skip if we already stored this message id ---
          if (wamid) {
            const { data: existing } = await supabase
              .from("whatsapp_messages")
              .select("id")
              .eq("wa_message_id", wamid)
              .maybeSingle();
            if (existing) continue;
          }

          // --- Upsert the contact ---
          const nowIso = new Date().toISOString();
          const { data: contact } = await supabase
            .from("whatsapp_contacts")
            .upsert(
              {
                wa_id: waId,
                profile_name: profileName,
                last_message_at: nowIso,
                updated_at: nowIso,
              },
              { onConflict: "wa_id" }
            )
            .select("id")
            .single();

          // --- Store the inbound message ---
          await supabase.from("whatsapp_messages").insert({
            contact_id: contact?.id ?? null,
            wa_id: waId,
            direction: "inbound",
            wa_message_id: wamid,
            body,
            msg_type: msgType,
            raw: message,
          });

          // --- Decide on an auto-reply and send it ---
          const reply = buildAutoReply({ waId, profileName, text: body, msgType });
          if (reply) {
            const result = await sendWhatsAppText(waId, reply);
            await supabase.from("whatsapp_messages").insert({
              contact_id: contact?.id ?? null,
              wa_id: waId,
              direction: "outbound",
              wa_message_id: result.messageId ?? null,
              body: reply,
              msg_type: "text",
              status: result.ok ? "sent" : "failed",
              raw: result.ok ? null : { error: result.error },
            });
          }
        }

        // --- Delivery/read status updates (optional) ---
        for (const status of value?.statuses ?? []) {
          if (!status?.id) continue;
          await supabase
            .from("whatsapp_messages")
            .update({ status: status?.status })
            .eq("wa_message_id", status.id);
        }
      }
    }
  } catch (err) {
    // Log but still return 200 so Meta doesn't hammer us with retries.
    console.error("[whatsapp webhook] error:", err);
  }

  return NextResponse.json({ ok: true });
}
