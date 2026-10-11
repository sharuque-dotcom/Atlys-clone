import type { Prisma } from "@prisma/client";
import type { MemberUser } from "./auth";
import { can } from "./types";

/** Row-level scoping: employees only see applications they created or that are for them. */
export function applicationScope(user: MemberUser): Prisma.ApplicationWhereInput {
  if (can(user.role, "applications.viewAll")) return { enterpriseId: user.enterpriseId };
  return { enterpriseId: user.enterpriseId, OR: [{ createdById: user.id }, { traveler: { userId: user.id } }] };
}

export function travelerScope(user: MemberUser): Prisma.TravelerWhereInput {
  if (can(user.role, "travelers.manage")) return { enterpriseId: user.enterpriseId };
  return { enterpriseId: user.enterpriseId, userId: user.id };
}
