"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { refreshRisk } from "@/lib/applications";
import { after } from "next/server";
import { storeTravelerDocument } from "@/lib/documents";
import { runExtraction } from "@/lib/review";
import { isValidEmiratesId, normalizeEmiratesId, normalizeUaeMobile } from "@/lib/validators";
import { EMPLOYMENT, RELATIONSHIPS } from "@/lib/types";

function back(to: string, key: "ok" | "error", msg: string): never {
  redirect(`${to}${to.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
}

export async function uploadDocument(formData: FormData) {
  const travelerId = String(formData.get("travelerId"));
  const returnTo = String(formData.get("returnTo") || `/app/travelers/${travelerId}`);
  const user = await requireMember("customers.manage");
  const traveler = await db.traveler.findFirst({ where: { id: travelerId, enterpriseId: user.enterpriseId } });
  if (!traveler) back(returnTo, "error", "Traveler not found");
  try {
    await storeTravelerDocument({
      traveler: traveler!,
      type: String(formData.get("type")),
      file: formData.get("file"),
      mrz: String(formData.get("mrz") ?? ""),
      expiresAt: formData.get("expiresAt") ? new Date(String(formData.get("expiresAt"))) : null,
      actor: { id: user.id, name: user.name },
    });
  } catch (e) {
    back(returnTo, "error", e instanceof Error ? e.message : "Upload failed");
  }
  revalidatePath(returnTo.split("?")[0]);
  back(returnTo, "ok", "Uploaded — AI review is checking it now");
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await requireMember("customers.manage");
  const doc = await db.travelerDocument.findFirst({ where: { id, traveler: { enterpriseId: user.enterpriseId } } });
  if (!doc) back("/app/customers", "error", "Document not found");
  await db.travelerDocument.delete({ where: { id } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "document.deleted", "TravelerDocument", id, { type: doc!.type });
  revalidatePath(`/app/travelers/${doc!.travelerId}`);
  back(`/app/travelers/${doc!.travelerId}`, "ok", "Document removed");
}

const travelerSchema = z.object({
  customerId: z.string().min(1),
  relationship: z.enum(Object.keys(RELATIONSHIPS) as [string, ...string[]]),
  employmentType: z.enum(Object.keys(EMPLOYMENT) as [string, ...string[]]),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  nationality: z.string().length(2, "Pick a nationality"),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  employerName: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  monthlySalaryAed: z.string().optional(),
  joinedAt: z.string().optional(),
  passportNo: z.string().trim().optional(),
  passportExpiry: z.string().optional(),
  uaeResident: z.string().optional(),
  emiratesIdNo: z.string().trim().optional(),
  emiratesIdExpiry: z.string().optional(),
  residenceVisaExpiry: z.string().optional(),
  sponsorId: z.string().optional(),
  priorRejections: z.string().optional(),
  travelHistory: z.string().optional(),
});

const optDate = (v?: string) => (v ? new Date(v) : null);

export async function saveTraveler(formData: FormData) {
  const user = await requireMember("customers.manage");
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  const returnTo = id ? `/app/travelers/${id}` : `/app/customers/${customerId}`;
  const parsed = travelerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(returnTo, "error", parsed.error.issues[0].message);
  const d = parsed.data!;
  const customer = await db.customer.findFirst({ where: { id: d.customerId, enterpriseId: user.enterpriseId } });
  if (!customer) back("/app/customers", "error", "Customer not found");
  if (d.emiratesIdNo && !isValidEmiratesId(d.emiratesIdNo)) back(returnTo, "error", "Emirates ID number is invalid (should be 784-YYYY-NNNNNNN-C).");
  if (d.sponsorId && !(await db.traveler.findFirst({ where: { id: d.sponsorId, customerId: customer!.id } }))) back(returnTo, "error", "Sponsor must be a member of the same household.");
  const data = {
    customerId: customer!.id,
    relationship: d.relationship,
    employmentType: d.employmentType,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email || null,
    phone: d.phone ? normalizeUaeMobile(d.phone) ?? d.phone : null,
    nationality: d.nationality.toUpperCase(),
    gender: d.gender || null,
    dateOfBirth: optDate(d.dateOfBirth),
    employerName: d.employerName || null,
    designation: d.designation || null,
    monthlySalaryAed: d.monthlySalaryAed ? Number(d.monthlySalaryAed) : null,
    joinedAt: optDate(d.joinedAt),
    passportNo: d.passportNo || null,
    passportExpiry: optDate(d.passportExpiry),
    uaeResident: d.uaeResident === "on",
    emiratesIdNo: d.emiratesIdNo ? normalizeEmiratesId(d.emiratesIdNo) : null,
    emiratesIdExpiry: optDate(d.emiratesIdExpiry),
    residenceVisaExpiry: optDate(d.residenceVisaExpiry),
    sponsorId: d.sponsorId && d.sponsorId !== id ? d.sponsorId : null,
    priorRejections: d.priorRejections ? Number(d.priorRejections) : 0,
    travelHistory: (d.travelHistory ?? "").toUpperCase().split(/[\s,]+/).filter((c) => /^[A-Z]{2}$/.test(c)).join(","),
  };
  if (id) {
    const existing = await db.traveler.findFirst({ where: { id, enterpriseId: user.enterpriseId } });
    if (!existing) back("/app/customers", "error", "Traveler not found");
    await db.traveler.update({ where: { id }, data });
    await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "traveler.updated", "Traveler", id);
    const apps = await db.application.findMany({ where: { travelerId: id, status: { notIn: ["ISSUED", "REJECTED", "CANCELLED"] } } });
    for (const a of apps) await refreshRisk(a.id);
    revalidatePath(returnTo);
    back(returnTo, "ok", "Profile saved");
  }
  const created = await db.traveler.create({ data: { ...data, enterpriseId: user.enterpriseId } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "traveler.created", "Traveler", created.id);
  revalidatePath(returnTo);
  back(returnTo, "ok", `${created.firstName} added to the household`);
}

export async function rerunReview(formData: FormData) {
  const id = String(formData.get("id"));
  const returnTo = String(formData.get("returnTo") || "/app");
  const user = await requireMember("customers.manage");
  const doc = await db.travelerDocument.findFirst({ where: { id, traveler: { enterpriseId: user.enterpriseId } } });
  if (!doc) back(returnTo, "error", "Document not found");
  await db.travelerDocument.update({ where: { id }, data: { aiStatus: "PENDING", aiError: null } });
  after(() => runExtraction(id));
  back(returnTo, "ok", "AI review restarted");
}

/** Agent accepts a document despite findings (e.g. embassy confirmed it's fine). Recorded in the audit log. */
export async function overrideReview(formData: FormData) {
  const id = String(formData.get("id"));
  const returnTo = String(formData.get("returnTo") || "/app");
  const note = String(formData.get("note") ?? "").trim();
  const user = await requireMember("customers.manage");
  if (note.length < 5) back(returnTo, "error", "Add a short reason for accepting this document.");
  const doc = await db.travelerDocument.findFirst({ where: { id, traveler: { enterpriseId: user.enterpriseId } } });
  if (!doc) back(returnTo, "error", "Document not found");
  await db.travelerDocument.update({ where: { id }, data: { override: JSON.stringify({ by: user.name, note, at: new Date().toISOString() }) } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "document.review_overridden", "TravelerDocument", id, { note });
  revalidatePath(returnTo.split("?")[0]);
  back(returnTo, "ok", "Accepted with override");
}
