// What we read from an uploaded document. Every field is nullable: the extractor must report only what is
// printed on the document — never infer. Rules (rules.ts) decide what the values mean for the application.
import * as z from "zod/v4";

export const DETECTABLE_TYPES = [
  "PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "BANK_STATEMENT", "SALARY_CERTIFICATE", "NOC",
  "TRADE_LICENSE", "INVITATION_LETTER", "TRAVEL_INSURANCE", "FLIGHT_RESERVATION", "HOTEL_BOOKING",
  "BIRTH_CERTIFICATE", "MARRIAGE_CERTIFICATE", "SCHOOL_LETTER", "PENSION_PROOF", "OTHER",
] as const;

const date = z.string().nullable().describe("ISO date YYYY-MM-DD exactly as printed, or null");

export const ExtractionSchema = z.object({
  detectedType: z.enum(DETECTABLE_TYPES).describe("What this document actually is"),
  readable: z.boolean().describe("false if the key data cannot be read reliably"),
  qualityIssues: z.array(z.string()).describe("Short problems a visa officer would reject: blurry, corners cut off, glare over data, partial page, low resolution, black-and-white copy of a colour document"),
  holderName: z.string().nullable().describe("Full name of the person the document is about, as printed"),
  documentNumber: z.string().nullable().describe("Passport no., Emirates ID no. (784-…), visa/file no., licence no., policy no."),
  nationality: z.string().nullable().describe("ISO 3166-1 alpha-2 code of the holder's nationality if printed"),
  dateOfBirth: date,
  issueDate: date,
  expiryDate: date,
  mrz: z.string().nullable().describe("Passport MRZ: the two 44-character lines joined by a newline, characters exactly as printed including '<'"),
  linkedPassportNumber: z.string().nullable().describe("For UAE residence visas / entry permits: the passport number the visa is issued under"),
  sponsorOrEmployer: z.string().nullable().describe("Residence visa sponsor or employer name; employer issuing an NOC or salary certificate; company on a trade licence"),
  profession: z.string().nullable(),
  monthlySalaryAed: z.number().nullable().describe("Gross monthly salary in AED if stated"),
  letterDate: date.describe("Date the letter/certificate/statement was issued"),
  periodFrom: date.describe("Leave/travel/coverage/statement/booking period start"),
  periodTo: date.describe("Leave/travel/coverage/statement/booking period end"),
  closingBalanceAed: z.number().nullable(),
  accountHolder: z.string().nullable(),
  hasStampOrSignature: z.boolean().nullable().describe("Official stamp, seal or signature visible"),
  attested: z.boolean().nullable().describe("Attestation stamp (e.g. MOFA UAE / embassy) visible on certificates"),
  coverageAmountEur: z.number().nullable().describe("Medical coverage converted to EUR if another currency is stated"),
  coversSchengen: z.boolean().nullable(),
  parentNames: z.array(z.string()).describe("Birth certificates: parents' names; otherwise empty"),
  spouseNames: z.array(z.string()).describe("Marriage certificates: both spouses' names; otherwise empty"),
  photo: z
    .object({ whiteBackground: z.boolean(), faceCentered: z.boolean(), wearingGlasses: z.boolean(), headCovered: z.boolean() })
    .nullable()
    .describe("Only for passport photos"),
  notes: z.string().nullable().describe("Anything else a visa officer would notice, in one sentence"),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export function parseExtraction(json: string | null | undefined): Extraction | null {
  if (!json) return null;
  try {
    const r = ExtractionSchema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
