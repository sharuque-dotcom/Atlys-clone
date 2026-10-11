import { authenticateApiKey } from "@/lib/apikeys";
import { db } from "@/lib/db";
import { serializeApplication } from "@/lib/serialize";

export async function GET(req: Request) {
  const enterpriseId = await authenticateApiKey(req);
  if (!enterpriseId) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status");
  const apps = await db.application.findMany({ where: { enterpriseId, ...(status ? { status } : {}) }, include: { traveler: true }, orderBy: { createdAt: "desc" }, take: 500 });
  return Response.json({ data: apps.map(serializeApplication) });
}
