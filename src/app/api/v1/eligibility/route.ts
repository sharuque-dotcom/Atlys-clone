import { eligibility, requirementsFor } from "@/lib/requirements";
import type { Purpose } from "@/lib/catalog";
import { authenticateApiKey } from "@/lib/apikeys";

const PURPOSES = ["BUSINESS", "TOURISM", "CONFERENCE", "TRAINING", "FAMILY"];

export async function GET(req: Request) {
  if (!(await authenticateApiKey(req))) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const nationality = (sp.get("nationality") ?? "").toUpperCase();
  const destination = (sp.get("destination") ?? "").toUpperCase();
  const purpose = (sp.get("purpose") ?? "BUSINESS").toUpperCase();
  const uaeResident = sp.get("uaeResident") !== "false";
  if (!/^[A-Z]{2}$/.test(nationality) || !/^[A-Z]{2}$/.test(destination) || !PURPOSES.includes(purpose)) {
    return Response.json({ error: "invalid_query", hint: "nationality, destination (ISO2) and purpose are required" }, { status: 400 });
  }
  const e = eligibility(destination, { nationality, uaeResident }, purpose as Purpose);
  return Response.json({
    data: {
      ...e,
      products: e.status === "VISA_REQUIRED"
        ? e.products.map((p) => ({ id: p.id, name: p.name, kind: p.kind, processingDays: p.processingDays, govtFeeAed: p.govtFeeAed, serviceFeeAed: p.serviceFeeAed, requirements: requirementsFor(p, { nationality, uaeResident }, purpose as Purpose) }))
        : undefined,
    },
  });
}
