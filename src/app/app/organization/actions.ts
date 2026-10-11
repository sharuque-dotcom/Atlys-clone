"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ROLES, type Role } from "@/lib/types";
import { newCompanyCode } from "@/lib/refs";
import { aedToFils } from "@/lib/money";

function done(key: "ok" | "error", msg: string): never {
  revalidatePath("/app/organization");
  redirect(`/app/organization?${key}=${encodeURIComponent(msg)}`);
}

export async function approveAccess(formData: FormData) {
  return decideAccess(formData, true);
}
export async function denyAccess(formData: FormData) {
  return decideAccess(formData, false);
}

async function decideAccess(formData: FormData, approve: boolean) {
  const user = await requireMember("org.manage");
  const id = String(formData.get("id"));
  const role = String(formData.get("role") ?? "EMPLOYEE") as Role;
  const req = await db.accessRequest.findFirst({ where: { id, enterpriseId: user.enterpriseId, status: "PENDING" } });
  if (!req) done("error", "Request not found");
  await db.accessRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "DENIED", decidedById: user.id, decidedAt: new Date() } });
  if (approve) await db.user.update({ where: { id: req!.userId }, data: { enterpriseId: user.enterpriseId, role: ROLES.includes(role) && role !== "OWNER" ? role : "EMPLOYEE" } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, approve ? "access.approved" : "access.denied", "User", req!.userId);
  done("ok", approve ? `${req!.fullName} can now sign in` : "Request denied");
}

export async function changeRole(formData: FormData) {
  const user = await requireMember("org.manage");
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) as Role;
  if (!ROLES.includes(role)) done("error", "Invalid role");
  if (id === user.id) done("error", "You can't change your own role.");
  const member = await db.user.findFirst({ where: { id, enterpriseId: user.enterpriseId } });
  if (!member) done("error", "Member not found");
  if ((member!.role === "OWNER" || role === "OWNER") && user.role !== "OWNER") done("error", "Only an owner can grant or revoke ownership.");
  await db.user.update({ where: { id }, data: { role } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "member.role_changed", "User", id, { from: member!.role, to: role });
  done("ok", `${member!.name} is now ${role.toLowerCase().replace("_", " ")}`);
}

export async function removeMember(formData: FormData) {
  const user = await requireMember("org.manage");
  const id = String(formData.get("id"));
  if (id === user.id) done("error", "You can't remove yourself.");
  const member = await db.user.findFirst({ where: { id, enterpriseId: user.enterpriseId } });
  if (!member || member.role === "OWNER") done("error", "Owners can't be removed.");
  await db.user.update({ where: { id }, data: { enterpriseId: null, role: "EMPLOYEE" } });
  await db.session.deleteMany({ where: { userId: id } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "member.removed", "User", id);
  done("ok", `${member!.name} removed`);
}

export async function rotateCode() {
  const user = await requireMember("org.manage");
  await db.enterprise.update({ where: { id: user.enterpriseId }, data: { companyCode: newCompanyCode() } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "company_code.rotated", "Enterprise", user.enterpriseId);
  done("ok", "New company code generated — the old one no longer works");
}

export async function addBranch(formData: FormData) {
  const user = await requireMember("org.manage");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name || !address) done("error", "Branch name and address are required");
  await db.branch.create({ data: { enterpriseId: user.enterpriseId, name, address, emirate: String(formData.get("emirate") ?? "DXB"), type: String(formData.get("type") ?? "BRANCH_OFFICE") } });
  done("ok", "Branch added");
}

export async function saveCostCenter(formData: FormData) {
  const user = await requireMember("org.manage");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const budgetFils = aedToFils(Number(formData.get("budgetAed") ?? 0) || 0);
  if (!code || !name) done("error", "Code and name are required");
  await db.costCenter.upsert({
    where: { enterpriseId_code: { enterpriseId: user.enterpriseId, code } },
    create: { enterpriseId: user.enterpriseId, code, name, budgetFils },
    update: { name, budgetFils },
  });
  done("ok", `Cost centre ${code} saved`);
}

export async function savePolicy(formData: FormData) {
  const user = await requireMember("org.manage");
  const data = {
    requireApproval: formData.get("requireApproval") === "on",
    autoApproveBelowFils: aedToFils(Number(formData.get("autoApproveBelowAed") ?? 0) || 0),
    allowPriority: formData.get("allowPriority") === "on",
    allowProtect: formData.get("allowProtect") === "on",
    whatsappNotifications: formData.get("whatsappNotifications") === "on",
    blockedDestinations: String(formData.get("blockedDestinations") ?? "").toUpperCase().split(/[\s,]+/).filter((c) => /^[A-Z]{2}$/.test(c)).join(","),
  };
  await db.policy.upsert({ where: { enterpriseId: user.enterpriseId }, create: { enterpriseId: user.enterpriseId, ...data }, update: data });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "policy.updated", "Policy", user.enterpriseId, data);
  done("ok", "Travel policy saved");
}
