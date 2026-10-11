import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { can } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user?.enterpriseId) return new Response("Unauthorized", { status: 401 });
  const doc = await db.travelerDocument.findFirst({ where: { id, traveler: { enterpriseId: user.enterpriseId } }, include: { traveler: true } });
  if (!doc) return new Response("Not found", { status: 404 });
  if (!can(user.role, "applications.viewAll") && doc.traveler.userId !== user.id) return new Response("Forbidden", { status: 403 });
  let body: Buffer;
  try {
    body = await getObject(doc.storageKey);
  } catch {
    return new Response("File missing from storage", { status: 404 });
  }
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "document.viewed", "TravelerDocument", doc.id, { type: doc.type });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
