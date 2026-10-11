import { authenticateApiKey } from "@/lib/apikeys";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const enterpriseId = await authenticateApiKey(req);
  if (!enterpriseId) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const travelers = await db.traveler.findMany({ where: { enterpriseId }, include: { customer: true }, orderBy: { lastName: "asc" } });
  return Response.json({
    data: travelers.map((t) => ({
      id: t.id, customer: t.customer ? { id: t.customer.id, name: t.customer.name } : null, relationship: t.relationship,
      firstName: t.firstName, lastName: t.lastName, nationality: t.nationality, passportExpiry: t.passportExpiry, residenceVisaExpiry: t.residenceVisaExpiry,
    })),
  });
}
