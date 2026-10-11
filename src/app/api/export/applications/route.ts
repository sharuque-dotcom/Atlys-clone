import { currentUser, type MemberUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applicationScope } from "@/lib/scope";
import { parsePricing, parseRisk } from "@/lib/applications";
import { getProduct } from "@/lib/catalog";
import { audit } from "@/lib/audit";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  // Neutralise spreadsheet formula injection and quote CSV special chars.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user?.enterpriseId) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const booking = url.searchParams.get("booking");
  const apps = await db.application.findMany({
    where: { ...applicationScope(user as MemberUser), ...(booking ? { bookingId: booking } : {}) },
    include: { traveler: true, booking: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
  });
  const rows = [
    ["ref", "traveler", "nationality", "passport_no", "destination", "visa", "purpose", "travel_start", "travel_end", "status", "risk", "customer", "total_aed", "vat_aed"],
    ...apps.map((a) => {
      const p = parsePricing(a);
      return [a.ref, `${a.traveler.firstName} ${a.traveler.lastName}`, a.traveler.nationality, a.traveler.passportNo, a.destination, getProduct(a.productId)?.name, a.purpose, a.travelStart.toISOString().slice(0, 10), a.travelEnd.toISOString().slice(0, 10), a.status, parseRisk(a)?.level, a.booking?.customer.name, (p.totalFils / 100).toFixed(2), (p.vatFils / 100).toFixed(2)];
    }),
  ];
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "applications.exported", "Application", null, { count: apps.length });
  return new Response(rows.map((r) => r.map(esc).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="safar-applications-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
