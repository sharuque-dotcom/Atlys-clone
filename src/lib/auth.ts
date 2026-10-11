import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";
import { db } from "./db";
import { can, type Permission } from "./types";

const COOKIE = "safar_session";
export const SESSION_COOKIE = COOKIE;
const TTL_DAYS = 14;

function hashToken(token: string) {
  return createHash("sha256").update(token + (process.env.SESSION_SECRET ?? "dev-secret")).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86400_000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { enterprise: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
export type MemberUser = SessionUser & { enterpriseId: string; enterprise: NonNullable<SessionUser["enterprise"]> };

/** Requires a signed-in user who belongs to an enterprise. */
export async function requireMember(permission?: Permission): Promise<MemberUser> {
  const user = await currentUser();
  if (!user) redirect("/get-started");
  if (!user.enterpriseId || !user.enterprise) redirect("/get-started/onboarding");
  if (permission && !can(user.role, permission)) redirect("/app?denied=" + permission);
  return user as MemberUser;
}
