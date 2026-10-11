// ICAO 9303 TD3 (passport) machine-readable-zone parser with check-digit validation.
// Used to auto-fill traveler profiles from an uploaded passport scan (after OCR) or a pasted MRZ.

import { ALPHA3_TO_ALPHA2 } from "./countries";

const WEIGHTS = [7, 3, 1];

function charValue(c: string) {
  if (c === "<") return 0;
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return -1;
}

export function checkDigit(input: string) {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const v = charValue(input[i]);
    if (v < 0) return -1;
    sum += v * WEIGHTS[i % 3];
  }
  return sum % 10;
}

export type MrzResult = {
  valid: boolean;
  errors: string[];
  fields: {
    documentType: string;
    issuingCountry: string;
    lastName: string;
    firstName: string;
    passportNo: string;
    nationality: string; // alpha-2 when known
    dateOfBirth: string | null; // ISO yyyy-mm-dd
    gender: "MALE" | "FEMALE" | "UNSPECIFIED";
    expiry: string | null;
    personalNumber: string;
  };
};

function parseDate(yymmdd: string, kind: "birth" | "expiry", now = new Date()): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const currentYY = now.getUTCFullYear() % 100;
  let century: number;
  if (kind === "birth") century = yy > currentYY ? 1900 : 2000;
  else century = yy < 70 ? 2000 : 1900; // passports expire at most ~10 years ahead
  const y = century + yy;
  return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function toAlpha2(a3: string) {
  const code = a3.replace(/</g, "");
  return ALPHA3_TO_ALPHA2[a3] ?? ALPHA3_TO_ALPHA2[code] ?? code;
}

export function parseTd3(raw: string, now = new Date()): MrzResult {
  const lines = raw
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ""))
    .filter(Boolean);
  const errors: string[] = [];
  const empty: MrzResult["fields"] = {
    documentType: "", issuingCountry: "", lastName: "", firstName: "", passportNo: "", nationality: "",
    dateOfBirth: null, gender: "UNSPECIFIED", expiry: null, personalNumber: "",
  };
  if (lines.length !== 2 || lines[0].length !== 44 || lines[1].length !== 44) {
    return { valid: false, errors: ["MRZ must be two lines of 44 characters (TD3 passport)."], fields: empty };
  }
  const [l1, l2] = lines;
  if (l1[0] !== "P") errors.push("Line 1 must start with 'P' for a passport.");

  const names = l1.slice(5).split("<<");
  const lastName = (names[0] ?? "").replace(/</g, " ").trim();
  const firstName = names.slice(1).join(" ").replace(/</g, " ").replace(/\s+/g, " ").trim();

  const passportNo = l2.slice(0, 9);
  const dob = l2.slice(13, 19);
  const exp = l2.slice(21, 27);
  const personal = l2.slice(28, 42);

  if (checkDigit(passportNo) !== Number(l2[9])) errors.push("Passport number check digit mismatch.");
  if (checkDigit(dob) !== Number(l2[19])) errors.push("Date of birth check digit mismatch.");
  if (checkDigit(exp) !== Number(l2[27])) errors.push("Expiry date check digit mismatch.");
  const personalCd = l2[42] === "<" ? 0 : Number(l2[42]);
  if (checkDigit(personal) !== personalCd) errors.push("Personal number check digit mismatch.");
  const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);
  if (checkDigit(composite) !== Number(l2[43])) errors.push("Composite check digit mismatch.");

  const sex = l2[20];
  return {
    valid: errors.length === 0,
    errors,
    fields: {
      documentType: l1.slice(0, 2).replace(/</g, ""),
      issuingCountry: toAlpha2(l1.slice(2, 5)),
      lastName,
      firstName,
      passportNo: passportNo.replace(/</g, ""),
      nationality: toAlpha2(l2.slice(10, 13)),
      dateOfBirth: parseDate(dob, "birth", now),
      gender: sex === "M" ? "MALE" : sex === "F" ? "FEMALE" : "UNSPECIFIED",
      expiry: parseDate(exp, "expiry", now),
      personalNumber: personal.replace(/</g, ""),
    },
  };
}

/** Finds a TD3 MRZ inside arbitrary OCR text. */
export function findMrz(text: string): string | null {
  const candidates = text
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, "").replace(/[«‹]/g, "<"))
    .filter((l) => /^[A-Z0-9<]{44}$/.test(l));
  for (let i = 0; i < candidates.length - 1; i++) {
    if (candidates[i].startsWith("P")) return `${candidates[i]}\n${candidates[i + 1]}`;
  }
  return null;
}
