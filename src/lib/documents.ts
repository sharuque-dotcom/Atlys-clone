import "server-only";
import { after } from "next/server";
import { EncryptedPDFError, PDFDocument } from "pdf-lib";
import type { Traveler } from "@prisma/client";
import { db } from "./db";
import { putObject } from "./storage";
import { audit } from "./audit";
import { DOC_TYPES, type DocType } from "./types";
import { extractionFromMrz, runExtraction } from "./review";

export type UploadInput = {
  traveler: Traveler;
  type: string;
  file: unknown;
  mrz?: string;
  expiresAt?: Date | null;
  actor: { id?: string | null; name: string };
};

/**
 * Stores a document in a traveler's vault and queues the AI review. Shared by agency staff and the
 * customer self-service portal. The review runs after the response is sent, so uploads stay fast.
 */
export async function storeTravelerDocument({ traveler, type, file, mrz, expiresAt, actor }: UploadInput) {
  if (!DOC_TYPES.includes(type as DocType)) throw new Error("Unknown document type");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
  if (file.type === "application/pdf") {
    // Bank e-statements are often password-protected: neither the reviewer nor the print pack can open those.
    try {
      await PDFDocument.load(await file.arrayBuffer());
    } catch (e) {
      if (e instanceof EncryptedPDFError) throw new Error("This PDF is password-protected. Open it, choose Print → Save as PDF to remove the password, and upload that copy.");
      throw new Error("This PDF appears to be damaged — please export it again.");
    }
  }
  const stored = await putObject(traveler.enterpriseId, file);

  const fromMrz = type === "PASSPORT" && mrz?.trim() ? extractionFromMrz(mrz.trim()) : null;
  if (type === "PASSPORT" && mrz?.trim() && !fromMrz) throw new Error("That MRZ failed its check digits — check for typos (0/O, 1/I) or leave it blank and let the AI read the scan.");

  const doc = await db.travelerDocument.create({
    data: {
      travelerId: traveler.id,
      type,
      fileName: file.name.slice(0, 200),
      mimeType: file.type,
      size: stored.size,
      storageKey: stored.key,
      sha256: stored.sha256,
      expiresAt: expiresAt ?? (fromMrz?.expiryDate ? new Date(fromMrz.expiryDate) : null),
      extracted: fromMrz ? JSON.stringify(fromMrz) : null,
      aiStatus: "PENDING",
    },
  });
  await audit({ id: actor.id, name: actor.name, enterpriseId: traveler.enterpriseId }, "document.uploaded", "TravelerDocument", doc.id, { type, travelerId: traveler.id });
  after(() => runExtraction(doc.id));
  return doc;
}
