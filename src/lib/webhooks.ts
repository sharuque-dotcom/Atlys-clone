import { createHmac } from "node:crypto";
import { db } from "./db";

/** Delivers a signed event to every active webhook subscribed to it (fire-and-forget). */
export async function emitEvent(enterpriseId: string, event: string, payload: Record<string, unknown>) {
  const hooks = await db.webhook.findMany({ where: { enterpriseId, active: true } });
  const body = JSON.stringify({ event, createdAt: new Date().toISOString(), data: payload });
  await Promise.allSettled(
    hooks
      .filter((h) => h.events.split(",").some((e) => e === "*" || e === event))
      .map((h) =>
        fetch(h.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Safar-Event": event,
            "X-Safar-Signature": "sha256=" + createHmac("sha256", h.secret).update(body).digest("hex"),
          },
          body,
          signal: AbortSignal.timeout(5000),
        }),
      ),
  );
}
