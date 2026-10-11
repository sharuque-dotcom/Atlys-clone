import { cookies } from "next/headers";
import { currentUser, SESSION_COOKIE } from "@/lib/auth";
import { generatePack } from "@/lib/pack";
import { can } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user?.enterpriseId || !user.enterprise || !can(user.role, "applications.viewAll")) return new Response("Unauthorized", { status: 401 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const pack = await generatePack({
    enterpriseId: user.enterpriseId, agencyName: user.enterprise.name, applicationIds: [id], origin: new URL(req.url).origin,
    sessionCookie: token ? { name: SESSION_COOKIE, value: token } : null, actor: { id: user.id, name: user.name },
  });
  if (!pack) return new Response("Not found", { status: 404 });
  const name = pack.applicants[0].name.replace(/[^A-Za-z0-9]+/g, "-");
  return new Response(new Uint8Array(pack.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}-${pack.applicants[0].ref}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
