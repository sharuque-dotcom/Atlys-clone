// Document review rules. Pure and deterministic: the AI only READS documents (extraction.ts);
// every judgement about what's wrong — and how to fix it — is made here, in testable code.

import type { DocumentRequirementKey, VisaProduct } from "../catalog";
import { DOCUMENT_LABELS, isSchengen } from "../catalog";
import { country } from "../countries";
import { daysBetween } from "../dates";
import { parseTd3 } from "../mrz";
import { isValidEmiratesId } from "../validators";
import type { Extraction } from "./extraction";

export type Severity = "BLOCKER" | "WARNING" | "INFO";
export type Finding = { code: string; severity: Severity; message: string; fix?: string };
export type Verdict = "VERIFIED" | "WARNINGS" | "REJECTED";

export type PersonFacts = {
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth: Date | null;
  passportNo: string | null;
  emiratesIdNo: string | null;
  employerName: string | null;
  monthlySalaryAed: number | null;
  relationship: string;
};

export type ReviewContext = {
  expected: DocumentRequirementKey | "OTHER";
  traveler: PersonFacts;
  /** The family member who sponsors this traveler (dependents, minors) */
  sponsor?: PersonFacts | null;
  trip?: { start: Date; end: Date; destination: string; product?: VisaProduct | null; familySize: number } | null;
  /** Latest extraction of the traveler's other documents, by type (cross-document checks) */
  related: Partial<Record<string, Extraction>>;
  today?: Date;
};

// ---------- helpers ----------

const PARTICLES = new Set(["AL", "EL", "BIN", "BINT", "BEN", "ABD", "ABDUL", "DE", "DA", "VAN", "VON", "MR", "MRS", "MS", "MISS"]);

function tokens(name: string) {
  return name
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !PARTICLES.has(t));
}

function lev(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** 1 = same person's name, ~0.5 = partially matching (order/transliteration), 0 = different. Handles MOHAMMED/MOHAMED-style spelling. */
export function nameSimilarity(a: string, b: string) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.length || !B.length) return 0;
  const same = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 4 && lev(x, y) <= 1);
  const hits = A.filter((x) => B.some((y) => same(x, y))).length;
  return hits / Math.min(A.length, B.length);
}

const normNo = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const d = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00Z") : null);
const calendarDay = (x: Date) => new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
const fullName = (p: PersonFacts) => `${p.firstName} ${p.lastName}`;
const label = (k: string) => (k in DOCUMENT_LABELS ? DOCUMENT_LABELS[k as DocumentRequirementKey].en : k.toLowerCase());

/** Documents that must be issued recently to be accepted (days). */
const MAX_AGE_DAYS: Partial<Record<string, number>> = { NOC: 30, SALARY_CERTIFICATE: 30, BANK_STATEMENT: 30, INVITATION_LETTER: 90, SCHOOL_LETTER: 60 };
/** Whose name should be on this document? */
function expectedHolder(type: string, ctx: ReviewContext): PersonFacts | null {
  if (type === "BANK_STATEMENT" && ctx.sponsor && !["SELF"].includes(ctx.traveler.relationship) && ctx.traveler.monthlySalaryAed == null) return null; // either person's account is fine
  if (["SPONSORSHIP_LETTER", "SPONSOR_DOCUMENTS", "INVITATION_LETTER", "FLIGHT_RESERVATION", "HOTEL_BOOKING", "PARENTAL_CONSENT", "MARRIAGE_CERTIFICATE", "TRADE_LICENSE", "OTHER"].includes(type)) return null;
  return ctx.traveler;
}

// ---------- the review ----------

export function reviewDocument(x: Extraction, ctx: ReviewContext): Finding[] {
  const f: Finding[] = [];
  const today = calendarDay(ctx.today ?? new Date());
  const t = ctx.traveler;
  // Compare calendar days: trip dates may carry a time of day, document dates never do.
  const trip = ctx.trip ? { ...ctx.trip, start: calendarDay(ctx.trip.start), end: calendarDay(ctx.trip.end) } : null;
  const product = trip?.product ?? null;
  const exp = ctx.expected;
  const add = (code: string, severity: Severity, message: string, fix?: string) => f.push({ code, severity, message, fix });

  // 1. Is it even the right, readable document?
  if (exp !== "OTHER" && x.detectedType !== "OTHER" && x.detectedType !== exp && !(exp === "SPONSOR_DOCUMENTS" && ["PASSPORT", "EMIRATES_ID", "RESIDENCE_VISA"].includes(x.detectedType))) {
    add("WRONG_DOCUMENT", "BLOCKER", `This looks like a ${label(x.detectedType)}, not a ${label(exp)}.`, `Upload the ${label(exp)} here, and upload this file under ${label(x.detectedType)}.`);
    return f; // nothing else is meaningful
  }
  if (!x.readable) {
    add("UNREADABLE", "BLOCKER", "The document can't be read reliably.", "Re-scan in colour, flat, with all four corners visible and no glare.");
    return f;
  }
  for (const q of x.qualityIssues) add("QUALITY", "WARNING", `Image quality: ${q}.`, "Embassies reject unclear copies — re-scan or take a new photo in good light.");

  // 2. Right person?
  const holder = expectedHolder(exp, ctx);
  if (holder && x.holderName) {
    const sim = nameSimilarity(x.holderName, fullName(holder));
    if (sim === 0) add("NAME_MISMATCH", "BLOCKER", `Name on document "${x.holderName}" does not match ${fullName(holder)}.`, "Check it was uploaded for the right family member.");
    else if (sim < 1) add("NAME_PARTIAL", "WARNING", `Name on document "${x.holderName}" only partly matches the passport name ${fullName(holder)}.`, "Names must match the passport exactly across all documents — ask the issuer to correct it, or add a note in the cover letter.");
  }

  // 3. Expiry against the trip
  const expiry = d(x.expiryDate);
  if (expiry && expiry < today) {
    add("EXPIRED", "BLOCKER", `${label(exp)} expired on ${x.expiryDate}.`, exp === "PASSPORT" ? "Renew the passport first, then upload the new one." : "Renew it and upload the new copy.");
  } else if (expiry && trip && expiry < trip.end && !["FLIGHT_RESERVATION", "HOTEL_BOOKING", "TRAVEL_INSURANCE"].includes(exp)) {
    add("EXPIRES_DURING_TRIP", "BLOCKER", `${label(exp)} expires (${x.expiryDate}) before the return date.`, "Renew it before applying.");
  }

  // 4. Recency of letters/statements
  const maxAge = MAX_AGE_DAYS[exp];
  const issued = d(x.letterDate) ?? (exp === "BANK_STATEMENT" ? d(x.periodTo) : null);
  if (maxAge && issued && daysBetween(issued, today) > maxAge) {
    add("TOO_OLD", "WARNING", `${label(exp)} is dated ${daysBetween(issued, today)} days ago; embassies expect one issued within ${maxAge} days.`, "Ask for a freshly dated copy.");
  }
  if (["NOC", "SALARY_CERTIFICATE", "TRADE_LICENSE", "BIRTH_CERTIFICATE", "MARRIAGE_CERTIFICATE"].includes(exp) && x.hasStampOrSignature === false) {
    add("NO_STAMP", "BLOCKER", `${label(exp)} has no visible stamp or signature.`, "Get it signed and stamped by the issuer.");
  }

  // 5. Type-specific checks
  switch (exp) {
    case "PASSPORT": {
      const printed = normNo(x.documentNumber);
      if (x.mrz) {
        const m = parseTd3(x.mrz, today);
        if (!m.valid) add("MRZ_INVALID", "BLOCKER", "The passport's machine-readable zone failed its check digits.", "Usually a bad scan — re-scan the bio page. If it persists, the passport may be damaged.");
        else {
          if (printed && normNo(m.fields.passportNo) !== printed) add("MRZ_MISMATCH", "BLOCKER", `Passport number in the MRZ (${m.fields.passportNo}) differs from the printed number (${x.documentNumber}).`, "Re-scan; if it's genuine, the passport must be replaced.");
          if (m.fields.expiry && x.expiryDate && m.fields.expiry !== x.expiryDate) add("MRZ_MISMATCH", "BLOCKER", "Expiry date in the MRZ differs from the printed expiry date.", "Re-scan the bio page.");
        }
      }
      if (printed && t.passportNo && normNo(t.passportNo) !== printed) {
        add("NEW_PASSPORT", "WARNING", `Passport number ${x.documentNumber} differs from the profile (${t.passportNo}) — is this a new passport?`, "Update the traveler profile. If the UAE residence visa is still on the old passport, see the residence visa check.");
      }
      if (x.dateOfBirth && t.dateOfBirth && x.dateOfBirth !== t.dateOfBirth.toISOString().slice(0, 10)) {
        add("DOB_MISMATCH", "WARNING", `Date of birth on passport (${x.dateOfBirth}) differs from the profile.`, "Correct the profile — every form must match the passport.");
      }
      if (x.nationality && x.nationality.length === 2 && x.nationality !== t.nationality) {
        add("NATIONALITY_MISMATCH", "BLOCKER", `This is a ${country(x.nationality).en} passport but the profile says ${country(t.nationality).en}.`, "Fix the profile nationality — visa requirements change completely by passport.");
      }
      if (expiry && trip && product && product.passportValidityBeyondReturnDays > 0) {
        const margin = daysBetween(trip.end, expiry);
        if (margin >= 0 && margin < product.passportValidityBeyondReturnDays) {
          add("PASSPORT_VALIDITY", "BLOCKER", `Passport is valid only ${margin} days after return; ${country(trip.destination).en} requires ${product.passportValidityBeyondReturnDays}.`, "Renew the passport before applying.");
        }
      }
      break;
    }
    case "RESIDENCE_VISA": {
      const passport = ctx.related.PASSPORT;
      const currentNo = normNo(passport?.documentNumber) || normNo(t.passportNo);
      const linked = normNo(x.linkedPassportNumber);
      if (linked && currentNo && linked !== currentNo) {
        add(
          "VISA_ON_OLD_PASSPORT",
          "BLOCKER",
          `The UAE residence visa is issued under passport ${x.linkedPassportNumber}, but the current passport is ${passport?.documentNumber ?? t.passportNo}.`,
          "Transfer the residence visa to the new passport (ICP / GDRFA), or submit the old passport together with the new one — most embassies refuse otherwise.",
        );
      }
      if (expiry && trip && product?.residenceValidityBeyondReturnDays) {
        const margin = daysBetween(trip.end, expiry);
        if (margin >= 0 && margin < product.residenceValidityBeyondReturnDays) {
          add("RESIDENCE_VALIDITY", "WARNING", `Residence visa is valid ${margin} days after return; the consulate expects ${product.residenceValidityBeyondReturnDays}.`, "Renew the residence visa first, or attach the renewal application receipt.");
        }
      }
      const noc = ctx.related.NOC ?? ctx.related.SALARY_CERTIFICATE;
      if (x.sponsorOrEmployer && noc?.sponsorOrEmployer && ["SELF"].includes(t.relationship) && nameSimilarity(x.sponsorOrEmployer, noc.sponsorOrEmployer) === 0) {
        add("EMPLOYER_MISMATCH", "WARNING", `Visa sponsor "${x.sponsorOrEmployer}" differs from the employer on the NOC/salary certificate ("${noc.sponsorOrEmployer}").`, "If the employee changed jobs, the visa must be transferred; otherwise explain in the cover letter.");
      }
      break;
    }
    case "EMIRATES_ID": {
      if (x.documentNumber && !isValidEmiratesId(x.documentNumber)) add("EID_INVALID", "BLOCKER", `Emirates ID number ${x.documentNumber} is not valid.`, "Re-scan the front side clearly.");
      if (x.documentNumber && t.emiratesIdNo && normNo(x.documentNumber) !== normNo(t.emiratesIdNo)) add("EID_DIFFERS", "WARNING", "Emirates ID number differs from the profile.", "Update the profile with the number on the card.");
      break;
    }
    case "PHOTO": {
      if (x.photo && !x.photo.whiteBackground) add("PHOTO_BACKGROUND", "BLOCKER", "Photo background is not plain white.", "Retake against a white wall — most VFS/TLS centres reject coloured backgrounds.");
      if (x.photo?.wearingGlasses) add("PHOTO_GLASSES", "WARNING", "Applicant is wearing glasses.", "Schengen, UK and US photos should be taken without glasses.");
      if (x.photo && !x.photo.faceCentered) add("PHOTO_FRAMING", "WARNING", "Face is not centred / correctly framed.", "Head should fill 70–80% of the frame, looking straight at the camera.");
      break;
    }
    case "NOC":
    case "SALARY_CERTIFICATE": {
      if (x.monthlySalaryAed && t.monthlySalaryAed && Math.abs(x.monthlySalaryAed - t.monthlySalaryAed) / t.monthlySalaryAed > 0.05) {
        add("SALARY_DIFFERS", "WARNING", `Salary on the ${label(exp)} (AED ${x.monthlySalaryAed.toLocaleString()}) differs from the profile (AED ${t.monthlySalaryAed.toLocaleString()}).`, "All documents must show the same salary — correct the profile or the letter.");
      }
      const other = exp === "NOC" ? ctx.related.SALARY_CERTIFICATE : ctx.related.NOC;
      if (x.monthlySalaryAed && other?.monthlySalaryAed && x.monthlySalaryAed !== other.monthlySalaryAed) {
        add("SALARY_INCONSISTENT", "BLOCKER", `NOC and salary certificate show different salaries (AED ${x.monthlySalaryAed.toLocaleString()} vs AED ${other.monthlySalaryAed.toLocaleString()}).`, "Ask the employer to reissue so both match the bank statement credits.");
      }
      if (exp === "NOC" && trip) {
        const from = d(x.periodFrom);
        const to = d(x.periodTo);
        if (from && to && (from > trip.start || to < trip.end)) add("NOC_DATES", "BLOCKER", `NOC leave dates (${x.periodFrom} → ${x.periodTo}) don't cover the trip.`, "Ask the employer to reissue with the exact travel dates.");
        if (!from && !to) add("NOC_NO_DATES", "WARNING", "NOC doesn't state the leave dates.", "Most Schengen consulates want the approved leave period in the NOC.");
      }
      break;
    }
    case "BANK_STATEMENT": {
      const from = d(x.periodFrom);
      const to = d(x.periodTo);
      if (from && to) {
        const months = Math.round(daysBetween(from, to) / 30.4);
        if (months < 3) add("STATEMENT_SHORT", "BLOCKER", `Statement covers only ${months} month(s).`, "Provide the last 6 months.");
        else if (months < 6) add("STATEMENT_SHORT", "WARNING", `Statement covers ${months} months; most embassies ask for 6.`, "Provide the last 6 months.");
      }
      if (x.accountHolder) {
        const own = nameSimilarity(x.accountHolder, fullName(t));
        const spons = ctx.sponsor ? nameSimilarity(x.accountHolder, fullName(ctx.sponsor)) : 0;
        if (own === 0 && spons === 0) add("ACCOUNT_HOLDER", "WARNING", `Account holder "${x.accountHolder}" is neither the traveler nor their sponsor.`, "Upload the traveler's or sponsor's own statement.");
      }
      if (trip && product?.recommendedMinSalaryAed && x.closingBalanceAed != null) {
        const days = Math.max(1, daysBetween(trip.start, trip.end) + 1);
        const needed = 1000 * days * Math.max(1, trip.familySize);
        if (x.closingBalanceAed < needed) add("LOW_BALANCE", "WARNING", `Closing balance AED ${x.closingBalanceAed.toLocaleString()} is low for ${trip.familySize > 1 ? `${trip.familySize} people` : "one person"} over ${days} days (≈ AED ${needed.toLocaleString()} recommended).`, "Top up the account before the statement date, or add a sponsor's / fixed-deposit statement.");
      }
      if (x.hasStampOrSignature === false) add("NO_STAMP", "WARNING", "Statement is not bank-stamped.", "Get it stamped at the branch, or use the bank's e-statement with a verification code.");
      break;
    }
    case "TRAVEL_INSURANCE": {
      if (trip && isSchengen(trip.destination)) {
        if (x.coverageAmountEur != null && x.coverageAmountEur < 30000) add("INSURANCE_COVER", "BLOCKER", `Medical cover €${x.coverageAmountEur.toLocaleString()} is below the €30,000 Schengen minimum.`, "Buy a Schengen-compliant policy.");
        if (x.coversSchengen === false) add("INSURANCE_AREA", "BLOCKER", "Policy does not cover the whole Schengen area.", "Policy must be valid in all Schengen states.");
      }
      const from = d(x.periodFrom);
      const to = d(x.periodTo);
      if (trip && from && to && (from > trip.start || to < trip.end)) add("INSURANCE_DATES", "BLOCKER", `Insurance (${x.periodFrom} → ${x.periodTo}) doesn't cover the whole trip.`, "Extend the policy to cover every travel day.");
      break;
    }
    case "FLIGHT_RESERVATION":
    case "HOTEL_BOOKING": {
      const from = d(x.periodFrom);
      const to = d(x.periodTo);
      if (trip && from && to && (from.toISOString().slice(0, 10) !== trip.start.toISOString().slice(0, 10) || to.toISOString().slice(0, 10) !== trip.end.toISOString().slice(0, 10))) {
        add("DATES_DIFFER", "WARNING", `${label(exp)} dates (${x.periodFrom} → ${x.periodTo}) differ from the application's travel dates.`, "All documents and the form must show the same dates.");
      }
      break;
    }
    case "BIRTH_CERTIFICATE": {
      if (ctx.sponsor && x.parentNames.length && !x.parentNames.some((p) => nameSimilarity(p, fullName(ctx.sponsor!)) > 0)) {
        add("PARENT_NOT_LISTED", "WARNING", `The sponsoring parent (${fullName(ctx.sponsor)}) is not named as a parent on the birth certificate.`, "Upload the birth certificate that names the sponsoring parent, or add proof of guardianship.");
      }
      if (x.attested === false && t.nationality !== "AE") add("NOT_ATTESTED", "WARNING", "No attestation stamp visible on the birth certificate.", "Foreign-issued certificates usually need MOFA UAE attestation.");
      break;
    }
    case "MARRIAGE_CERTIFICATE": {
      if (x.spouseNames.length && !x.spouseNames.some((p) => nameSimilarity(p, fullName(t)) > 0)) add("SPOUSE_NOT_LISTED", "BLOCKER", `${fullName(t)} is not named on this marriage certificate.`, "Upload the correct certificate.");
      if (ctx.sponsor && x.spouseNames.length && !x.spouseNames.some((p) => nameSimilarity(p, fullName(ctx.sponsor!)) > 0)) add("SPONSOR_NOT_LISTED", "WARNING", `The sponsor (${fullName(ctx.sponsor)}) is not named on this marriage certificate.`);
      if (x.attested === false) add("NOT_ATTESTED", trip && (isSchengen(trip.destination) || trip.destination === "GB") ? "BLOCKER" : "WARNING", "Marriage certificate is not attested.", "Get MOFA UAE attestation (and home-country attestation if issued abroad) — a common reason for Schengen refusals.");
      break;
    }
  }
  return f;
}

export function verdictOf(findings: Finding[], overridden = false): Verdict {
  if (findings.some((x) => x.severity === "BLOCKER") && !overridden) return "REJECTED";
  if (findings.some((x) => x.severity !== "INFO")) return "WARNINGS";
  return "VERIFIED";
}
