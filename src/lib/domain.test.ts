import { describe, expect, it } from "vitest";
import { checkDigit, findMrz, parseTd3 } from "./mrz";
import { isValidEmiratesId, isValidTrn, luhnValid, normalizeEmiratesId, normalizeUaeMobile, isCorporateEmail } from "./validators";
import { ageOn, eligibility, requirementsFor } from "./requirements";
import { getProduct } from "./catalog";
import { assessRisk } from "./risk";
import { bookingTotals, price, quote } from "./pricing";
import { addWorkingDays } from "./dates";

const ICAO_SAMPLE = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10";

describe("MRZ (ICAO 9303 TD3)", () => {
  it("computes check digits", () => {
    expect(checkDigit("L898902C3")).toBe(6);
    expect(checkDigit("740812")).toBe(2);
    expect(checkDigit("120415")).toBe(9);
  });

  it("parses the ICAO specimen", () => {
    const r = parseTd3(ICAO_SAMPLE, new Date("2026-01-01"));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.fields).toMatchObject({
      lastName: "ERIKSSON",
      firstName: "ANNA MARIA",
      passportNo: "L898902C3",
      dateOfBirth: "1974-08-12",
      gender: "FEMALE",
      expiry: "2012-04-15",
    });
  });

  it("detects tampered data", () => {
    const tampered = ICAO_SAMPLE.replace("L898902C3", "L898902C4");
    expect(parseTd3(tampered).valid).toBe(false);
  });

  it("finds an MRZ inside OCR noise", () => {
    expect(findMrz(`REPUBLIC OF UTOPIA\nsome text\n${ICAO_SAMPLE}\n`)).toBe(ICAO_SAMPLE);
  });
});

function withLuhn(prefix14: string) {
  for (let d = 0; d <= 9; d++) if (luhnValid(prefix14 + d)) return prefix14 + d;
  throw new Error("unreachable");
}

describe("UAE identifiers", () => {
  it("validates Emirates ID with Luhn", () => {
    const id = withLuhn("78419901234567");
    expect(isValidEmiratesId(id)).toBe(true);
    expect(normalizeEmiratesId(id)).toMatch(/^784-1990-1234567-\d$/);
    const bad = id.slice(0, 14) + ((Number(id[14]) + 1) % 10);
    expect(isValidEmiratesId(bad)).toBe(false);
    expect(isValidEmiratesId("123419901234567")).toBe(false);
  });
  it("validates TRN", () => {
    expect(isValidTrn("100123456700003")).toBe(true);
    expect(isValidTrn("200123456700003")).toBe(false);
    expect(isValidTrn("10012345")).toBe(false);
  });
  it("normalizes UAE mobiles", () => {
    expect(normalizeUaeMobile("050 123 4567")).toBe("+971501234567");
    expect(normalizeUaeMobile("+971 55 123 4567")).toBe("+971551234567");
    expect(normalizeUaeMobile("04 123 4567")).toBeNull();
  });
  it("detects corporate email", () => {
    expect(isCorporateEmail("a@acme.ae")).toBe(true);
    expect(isCorporateEmail("a@gmail.com")).toBe(false);
  });
});

describe("eligibility engine", () => {
  it("Indian resident of UAE needs a Schengen visa for France", () => {
    const e = eligibility("FR", { nationality: "IN", uaeResident: true }, "BUSINESS");
    expect(e.status).toBe("VISA_REQUIRED");
  });
  it("Emirati is visa-free for Schengen", () => {
    expect(eligibility("FR", { nationality: "AE", uaeResident: true }, "TOURISM").status).toBe("VISA_FREE");
  });
  it("GCC passport needs a UK ETA, not a visa", () => {
    const e = eligibility("GB", { nationality: "AE", uaeResident: true }, "BUSINESS");
    expect(e.status).toBe("VISA_REQUIRED");
    if (e.status === "VISA_REQUIRED") expect(e.products.map((p) => p.id)).toEqual(["GB-eta"]);
  });
  it("Saudi GCC-resident eVisa requires UAE residence", () => {
    const resident = eligibility("SA", { nationality: "PK", uaeResident: true }, "TOURISM");
    const nonResident = eligibility("SA", { nationality: "PK", uaeResident: false }, "TOURISM");
    expect(resident.status === "VISA_REQUIRED" && resident.products.some((p) => p.id === "SA-gcc-resident-evisa")).toBe(true);
    expect(nonResident.status).toBe("NOT_SUPPORTED");
  });
  it("expat resident Schengen file needs EID, residence, NOC, bank statement", () => {
    const keys = requirementsFor(getProduct("FR-schengen-c")!, { nationality: "PH", uaeResident: true }, "BUSINESS").map((r) => r.key);
    for (const k of ["PASSPORT", "EMIRATES_ID", "RESIDENCE_VISA", "NOC", "BANK_STATEMENT", "INVITATION_LETTER", "TRAVEL_INSURANCE"]) expect(keys).toContain(k);
  });
  it("business owners provide a trade licence instead of an NOC", () => {
    const keys = requirementsFor(getProduct("DE-schengen-c")!, { nationality: "IN", uaeResident: true, employmentType: "SELF_EMPLOYED" }, "TOURISM").map((r) => r.key);
    expect(keys).toContain("TRADE_LICENSE");
    expect(keys).not.toContain("NOC");
  });
});

describe("risk report", () => {
  const today = new Date("2026-10-01T00:00:00Z");
  const base = {
    product: getProduct("FR-schengen-c")!,
    nationality: "IN",
    uaeResident: true,
    passportExpiry: new Date("2030-01-01"),
    residenceVisaExpiry: new Date("2028-01-01"),
    emiratesIdExpiry: new Date("2028-01-01"),
    monthlySalaryAed: 20000,
    joinedAt: new Date("2020-01-01"),
    priorRejections: 0,
    travelHistory: ["GB"],
    travelStart: new Date("2026-12-01"),
    travelEnd: new Date("2026-12-08"),
    missingRequiredDocs: 0,
    priority: false,
    today,
  };
  it("is LOW for a strong, well-timed file", () => {
    expect(assessRisk(base).level).toBe("LOW");
  });
  it("blocks when the passport is too short", () => {
    const r = assessRisk({ ...base, passportExpiry: new Date("2027-01-15") });
    expect(r.level).toBe("BLOCKED");
    expect(r.factors[0].id).toBe("passport-validity");
  });
  it("flags tight timelines and suggests priority", () => {
    const r = assessRisk({ ...base, travelStart: new Date("2026-10-10"), travelEnd: new Date("2026-10-15") });
    const t = r.factors.find((f) => f.id === "timeline");
    expect(t?.severity).toBe("warn");
    expect(t?.fix).toMatch(/Priority/);
  });
  it("warns on residence expiring within 90 days of return", () => {
    const r = assessRisk({ ...base, residenceVisaExpiry: new Date("2027-01-20") });
    expect(r.factors.some((f) => f.id === "residence-validity")).toBe(true);
  });
});

describe("pricing & VAT", () => {
  it("applies 5% VAT only to service components, not government fees", () => {
    const p = price(getProduct("FR-schengen-c")!, "PRIORITY", "PICKUP", "STARTER");
    expect(p.governmentFils).toBe(36500);
    expect(p.taxableFils).toBe(39900 + 24900 + 7500);
    expect(p.vatFils).toBe(Math.round(p.taxableFils * 0.05));
    expect(p.totalFils).toBe(p.governmentFils + p.taxableFils + p.vatFils);
  });
  it("applies plan discounts to service fees", () => {
    const starter = price(getProduct("GB-visitor")!, "STANDARD", "NONE", "STARTER");
    const ent = price(getProduct("GB-visitor")!, "STANDARD", "NONE", "ENTERPRISE");
    expect(ent.serviceFils).toBe(Math.round(starter.serviceFils * 0.8));
  });
  it("does not charge courier for online products", () => {
    expect(price(getProduct("SA-business")!, "STANDARD", "PICKUP").courierFils).toBe(0);
  });
});

describe("dates", () => {
  it("skips the UAE Sat/Sun weekend", () => {
    // Friday 2 Oct 2026 + 1 working day = Monday 5 Oct
    expect(addWorkingDays(new Date("2026-10-02T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-10-05");
  });
});

describe("families (retail)", () => {
  const schengen = getProduct("FR-schengen-c")!;
  const keys = (f: Parameters<typeof requirementsFor>[1]) => requirementsFor(schengen, f, "TOURISM").map((r) => r.key);

  it("dependent spouse rides on the sponsor's file", () => {
    const k = keys({ nationality: "IN", uaeResident: true, employmentType: "DEPENDENT", relationship: "SPOUSE", age: 34 });
    expect(k).toEqual(expect.arrayContaining(["SPONSOR_DOCUMENTS", "SPONSORSHIP_LETTER", "MARRIAGE_CERTIFICATE"]));
    expect(k).not.toContain("NOC");
  });
  it("minor needs a birth certificate, and consent only when a parent stays home", () => {
    const both = keys({ nationality: "IN", uaeResident: true, relationship: "CHILD", age: 8, travelsWithBothParents: true });
    const one = keys({ nationality: "IN", uaeResident: true, relationship: "CHILD", age: 8, travelsWithBothParents: false });
    expect(both).toContain("BIRTH_CERTIFICATE");
    expect(both).not.toContain("PARENTAL_CONSENT");
    expect(one).toContain("PARENTAL_CONSENT");
    expect(both).not.toContain("NOC");
  });
  it("computes age at departure", () => {
    expect(ageOn(new Date("2018-12-10"), new Date("2026-12-09"))).toBe(7);
    expect(ageOn(new Date("2018-12-10"), new Date("2026-12-10"))).toBe(8);
  });
  it("applies Schengen child embassy fees", () => {
    expect(price(schengen, "STANDARD", "NONE", "STARTER", 4).governmentFils).toBe(0);
    expect(price(schengen, "STANDARD", "NONE", "STARTER", 9).governmentFils).toBe(18000);
    expect(price(schengen, "STANDARD", "NONE", "STARTER", 12).governmentFils).toBe(36500);
  });
  it("judges dependents on the sponsor's income, scaled for family size", () => {
    const base = {
      product: schengen, nationality: "IN", uaeResident: true, passportExpiry: new Date("2031-01-01"), residenceVisaExpiry: new Date("2029-01-01"),
      emiratesIdExpiry: new Date("2029-01-01"), monthlySalaryAed: null, joinedAt: null, priorRejections: 0, travelHistory: ["GB"],
      travelStart: new Date("2026-12-01"), travelEnd: new Date("2026-12-08"), missingRequiredDocs: 0, priority: false, today: new Date("2026-10-01"),
      employmentType: "DEPENDENT",
    };
    expect(assessRisk({ ...base, sponsorSalaryAed: 15000, familySize: 1 }).factors.some((f) => f.id === "salary")).toBe(false);
    expect(assessRisk({ ...base, sponsorSalaryAed: 15000, familySize: 4 }).factors.some((f) => f.id === "salary")).toBe(true);
  });
});

describe("agency quote", () => {
  const p = getProduct("FR-schengen-c")!;
  const agency = { plan: "GROWTH", markupPct: 50, overrides: {}, vatRegistered: true };
  it("marks up Safar's net service fee and keeps embassy fees at cost", () => {
    const q = quote(p, "STANDARD", "NONE", agency);
    expect(q.net.serviceFils).toBe(Math.round(39900 * 0.9));
    expect(q.sell.serviceFils).toBe(Math.round(q.net.serviceFils * 1.5));
    expect(q.sell.governmentFils).toBe(q.net.governmentFils);
    expect(q.marginFils).toBe(q.sell.taxableFils - q.net.taxableFils);
  });
  it("uses the agency's own fee when set, and no VAT if not registered", () => {
    const q = quote(p, "STANDARD", "NONE", { ...agency, overrides: { [p.id]: 30000 }, vatRegistered: false });
    expect(q.sell.serviceFils).toBe(30000);
    expect(q.sell.vatFils).toBe(0);
  });
});

describe("booking totals", () => {
  it("charges VAT on the discounted service value only", () => {
    const line = { governmentFils: 36500, serviceFils: 50000, bundleFils: 0, courierFils: 0, taxableFils: 50000, vatFils: 2500, totalFils: 89000 };
    const t = bookingTotals([line, line], 10000, true);
    expect(t.taxableFils).toBe(90000);
    expect(t.vatFils).toBe(4500);
    expect(t.totalFils).toBe(90000 + 4500 + 73000);
  });
});
