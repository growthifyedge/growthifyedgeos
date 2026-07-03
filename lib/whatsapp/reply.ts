/**
 * Auto-reply logic. This is the "brain" that decides what to answer.
 *
 * >>> THIS IS THE FILE YOU CUSTOMISE. <<<
 *
 * Right now it does simple keyword matching with a default fallback. Replace the
 * body of buildAutoReply() with whatever your software should do — look up an
 * order, check a client, call your own logic, etc. Return `null` to send no
 * reply at all.
 */

export type IncomingMessage = {
  waId: string; // customer's number, e.g. "923001234567"
  profileName?: string; // WhatsApp display name
  text: string; // the message text (lowercased comparisons are up to you)
  msgType: string; // "text" | "image" | ...
};

export function buildAutoReply(msg: IncomingMessage): string | null {
  const name = msg.profileName ? msg.profileName.split(" ")[0] : "there";
  const text = (msg.text || "").trim().toLowerCase();

  // Only auto-reply to text for now; ignore images/audio/etc.
  if (msg.msgType !== "text") {
    return `Hi ${name}, thanks for your message! Our team will get back to you shortly.`;
  }

  // --- Simple keyword rules (edit / extend freely) ---
  if (/\b(hi|hello|hey|salam|assalam)\b/.test(text)) {
    return `Hello ${name}! 👋 Thanks for reaching out to Growthify. How can we help you today?`;
  }

  if (/\b(price|pricing|cost|quote|rate)\b/.test(text)) {
    return `Thanks for your interest, ${name}! A team member will share pricing details with you shortly. Meanwhile, could you tell us which service you're interested in?`;
  }

  if (/\b(hours|open|timing|timings|available)\b/.test(text)) {
    return `We're available Monday–Saturday, 9:00 AM – 6:00 PM. We'll respond to your message as soon as we're back online.`;
  }

  if (/\b(thanks|thank you|shukriya)\b/.test(text)) {
    return `You're welcome, ${name}! 🙌 Let us know if there's anything else we can do.`;
  }

  // --- Default fallback ---
  return `Hi ${name}, thanks for messaging Growthify! ✅ We've received your message and a team member will reply soon. For anything urgent, please reply with the word "urgent".`;
}
