// Real-time refusal-risk report. Every factor is explainable and comes with a concrete fix,
// so agents can strengthen the file BEFORE it reaches the embassy.

import type { VisaProduct } from "./catalog";
import { addWorkingDays, daysBetween } from "./dates";
import { STRONG_PASSPORTS, GCC } from "./countries";

export type RiskInput = {
  product: VisaProduct;
  nationality: string;
  uaeResident: boolean;
  passportExpiry: Date | null;
  residenceVisaExpiry: Date | null;
  emiratesIdExpiry: Date | null;
  monthlySalaryAed: number | null;
  joinedAt: Date | null;
  priorRejections: number;
  travelHistory: string[];
  travelStart: Date;
  travelEnd: Date;
  missingRequiredDocs: number;
  priority: boolean;
  today?: Date;
  /** Retail/family context */
  employmentType?: string;
  age?: number | null;
  /** Monthly income of the family member sponsoring a dependent */
  sponsorSalaryAed?: number | null;
  /** Number of people on the same booking funded by the same household */
  familySize?: number;
};

export type RiskFactor = {
  id: string;
  label: string;
  impact: number; // points added to risk (0..100 scale)
  severity: "info" | "warn" | "block";
  fix?: string;
};

export type RiskReport = {
  score: number; // 0 (no risk) .. 100 (very likely to be refused / impossible)
  level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  factors: RiskFactor[];
  earliestDecision: string; // ISO date
  latestSafeSubmission: string; // ISO date
};

export function assessRisk(input: RiskInput): RiskReport {
  const today = input.today ?? new Date();
  const p = input.product;
  const factors: RiskFactor[] = [];
  const stay = daysBetween(input.travelStart, input.travelEnd) + 1;

  if (stay > p.maxStayDays) {
    factors.push({ id: "stay", label: `Trip is ${stay} days but this visa allows ${p.maxStayDays}`, impact: 100, severity: "block", fix: "Shorten the trip or choose a long-stay/work visa." });
  }

  // Passport validity
  if (!input.passportExpiry) {
    factors.push({ id: "passport-missing", label: "Passport details missing", impact: 25, severity: "warn", fix: "Upload the passport bio page — fields are read from the MRZ automatically." });
  } else {
    const needed = daysBetween(input.travelEnd, input.passportExpiry);
    if (needed < 0) {
      factors.push({ id: "passport-expired", label: "Passport expires before the trip ends", impact: 100, severity: "block", fix: "Renew the passport first (Indian/Pakistani/Filipino missions in the UAE offer tatkal/express renewal)." });
    } else if (needed < p.passportValidityBeyondReturnDays) {
      factors.push({ id: "passport-validity", label: `Passport valid only ${needed} days after return (needs ${p.passportValidityBeyondReturnDays})`, impact: 90, severity: "block", fix: "Renew the passport before applying." });
    } else if (daysBetween(today, input.passportExpiry) < 365) {
      factors.push({ id: "passport-soon", label: "Passport expires within a year", impact: 5, severity: "info", fix: "Consider renewing — multi-year visas are capped at passport validity." });
    }
  }

  // UAE residence (expats applying from the UAE)
  if (input.uaeResident && input.nationality !== "AE") {
    if (!input.residenceVisaExpiry) {
      factors.push({ id: "residence-missing", label: "UAE residence visa expiry unknown", impact: 15, severity: "warn", fix: "Upload the residence visa / Emirates ID." });
    } else {
      const margin = daysBetween(input.travelEnd, input.residenceVisaExpiry);
      if (margin < 0) {
        factors.push({ id: "residence-expired", label: "UAE residence expires before return", impact: 100, severity: "block", fix: "Renew the residence visa through your PRO before applying." });
      } else if (margin < p.residenceValidityBeyondReturnDays) {
        factors.push({ id: "residence-validity", label: `Residence valid ${margin} days after return (consulate expects ${p.residenceValidityBeyondReturnDays})`, impact: 45, severity: "warn", fix: "Start residence renewal now, or attach the renewal receipt with the application." });
      }
    }
    if (input.emiratesIdExpiry && input.emiratesIdExpiry < input.travelEnd) {
      factors.push({ id: "eid", label: "Emirates ID expires before return", impact: 20, severity: "warn", fix: "Renew via ICP / GDRFA — renewal receipt is accepted by most centres." });
    }
  }

  // Timeline
  const procDays = input.priority && p.processingDays.priority ? p.processingDays.priority : p.processingDays.standard;
  const daysToTravel = daysBetween(today, input.travelStart);
  const decision = addWorkingDays(today, procDays + (p.biometrics ? 5 : 0));
  if (decision > input.travelStart) {
    const sev = p.processingDays.priority && !input.priority ? "warn" : "block";
    factors.push({
      id: "timeline",
      label: `Decision expected ${daysBetween(input.travelStart, decision)} days after departure`,
      impact: sev === "block" ? 70 : 40,
      severity: sev,
      fix: sev === "warn" ? "Switch to Priority — we hunt cancellation slots and use embassy fast-track." : "Move travel dates or pick a destination with faster processing.",
    });
  } else if (daysToTravel < p.leadTimeDays) {
    factors.push({ id: "lead", label: `Only ${daysToTravel} days to travel (recommended ${p.leadTimeDays})`, impact: 15, severity: "warn", fix: "Apply today — appointment slots in Dubai/Abu Dhabi fill up 2–4 weeks ahead in peak season." });
  }

  // Financial standing — dependents and minors are assessed on their sponsor's income,
  // and the household needs proportionally more funds when the whole family travels.
  const dependent = (input.age != null && input.age < 18) || ["DEPENDENT", "STUDENT", "UNEMPLOYED"].includes(input.employmentType ?? "");
  const income = dependent ? input.sponsorSalaryAed ?? null : input.monthlySalaryAed;
  const familySize = Math.max(1, input.familySize ?? 1);
  if (p.recommendedMinSalaryAed > 0 && input.employmentType !== "SELF_EMPLOYED" && input.employmentType !== "RETIRED") {
    const threshold = Math.round(p.recommendedMinSalaryAed * (1 + 0.3 * (familySize - 1)));
    if (income == null) {
      factors.push({ id: "salary-missing", label: dependent ? "Sponsor's income not on file" : "Salary not on file", impact: 10, severity: "info", fix: dependent ? "Link this traveler to the sponsoring family member and record their salary." : "Add the monthly salary so the NOC and salary certificate drafts are complete." });
    } else if (income < threshold) {
      factors.push({
        id: "salary",
        label: `${dependent ? "Sponsor's income" : "Salary"} below typical threshold for ${familySize > 1 ? `a family of ${familySize}` : "this visa"} (AED ${threshold.toLocaleString()})`,
        impact: 20,
        severity: "warn",
        fix: "Show a higher closing bank balance (≈ AED 1,000 per person per travel day), fixed deposits, or a second earning family member as co-sponsor.",
      });
    }
  }

  if ((input.employmentType ?? "EMPLOYED") === "EMPLOYED" && input.joinedAt && daysBetween(input.joinedAt, today) < 90 && p.kind === "STICKER") {
    factors.push({ id: "tenure", label: "Started current job less than 3 months ago", impact: 10, severity: "info", fix: "Include the employment contract / offer letter to show ties to the UAE." });
  }

  if (input.priorRejections > 0) {
    factors.push({ id: "rejections", label: `${input.priorRejections} previous refusal(s) on record`, impact: Math.min(30, 15 * input.priorRejections), severity: "warn", fix: "Our specialist will address the refusal reason explicitly in the cover letter." });
  }

  const strongHistory = input.travelHistory.some((c) => ["US", "GB", "CA", "AU", "JP", ...STRONG_PASSPORTS].includes(c));
  if (p.kind === "STICKER" && !strongHistory && !GCC.includes(input.nationality) && !(input.age != null && input.age < 18)) {
    factors.push({ id: "history", label: "No prior travel to US/UK/Schengen-type destinations", impact: 10, severity: "info", fix: "List any past visas (even expired) — they materially improve approval odds." });
  }

  if (input.missingRequiredDocs > 0) {
    factors.push({ id: "docs", label: `${input.missingRequiredDocs} required document(s) not yet uploaded`, impact: Math.min(25, input.missingRequiredDocs * 5), severity: "info", fix: "Upload once — they're stored in the vault and reused on every future trip." });
  }

  const blocked = factors.some((f) => f.severity === "block");
  const score = Math.min(100, factors.reduce((s, f) => s + f.impact, 0));
  const level: RiskReport["level"] = blocked ? "BLOCKED" : score >= 50 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";

  // Latest date you can submit and still get a decision before departure
  let latest = new Date(input.travelStart);
  let wd = procDays + (p.biometrics ? 5 : 0);
  while (wd > 0) {
    latest.setUTCDate(latest.getUTCDate() - 1);
    const d = latest.getUTCDay();
    if (d !== 0 && d !== 6) wd--;
  }
  if (latest < today) latest = today;

  return {
    score,
    level,
    factors: factors.sort((a, b) => b.impact - a.impact),
    earliestDecision: decision.toISOString().slice(0, 10),
    latestSafeSubmission: latest.toISOString().slice(0, 10),
  };
}
