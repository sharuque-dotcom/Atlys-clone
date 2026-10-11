import "server-only";
import { PDFDocument, StandardFonts, rgb, PageSizes, type PDFFont, type PDFPage } from "pdf-lib";
import { getObject } from "../storage";
import { DOCUMENT_LABELS, type DocumentRequirementKey } from "../catalog";
import type { ItemReview } from "../review";
import type { Sheet } from "./datasheet";

// The order documents go into the embassy file (VFS / TLS / BLS checklists all follow roughly this).
export const SUBMISSION_ORDER: (DocumentRequirementKey | "FORM")[] = [
  "FORM", "PHOTO", "PASSPORT", "OLD_PASSPORTS", "RESIDENCE_VISA", "EMIRATES_ID", "COVER_LETTER", "ITINERARY", "FLIGHT_RESERVATION",
  "HOTEL_BOOKING", "TRAVEL_INSURANCE", "INVITATION_LETTER", "CONFERENCE_REGISTRATION", "NOC", "SALARY_CERTIFICATE", "TRADE_LICENSE",
  "PENSION_PROOF", "BANK_STATEMENT", "SPONSORSHIP_LETTER", "SPONSOR_DOCUMENTS", "MARRIAGE_CERTIFICATE", "BIRTH_CERTIFICATE",
  "PARENTAL_CONSENT", "SCHOOL_LETTER", "DS160_CONFIRMATION",
];

/** Letters we generate, keyed by requirement → print template. NOC/salary are employer drafts. */
export const LETTER_FOR: Partial<Record<DocumentRequirementKey, string>> = {
  COVER_LETTER: "cover", ITINERARY: "itinerary", SPONSORSHIP_LETTER: "sponsorship", PARENTAL_CONSENT: "consent", NOC: "noc", SALARY_CERTIFICATE: "salary",
};

export type PackApplicant = {
  applicationId: string;
  name: string;
  ref: string;
  visa: string;
  center: string;
  items: ItemReview[];
  sheet: Sheet;
};

type LetterRenderer = (applicationId: string, kind: string) => Promise<Uint8Array | null>;

const A4 = PageSizes.A4;
const M = 48;

/** pdf-lib's standard fonts are WinAnsi-only; keep text printable whatever the source. */
function safe(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[—–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/→/g, "->").replace(/•/g, "-").replace(/≈/g, "~").replace(/×/g, "x").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of safe(text).split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = w; } else line = next;
    }
    out.push(line);
  }
  return out;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont, private header: string) { this.newPage(); }
  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - M;
    this.page.drawText(safe(this.header), { x: M, y: A4[1] - 28, size: 8, font: this.font, color: rgb(0.45, 0.45, 0.5) });
  }
  ensure(h: number) { if (this.y - h < M) this.newPage(); }
  text(s: string, o: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number } = {}) {
    const size = o.size ?? 10;
    const f = o.bold ? this.bold : this.font;
    for (const line of wrap(s, f, size, A4[0] - 2 * M - (o.indent ?? 0))) {
      this.ensure(size + 4);
      this.page.drawText(line, { x: M + (o.indent ?? 0), y: this.y - size, size, font: f, color: o.color ? rgb(...o.color) : rgb(0.1, 0.1, 0.15) });
      this.y -= size + 4;
    }
  }
  gap(h = 8) { this.y -= h; }
  row(label: string, value: string) {
    const lw = 190;
    const lines = wrap(value || "______________________________", this.font, 10, A4[0] - 2 * M - lw);
    this.ensure(14 * lines.length + 4);
    this.page.drawText(safe(label), { x: M, y: this.y - 10, size: 9, font: this.font, color: rgb(0.4, 0.4, 0.45) });
    lines.forEach((l, i) => this.page.drawText(l, { x: M + lw, y: this.y - 10 - i * 14, size: 10, font: value ? this.bold : this.font, color: value ? rgb(0.1, 0.1, 0.15) : rgb(0.7, 0.7, 0.75) }));
    this.y -= 14 * lines.length + 4;
    this.page.drawLine({ start: { x: M, y: this.y + 2 }, end: { x: A4[0] - M, y: this.y + 2 }, thickness: 0.3, color: rgb(0.88, 0.88, 0.9) });
  }
}

/**
 * Builds one print-ready PDF: for each applicant a cover sheet with the AI review result, the pre-filled
 * form data sheet, the generated letters, then every uploaded document — all in submission order.
 */
export async function buildPack(opts: { agency: string; applicants: PackApplicant[]; renderLetter: LetterRenderer | null }) {
  const out = await PDFDocument.create();
  out.setTitle(`Visa application pack — ${opts.applicants.map((a) => a.name).join(", ")}`);
  out.setProducer("Safar");
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);

  for (const a of opts.applicants) {
    const header = `${opts.agency} · ${a.name} · ${a.ref}`;
    // --- Cover sheet & checklist
    const w = new Writer(out, font, bold, header);
    w.text("VISA APPLICATION FILE", { size: 9, color: [0.4, 0.4, 0.45] });
    w.text(a.name, { size: 20, bold: true });
    w.text(`${a.visa} · submit at ${a.center}`, { size: 11 });
    w.gap(10);
    const blockers = a.items.filter((i) => (i.required && !i.satisfiedBy && !i.autoGenerated) || i.review?.status === "REJECTED");
    if (blockers.length) {
      w.text(`NOT READY — ${blockers.length} blocking issue(s). Fix before submission:`, { bold: true, color: [0.75, 0.1, 0.15] });
      for (const b of blockers) {
        const why = b.review?.findings.find((f) => f.severity === "BLOCKER");
        w.text(`• ${DOCUMENT_LABELS[b.key].en}: ${why ? `${why.message}${why.fix ? ` -> ${why.fix}` : ""}` : "missing"}`, { indent: 10, color: [0.6, 0.1, 0.15] });
      }
    } else {
      w.text("READY — all required documents present and checked.", { bold: true, color: [0.05, 0.45, 0.3] });
    }
    w.gap(12);
    w.text("Document checklist (in submission order)", { bold: true, size: 12 });
    w.gap(4);
    const byKey = new Map(a.items.map((i) => [i.key, i]));
    let n = 1;
    for (const key of SUBMISSION_ORDER) {
      if (key === "FORM") { w.text(`${n++}. Application form — completed online, data sheet attached   [x]`); continue; }
      const i = byKey.get(key);
      if (!i) continue;
      const mark = i.satisfiedBy ? (i.review?.status === "REJECTED" ? "[!] issue" : i.review?.status === "WARNINGS" ? "[x] check warnings" : "[x]") : LETTER_FOR[key] && opts.renderLetter ? (key === "NOC" || key === "SALARY_CERTIFICATE" ? "[ ] draft enclosed — employer to sign & stamp" : "[x] generated") : i.autoGenerated ? "[ ] to attach" : i.required ? "[ ] MISSING" : "[ ] optional";
      w.text(`${n++}. ${DOCUMENT_LABELS[key].en}   ${mark}`);
      for (const f of i.review?.findings.filter((x) => x.severity === "WARNING") ?? []) w.text(`- ${f.message}`, { size: 8, indent: 18, color: [0.6, 0.4, 0.05] });
    }

    // --- Pre-filled form data sheet
    const s = new Writer(out, font, bold, header);
    s.text(a.sheet.title, { size: 14, bold: true });
    s.text(a.sheet.subtitle, { size: 9, color: [0.4, 0.4, 0.45] });
    s.text("Copy these answers into the embassy's online form. Blank lines still need to be asked from the customer.", { size: 8, color: [0.4, 0.4, 0.45] });
    for (const sec of a.sheet.sections) {
      s.gap(10);
      s.text(sec.title.toUpperCase(), { size: 9, bold: true, color: [0.05, 0.45, 0.4] });
      for (const [k, v] of sec.rows) s.row(k, v);
    }

    // --- Letters and documents, in submission order
    for (const key of SUBMISSION_ORDER) {
      if (key === "FORM") continue;
      const i = byKey.get(key);
      if (!i) continue;
      if (i.satisfiedBy) {
        await appendFile(out, i.satisfiedBy.storageKey, i.satisfiedBy.mimeType, `${DOCUMENT_LABELS[key].en} — ${i.satisfiedBy.fileName}`, font, header);
      } else if (LETTER_FOR[key] && opts.renderLetter) {
        const pdf = await opts.renderLetter(a.applicationId, LETTER_FOR[key]!);
        if (pdf) {
          const src = await PDFDocument.load(pdf);
          for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
        }
      }
    }
  }
  return out.save();
}

async function appendFile(out: PDFDocument, key: string, mime: string, title: string, font: PDFFont, header: string) {
  let bytes: Buffer;
  try {
    bytes = await getObject(key);
  } catch {
    return placeholder(out, font, header, `${title}\n\nFile is not available in storage — attach the original.`);
  }
  try {
    if (mime === "application/pdf") {
      const src = await PDFDocument.load(bytes);
      for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
      return;
    }
    if (mime === "image/jpeg" || mime === "image/png") {
      const img = mime === "image/png" ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      const page = out.addPage(A4);
      const scale = Math.min((A4[0] - 2 * M) / img.width, (A4[1] - 2 * M) / img.height, 1.5);
      page.drawImage(img, { x: (A4[0] - img.width * scale) / 2, y: A4[1] - M - img.height * scale, width: img.width * scale, height: img.height * scale });
      page.drawText(safe(header), { x: M, y: 24, size: 7, font, color: rgb(0.6, 0.6, 0.65) });
      return;
    }
  } catch {
    /* fall through to placeholder */
  }
  placeholder(out, font, header, `${title}\n\nThis file could not be merged (unsupported or protected format) — print it separately and insert here.`);
}

function placeholder(out: PDFDocument, font: PDFFont, header: string, msg: string) {
  const page = out.addPage(A4);
  page.drawText(safe(header), { x: M, y: A4[1] - 28, size: 8, font });
  wrap(msg, font, 12, A4[0] - 2 * M).forEach((l, i) => page.drawText(l, { x: M, y: A4[1] / 2 - i * 16, size: 12, font }));
}
