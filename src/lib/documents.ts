import "server-only";
import type { Traveler } from "@prisma/client";
import { db } from "./db";
import { putObject } from "./storage";
import { audit } from "./audit";
import { parseTd3 } from "./mrz";
import { DOC_TYPES, type DocType } from "./types";
import { refreshRisk } from "./applications";

export type UploadInput = {
  traveler: Traveler;
  type: string;
  file: unknown;
  mrz?: string;
  expiresAt?: Date | null;
  actor: { id?: string | null; name: string };
};

/**
 * Stores a document in a traveler's vault. Shared by agency staff and the customer self-service portal.
 * Passports: the MRZ is verified (check digits) and, when valid, auto-fills the traveler profile.
 * Returns a human-readable note, or throws with a user-facing message.
 */
export async function storeTravelerDocument({ traveler, type, file, mrz, expiresAt, actor }: UploadInput) {
  if (!DOC_TYPES.includes(type as DocType)) throw new Error("Unknown document type");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
  const stored = await putObject(traveler.enterpriseId, file);

  let extracted: Record<string, unknown> | null = null;
  let docExpiry = expiresAt ?? null;
  if (type === "PASSPORT" && mrz?.trim()) {
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
  if (type === "PASSPORT" && docExpiry && !extracted) await db.traveler.update({ where: { id: traveler.id }, data: { passportExpiry: docExpiry } });
  if (type === "RESIDENCE_VISA" && docExpiry) await db.traveler.update({ where: { id: traveler.id }, data: { residenceVisaExpiry: docExpiry } });
  if (type === "EMIRATES_ID" && docExpiry) await db.traveler.update({ where: { id: traveler.id }, data: { emiratesIdExpiry: docExpiry } });

  const doc = await db.travelerDocument.create({
    data: {
      travelerId: traveler.id,
      type,
      fileName: file.name.slice(0, 200),
      mimeType: file.type,
      size: stored.size,
      storageKey: stored.key,
      sha256: stored.sha256,
      expiresAt: docExpiry,
      extracted: extracted ? JSON.stringify(extracted) : null,
    },
  });
  await audit({ id: actor.id, name: actor.name, enterpriseId: traveler.enterpriseId }, "document.uploaded", "TravelerDocument", doc.id, { type, travelerId: traveler.id });

  // New documents unblock applications waiting on them and change the risk picture.
  const apps = await db.application.findMany({ where: { travelerId: traveler.id, status: { in: ["DRAFT", "DOCS_PENDING", "IN_REVIEW"] } } });
  for (const a of apps) await refreshRisk(a.id);

  if (!extracted) return "Document uploaded";
  return extracted.mrzValid ? "Passport uploaded — details read from the MRZ" : "Passport uploaded, but the MRZ could not be verified — please check the details";
}
