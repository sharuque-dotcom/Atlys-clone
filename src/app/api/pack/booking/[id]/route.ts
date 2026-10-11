import { cookies } from "next/headers";
import { currentUser, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatePack } from "@/lib/pack";
import { can } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** The whole family's files in one PDF — one complete file per applicant, back to back. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user?.enterpriseId || !user.enterprise || !can(user.role, "applications.viewAll")) return new Response("Unauthorized", { status: 401 });
  const booking = await db.booking.findFirst({ where: { id, enterpriseId: user.enterpriseId }, include: { applications: { select: { id: true } } } });
  if (!booking) return new Response("Not found", { status: 404 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const pack = await generatePack({
    enterpriseId: user.enterpriseId, agencyName: user.enterprise.name, applicationIds: booking.applications.map((a) => a.id), origin: new URL(req.url).origin,
    sessionCookie: token ? { name: SESSION_COOKIE, value: token } : null, actor: { id: user.id, name: user.name },
  });
  if (!pack) return new Response("Nothing to print", { status: 404 });
  return new Response(new Uint8Array(pack.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${booking.ref}-family-pack.pdf"`, "Cache-Control": "private, no-store" },
  });
}
