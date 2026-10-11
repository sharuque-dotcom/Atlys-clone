import { db } from "./db";

export async function audit(
  actor: { id?: string | null; name: string; enterpriseId: string },
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
) {
  await db.auditLog.create({
    data: {
      enterpriseId: actor.enterpriseId,
      actorId: actor.id ?? null,
      actorName: actor.name,
      action,
      entity,
      entityId: entityId ?? null,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}
