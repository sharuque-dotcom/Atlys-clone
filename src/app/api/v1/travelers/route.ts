import { z } from "zod";
import { authenticateApiKey } from "@/lib/apikeys";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const enterpriseId = await authenticateApiKey(req);
  if (!enterpriseId) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const travelers = await db.traveler.findMany({ where: { enterpriseId }, orderBy: { lastName: "asc" } });
  return Response.json({
    data: travelers.map((t) => ({
      id: t.id, employeeId: t.employeeId, firstName: t.firstName, lastName: t.lastName, email: t.email, nationality: t.nationality,
      designation: t.designation, department: t.department, passportExpiry: t.passportExpiry, residenceVisaExpiry: t.residenceVisaExpiry,
    })),
  });
}

const upsert = z.object({
  employeeId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email().optional(),
  phone: z.string().optional(),
  nationality: z.string().length(2),
  designation: z.string().optional(),
  department: z.string().optional(),
  monthlySalaryAed: z.number().int().nonnegative().optional(),
  joinedAt: z.coerce.date().optional(),
  passportNo: z.string().optional(),
  passportExpiry: z.coerce.date().optional(),
  emiratesIdExpiry: z.coerce.date().optional(),
  residenceVisaExpiry: z.coerce.date().optional(),
});

/** HRMS sync: upserts a traveler by employeeId. */
export async function POST(req: Request) {
  const enterpriseId = await authenticateApiKey(req);
  if (!enterpriseId) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const parsed = upsert.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  const { employeeId, ...rest } = parsed.data;
  const data = { ...rest, nationality: rest.nationality.toUpperCase() };
  const existing = await db.traveler.findFirst({ where: { enterpriseId, employeeId } });
  const t = existing
    ? await db.traveler.update({ where: { id: existing.id }, data })
    : await db.traveler.create({ data: { ...data, employeeId, enterpriseId } });
  await db.auditLog.create({ data: { enterpriseId, actorName: "API", action: existing ? "traveler.synced_update" : "traveler.synced_create", entity: "Traveler", entityId: t.id } });
  return Response.json({ data: { id: t.id, employeeId }, created: !existing }, { status: existing ? 200 : 201 });
}
