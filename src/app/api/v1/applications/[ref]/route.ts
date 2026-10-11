import { authenticateApiKey } from "@/lib/apikeys";
import { db } from "@/lib/db";
import { serializeApplication } from "@/lib/serialize";

export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const enterpriseId = await authenticateApiKey(req);
  if (!enterpriseId) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const { ref } = await params;
  const app = await db.application.findFirst({ where: { enterpriseId, ref }, include: { traveler: true, events: { orderBy: { createdAt: "asc" } } } });
  if (!app) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ data: { ...serializeApplication(app), events: app.events.map((e) => ({ type: e.type, message: e.message, at: e.createdAt })) } });
}
