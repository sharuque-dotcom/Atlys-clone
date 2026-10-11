"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { putObject } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { parseTd3 } from "@/lib/mrz";
import { DOC_TYPES } from "@/lib/types";
import { refreshRisk } from "@/lib/applications";
import { isValidEmiratesId, normalizeEmiratesId, normalizeUaeMobile } from "@/lib/validators";
import { can } from "@/lib/types";

function back(to: string, key: "ok" | "error", msg: string): never {
  redirect(`${to}${to.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
}

async function loadTraveler(travelerId: string) {
  const user = await requireMember();
  const traveler = await db.traveler.findFirst({ where: { id: travelerId, enterpriseId: user.enterpriseId } });
  if (!traveler) throw new Error("Traveler not found");
  if (!can(user.role, "travelers.manage") && traveler.userId !== user.id) throw new Error("Not allowed");
  return { user, traveler };
}

export async function uploadDocument(formData: FormData) {
  const travelerId = String(formData.get("travelerId"));
  const returnTo = String(formData.get("returnTo") || `/app/travelers/${travelerId}`);
  const type = String(formData.get("type"));
  const file = formData.get("file");
  const mrz = String(formData.get("mrz") ?? "").trim();
  const expiresAt = formData.get("expiresAt") ? new Date(String(formData.get("expiresAt"))) : null;
  const { user, traveler } = await loadTraveler(travelerId);
  if (!DOC_TYPES.includes(type as (typeof DOC_TYPES)[number])) back(returnTo, "error", "Unknown document type");
  if (!(file instanceof File) || file.size === 0) back(returnTo, "error", "Choose a file to upload.");

  let stored;
  try {
    stored = await putObject(user.enterpriseId, file);
  } catch (e) {
    back(returnTo, "error", e instanceof Error ? e.message : "Upload failed");
  }

  // Passport: read the MRZ (pasted from the scan / produced by OCR) and auto-fill the profile.
  let extracted: Record<string, unknown> | null = null;
  let docExpiry = expiresAt;
  if (type === "PASSPORT" && mrz) {
    const r = parseTd3(mrz);
    extracted = { mrzValid: r.valid, mrzErrors: r.errors, ...r.fields };
    if (r.valid) {
      docExpiry = r.fields.expiry ? new Date(r.fields.expiry) : docExpiry;
      await db.traveler.update({
        where: { id: traveler.id },
        data: {
          passportNo: r.fields.passportNo,
          passportExpiry: r.fields.expiry ? new Date(r.fields.expiry) : undefined,
          dateOfBirth: r.fields.dateOfBirth ? new Date(r.fields.dateOfBirth) : undefined,
          nationality: r.fields.nationality.length === 2 ? r.fields.nationality : undefined,
          gender: r.fields.gender !== "UNSPECIFIED" ? r.fields.gender : undefined,
        },
      });
    }
  }
  if (type === "PASSPORT" && docExpiry && !mrz) await db.traveler.update({ where: { id: traveler.id }, data: { passportExpiry: docExpiry } });
  if (type === "RESIDENCE_VISA" && docExpiry) await db.traveler.update({ where: { id: traveler.id }, data: { residenceVisaExpiry: docExpiry } });
  if (type === "EMIRATES_ID" && docExpiry) await db.traveler.update({ where: { id: traveler.id }, data: { emiratesIdExpiry: docExpiry } });

  const doc = await db.travelerDocument.create({
    data: {
      travelerId: traveler.id,
      type,
      fileName: (file as File).name.slice(0, 200),
      mimeType: (file as File).type,
      size: stored!.size,
      storageKey: stored!.key,
      sha256: stored!.sha256,
      expiresAt: docExpiry,
      extracted: extracted ? JSON.stringify(extracted) : null,
    },
  });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "document.uploaded", "TravelerDocument", doc.id, { type, travelerId });

  // Documents unblock applications waiting on them, and change the risk picture.
  const apps = await db.application.findMany({ where: { travelerId: traveler.id, status: { in: ["DOCS_PENDING", "IN_REVIEW", "PENDING_APPROVAL"] } } });
  for (const a of apps) await refreshRisk(a.id);

  revalidatePath(returnTo.split("?")[0]);
  const note = extracted && type === "PASSPORT" ? (extracted.mrzValid ? " — profile auto-filled from MRZ" : " — MRZ could not be verified, please check details") : "";
  back(returnTo, "ok", `Document uploaded${note}`);
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await requireMember("travelers.manage");
  const doc = await db.travelerDocument.findFirst({ where: { id, traveler: { enterpriseId: user.enterpriseId } } });
  if (!doc) back("/app/travelers", "error", "Document not found");
  await db.travelerDocument.delete({ where: { id } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "document.deleted", "TravelerDocument", id, { type: doc!.type });
  revalidatePath(`/app/travelers/${doc!.travelerId}`);
  back(`/app/travelers/${doc!.travelerId}`, "ok", "Document removed");
}

const travelerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  nationality: z.string().length(2, "Pick a nationality"),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  employeeId: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  monthlySalaryAed: z.string().optional(),
  joinedAt: z.string().optional(),
  passportNo: z.string().trim().optional(),
  passportExpiry: z.string().optional(),
  uaeResident: z.string().optional(),
  emiratesIdNo: z.string().trim().optional(),
  emiratesIdExpiry: z.string().optional(),
  residenceVisaExpiry: z.string().optional(),
  priorRejections: z.string().optional(),
  travelHistory: z.string().optional(),
  branchId: z.string().optional(),
  managerId: z.string().optional(),
});

const optDate = (v?: string) => (v ? new Date(v) : null);

export async function saveTraveler(formData: FormData) {
  const user = await requireMember("travelers.manage");
  const id = String(formData.get("id") ?? "");
  const returnTo = id ? `/app/travelers/${id}` : "/app/travelers";
  const parsed = travelerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(returnTo, "error", parsed.error.issues[0].message);
  const d = parsed.data!;
  const phone = d.phone ? normalizeUaeMobile(d.phone) ?? d.phone : null;
  if (d.emiratesIdNo && !isValidEmiratesId(d.emiratesIdNo)) back(returnTo, "error", "Emirates ID number is invalid (should be 784-YYYY-NNNNNNN-C).");
  const data = {
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email || null,
    phone,
    nationality: d.nationality.toUpperCase(),
    gender: d.gender || null,
    dateOfBirth: optDate(d.dateOfBirth),
    employeeId: d.employeeId || null,
    designation: d.designation || null,
    department: d.department || null,
    monthlySalaryAed: d.monthlySalaryAed ? Number(d.monthlySalaryAed) : null,
    joinedAt: optDate(d.joinedAt),
    passportNo: d.passportNo || null,
    passportExpiry: optDate(d.passportExpiry),
    uaeResident: d.uaeResident === "on",
    emiratesIdNo: d.emiratesIdNo ? normalizeEmiratesId(d.emiratesIdNo) : null,
    emiratesIdExpiry: optDate(d.emiratesIdExpiry),
    residenceVisaExpiry: optDate(d.residenceVisaExpiry),
    priorRejections: d.priorRejections ? Number(d.priorRejections) : 0,
    travelHistory: (d.travelHistory ?? "").toUpperCase().split(/[\s,]+/).filter((c) => /^[A-Z]{2}$/.test(c)).join(","),
    branchId: d.branchId || null,
    managerId: d.managerId || null,
  };
  if (id) {
    const existing = await db.traveler.findFirst({ where: { id, enterpriseId: user.enterpriseId } });
    if (!existing) back("/app/travelers", "error", "Traveler not found");
    await db.traveler.update({ where: { id }, data });
    await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "traveler.updated", "Traveler", id);
    const apps = await db.application.findMany({ where: { travelerId: id, status: { notIn: ["ISSUED", "REJECTED", "CANCELLED"] } } });
    for (const a of apps) await refreshRisk(a.id);
    revalidatePath(returnTo);
    back(returnTo, "ok", "Profile saved");
  }
  const created = await db.traveler.create({ data: { ...data, enterpriseId: user.enterpriseId } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "traveler.created", "Traveler", created.id);
  redirect(`/app/travelers/${created.id}?ok=Traveler+added`);
}

/** CSV columns: first_name,last_name,email,phone,nationality,designation,department,employee_id,monthly_salary_aed,passport_no,passport_expiry,residence_visa_expiry */
export async function importTravelers(formData: FormData) {
  const user = await requireMember("travelers.manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back("/app/travelers", "error", "Choose a CSV file.");
  const text = await (file as File).text();
  const rows = text.split(/\r?\n/).filter((l) => l.trim());
  const header = rows.shift()?.split(",").map((h) => h.trim().toLowerCase()) ?? [];
  const idx = (k: string) => header.indexOf(k);
  let created = 0;
  const errors: string[] = [];
  for (const [n, line] of rows.entries()) {
    const c = line.split(",").map((x) => x.trim());
    const get = (k: string) => (idx(k) >= 0 ? c[idx(k)] : "") || "";
    const nat = get("nationality").toUpperCase();
    if (!get("first_name") || !/^[A-Z]{2}$/.test(nat)) { errors.push(`row ${n + 2}`); continue; }
    await db.traveler.create({
      data: {
        enterpriseId: user.enterpriseId,
        firstName: get("first_name"),
        lastName: get("last_name"),
        email: get("email") || null,
        phone: normalizeUaeMobile(get("phone")) ?? (get("phone") || null),
        nationality: nat,
        designation: get("designation") || null,
        department: get("department") || null,
        employeeId: get("employee_id") || null,
        monthlySalaryAed: get("monthly_salary_aed") ? Number(get("monthly_salary_aed")) : null,
        passportNo: get("passport_no") || null,
        passportExpiry: get("passport_expiry") ? new Date(get("passport_expiry")) : null,
        residenceVisaExpiry: get("residence_visa_expiry") ? new Date(get("residence_visa_expiry")) : null,
        uaeResident: true,
      },
    });
    created++;
  }
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "traveler.imported", "Traveler", null, { created, errors: errors.length });
  revalidatePath("/app/travelers");
  back("/app/travelers", errors.length ? "error" : "ok", `${created} travelers imported${errors.length ? `; skipped ${errors.join(", ")} (missing name or nationality)` : ""}`);
}
