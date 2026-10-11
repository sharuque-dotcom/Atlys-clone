// Pre-filled application data sheet: every answer the agent will type into the embassy portal
// (France-Visas / VFS / TLS / GOV.UK / DS-160), in the order those forms ask for it.
// Values we cannot know are left blank so the agent sees exactly what still needs asking.

import { getProduct } from "../catalog";
import { country, emirateName } from "../countries";
import { ageOn } from "../requirements";
import { isSchengen } from "../catalog";
import { EMPLOYMENT, RELATIONSHIPS } from "../types";
import type { Extraction } from "../review/extraction";

export type SheetPerson = {
  firstName: string; lastName: string; gender: string | null; dateOfBirth: Date | null; nationality: string; passportNo: string | null;
  passportExpiry: Date | null; emiratesIdNo: string | null; emiratesIdExpiry: Date | null; residenceVisaExpiry: Date | null; uaeResident: boolean;
  relationship: string; employmentType: string; employerName: string | null; designation: string | null; monthlySalaryAed: number | null;
  phone: string | null; email: string | null; travelHistory: string; priorRejections: number;
};

export type SheetInput = {
  traveler: SheetPerson;
  sponsor: SheetPerson | null;
  household: SheetPerson[];
  customer: { name: string; phone: string | null; email: string | null; emirate: string | null };
  application: { productId: string; destination: string; purpose: string; travelStart: Date; travelEnd: Date; courierAddress: string | null };
  docs: Partial<Record<string, Extraction>>;
};

export type SheetSection = { title: string; rows: [string, string][] };
export type Sheet = { title: string; subtitle: string; sections: SheetSection[] };

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const PURPOSE: Record<string, string> = { TOURISM: "Tourism", FAMILY: "Visiting family or friends", BUSINESS: "Business", CONFERENCE: "Business (conference / event)", TRAINING: "Study / training" };

export function buildSheet(i: SheetInput): Sheet {
  const t = i.traveler;
  const p = getProduct(i.application.productId);
  const pass = i.docs.PASSPORT;
  const visa = i.docs.RESIDENCE_VISA;
  const age = ageOn(t.dateOfBirth, i.application.travelStart);
  const minor = age != null && age < 18;
  const hasSpouse = i.household.some((h) => h.relationship === "SPOUSE") && ["SELF", "SPOUSE"].includes(t.relationship);
  const civil = minor ? "Single (minor)" : hasSpouse ? "Married" : "";
  const nights = Math.round((i.application.travelEnd.getTime() - i.application.travelStart.getTime()) / 86400000);
  const parents = i.household.filter((h) => ["SELF", "SPOUSE"].includes(h.relationship));
  const funder = ["DEPENDENT", "STUDENT", "UNEMPLOYED"].includes(t.employmentType) || minor ? i.sponsor : null;
  const dest = country(i.application.destination).en;
  const schengen = isSchengen(i.application.destination);

  const sections: SheetSection[] = [
    {
      title: "Applicant",
      rows: [
        ["Surname (family name)", t.lastName.toUpperCase()],
        ["First name(s)", t.firstName.toUpperCase()],
        ["Name as in passport MRZ", pass?.holderName ?? ""],
        ["Date of birth", iso(t.dateOfBirth) || pass?.dateOfBirth || ""],
        ["Place / country of birth", ""],
        ["Sex", t.gender === "MALE" ? "Male" : t.gender === "FEMALE" ? "Female" : ""],
        ["Civil status", civil],
        ["Current nationality", country(t.nationality).en],
        ["Nationality at birth, if different", ""],
        ...(minor ? ([["Parental authority / legal guardian", parents.map((x) => `${x.firstName} ${x.lastName} (${country(x.nationality).en})`).join("; ")]] as [string, string][]) : []),
      ],
    },
    {
      title: "Travel document",
      rows: [
        ["Type", "Ordinary passport"],
        ["Number", pass?.documentNumber ?? t.passportNo ?? ""],
        ["Date of issue", pass?.issueDate ?? ""],
        ["Valid until", pass?.expiryDate ?? iso(t.passportExpiry)],
        ["Issued by (country)", country(pass?.nationality ?? t.nationality).en],
      ],
    },
    {
      title: "Residence & contact",
      rows: [
        ["Country of residence", t.uaeResident ? "United Arab Emirates" : ""],
        ["Residence permit type", t.uaeResident && t.nationality !== "AE" ? "UAE residence visa" : t.nationality === "AE" ? "Citizen" : ""],
        ["Residence permit / file no.", visa?.documentNumber ?? ""],
        ["Residence permit valid until", visa?.expiryDate ?? iso(t.residenceVisaExpiry)],
        ["Emirates ID no.", t.emiratesIdNo ?? i.docs.EMIRATES_ID?.documentNumber ?? ""],
        ["Home address", i.application.courierAddress ?? (i.customer.emirate ? `${emirateName(i.customer.emirate)}, UAE` : "")],
        ["Telephone", t.phone ?? i.customer.phone ?? ""],
        ["Email", t.email ?? i.customer.email ?? ""],
      ],
    },
    {
      title: "Occupation",
      rows: [
        ["Current occupation", minor ? (age! >= 5 ? "Student (school)" : "Child") : t.designation ?? EMPLOYMENT[t.employmentType as keyof typeof EMPLOYMENT]?.en ?? ""],
        ["Employer / school", t.employerName ?? i.docs.NOC?.sponsorOrEmployer ?? i.docs.SALARY_CERTIFICATE?.sponsorOrEmployer ?? ""],
        ["Employer address & phone", ""],
        ["Monthly income (AED)", t.monthlySalaryAed ? t.monthlySalaryAed.toLocaleString() : ""],
      ],
    },
    {
      title: "Trip",
      rows: [
        ["Purpose", PURPOSE[i.application.purpose] ?? i.application.purpose],
        [schengen ? "Member State of main destination" : "Destination", dest],
        ...(schengen ? ([["Member State of first entry", dest]] as [string, string][]) : []),
        ["Visa requested", p?.name ?? ""],
        ["Number of entries", p ? (p.entries === "MULTIPLE" ? "Multiple" : "Single") : ""],
        ["Intended arrival", iso(i.application.travelStart)],
        ["Intended departure", iso(i.application.travelEnd)],
        ["Duration of stay", `${nights + 1} days`],
        ["Accommodation (hotel name & address)", ""],
        ["Inviting person / company", i.docs.INVITATION_LETTER?.sponsorOrEmployer ?? ""],
      ],
    },
    {
      title: "Cost of travel & living",
      rows: [
        ["Paid by", funder ? `Sponsor: ${funder.firstName} ${funder.lastName} (${RELATIONSHIPS[t.relationship as keyof typeof RELATIONSHIPS]?.en === "Child" ? "parent" : "family member"})` : "Applicant"],
        ["Means of support", "Cash, credit card, prepaid accommodation, prepaid transport"],
        ["Travel medical insurance", i.docs.TRAVEL_INSURANCE ? `Yes — policy ${i.docs.TRAVEL_INSURANCE.documentNumber ?? ""}` : "To be attached"],
      ],
    },
    {
      title: "History",
      rows: [
        ["Countries visited (last 5 years)", t.travelHistory ? t.travelHistory.split(",").map((c) => country(c).en).join(", ") : "None recorded"],
        ["Previous visa refusals", t.priorRejections ? `${t.priorRejections} — explain in the cover letter` : "None"],
        ...(schengen ? ([["Fingerprints collected for a previous Schengen visa", ""]] as [string, string][]) : []),
        ...(i.application.destination === "US" ? ([["US contact / point of contact", ""], ["Social media identifiers (last 5 years)", ""]] as [string, string][]) : []),
        ...(i.application.destination === "GB" ? ([["How much the trip will cost (GBP)", ""], ["Family in the UK", ""]] as [string, string][]) : []),
      ],
    },
  ];

  const title = schengen
    ? "Schengen visa application — form data (harmonised application form)"
    : i.application.destination === "GB" ? "UK Standard Visitor — GOV.UK online form data"
    : i.application.destination === "US" ? "US DS-160 — form data"
    : `${dest} visa application — form data`;
  return { title, subtitle: `${t.firstName} ${t.lastName} · ${p?.name ?? ""} · ${iso(i.application.travelStart)} → ${iso(i.application.travelEnd)}`, sections };
}
