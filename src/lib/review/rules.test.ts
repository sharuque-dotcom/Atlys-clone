import { describe, expect, it } from "vitest";
import { nameSimilarity, reviewDocument, verdictOf, type ReviewContext } from "./rules";
import type { Extraction } from "./extraction";
import { getProduct } from "../catalog";
import { luhnValid } from "../validators";

const base: Extraction = {
  detectedType: "PASSPORT", readable: true, qualityIssues: [], holderName: "ROHAN MEHTA", documentNumber: "Z4821936", nationality: "IN",
  dateOfBirth: "1987-05-12", issueDate: "2020-01-01", expiryDate: "2030-01-01", mrz: null, linkedPassportNumber: null, sponsorOrEmployer: null,
  profession: null, monthlySalaryAed: null, letterDate: null, periodFrom: null, periodTo: null, closingBalanceAed: null, accountHolder: null,
  hasStampOrSignature: null, attested: null, coverageAmountEur: null, coversSchengen: null, parentNames: [], spouseNames: [], photo: null, notes: null,
};
const rohan = { firstName: "Rohan", lastName: "Mehta", nationality: "IN", dateOfBirth: new Date("1987-05-12"), passportNo: "Z4821936", emiratesIdNo: null, employerName: "Gulf Engineering", monthlySalaryAed: 26000, relationship: "SELF" };
const ctx = (over: Partial<ReviewContext> = {}): ReviewContext => ({
  expected: "PASSPORT",
  traveler: rohan,
  trip: { start: new Date("2026-12-01"), end: new Date("2026-12-10"), destination: "FR", product: getProduct("FR-schengen-c"), familySize: 4 },
  related: {},
  today: new Date("2026-10-11"),
  ...over,
});
const codes = (x: Extraction, c: ReviewContext) => reviewDocument(x, c).map((f) => f.code);

describe("name matching", () => {
  it("tolerates transliteration and order", () => {
    expect(nameSimilarity("MOHAMED AHMED", "Mohammed Ahmed")).toBe(1);
    expect(nameSimilarity("MEHTA ROHAN KUMAR", "Rohan Mehta")).toBe(1);
    expect(nameSimilarity("Priya Mehta", "Rohan Mehta")).toBe(0.5);
    expect(nameSimilarity("John Smith", "Rohan Mehta")).toBe(0);
  });
});

describe("document review", () => {
  it("passes a clean passport", () => {
    expect(reviewDocument(base, ctx())).toEqual([]);
    expect(verdictOf([])).toBe("VERIFIED");
  });
  it("rejects the wrong document type outright", () => {
    expect(codes({ ...base, detectedType: "EMIRATES_ID" }, ctx())).toEqual(["WRONG_DOCUMENT"]);
  });
  it("flags passport validity below the Schengen 90-day rule", () => {
    expect(codes({ ...base, expiryDate: "2027-01-20" }, ctx())).toContain("PASSPORT_VALIDITY");
  });
  it("flags a passport for another family member", () => {
    expect(codes({ ...base, holderName: "ANAYA SHARMA" }, ctx())).toContain("NAME_MISMATCH");
  });
  it("detects a tampered / misread MRZ", () => {
    const mrz = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C46UTO7408122F1204159ZE184226B<<<<<10";
    expect(codes({ ...base, mrz }, ctx())).toContain("MRZ_INVALID");
  });
  it("catches a residence visa still on the OLD passport", () => {
    const visa = { ...base, detectedType: "RESIDENCE_VISA" as const, documentNumber: "201/2023/1234567", linkedPassportNumber: "K1122334", expiryDate: "2028-06-01" };
    const f = reviewDocument(visa, ctx({ expected: "RESIDENCE_VISA", related: { PASSPORT: base } }));
    expect(f.find((x) => x.code === "VISA_ON_OLD_PASSPORT")?.severity).toBe("BLOCKER");
    expect(f.find((x) => x.code === "VISA_ON_OLD_PASSPORT")?.fix).toMatch(/transfer/i);
  });
  it("validates the Emirates ID number", () => {
    let valid = "";
    for (let i = 0; i <= 9; i++) if (luhnValid("78419875551234" + i)) valid = "78419875551234" + i;
    const eid = { ...base, detectedType: "EMIRATES_ID" as const, mrz: null, expiryDate: "2028-01-01" };
    expect(codes({ ...eid, documentNumber: valid }, ctx({ expected: "EMIRATES_ID" }))).not.toContain("EID_INVALID");
    expect(codes({ ...eid, documentNumber: "784-1987-5551234-0".replace(/.$/, String((Number(valid.at(-1)) + 1) % 10)) }, ctx({ expected: "EMIRATES_ID" }))).toContain("EID_INVALID");
  });
  it("checks NOC dates, recency, stamp and salary consistency", () => {
    const noc = { ...base, detectedType: "NOC" as const, documentNumber: null, expiryDate: null, letterDate: "2026-08-01", periodFrom: "2026-12-02", periodTo: "2026-12-09", hasStampOrSignature: false, monthlySalaryAed: 30000 };
    const c = codes(noc, ctx({ expected: "NOC", related: { SALARY_CERTIFICATE: { ...noc, detectedType: "SALARY_CERTIFICATE", monthlySalaryAed: 26000 } } }));
    expect(c).toEqual(expect.arrayContaining(["TOO_OLD", "NO_STAMP", "NOC_DATES", "SALARY_DIFFERS", "SALARY_INCONSISTENT"]));
  });
  it("treats trip dates by calendar day (no false NOC-date flags from time of day)", () => {
    const noc = { ...base, detectedType: "NOC" as const, documentNumber: null, expiryDate: null, letterDate: "2026-10-05", periodFrom: "2026-12-01", periodTo: "2026-12-10", hasStampOrSignature: true };
    const c = ctx({ expected: "NOC", trip: { start: new Date("2026-12-01T13:45:00Z"), end: new Date("2026-12-10T13:45:00Z"), destination: "FR", product: getProduct("FR-schengen-c"), familySize: 1 } });
    expect(codes(noc, c)).not.toContain("NOC_DATES");
  });
  it("checks bank statement period and funds for the family", () => {
    const bs = { ...base, detectedType: "BANK_STATEMENT" as const, documentNumber: null, expiryDate: null, accountHolder: "ROHAN MEHTA", periodFrom: "2026-07-01", periodTo: "2026-10-01", closingBalanceAed: 12000 };
    expect(codes(bs, ctx({ expected: "BANK_STATEMENT" }))).toEqual(expect.arrayContaining(["STATEMENT_SHORT", "LOW_BALANCE"]));
  });
  it("requires attested marriage certificates for Schengen", () => {
    const priya = { ...rohan, firstName: "Priya", relationship: "SPOUSE", monthlySalaryAed: null };
    const mc = { ...base, detectedType: "MARRIAGE_CERTIFICATE" as const, holderName: null, documentNumber: null, expiryDate: null, spouseNames: ["ROHAN MEHTA", "PRIYA MEHTA"], attested: false };
    const f = reviewDocument(mc, ctx({ expected: "MARRIAGE_CERTIFICATE", traveler: priya, sponsor: rohan }));
    expect(f.find((x) => x.code === "NOT_ATTESTED")?.severity).toBe("BLOCKER");
  });
  it("rejects photos with coloured backgrounds", () => {
    const ph = { ...base, detectedType: "PHOTO" as const, holderName: null, documentNumber: null, expiryDate: null, photo: { whiteBackground: false, faceCentered: true, wearingGlasses: false, headCovered: false } };
    expect(codes(ph, ctx({ expected: "PHOTO" }))).toEqual(["PHOTO_BACKGROUND"]);
  });
  it("checks Schengen insurance minimums", () => {
    const ins = { ...base, detectedType: "TRAVEL_INSURANCE" as const, holderName: "ROHAN MEHTA", documentNumber: "POL1", expiryDate: null, coverageAmountEur: 20000, coversSchengen: true, periodFrom: "2026-12-01", periodTo: "2026-12-05" };
    expect(codes(ins, ctx({ expected: "TRAVEL_INSURANCE" }))).toEqual(expect.arrayContaining(["INSURANCE_COVER", "INSURANCE_DATES"]));
  });
  it("an agent override downgrades a rejection to warnings", () => {
    const f = reviewDocument({ ...base, expiryDate: "2027-01-20" }, ctx());
    expect(verdictOf(f)).toBe("REJECTED");
    expect(verdictOf(f, true)).toBe("WARNINGS");
  });
});
