import "server-only";
import type { Traveler, TravelerDocument } from "@prisma/client";
import { db } from "../db";
import { getObject } from "../storage";
import { getProduct, type DocumentRequirementKey } from "../catalog";
import { parseTd3 } from "../mrz";
import { refreshRisk, type ChecklistItem } from "../applications";
import { AI_MODEL, aiConfigured, extractDocument, ExtractionError } from "./ai";
import { parseExtraction, type Extraction } from "./extraction";
import { reviewDocument, verdictOf, type Finding, type PersonFacts, type Verdict } from "./rules";

export type { Finding, Verdict };

const EMPTY: Omit<Extraction, "detectedType" | "readable"> = {
  qualityIssues: [], holderName: null, documentNumber: null, nationality: null, dateOfBirth: null, issueDate: null, expiryDate: null,
  mrz: null, linkedPassportNumber: null, sponsorOrEmployer: null, profession: null, monthlySalaryAed: null, letterDate: null,
  periodFrom: null, periodTo: null, closingBalanceAed: null, accountHolder: null, hasStampOrSignature: null, attested: null,
  coverageAmountEur: null, coversSchengen: null, parentNames: [], spouseNames: [], photo: null, notes: null,
};

/** A staff-pasted MRZ gives us a verified passport extraction immediately, before (or without) AI. */
export function extractionFromMrz(mrz: string): Extraction | null {
  const r = parseTd3(mrz);
  if (!r.valid) return null;
  return {
    ...EMPTY, detectedType: "PASSPORT", readable: true, mrz, holderName: `${r.fields.firstName} ${r.fields.lastName}`,
    documentNumber: r.fields.passportNo, nationality: r.fields.nationality.length === 2 ? r.fields.nationality : null,
    dateOfBirth: r.fields.dateOfBirth, expiryDate: r.fields.expiry,
  };
}

/** Reads a stored document with Claude, saves the extraction, fills empty profile fields. Safe to call in the background. */
export async function runExtraction(documentId: string) {
  const doc = await db.travelerDocument.findUnique({ where: { id: documentId }, include: { traveler: true } });
  if (!doc) return;
  if (!aiConfigured()) {
    await db.travelerDocument.update({ where: { id: doc.id }, data: { aiStatus: "SKIPPED", aiError: "AI review is not configured (set ANTHROPIC_API_KEY)." } });
    return;
  }
  try {
    const file = await getObject(doc.storageKey);
    const x = await extractDocument(file, doc.mimeType, doc.type);
    const prior = parseExtraction(doc.extracted);
    if (prior?.mrz && !x.mrz) x.mrz = prior.mrz; // keep a staff-verified MRZ
    await db.travelerDocument.update({
      where: { id: doc.id },
      data: {
        extracted: JSON.stringify(x), aiStatus: "DONE", aiError: null, aiModel: AI_MODEL, aiCheckedAt: new Date(),
        expiresAt: doc.expiresAt ?? (x.expiryDate ? new Date(x.expiryDate) : null),
      },
    });
    await fillProfile(doc.traveler, doc.type, x);
  } catch (e) {
    await db.travelerDocument.update({
      where: { id: doc.id },
      data: { aiStatus: "ERROR", aiError: e instanceof ExtractionError ? e.message : "AI review failed unexpectedly.", aiCheckedAt: new Date() },
    });
    if (!(e instanceof ExtractionError)) console.error("[ai-review]", e);
  }
  const apps = await db.application.findMany({ where: { travelerId: doc.travelerId, status: { in: ["DRAFT", "DOCS_PENDING", "IN_REVIEW"] } } });
  for (const a of apps) await refreshRisk(a.id);
}

/** Only fills blanks — conflicting values are surfaced as findings for a human to resolve. */
async function fillProfile(t: Traveler, type: string, x: Extraction) {
  if (x.detectedType !== type) return;
  const data: Partial<Traveler> = {};
  if (type === "PASSPORT") {
    if (!t.passportNo && x.documentNumber) data.passportNo = x.documentNumber;
    if (!t.passportExpiry && x.expiryDate) data.passportExpiry = new Date(x.expiryDate);
    if (!t.dateOfBirth && x.dateOfBirth) data.dateOfBirth = new Date(x.dateOfBirth);
  }
  if (type === "RESIDENCE_VISA" && !t.residenceVisaExpiry && x.expiryDate) data.residenceVisaExpiry = new Date(x.expiryDate);
  if (type === "EMIRATES_ID") {
    if (!t.emiratesIdExpiry && x.expiryDate) data.emiratesIdExpiry = new Date(x.expiryDate);
    if (!t.emiratesIdNo && x.documentNumber) data.emiratesIdNo = x.documentNumber;
  }
  if ((type === "SALARY_CERTIFICATE" || type === "NOC") && !t.employerName && x.sponsorOrEmployer) data.employerName = x.sponsorOrEmployer;
  if (Object.keys(data).length) await db.traveler.update({ where: { id: t.id }, data });
}

// ---------- evaluation (cheap, runs on every render so it always reflects current trip dates) ----------

export function personFacts(t: Traveler): PersonFacts {
  return {
    firstName: t.firstName, lastName: t.lastName, nationality: t.nationality, dateOfBirth: t.dateOfBirth, passportNo: t.passportNo,
    emiratesIdNo: t.emiratesIdNo, employerName: t.employerName, monthlySalaryAed: t.monthlySalaryAed, relationship: t.relationship,
  };
}

export type DocReview = {
  status: "PENDING" | "SKIPPED" | "ERROR" | Verdict;
  findings: Finding[];
  extraction: Extraction | null;
  overridden: { by: string; note: string; at: string } | null;
  error: string | null;
};

function latestByType(docs: TravelerDocument[]) {
  const out: Partial<Record<string, Extraction>> = {};
  for (const d of [...docs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const x = parseExtraction(d.extracted);
    if (x) out[d.type] = x;
  }
  return out;
}

export function reviewDoc(
  doc: TravelerDocument,
  traveler: Traveler & { documents: TravelerDocument[] },
  opts: { sponsor?: Traveler | null; trip?: { start: Date; end: Date; destination: string; productId?: string; familySize: number } | null; expected?: string } = {},
): DocReview {
  const overridden = doc.override ? (JSON.parse(doc.override) as DocReview["overridden"]) : null;
  const extraction = parseExtraction(doc.extracted);
  if (!extraction) {
    const status = doc.aiStatus === "ERROR" ? "ERROR" : doc.aiStatus === "SKIPPED" ? "SKIPPED" : "PENDING";
    return { status, findings: [], extraction: null, overridden, error: doc.aiError };
  }
  const findings = reviewDocument(extraction, {
    expected: (opts.expected ?? doc.type) as DocumentRequirementKey,
    traveler: personFacts(traveler),
    sponsor: opts.sponsor ? personFacts(opts.sponsor) : null,
    trip: opts.trip ? { ...opts.trip, product: opts.trip.productId ? getProduct(opts.trip.productId) : null } : null,
    related: latestByType(traveler.documents.filter((d) => d.id !== doc.id)),
  });
  return { status: verdictOf(findings, !!overridden), findings, extraction, overridden, error: doc.aiError };
}

export type ItemReview = ChecklistItem & { review: DocReview | null };

/** Reviews every checklist item of an application. Missing required documents count as blockers for the pack. */
export function reviewChecklist(
  items: ChecklistItem[],
  traveler: Traveler & { documents: TravelerDocument[] },
  ctx: { sponsor?: Traveler | null; trip: { start: Date; end: Date; destination: string; productId: string; familySize: number } },
) {
  const reviewed: ItemReview[] = items.map((i) => ({ ...i, review: i.satisfiedBy ? reviewDoc(i.satisfiedBy, traveler, { sponsor: ctx.sponsor, trip: ctx.trip, expected: i.key }) : null }));
  const blockers = reviewed.filter((i) => (i.required && !i.satisfiedBy && !i.autoGenerated) || i.review?.status === "REJECTED").length;
  const warnings = reviewed.filter((i) => i.review?.status === "WARNINGS").length;
  const pending = reviewed.filter((i) => i.review?.status === "PENDING").length;
  return { items: reviewed, blockers, warnings, pending, ready: blockers === 0 && pending === 0 };
}
