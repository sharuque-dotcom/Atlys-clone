// Demo workspace: Falcon Logistics L.L.C (Dubai) — a realistic multi-national UAE workforce.
// Sign in with any demo user below and the password DEMO_PASSWORD.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { getProduct, type Purpose } from "../src/lib/catalog";
import { price } from "../src/lib/pricing";
import { assessRisk } from "../src/lib/risk";
import { requirementsFor } from "../src/lib/requirements";
import { addDays } from "../src/lib/dates";
import { randomCode } from "../src/lib/refs";
import type { Bundle } from "../src/lib/types";

const db = new PrismaClient();
const DEMO_PASSWORD = "Safar-Demo-2026!";
const now = new Date();
const d = (days: number) => addDays(now, days);

async function main() {
  await db.enterprise.deleteMany({ where: { domain: "falconlogistics.ae" } });
  await db.user.deleteMany({ where: { email: { endsWith: "@falconlogistics.ae" } } });
  await db.user.deleteMany({ where: { email: "new.joiner@gmail.com" } });

  const enterprise = await db.enterprise.create({
    data: {
      name: "Falcon Logistics",
      legalName: "Falcon Logistics L.L.C",
      domain: "falconlogistics.ae",
      companyCode: "FALCON26",
      tradeLicenseNo: "1029384",
      licenseAuthority: "DED Dubai",
      trn: "100234567800003",
      invoiceType: "VAT",
      emirate: "DXB",
      industry: "Logistics & freight",
      size: "201–1,000",
      plan: "GROWTH",
      branches: {
        create: [
          { name: "Head office", type: "BILLING", emirate: "DXB", address: "Office 1204, The Opus, Business Bay, Dubai" },
          { name: "JAFZA warehouse", type: "BRANCH_OFFICE", emirate: "DXB", address: "Plot S30402, Jebel Ali Free Zone, Dubai" },
          { name: "Abu Dhabi office", type: "SHIPPING", emirate: "AUH", address: "Floor 9, Al Khatem Tower, ADGM, Abu Dhabi" },
        ],
      },
      costCenters: {
        create: [
          { code: "SALES", name: "Sales & BD", budgetFils: 6000000 },
          { code: "OPS", name: "Operations", budgetFils: 3500000 },
          { code: "EXEC", name: "Leadership", budgetFils: 4000000 },
          { code: "GEN", name: "General", budgetFils: 0 },
        ],
      },
      policy: { create: { requireApproval: true, autoApproveBelowFils: 120000, blockedDestinations: "" } },
    },
    include: { branches: true, costCenters: true },
  });

  const pw = await hashPassword(DEMO_PASSWORD);
  const mk = (email: string, name: string, role: string, phone?: string) =>
    db.user.create({ data: { email, name, role, phone, passwordHash: pw, enterpriseId: enterprise.id } });
  const layla = await mk("layla@falconlogistics.ae", "Layla Al Hashimi", "OWNER", "+971501112233");
  const arjun = await mk("arjun@falconlogistics.ae", "Arjun Nair", "APPROVER", "+971502223344");
  const fatima = await mk("fatima@falconlogistics.ae", "Fatima Rahman", "FINANCE");
  const maria = await mk("maria@falconlogistics.ae", "Maria Santos", "EMPLOYEE", "+971554445566");
  await mk("khalid@falconlogistics.ae", "Khalid Al Suwaidi", "TRAVEL_MANAGER");

  const pending = await db.user.create({ data: { email: "new.joiner@gmail.com", name: "Daniel Okafor", passwordHash: pw } });
  await db.accessRequest.create({ data: { enterpriseId: enterprise.id, userId: pending.id, fullName: pending.name, designation: "Fleet Coordinator" } });

  const branch = enterprise.branches[0];
  const cc = Object.fromEntries(enterprise.costCenters.map((c) => [c.code, c.id]));

  type T = import("@prisma/client").Prisma.TravelerUncheckedCreateInput;
  const people: (Omit<T, "enterpriseId"> & { key: string })[] = [
    { key: "layla", userId: layla.id, firstName: "Layla", lastName: "Al Hashimi", nationality: "AE", designation: "Chief Executive Officer", department: "Leadership", monthlySalaryAed: 85000, passportNo: "A1234567", passportExpiry: d(2400), emiratesIdNo: "784-1985-1234567-3", emiratesIdExpiry: d(900), uaeResident: true, travelHistory: "GB,FR,US,JP", phone: "+971501112233", gender: "FEMALE", joinedAt: d(-3000) },
    { key: "arjun", userId: arjun.id, firstName: "Arjun", lastName: "Nair", nationality: "IN", designation: "Head of Sales", department: "Sales", monthlySalaryAed: 42000, passportNo: "Z4821936", passportExpiry: d(1900), residenceVisaExpiry: d(640), emiratesIdExpiry: d(640), uaeResident: true, travelHistory: "GB,DE,SG", phone: "+971502223344", gender: "MALE", joinedAt: d(-2100) },
    { key: "maria", userId: maria.id, firstName: "Maria", lastName: "Santos", nationality: "PH", designation: "Key Account Manager", department: "Sales", monthlySalaryAed: 14500, passportNo: "P7712345A", passportExpiry: d(1500), residenceVisaExpiry: d(75), emiratesIdExpiry: d(75), uaeResident: true, travelHistory: "SG,TH", phone: "+971554445566", gender: "FEMALE", joinedAt: d(-900) },
    { key: "omar", firstName: "Omar", lastName: "Khalid", nationality: "EG", designation: "Operations Manager", department: "Operations", monthlySalaryAed: 26000, passportNo: "A29384756", passportExpiry: d(1100), residenceVisaExpiry: d(500), emiratesIdExpiry: d(500), uaeResident: true, travelHistory: "SA,TR", phone: "+971505556677", gender: "MALE", joinedAt: d(-1500) },
    { key: "bilal", firstName: "Bilal", lastName: "Ahmed", nationality: "PK", designation: "Fleet Supervisor", department: "Operations", monthlySalaryAed: 9500, passportNo: "AB1234567", passportExpiry: d(150), residenceVisaExpiry: d(400), emiratesIdExpiry: d(400), uaeResident: true, travelHistory: "", phone: "+971506667788", gender: "MALE", joinedAt: d(-700) },
    { key: "james", firstName: "James", lastName: "Carter", nationality: "GB", designation: "CFO", department: "Finance", monthlySalaryAed: 70000, passportNo: "533829104", passportExpiry: d(2000), residenceVisaExpiry: d(800), emiratesIdExpiry: d(800), uaeResident: true, travelHistory: "US,FR,DE", gender: "MALE", joinedAt: d(-1200) },
    { key: "priya", firstName: "Priya", lastName: "Sharma", nationality: "IN", designation: "Business Development Executive", department: "Sales", monthlySalaryAed: 12000, passportNo: "V9988776", passportExpiry: d(2800), residenceVisaExpiry: d(560), emiratesIdExpiry: d(560), uaeResident: true, travelHistory: "", phone: "+971507778899", gender: "FEMALE", joinedAt: d(-60) },
    { key: "chen", firstName: "Wei", lastName: "Chen", nationality: "CN", designation: "Procurement Lead", department: "Operations", monthlySalaryAed: 31000, passportNo: "E81234567", passportExpiry: d(2100), residenceVisaExpiry: d(300), emiratesIdExpiry: d(300), uaeResident: true, travelHistory: "SG,JP", gender: "MALE", joinedAt: d(-1300) },
    { key: "nimal", firstName: "Nimal", lastName: "Perera", nationality: "LK", designation: "Warehouse Manager", department: "Operations", monthlySalaryAed: 16000, passportNo: "N5544332", passportExpiry: d(1300), residenceVisaExpiry: d(35), emiratesIdExpiry: d(35), uaeResident: true, travelHistory: "", gender: "MALE", joinedAt: d(-1800) },
    { key: "rania", firstName: "Rania", lastName: "Haddad", nationality: "JO", designation: "HR Business Partner", department: "People", monthlySalaryAed: 22000, passportNo: "K123987", passportExpiry: d(1700), residenceVisaExpiry: d(700), emiratesIdExpiry: d(700), uaeResident: true, travelHistory: "TR,GB", gender: "FEMALE", joinedAt: d(-1000) },
    { key: "sabbir", firstName: "Sabbir", lastName: "Hossain", nationality: "BD", designation: "Logistics Coordinator", department: "Operations", monthlySalaryAed: 7000, passportNo: "EB0123456", passportExpiry: d(1600), residenceVisaExpiry: d(450), emiratesIdExpiry: d(450), uaeResident: true, travelHistory: "", gender: "MALE", joinedAt: d(-500) },
    { key: "elena", firstName: "Elena", lastName: "Ivanova", nationality: "RU", designation: "Solutions Architect", department: "Technology", monthlySalaryAed: 38000, passportNo: "754321098", passportExpiry: d(1400), residenceVisaExpiry: d(600), emiratesIdExpiry: d(600), uaeResident: true, travelHistory: "TR,GE,TH", gender: "FEMALE", joinedAt: d(-800) },
  ];

  const travelers: Record<string, Awaited<ReturnType<typeof db.traveler.create>>> = {};
  let n = 1000;
  for (const { key, ...p } of people) {
    travelers[key] = await db.traveler.create({ data: { ...p, enterpriseId: enterprise.id, branchId: branch.id, employeeId: `FL-${n++}`, email: `${p.firstName.toLowerCase()}@falconlogistics.ae`, managerId: arjun.id } });
  }

  // Vault documents (metadata only — demo files are not on disk)
  const vault = async (key: string, types: string[]) => {
    const t = travelers[key];
    for (const type of types) {
      await db.travelerDocument.create({
        data: {
          travelerId: t.id, type, fileName: `${type.toLowerCase()}_${t.lastName.toLowerCase().replace(/\s/g, "_")}.pdf`, mimeType: "application/pdf", size: 180_000 + Math.floor(Math.random() * 400_000),
          storageKey: `demo/${t.id}/${type}.pdf`, sha256: randomCode(32).toLowerCase(),
          expiresAt: type === "PASSPORT" ? t.passportExpiry : type === "RESIDENCE_VISA" || type === "EMIRATES_ID" ? t.residenceVisaExpiry ?? t.emiratesIdExpiry : null,
        },
      });
    }
  };
  await vault("arjun", ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "BANK_STATEMENT", "TRAVEL_INSURANCE"]);
  await vault("maria", ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA"]);
  await vault("omar", ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "BANK_STATEMENT"]);
  await vault("chen", ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "BANK_STATEMENT", "INVITATION_LETTER"]);
  await vault("layla", ["PASSPORT", "EMIRATES_ID"]);
  await vault("priya", ["PASSPORT", "PHOTO"]);
  await vault("rania", ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "BANK_STATEMENT"]);

  const trip = await db.trip.create({ data: { enterpriseId: enterprise.id, name: "Transport Logistic Munich — sales delegation", destination: "DE", purpose: "CONFERENCE", startDate: d(48), endDate: d(53) } });

  let refN = 0;
  const app = async (o: {
    key: string; product: string; purpose: Purpose; start: number; end: number; status: string; bundle?: Bundle; cc: string;
    createdBy: string; tripId?: string; createdDaysAgo: number; appointment?: number; events: [string, string, number][];
  }) => {
    const t = (await db.traveler.findUnique({ where: { id: travelers[o.key].id }, include: { documents: true } }))!;
    const product = getProduct(o.product)!;
    const bundle = o.bundle ?? "STANDARD";
    const pricing = price(product, bundle, product.passportSubmission ? "PICKUP" : "NONE", "GROWTH");
    const reqs = requirementsFor(product, { nationality: t.nationality, uaeResident: t.uaeResident }, o.purpose);
    const missing = reqs.filter((r) => r.required && !r.autoGenerated && !t.documents.some((x) => x.type === r.key)).length;
    const risk = assessRisk({
      product, nationality: t.nationality, uaeResident: t.uaeResident, passportExpiry: t.passportExpiry, residenceVisaExpiry: t.residenceVisaExpiry,
      emiratesIdExpiry: t.emiratesIdExpiry, monthlySalaryAed: t.monthlySalaryAed, joinedAt: t.joinedAt, priorRejections: t.priorRejections,
      travelHistory: t.travelHistory.split(",").filter(Boolean), travelStart: d(o.start), travelEnd: d(o.end), missingRequiredDocs: missing, priority: bundle !== "STANDARD",
    });
    const created = d(-o.createdDaysAgo);
    const decided = ["ISSUED", "REJECTED"].includes(o.status) ? d(-Math.max(1, o.createdDaysAgo - 12)) : null;
    return db.application.create({
      data: {
        ref: `SF-${["K7P2QX", "M4T9WD", "R8C3NV", "H2Y6LB", "Q5J8ZE", "T3V7GA", "W9N4KF", "B6X2PM", "D8R5HC", "F4L7SU", "G2Z9TY", "J6E3WN"][refN++] ?? randomCode(6)}`,
        enterpriseId: enterprise.id, travelerId: t.id, tripId: o.tripId ?? null, costCenterId: cc[o.cc], destination: product.destination, productId: product.id,
        purpose: o.purpose, travelStart: d(o.start), travelEnd: d(o.end), bundle, status: o.status, riskScore: risk.score, riskReport: JSON.stringify(risk),
        pricing: JSON.stringify(pricing), courier: product.passportSubmission ? "PICKUP" : "NONE", courierAddress: product.passportSubmission ? branch.address : null,
        createdById: o.createdBy, approvedById: o.status === "PENDING_APPROVAL" ? null : arjun.id, approvedAt: o.status === "PENDING_APPROVAL" ? null : created,
        appointmentAt: o.appointment != null ? d(o.appointment) : null, appointmentCenter: o.appointment != null ? product.centers[0] : null,
        submittedAt: ["SUBMITTED", "ISSUED", "REJECTED"].includes(o.status) ? d(-Math.max(1, o.createdDaysAgo - 5)) : null,
        decidedAt: decided, createdAt: created,
        events: { create: o.events.map(([type, message, ago]) => ({ type, message, actorName: type.startsWith("STATUS") ? "Safar Ops" : "Layla Al Hashimi", createdAt: d(-ago) })) },
      },
    });
  };

  const a1 = await app({ key: "arjun", product: "DE-schengen-c", purpose: "CONFERENCE", start: 48, end: 53, status: "APPOINTMENT_BOOKED", bundle: "PRIORITY", cc: "SALES", createdBy: layla.id, tripId: trip.id, createdDaysAgo: 9, appointment: 6,
    events: [["CREATED", "Application created for Schengen short-stay visa (Type C)", 9], ["AUTO_APPROVED", "Auto-approved by travel policy", 9], ["STATUS_IN_REVIEW", "Expert review started", 8], ["STATUS_APPOINTMENT_BOOKED", "VFS Global Dubai — Wafi Mall appointment held", 5]] });
  await app({ key: "maria", product: "DE-schengen-c", purpose: "CONFERENCE", start: 48, end: 53, status: "IN_REVIEW", bundle: "PRIORITY", cc: "SALES", createdBy: layla.id, tripId: trip.id, createdDaysAgo: 9,
    events: [["CREATED", "Application created for Schengen short-stay visa (Type C)", 9], ["AUTO_APPROVED", "Auto-approved by travel policy", 9], ["STATUS_IN_REVIEW", "Specialist flagged residence visa renewal — receipt requested", 7]] });
  await app({ key: "priya", product: "DE-schengen-c", purpose: "CONFERENCE", start: 48, end: 53, status: "DOCS_PENDING", cc: "SALES", createdBy: layla.id, tripId: trip.id, createdDaysAgo: 9,
    events: [["CREATED", "Application created for Schengen short-stay visa (Type C)", 9], ["AUTO_APPROVED", "Auto-approved by travel policy", 9], ["STATUS_DOCS_PENDING", "Waiting for Emirates ID, residence visa and bank statement", 8]] });
  await app({ key: "chen", product: "DE-schengen-c", purpose: "CONFERENCE", start: 48, end: 53, status: "SUBMITTED", cc: "SALES", createdBy: layla.id, tripId: trip.id, createdDaysAgo: 14, appointment: -4,
    events: [["CREATED", "Application created", 14], ["AUTO_APPROVED", "Auto-approved by travel policy", 14], ["STATUS_APPOINTMENT_BOOKED", "Biometrics appointment booked", 12], ["STATUS_SUBMITTED", "Biometrics done, passport with consulate", 4]] });

  await app({ key: "omar", product: "GB-visitor", purpose: "BUSINESS", start: 30, end: 36, status: "PENDING_APPROVAL", cc: "OPS", createdBy: maria.id, createdDaysAgo: 1,
    events: [["CREATED", "Application created for UK Standard Visitor visa", 1], ["APPROVAL_REQUESTED", "Sent for manager approval (above auto-approve limit)", 1]] });
  await app({ key: "bilal", product: "SA-gcc-resident-evisa", purpose: "BUSINESS", start: 20, end: 24, status: "DOCS_PENDING", cc: "OPS", createdBy: layla.id, createdDaysAgo: 2,
    events: [["CREATED", "Application created for Saudi eVisa for GCC residents", 2], ["AUTO_APPROVED", "Auto-approved by travel policy", 2]] });
  await app({ key: "elena", product: "CN-m", purpose: "BUSINESS", start: 25, end: 32, status: "PENDING_APPROVAL", bundle: "PROTECT", cc: "OPS", createdBy: maria.id, createdDaysAgo: 0,
    events: [["CREATED", "Application created for China business visa (M)", 0], ["APPROVAL_REQUESTED", "Sent for manager approval (above auto-approve limit)", 0]] });

  const issued1 = await app({ key: "rania", product: "GB-visitor", purpose: "TRAINING", start: -20, end: -15, status: "ISSUED", cc: "GEN", createdBy: layla.id, createdDaysAgo: 50,
    events: [["CREATED", "Application created", 50], ["STATUS_SUBMITTED", "Submitted at TLScontact Dubai", 42], ["STATUS_ISSUED", "Visa issued — 2-year multiple entry", 33]] });
  const issued2 = await app({ key: "omar", product: "TR-evisa", purpose: "BUSINESS", start: -10, end: -6, status: "ISSUED", cc: "OPS", createdBy: layla.id, createdDaysAgo: 30,
    events: [["CREATED", "Application created", 30], ["STATUS_SUBMITTED", "Submitted online", 29], ["STATUS_ISSUED", "e-Visa issued", 28]] });
  const issued3 = await app({ key: "chen", product: "JP-short", purpose: "BUSINESS", start: -40, end: -34, status: "ISSUED", cc: "OPS", createdBy: layla.id, createdDaysAgo: 70,
    events: [["CREATED", "Application created", 70], ["STATUS_SUBMITTED", "Submitted at Consulate-General of Japan, Dubai", 64], ["STATUS_ISSUED", "Visa issued", 58]] });
  await app({ key: "sabbir", product: "TH-evisa", purpose: "TOURISM", start: -5, end: 2, status: "REJECTED", cc: "GEN", createdBy: layla.id, createdDaysAgo: 40,
    events: [["CREATED", "Application created", 40], ["STATUS_SUBMITTED", "Submitted online", 38], ["STATUS_REJECTED", "Refused: insufficient proof of funds — re-application advised with sponsor letter", 26]] });

  const inv1Apps = [issued1, issued3];
  const sums = inv1Apps.map((a) => JSON.parse(a.pricing)).reduce((s, p) => ({ t: s.t + p.taxableFils, v: s.v + p.vatFils, g: s.g + p.governmentFils }), { t: 0, v: 0, g: 0 });
  await db.invoice.create({
    data: {
      number: "SF-" + d(-35).toISOString().slice(0, 7).replace("-", "") + "-FALC-0001", enterpriseId: enterprise.id, periodStart: d(-70), periodEnd: d(-35), issuedAt: d(-35), dueAt: d(-5),
      taxableFils: sums.t, vatFils: sums.v, disbursementFils: sums.g, totalFils: sums.t + sums.v + sums.g, status: "PAID", paidAt: d(-10),
      applications: { connect: inv1Apps.map((a) => ({ id: a.id })) },
    },
  });
  void issued2;

  await db.message.createMany({
    data: [
      { enterpriseId: enterprise.id, applicationId: a1.id, authorName: "Layla Al Hashimi", body: "Can we get Arjun an earlier slot? He has a client meeting in Riyadh that week." },
      { enterpriseId: enterprise.id, applicationId: a1.id, authorName: "Safar Concierge · Noura", fromAgent: true, body: "Done — moved to an earlier morning slot at VFS Wafi. Courier pickup from Business Bay the day before at 4pm." },
    ],
  });

  for (const [action, entity, ago] of [["enterprise.created", "Enterprise", 120], ["policy.updated", "Policy", 100], ["application.created", "Application", 9], ["document.uploaded", "TravelerDocument", 8], ["invoice.issued", "Invoice", 35]] as const) {
    await db.auditLog.create({ data: { enterpriseId: enterprise.id, actorId: layla.id, actorName: layla.name, action, entity, createdAt: d(-ago) } });
  }

  console.log(`Seeded "${enterprise.name}". Sign in as layla@falconlogistics.ae (owner), arjun@ (approver), fatima@ (finance), maria@ (employee) — password: ${DEMO_PASSWORD}`);
  void fatima;
}

main().finally(() => db.$disconnect());
