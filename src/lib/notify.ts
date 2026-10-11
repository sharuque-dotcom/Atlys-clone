// Notification fan-out. WhatsApp is the primary channel in the UAE; email is the fallback.
// When WHATSAPP_TOKEN is not configured, messages are logged so local development works offline.

export type Notification = { to: string | null | undefined; template: string; text: string };

export async function sendWhatsApp(n: Notification) {
  if (!n.to) return { ok: false, reason: "no-recipient" };
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.info(`[whatsapp:dev] → ${n.to} (${n.template}) ${n.text}`);
    return { ok: true, dev: true };
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: n.to.replace("+", ""), type: "text", text: { body: n.text } }),
  });
  return { ok: res.ok };
}
