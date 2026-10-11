"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ROLES, type Role } from "@/lib/types";
import { newCompanyCode } from "@/lib/refs";
import { isValidTrn, normalizeUaeMobile } from "@/lib/validators";

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
  const role = String(formData.get("role") ?? "AGENT") as Role;
  const req = await db.accessRequest.findFirst({ where: { id, enterpriseId: user.enterpriseId, status: "PENDING" } });
  if (!req) done("error", "Request not found");
  await db.accessRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "DENIED", decidedById: user.id, decidedAt: new Date() } });
  if (approve) await db.user.update({ where: { id: req!.userId }, data: { enterpriseId: user.enterpriseId, role: ROLES.includes(role) && role !== "OWNER" ? role : "AGENT" } });
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
  await db.user.update({ where: { id }, data: { enterpriseId: null, role: "AGENT" } });
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

export async function saveAgencyProfile(formData: FormData) {
  const user = await requireMember("org.manage");
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const invoiceType = str("invoiceType") === "NON_VAT" ? "NON_VAT" : "VAT";
  const trn = str("trn").replace(/\D/g, "");
  if (invoiceType === "VAT" && !isValidTrn(trn)) done("error", "Enter a valid 15-digit TRN, or switch to non-VAT invoicing.");
  const brandColor = /^#[0-9a-fA-F]{6}$/.test(str("brandColor")) ? str("brandColor") : "#0f7a69";
  await db.enterprise.update({
    where: { id: user.enterpriseId },
    data: {
      name: str("name") || user.enterprise.name,
      legalName: str("legalName") || user.enterprise.legalName,
      tourismLicenseNo: str("tourismLicenseNo") || null,
      phone: normalizeUaeMobile(str("phone")) ?? (str("phone") || null),
      email: str("email") || null,
      brandColor,
      invoicePrefix: (str("invoicePrefix") || "INV").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "INV",
      invoiceType,
      trn: invoiceType === "VAT" ? trn : null,
    },
  });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "agency.updated", "Enterprise", user.enterpriseId);
  done("ok", "Agency profile saved");
}
