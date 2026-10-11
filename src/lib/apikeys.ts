import { createHash } from "node:crypto";
import { db } from "./db";

export function hashApiKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/** Resolves `Authorization: Bearer sk_live_…` to an enterprise id, or null. */
export async function authenticateApiKey(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!secret.startsWith("sk_live_")) return null;
  const key = await db.apiKey.findUnique({ where: { hash: hashApiKey(secret) } });
  if (!key || key.revokedAt) return null;
  await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return key.enterpriseId;
}
