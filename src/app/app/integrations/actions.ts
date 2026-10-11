"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashApiKey } from "@/lib/apikeys";
import { emitEvent } from "@/lib/webhooks";

function done(key: "ok" | "error", msg: string): never {
  revalidatePath("/app/integrations");
  redirect(`/app/integrations?${key}=${encodeURIComponent(msg)}`);
}

export async function createApiKey(formData: FormData) {
  const user = await requireMember("integrations.manage");
  const name = String(formData.get("name") ?? "").trim() || "API key";
  const secret = `sk_live_${randomBytes(24).toString("base64url")}`;
  await db.apiKey.create({ data: { enterpriseId: user.enterpriseId, name, prefix: secret.slice(0, 12), hash: hashApiKey(secret) } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "api_key.created", "ApiKey", null, { name });
  // Shown exactly once via a short-lived cookie, never stored in plaintext.
  (await cookies()).set("new_api_key", secret, { httpOnly: true, maxAge: 60, path: "/app/integrations", sameSite: "strict" });
  done("ok", "API key created — copy it now, it won't be shown again");
}

export async function revokeApiKey(formData: FormData) {
  const user = await requireMember("integrations.manage");
  const id = String(formData.get("id"));
  await db.apiKey.updateMany({ where: { id, enterpriseId: user.enterpriseId }, data: { revokedAt: new Date() } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "api_key.revoked", "ApiKey", id);
  done("ok", "Key revoked");
}

export async function addWebhook(formData: FormData) {
  const user = await requireMember("integrations.manage");
  const url = String(formData.get("url") ?? "").trim();
  if (!/^https:\/\//.test(url)) done("error", "Webhook URL must use https://");
  const events = formData.getAll("events").map(String).filter(Boolean);
  await db.webhook.create({ data: { enterpriseId: user.enterpriseId, url, secret: `whsec_${randomBytes(18).toString("base64url")}`, events: (events.length ? events : ["*"]).join(",") } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "webhook.created", "Webhook", null, { url });
  done("ok", "Webhook added");
}

export async function deleteWebhook(formData: FormData) {
  const user = await requireMember("integrations.manage");
  await db.webhook.deleteMany({ where: { id: String(formData.get("id")), enterpriseId: user.enterpriseId } });
  done("ok", "Webhook removed");
}

export async function testWebhooks() {
  const user = await requireMember("integrations.manage");
  await emitEvent(user.enterpriseId, "ping", { message: "Hello from Safar" });
  done("ok", "Test event sent to all active webhooks");
}
