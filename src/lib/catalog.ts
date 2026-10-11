// Destination & visa-product catalog, tuned for applicants who RESIDE in the UAE.
//
// IMPORTANT: fees, timelines and centres are indicative seed data. In production this catalog is
// operator-managed (ops team updates it as embassies change rules) — never hard-code it in UI logic.

import { SCHENGEN, STRONG_PASSPORTS, GCC, EU_EEA_CH } from "./countries";

export type VisaKind = "STICKER" | "EVISA" | "ETA" | "VOA" | "VISA_FREE";
export type Purpose = "BUSINESS" | "TOURISM" | "CONFERENCE" | "TRAINING" | "FAMILY";

export type VisaProduct = {
  id: string;
  destination: string;
  name: string;
  nameAr: string;
  kind: VisaKind;
  purposes: Purpose[];
  entries: "SINGLE" | "MULTIPLE";
  validityDays: number;
  maxStayDays: number;
  /** Working days from submission to decision */
  processingDays: { standard: number; priority: number | null };
  govtFeeAed: number;
  serviceFeeAed: number;
  biometrics: boolean;
  passportSubmission: boolean;
  centers: string[];
  /** Passport must be valid this many days beyond the return date */
  passportValidityBeyondReturnDays: number;
  /** UAE residence visa must be valid this many days beyond the return date */
  residenceValidityBeyondReturnDays: number;
  /** Minimum recommended monthly salary in AED for a strong application */
  recommendedMinSalaryAed: number;
  /** Recommended booking lead time in calendar days (appointment backlog + processing) */
  leadTimeDays: number;
  /** Applying with UAE residence is required (e.g. GCC-resident eVisas) */
  requiresUaeResidence?: boolean;
  extraDocs?: DocumentRequirementKey[];
};

export type Destination = {
  code: string;
  region: "SCHENGEN" | "EUROPE" | "AMERICAS" | "ASIA" | "GCC_MENA" | "AFRICA" | "OCEANIA";
  popular?: boolean;
  /** Nationalities that do not need a visa for short stays */
  visaFree: string[];
  /** Nationalities eligible for visa-on-arrival */
  visaOnArrival?: string[];
  products: VisaProduct[];
  notes?: string;
};

export type DocumentRequirementKey =
  | "PASSPORT"
  | "PHOTO"
  | "EMIRATES_ID"
  | "RESIDENCE_VISA"
  | "NOC"
  | "SALARY_CERTIFICATE"
  | "BANK_STATEMENT"
  | "TRADE_LICENSE"
  | "INVITATION_LETTER"
  | "COVER_LETTER"
  | "FLIGHT_RESERVATION"
  | "HOTEL_BOOKING"
  | "TRAVEL_INSURANCE"
  | "ITINERARY"
  | "OLD_PASSPORTS"
  | "DS160_CONFIRMATION"
  | "CONFERENCE_REGISTRATION";

const schengenBase = {
  kind: "STICKER" as const,
  purposes: ["BUSINESS", "TOURISM", "CONFERENCE", "TRAINING", "FAMILY"] as Purpose[],
  entries: "MULTIPLE" as const,
  validityDays: 180,
  maxStayDays: 90,
  govtFeeAed: 365,
  biometrics: true,
  passportSubmission: true,
  passportValidityBeyondReturnDays: 90,
  residenceValidityBeyondReturnDays: 90,
  recommendedMinSalaryAed: 8000,
  extraDocs: ["TRAVEL_INSURANCE", "FLIGHT_RESERVATION", "HOTEL_BOOKING", "ITINERARY"] as DocumentRequirementKey[],
};

function schengen(code: string, provider: string, standard: number, leadTimeDays: number): Destination {
  return {
    code,
    region: "SCHENGEN",
    popular: ["FR", "DE", "IT", "ES", "NL", "CH"].includes(code),
    visaFree: [...STRONG_PASSPORTS, "AE", "MY", "BR", "MX", "UA", "GE"],
    products: [
      {
        ...schengenBase,
        id: `${code}-schengen-c`,
        destination: code,
        name: "Schengen short-stay visa (Type C)",
        nameAr: "تأشيرة شنغن قصيرة الإقامة (فئة C)",
        processingDays: { standard, priority: Math.max(5, Math.round(standard / 2)) },
        serviceFeeAed: 399,
        centers: [`${provider} — Dubai`, `${provider} — Abu Dhabi`],
        leadTimeDays,
      },
    ],
    notes: "Apply to the country of main stay (most nights) or first entry if stays are equal. Up to 6 months before travel.",
  };
}

export const DESTINATIONS: Destination[] = [
  schengen("FR", "TLScontact", 15, 30),
  schengen("DE", "VFS Global", 15, 35),
  schengen("IT", "VFS Global", 15, 30),
  schengen("ES", "BLS International", 15, 30),
  schengen("NL", "VFS Global", 15, 30),
  schengen("CH", "VFS Global", 15, 25),
  schengen("AT", "VFS Global", 15, 25),
  schengen("GR", "VFS Global", 15, 25),
  {
    code: "GB",
    region: "EUROPE",
    popular: true,
    visaFree: [...EU_EEA_CH, "US", "CA", "AU", "NZ", "JP", "KR", "SG", "MY"],
    products: [
      {
        id: "GB-visitor",
        destination: "GB",
        name: "UK Standard Visitor visa",
        nameAr: "تأشيرة الزيارة القياسية للمملكة المتحدة",
        kind: "STICKER",
        purposes: ["BUSINESS", "TOURISM", "CONFERENCE", "TRAINING", "FAMILY"],
        entries: "MULTIPLE",
        validityDays: 180,
        maxStayDays: 180,
        processingDays: { standard: 15, priority: 5 },
        govtFeeAed: 600,
        serviceFeeAed: 449,
        biometrics: true,
        passportSubmission: true,
        centers: ["TLScontact — Dubai", "TLScontact — Abu Dhabi"],
        passportValidityBeyondReturnDays: 0,
        residenceValidityBeyondReturnDays: 30,
        recommendedMinSalaryAed: 7000,
        leadTimeDays: 30,
        extraDocs: ["ITINERARY", "HOTEL_BOOKING"],
      },
      {
        id: "GB-eta",
        destination: "GB",
        name: "UK Electronic Travel Authorisation (ETA)",
        nameAr: "تصريح السفر الإلكتروني للمملكة المتحدة",
        kind: "ETA",
        purposes: ["BUSINESS", "TOURISM", "CONFERENCE", "FAMILY"],
        entries: "MULTIPLE",
        validityDays: 730,
        maxStayDays: 180,
        processingDays: { standard: 3, priority: 1 },
        govtFeeAed: 75,
        serviceFeeAed: 99,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 0,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 5,
      },
    ],
    notes: "GCC nationals (incl. UAE passport holders) need only an ETA. Other nationalities need a Standard Visitor visa.",
  },
  {
    code: "US",
    region: "AMERICAS",
    popular: true,
    visaFree: [...EU_EEA_CH.filter((c) => !["BG", "CY", "RO"].includes(c)), "GB", "AU", "NZ", "JP", "KR", "SG", "CA"],
    products: [
      {
        id: "US-b1b2",
        destination: "US",
        name: "US B1/B2 visitor visa",
        nameAr: "تأشيرة الزيارة الأمريكية B1/B2",
        kind: "STICKER",
        purposes: ["BUSINESS", "TOURISM", "CONFERENCE", "TRAINING", "FAMILY"],
        entries: "MULTIPLE",
        validityDays: 1825,
        maxStayDays: 180,
        processingDays: { standard: 10, priority: null },
        govtFeeAed: 680,
        serviceFeeAed: 549,
        biometrics: true,
        passportSubmission: true,
        centers: ["US Embassy — Abu Dhabi", "US Consulate General — Dubai"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 10000,
        leadTimeDays: 90,
        extraDocs: ["DS160_CONFIRMATION", "OLD_PASSPORTS"],
      },
    ],
    notes: "Interview required. Expedited appointment requests possible for urgent business travel.",
  },
  {
    code: "CA",
    region: "AMERICAS",
    visaFree: [...EU_EEA_CH, "GB", "US", "AU", "NZ", "JP", "KR", "SG", "AE"],
    products: [
      {
        id: "CA-trv",
        destination: "CA",
        name: "Canada Temporary Resident Visa",
        nameAr: "تأشيرة الإقامة المؤقتة لكندا",
        kind: "STICKER",
        purposes: ["BUSINESS", "TOURISM", "CONFERENCE", "FAMILY"],
        entries: "MULTIPLE",
        validityDays: 3650,
        maxStayDays: 180,
        processingDays: { standard: 40, priority: null },
        govtFeeAed: 500,
        serviceFeeAed: 549,
        biometrics: true,
        passportSubmission: true,
        centers: ["VFS Global — Dubai", "VFS Global — Abu Dhabi"],
        passportValidityBeyondReturnDays: 0,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 10000,
        leadTimeDays: 75,
        extraDocs: ["ITINERARY"],
      },
    ],
  },
  {
    code: "JP",
    region: "ASIA",
    popular: true,
    visaFree: [...EU_EEA_CH, "GB", "US", "CA", "AU", "NZ", "KR", "SG", "AE", "QA", "MY", "TH", "ID"],
    products: [
      {
        id: "JP-short",
        destination: "JP",
        name: "Japan short-term stay visa",
        nameAr: "تأشيرة الإقامة القصيرة لليابان",
        kind: "STICKER",
        purposes: ["BUSINESS", "TOURISM", "CONFERENCE", "TRAINING"],
        entries: "SINGLE",
        validityDays: 90,
        maxStayDays: 15,
        processingDays: { standard: 5, priority: null },
        govtFeeAed: 110,
        serviceFeeAed: 349,
        biometrics: false,
        passportSubmission: true,
        centers: ["Consulate-General of Japan — Dubai", "Embassy of Japan — Abu Dhabi"],
        passportValidityBeyondReturnDays: 0,
        residenceValidityBeyondReturnDays: 90,
        recommendedMinSalaryAed: 6000,
        leadTimeDays: 14,
        extraDocs: ["ITINERARY", "HOTEL_BOOKING", "FLIGHT_RESERVATION"],
      },
    ],
  },
  {
    code: "SG",
    region: "ASIA",
    visaFree: [...STRONG_PASSPORTS, ...GCC, "MY", "TH", "ID", "PH", "VN", "BR", "MX", "KZ", "UA", "TR"],
    products: [
      {
        id: "SG-evisa",
        destination: "SG",
        name: "Singapore e-Visa",
        nameAr: "تأشيرة سنغافورة الإلكترونية",
        kind: "EVISA",
        purposes: ["BUSINESS", "TOURISM", "CONFERENCE", "FAMILY"],
        entries: "MULTIPLE",
        validityDays: 60,
        maxStayDays: 30,
        processingDays: { standard: 4, priority: 2 },
        govtFeeAed: 110,
        serviceFeeAed: 199,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online (via local sponsor)"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 4000,
        leadTimeDays: 7,
      },
    ],
  },
  {
    code: "SA",
    region: "GCC_MENA",
    popular: true,
    visaFree: [...GCC],
    products: [
      {
        id: "SA-gcc-resident-evisa",
        destination: "SA",
        name: "Saudi eVisa for GCC residents",
        nameAr: "التأشيرة الإلكترونية السعودية لمقيمي دول الخليج",
        kind: "EVISA",
        purposes: ["BUSINESS", "TOURISM", "FAMILY"],
        entries: "MULTIPLE",
        validityDays: 365,
        maxStayDays: 90,
        processingDays: { standard: 2, priority: 1 },
        govtFeeAed: 480,
        serviceFeeAed: 149,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 90,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 3,
        requiresUaeResidence: true,
      },
      {
        id: "SA-business",
        destination: "SA",
        name: "Saudi business visit visa",
        nameAr: "تأشيرة زيارة أعمال سعودية",
        kind: "EVISA",
        purposes: ["BUSINESS", "CONFERENCE", "TRAINING"],
        entries: "MULTIPLE",
        validityDays: 365,
        maxStayDays: 90,
        processingDays: { standard: 5, priority: 2 },
        govtFeeAed: 600,
        serviceFeeAed: 249,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 7,
        extraDocs: ["INVITATION_LETTER"],
      },
    ],
    notes: "Tourist eVisa allows Umrah. UAE residents with a valid residence visa are eligible regardless of nationality.",
  },
  {
    code: "TR",
    region: "EUROPE",
    popular: true,
    visaFree: [...EU_EEA_CH, "GB", "US", "JP", "KR", "SG", "AE", "QA", "KW", "BH", "OM", "SA", "MY", "BR", "RU", "UA", "GE", "AZ", "KZ", "UZ", "JO", "LB", "TN", "MA"],
    products: [
      {
        id: "TR-evisa",
        destination: "TR",
        name: "Türkiye e-Visa (conditional)",
        nameAr: "التأشيرة الإلكترونية لتركيا (مشروطة)",
        kind: "EVISA",
        purposes: ["BUSINESS", "TOURISM", "CONFERENCE"],
        entries: "SINGLE",
        validityDays: 180,
        maxStayDays: 30,
        processingDays: { standard: 1, priority: 1 },
        govtFeeAed: 220,
        serviceFeeAed: 99,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 60,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 3,
      },
    ],
    notes: "Several nationalities qualify for the e-Visa only with a valid Schengen/UK/US visa or residence permit.",
  },
  {
    code: "EG",
    region: "GCC_MENA",
    visaFree: [...GCC.filter((c) => c !== "QA"), "JO", "LB", "SY", "PS", "SD"],
    visaOnArrival: [...EU_EEA_CH, "GB", "US", "CA", "AU", "NZ", "JP", "KR", "QA"],
    products: [
      {
        id: "EG-evisa",
        destination: "EG",
        name: "Egypt e-Visa",
        nameAr: "تأشيرة مصر الإلكترونية",
        kind: "EVISA",
        purposes: ["BUSINESS", "TOURISM", "FAMILY"],
        entries: "SINGLE",
        validityDays: 90,
        maxStayDays: 30,
        processingDays: { standard: 7, priority: 3 },
        govtFeeAed: 95,
        serviceFeeAed: 149,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 10,
      },
    ],
  },
  {
    code: "GE",
    region: "EUROPE",
    visaFree: [...STRONG_PASSPORTS, ...GCC, "UA", "TR", "AZ", "AM", "KZ", "UZ", "RU", "BR", "MX"],
    products: [
      {
        id: "GE-evisa",
        destination: "GE",
        name: "Georgia e-Visa",
        nameAr: "تأشيرة جورجيا الإلكترونية",
        kind: "EVISA",
        purposes: ["BUSINESS", "TOURISM"],
        entries: "SINGLE",
        validityDays: 90,
        maxStayDays: 30,
        processingDays: { standard: 5, priority: 3 },
        govtFeeAed: 75,
        serviceFeeAed: 149,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 90,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 7,
      },
    ],
    notes: "Holders of a valid GCC residence permit may be visa-free — confirm before booking.",
  },
  {
    code: "AZ",
    region: "EUROPE",
    visaFree: ["TR", "GE", "UA", "RU", "KZ", "UZ"],
    products: [
      {
        id: "AZ-asan",
        destination: "AZ",
        name: "Azerbaijan ASAN e-Visa",
        nameAr: "تأشيرة أذربيجان الإلكترونية (أسان)",
        kind: "EVISA",
        purposes: ["BUSINESS", "TOURISM"],
        entries: "SINGLE",
        validityDays: 90,
        maxStayDays: 30,
        processingDays: { standard: 3, priority: 1 },
        govtFeeAed: 95,
        serviceFeeAed: 99,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 90,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 5,
      },
    ],
  },
  {
    code: "TH",
    region: "ASIA",
    visaFree: [...STRONG_PASSPORTS, ...GCC, "MY", "ID", "SG", "BR", "RU", "IN", "CN", "KZ", "UZ", "TR", "JO", "EG"],
    products: [
      {
        id: "TH-evisa",
        destination: "TH",
        name: "Thailand e-Visa (TR)",
        nameAr: "تأشيرة تايلاند الإلكترونية",
        kind: "EVISA",
        purposes: ["BUSINESS", "TOURISM"],
        entries: "SINGLE",
        validityDays: 90,
        maxStayDays: 60,
        processingDays: { standard: 10, priority: null },
        govtFeeAed: 150,
        serviceFeeAed: 199,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 90,
        recommendedMinSalaryAed: 4000,
        leadTimeDays: 14,
        extraDocs: ["FLIGHT_RESERVATION", "HOTEL_BOOKING"],
      },
    ],
  },
  {
    code: "CN",
    region: "ASIA",
    visaFree: ["SG", "BN", "FR", "DE", "IT", "ES", "NL", "CH", "AT", "BE", "IE", "PT", "GR", "PL", "HU", "DK", "SE", "NO", "FI", "AU", "NZ", "KR", "JP", "MY", "TH", "AE", "SA", "QA", "KW", "BH", "OM", "GE", "AZ", "KZ", "UZ", "BR"],
    products: [
      {
        id: "CN-m",
        destination: "CN",
        name: "China business visa (M)",
        nameAr: "تأشيرة أعمال صينية (M)",
        kind: "STICKER",
        purposes: ["BUSINESS", "CONFERENCE", "TRAINING"],
        entries: "MULTIPLE",
        validityDays: 180,
        maxStayDays: 30,
        processingDays: { standard: 4, priority: 2 },
        govtFeeAed: 260,
        serviceFeeAed: 349,
        biometrics: true,
        passportSubmission: true,
        centers: ["Chinese Visa Application Service Center — Dubai", "— Abu Dhabi"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 90,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 14,
        extraDocs: ["INVITATION_LETTER", "FLIGHT_RESERVATION", "HOTEL_BOOKING"],
      },
      {
        id: "CN-l",
        destination: "CN",
        name: "China tourist visa (L)",
        nameAr: "تأشيرة سياحية صينية (L)",
        kind: "STICKER",
        purposes: ["TOURISM", "FAMILY"],
        entries: "SINGLE",
        validityDays: 90,
        maxStayDays: 30,
        processingDays: { standard: 4, priority: 2 },
        govtFeeAed: 260,
        serviceFeeAed: 299,
        biometrics: true,
        passportSubmission: true,
        centers: ["Chinese Visa Application Service Center — Dubai", "— Abu Dhabi"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 90,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 14,
        extraDocs: ["FLIGHT_RESERVATION", "HOTEL_BOOKING", "ITINERARY"],
      },
    ],
  },
  {
    code: "IN",
    region: "ASIA",
    visaFree: ["NP", "BT", "MV"],
    products: [
      {
        id: "IN-ebusiness",
        destination: "IN",
        name: "India e-Business visa",
        nameAr: "تأشيرة الأعمال الإلكترونية للهند",
        kind: "EVISA",
        purposes: ["BUSINESS", "CONFERENCE", "TRAINING"],
        entries: "MULTIPLE",
        validityDays: 365,
        maxStayDays: 180,
        processingDays: { standard: 4, priority: 2 },
        govtFeeAed: 300,
        serviceFeeAed: 149,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 7,
        extraDocs: ["INVITATION_LETTER"],
      },
      {
        id: "IN-etourist",
        destination: "IN",
        name: "India e-Tourist visa",
        nameAr: "تأشيرة السياحة الإلكترونية للهند",
        kind: "EVISA",
        purposes: ["TOURISM", "FAMILY"],
        entries: "MULTIPLE",
        validityDays: 365,
        maxStayDays: 90,
        processingDays: { standard: 4, priority: 2 },
        govtFeeAed: 150,
        serviceFeeAed: 99,
        biometrics: false,
        passportSubmission: false,
        centers: ["Online"],
        passportValidityBeyondReturnDays: 180,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 0,
        leadTimeDays: 7,
      },
    ],
    notes: "Indian passport holders do not need a visa. OCI card holders are visa-exempt.",
  },
  {
    code: "AU",
    region: "OCEANIA",
    visaFree: ["NZ"],
    products: [
      {
        id: "AU-600",
        destination: "AU",
        name: "Australia Visitor visa (subclass 600)",
        nameAr: "تأشيرة الزيارة الأسترالية (فئة 600)",
        kind: "EVISA",
        purposes: ["BUSINESS", "TOURISM", "CONFERENCE", "FAMILY"],
        entries: "MULTIPLE",
        validityDays: 365,
        maxStayDays: 90,
        processingDays: { standard: 25, priority: 10 },
        govtFeeAed: 470,
        serviceFeeAed: 449,
        biometrics: true,
        passportSubmission: false,
        centers: ["Online + VFS biometrics — Dubai"],
        passportValidityBeyondReturnDays: 0,
        residenceValidityBeyondReturnDays: 0,
        recommendedMinSalaryAed: 9000,
        leadTimeDays: 45,
      },
    ],
    notes: "ETA (subclass 601) / eVisitor (651) available for eligible passports instead.",
  },
];

export const DESTINATION_BY_CODE = new Map(DESTINATIONS.map((d) => [d.code, d]));
export const PRODUCT_BY_ID = new Map(DESTINATIONS.flatMap((d) => d.products.map((p) => [p.id, p] as const)));

export function getProduct(id: string): VisaProduct | undefined {
  return PRODUCT_BY_ID.get(id);
}

export function isSchengen(code: string) {
  return SCHENGEN.includes(code);
}

export const DOCUMENT_LABELS: Record<DocumentRequirementKey, { en: string; ar: string; hint: string }> = {
  PASSPORT: { en: "Passport (bio page)", ar: "جواز السفر (صفحة البيانات)", hint: "Colour scan, all 4 corners visible. MRZ is read automatically." },
  PHOTO: { en: "Passport photo", ar: "صورة شخصية", hint: "White background, 35×45 mm (Schengen/UK) or 51×51 mm (US)." },
  EMIRATES_ID: { en: "Emirates ID (front & back)", ar: "الهوية الإماراتية (الوجهان)", hint: "Must be valid for the full trip." },
  RESIDENCE_VISA: { en: "UAE residence visa", ar: "تأشيرة الإقامة الإماراتية", hint: "e-Visa printout or passport sticker page." },
  NOC: { en: "Employer NOC letter", ar: "خطاب عدم ممانعة من جهة العمل", hint: "On letterhead: designation, salary, leave dates, return-to-work confirmation. Auto-generated." },
  SALARY_CERTIFICATE: { en: "Salary certificate", ar: "شهادة راتب", hint: "Issued within the last 30 days. Auto-generated from HR data." },
  BANK_STATEMENT: { en: "Bank statement (last 6 months)", ar: "كشف حساب بنكي (آخر 6 أشهر)", hint: "Bank-stamped or e-statement. Salary credits should be visible." },
  TRADE_LICENSE: { en: "Company trade licence", ar: "الرخصة التجارية للشركة", hint: "Pulled from the company document vault." },
  INVITATION_LETTER: { en: "Invitation letter from host", ar: "خطاب دعوة من الجهة المضيفة", hint: "From the company/organiser abroad, with dates and purpose." },
  COVER_LETTER: { en: "Cover letter", ar: "خطاب تغطية", hint: "Auto-generated from trip details." },
  FLIGHT_RESERVATION: { en: "Flight reservation", ar: "حجز طيران", hint: "Verifiable reservation — no need to buy the ticket before the visa." },
  HOTEL_BOOKING: { en: "Hotel booking", ar: "حجز فندقي", hint: "Covering every night of the stay." },
  TRAVEL_INSURANCE: { en: "Travel medical insurance", ar: "تأمين سفر طبي", hint: "Min. €30,000 coverage valid in all Schengen states." },
  ITINERARY: { en: "Day-by-day itinerary", ar: "برنامج الرحلة اليومي", hint: "Auto-generated." },
  OLD_PASSPORTS: { en: "Previous passports", ar: "جوازات السفر السابقة", hint: "With prior visas, if any." },
  DS160_CONFIRMATION: { en: "DS-160 confirmation", ar: "تأكيد نموذج DS-160", hint: "Prepared by our team from your profile." },
  CONFERENCE_REGISTRATION: { en: "Event registration", ar: "تسجيل الفعالية", hint: "Confirmation of registration for the event." },
};
