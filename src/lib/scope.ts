import type { Prisma } from "@prisma/client";
import type { MemberUser } from "./auth";

// Every staff member of an agency works the shared customer book; isolation is per agency (tenant).
export function applicationScope(user: MemberUser): Prisma.ApplicationWhereInput {
  return { enterpriseId: user.enterpriseId };
}

export function travelerScope(user: MemberUser): Prisma.TravelerWhereInput {
  return { enterpriseId: user.enterpriseId };
}
