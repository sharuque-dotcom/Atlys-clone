// Demo workspace: Oasis Travel & Tours (Al Karama, Dubai) — a travel agency serving retail families.
// Sign in with any demo user below and the password DEMO_PASSWORD.

import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { getProduct, type Purpose } from "../src/lib/catalog";
import { bookingTotals, quote, type AgencyPricing } from "../src/lib/pricing";
import { assessRisk } from "../src/lib/risk";
import { ageOn } from "../src/lib/requirements";
import { householdContext } from "../src/lib/household";
import { addDays } from "../src/lib/dates";
import { randomCode } from "../src/lib/refs";
import { randomBytes } from "node:crypto";
import type { Bundle } from "../src/lib/types";

const db = new PrismaClient();
const DEMO_PASSWORD = "Safar-Demo-2026!";
const now = new Date();
const d = (days: number) => addDays(now, days);
const yearsAgo = (y: number, extraDays = 0) => addDays(now, -Math.round(y * 365.25) - extraDays);

async function main() {
  await db.enterprise.deleteMany({ where: { domain: "oasistravel.ae" } });
  await db.user.deleteMany({ where: { email: { endsWith: "@oasistravel.ae" } } });
  await db.user.deleteMany({ where: { email: "new.joiner@gmail.com" } });

  const agency = await db.enterprise.create({
    data: {
      name: "Oasis Travel & Tours",
      legalName: "Oasis Travel & Tourism L.L.C",
      domain: "oasistravel.ae",
      companyCode: "OASIS26",
      tradeLicenseNo: "784512",
      licenseAuthority: "DED Dubai",
      tourismLicenseNo: "DET-TA-20931",
      trn: "100345678900003",
      invoiceType: "VAT",
      emirate: "DXB",
      phone: "+971501234567",
      email: "visas@oasistravel.ae",
      brandColor: "#0f6e8c",
      invoicePrefix: "OTT",
      markupPct: 40,
      plan: "GROWTH",
      branches: {
        create: [
          { name: "Karama branch", type: "BILLING", emirate: "DXB", address: "Shop 14, Karama Centre, Al Karama, Dubai" },
          { name: "Sharjah branch", type: "BRANCH_OFFICE", emirate: "SHJ", address: "Al Taawun Street, Al Khan, Sharjah" },
        ],
      },
      // The agency's own retail prices for its best sellers
      agencyPrices: { create: [{ productId: "FR-schengen-c", serviceFeeFils: 45000 }, { productId: "GB-visitor", serviceFeeFils: 55000 }] },
    },
  });

  const pw = await hashPassword(DEMO_PASSWORD);
  const mk = (email: string, name: string, role: string) => db.user.create({ data: { email, name, role, passwordHash: pw, enterpriseId: agency.id } });
  const huda = await mk("huda@oasistravel.ae", "Huda Al Marzooqi", "OWNER");
  const ravi = await mk("ravi@oasistravel.ae", "Ravi Kumar", "AGENT");
  await mk("grace@oasistravel.ae", "Grace Lim", "ACCOUNTANT");
  await mk("sameer@oasistravel.ae", "Sameer Qureshi", "ADMIN");
  const pending = await db.user.create({ data: { email: "new.joiner@gmail.com", name: "Daniel Okafor", passwordHash: pw } });
  await db.accessRequest.create({ data: { enterpriseId: agency.id, userId: pending.id, fullName: pending.name, designation: "Visa counter agent" } });

  const pricing: AgencyPricing = { plan: "GROWTH", markupPct: 40, overrides: { "FR-schengen-c": 45000, "GB-visitor": 55000 }, vatRegistered: true };

  type M = Omit<Prisma.TravelerUncheckedCreateInput, "enterpriseId" | "customerId"> & { docs?: string[] };
  const household = async (c: { name: string; phone: string; email?: string; source: string; emirate: string; notes?: string; createdDaysAgo: number }, members: M[]) => {
    const { createdDaysAgo, ...fields } = c;
    const customer = await db.customer.create({ data: { ...fields, enterpriseId: agency.id, assignedToId: ravi.id, createdAt: d(-createdDaysAgo) } });
    const created = [];
    for (const { docs, ...m } of members) {
      const t = await db.traveler.create({ data: { ...m, enterpriseId: agency.id, customerId: customer.id } });
      for (const type of docs ?? []) {
        await db.travelerDocument.create({
          data: {
            travelerId: t.id, type, fileName: `${type.toLowerCase()}_${t.firstName.toLowerCase()}.pdf`, mimeType: "application/pdf", size: 150_000 + Math.floor(Math.random() * 300_000),
            storageKey: `demo/${t.id}/${type}.pdf`, sha256: randomCode(32).toLowerCase(),
            expiresAt: type === "PASSPORT" ? t.passportExpiry : type === "RESIDENCE_VISA" || type === "EMIRATES_ID" ? t.residenceVisaExpiry : null,
          },
        });
      }
      created.push(t);
    }
    // Link dependents to the main applicant as sponsor
    const self = created.find((x) => x.relationship === "SELF");
    for (const t of created) if (self && t.id !== self.id && ["DEPENDENT", "STUDENT"].includes(t.employmentType)) await db.traveler.update({ where: { id: t.id }, data: { sponsorId: self.id } });
    return { customer, members: await db.traveler.findMany({ where: { customerId: customer.id }, include: { documents: true }, orderBy: { createdAt: "asc" } }) };
  };

  let appN = 0;
  const APP_REFS = ["SF-K7P2QX", "SF-M4T9WD", "SF-R8C3NV", "SF-H2Y6LB", "SF-Q5J8ZE", "SF-T3V7GA", "SF-W9N4KF", "SF-B6X2PM", "SF-D8R5HC", "SF-F4L7SU", "SF-G2Z9TY", "SF-J6E3WN", "SF-N3P8RA"];
  const booking = async (o: {
    h: Awaited<ReturnType<typeof household>>; ref: string; product: (name: string) => string | null; purpose: Purpose; start: number; end: number;
    bundle?: Bundle; status: string; appStatus: (name: string) => string; createdDaysAgo: number; discountAed?: number; paidAed?: number; payMethod?: string;
    appointment?: number; events?: (name: string) => [string, string, number][]; notes?: string;
  }) => {
    const members = o.h.members;
    const bundle = o.bundle ?? "STANDARD";
    const lines = members.filter((m) => o.product(m.firstName)).map((m) => {
      const product = getProduct(o.product(m.firstName)!)!;
      const age = ageOn(m.dateOfBirth, d(o.start));
      const ctx = householdContext(m, members, o.h.members);
      const q = quote(product, bundle, product.passportSubmission ? "PICKUP" : "NONE", pricing, age);
      const risk = assessRisk({
        product, nationality: m.nationality, uaeResident: m.uaeResident, passportExpiry: m.passportExpiry, residenceVisaExpiry: m.residenceVisaExpiry,
        emiratesIdExpiry: m.emiratesIdExpiry, monthlySalaryAed: m.monthlySalaryAed, joinedAt: m.joinedAt, priorRejections: m.priorRejections,
        travelHistory: m.travelHistory.split(",").filter(Boolean), travelStart: d(o.start), travelEnd: d(o.end), missingRequiredDocs: 0, priority: bundle !== "STANDARD",
        employmentType: m.employmentType, age, sponsorSalaryAed: ctx.sponsorSalaryAed, familySize: ctx.familySize, today: d(-o.createdDaysAgo),
      });
      return { m, product, q, risk };
    });
    const totals = bookingTotals(lines.map((l) => l.q.sell), (o.discountAed ?? 0) * 100, true);
    const created = d(-o.createdDaysAgo);
    const b = await db.booking.create({
      data: {
        ref: o.ref, enterpriseId: agency.id, customerId: o.h.customer.id, destination: lines[0].product.destination, purpose: o.purpose,
        travelStart: d(o.start), travelEnd: d(o.end), status: o.status, portalToken: randomBytes(24).toString("base64url"),
        sellTotalFils: totals.totalFils, netTotalFils: lines.reduce((s, l) => s + l.q.net.totalFils, 0), discountFils: totals.discountFils,
        notes: o.notes ?? null, createdById: ravi.id, createdAt: created,
        applications: {
          create: lines.map(({ m, product, q, risk }) => {
            const status = o.appStatus(m.firstName);
            return {
              ref: APP_REFS[appN++] ?? `SF-${randomCode(6)}`, enterpriseId: agency.id, travelerId: m.id, destination: product.destination, productId: product.id,
              purpose: o.purpose, travelStart: d(o.start), travelEnd: d(o.end), bundle, status, riskScore: risk.score, riskReport: JSON.stringify(risk),
              pricing: JSON.stringify(q.sell), netPricing: JSON.stringify(q.net), courier: product.passportSubmission ? "PICKUP" : "NONE",
              courierAddress: product.passportSubmission ? "Villa 21, Street 4, Al Barsha 2, Dubai" : null, createdById: ravi.id, createdAt: created,
              appointmentAt: o.appointment != null && ["APPOINTMENT_BOOKED", "SUBMITTED", "ISSUED", "REJECTED"].includes(status) ? d(o.appointment) : null,
              appointmentCenter: o.appointment != null && ["APPOINTMENT_BOOKED", "SUBMITTED", "ISSUED", "REJECTED"].includes(status) ? product.centers[0] : null,
              submittedAt: ["SUBMITTED", "ISSUED", "REJECTED"].includes(status) ? d(-Math.max(1, o.createdDaysAgo - 6)) : null,
              decidedAt: ["ISSUED", "REJECTED"].includes(status) ? d(-Math.max(1, o.createdDaysAgo - 15)) : null,
              events: {
                create: [
                  { type: "CREATED", message: `Quoted ${product.name}`, actorName: ravi.name, createdAt: created },
                  ...(o.events?.(m.firstName) ?? []).map(([type, message, ago]) => ({ type, message, actorName: type === "CUSTOMER_UPLOAD" ? o.h.customer.name : "Safar Ops", createdAt: d(-ago) })),
                ],
              },
            };
          }),
        },
      },
    });
    if (o.paidAed) {
      await db.payment.create({ data: { enterpriseId: agency.id, bookingId: b.id, amountFils: Math.min(o.paidAed * 100, totals.totalFils), method: o.payMethod ?? "CARD", reference: o.payMethod === "BANK_TRANSFER" ? "FT26-889102" : null, receivedBy: ravi.name, createdAt: addDays(created, 1) } });
    }
    return b;
  };

  // 1) Indian family of four → France, holiday. Both kids get Schengen child fees; mum is a dependent on dad's file.
  const mehta = await household(
    { name: "Rohan Mehta", phone: "+971501112233", email: "rohan.mehta@gmail.com", source: "REFERRAL", emirate: "DXB", notes: "Prefers weekend appointments. Referred by the Shahs.", createdDaysAgo: 20 },
    [
      { firstName: "Rohan", lastName: "Mehta", relationship: "SELF", employmentType: "EMPLOYED", employerName: "Gulf Engineering Consultants LLC", designation: "Senior Project Engineer", monthlySalaryAed: 26000, joinedAt: yearsAgo(4), nationality: "IN", gender: "MALE", dateOfBirth: yearsAgo(39), passportNo: "Z4821936", passportExpiry: d(1900), emiratesIdNo: "784-1987-4821936-1", residenceVisaExpiry: d(640), emiratesIdExpiry: d(640), travelHistory: "GB,SG,TH", phone: "+971501112233", docs: ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "BANK_STATEMENT", "NOC", "SALARY_CERTIFICATE"] },
      { firstName: "Priya", lastName: "Mehta", relationship: "SPOUSE", employmentType: "DEPENDENT", nationality: "IN", gender: "FEMALE", dateOfBirth: yearsAgo(36), passportNo: "Z5519021", passportExpiry: d(2100), residenceVisaExpiry: d(640), emiratesIdExpiry: d(640), travelHistory: "SG,TH", docs: ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA"] },
      { firstName: "Aarav", lastName: "Mehta", relationship: "CHILD", employmentType: "DEPENDENT", nationality: "IN", gender: "MALE", dateOfBirth: yearsAgo(9, -40), passportNo: "Z7712044", passportExpiry: d(1300), residenceVisaExpiry: d(640), emiratesIdExpiry: d(640), docs: ["PASSPORT", "PHOTO"] },
      { firstName: "Anaya", lastName: "Mehta", relationship: "CHILD", employmentType: "DEPENDENT", nationality: "IN", gender: "FEMALE", dateOfBirth: yearsAgo(4, -100), passportNo: "Z8830511", passportExpiry: d(1500), residenceVisaExpiry: d(640), emiratesIdExpiry: d(640), docs: ["PASSPORT"] },
    ],
  );
  await booking({
    h: mehta, ref: "BK-PARIS7", product: () => "FR-schengen-c", purpose: "TOURISM", start: 42, end: 52, status: "IN_PROGRESS", createdDaysAgo: 12, discountAed: 100, paidAed: 1500, payMethod: "CARD", appointment: 8,
    appStatus: (n) => (n === "Rohan" ? "APPOINTMENT_BOOKED" : n === "Priya" ? "IN_REVIEW" : "DOCS_PENDING"),
    events: (n) => n === "Rohan"
      ? [["STATUS_IN_REVIEW", "Booking confirmed — processing started", 11], ["STATUS_APPOINTMENT_BOOKED", "TLScontact Dubai — family slot held for all four", 6]]
      : n === "Priya" ? [["STATUS_IN_REVIEW", "Booking confirmed — processing started", 11], ["CUSTOMER_UPLOAD", "Customer uploaded UAE residence visa", 9]]
      : [["STATUS_DOCS_PENDING", "Waiting for birth certificate and residence visa", 11]],
    notes: "Wants Paris + Disneyland; hotel near Marne-la-Vallée for 3 nights.",
  });

  // 2) Filipino mother + teenage son → UK, open quote. Residence expires in 75 days: risk flagged.
  const santos = await household(
    { name: "Maria Santos", phone: "+971554445566", source: "SOCIAL", emirate: "SHJ", createdDaysAgo: 3 },
    [
      { firstName: "Maria", lastName: "Santos", relationship: "SELF", employmentType: "EMPLOYED", employerName: "Al Zahra Hospital", designation: "Staff Nurse", monthlySalaryAed: 11500, joinedAt: yearsAgo(6), nationality: "PH", gender: "FEMALE", dateOfBirth: yearsAgo(41), passportNo: "P7712345A", passportExpiry: d(1500), residenceVisaExpiry: d(75), emiratesIdExpiry: d(75), travelHistory: "SG", docs: ["PASSPORT", "EMIRATES_ID"] },
      { firstName: "Miguel", lastName: "Santos", relationship: "CHILD", employmentType: "STUDENT", nationality: "PH", gender: "MALE", dateOfBirth: yearsAgo(15), passportNo: "P8841230B", passportExpiry: d(1200), residenceVisaExpiry: d(75), emiratesIdExpiry: d(75) },
    ],
  );
  await booking({ h: santos, ref: "BK-LONDN4", product: () => "GB-visitor", purpose: "FAMILY", start: 50, end: 64, status: "QUOTED", createdDaysAgo: 2, appStatus: () => "DRAFT" });

  // 3) Emirati couple → UK. GCC passports need only an ETA. Completed.
  const nuaimi = await household(
    { name: "Ahmed Al Nuaimi", phone: "+971506667788", source: "REPEAT", emirate: "AUH", createdDaysAgo: 120 },
    [
      { firstName: "Ahmed", lastName: "Al Nuaimi", relationship: "SELF", employmentType: "EMPLOYED", employerName: "ADNOC", designation: "Engineer", monthlySalaryAed: 48000, nationality: "AE", gender: "MALE", dateOfBirth: yearsAgo(45), passportNo: "A7731901", passportExpiry: d(2400), emiratesIdNo: "784-1981-7731901-4", emiratesIdExpiry: d(900), travelHistory: "GB,FR,US", docs: ["PASSPORT", "EMIRATES_ID"] },
      { firstName: "Mariam", lastName: "Al Nuaimi", relationship: "SPOUSE", employmentType: "DEPENDENT", nationality: "AE", gender: "FEMALE", dateOfBirth: yearsAgo(41), passportNo: "A7731955", passportExpiry: d(2400), emiratesIdExpiry: d(900), travelHistory: "GB,FR", docs: ["PASSPORT", "EMIRATES_ID"] },
    ],
  );
  await booking({ h: nuaimi, ref: "BK-ETAUK2", product: () => "GB-eta", purpose: "TOURISM", start: -30, end: -18, status: "COMPLETED", createdDaysAgo: 50, paidAed: 400, payMethod: "CASH", appStatus: () => "ISSUED", events: () => [["STATUS_SUBMITTED", "Submitted online", 49], ["STATUS_ISSUED", "UK ETA approved — valid 2 years", 47]] });

  // 4) Pakistani resident → Saudi GCC-resident eVisa (Umrah). Passport expiring soon.
  const bilal = await household(
    { name: "Bilal Ahmed", phone: "+971527778899", source: "WALK_IN", emirate: "AJM", createdDaysAgo: 4 },
    [{ firstName: "Bilal", lastName: "Ahmed", relationship: "SELF", employmentType: "EMPLOYED", employerName: "Emirates Transport", designation: "Driver", monthlySalaryAed: 5500, nationality: "PK", gender: "MALE", dateOfBirth: yearsAgo(34), passportNo: "AB1234567", passportExpiry: d(160), residenceVisaExpiry: d(400), emiratesIdExpiry: d(400), docs: ["PASSPORT", "PHOTO"] }],
  );
  await booking({ h: bilal, ref: "BK-UMRAH3", product: () => "SA-gcc-resident-evisa", purpose: "TOURISM", start: 18, end: 25, status: "IN_PROGRESS", createdDaysAgo: 3, paidAed: 900, payMethod: "CASH", appStatus: () => "DOCS_PENDING", events: () => [["STATUS_DOCS_PENDING", "Need Emirates ID and residence visa copy", 3]] });

  // 5) Egyptian couple → Italy: husband issued, wife refused (prior history). Shows refusal handling.
  const khalid = await household(
    { name: "Omar Khalid", phone: "+971509990011", source: "WHATSAPP", emirate: "DXB", createdDaysAgo: 70 },
    [
      { firstName: "Omar", lastName: "Khalid", relationship: "SELF", employmentType: "SELF_EMPLOYED", employerName: "Khalid Trading FZE", designation: "Owner", monthlySalaryAed: 30000, nationality: "EG", gender: "MALE", dateOfBirth: yearsAgo(44), passportNo: "A29384756", passportExpiry: d(1100), residenceVisaExpiry: d(500), emiratesIdExpiry: d(500), travelHistory: "SA,TR,FR", docs: ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA", "TRADE_LICENSE", "BANK_STATEMENT"] },
      { firstName: "Nour", lastName: "Khalid", relationship: "SPOUSE", employmentType: "DEPENDENT", nationality: "EG", gender: "FEMALE", dateOfBirth: yearsAgo(38), passportNo: "A30112233", passportExpiry: d(1300), residenceVisaExpiry: d(500), emiratesIdExpiry: d(500), priorRejections: 1, docs: ["PASSPORT", "PHOTO", "EMIRATES_ID", "RESIDENCE_VISA"] },
    ],
  );
  await booking({
    h: khalid, ref: "BK-ROMA19", product: () => "IT-schengen-c", purpose: "TOURISM", start: -10, end: 0, status: "COMPLETED", createdDaysAgo: 60, paidAed: 2600, payMethod: "BANK_TRANSFER", appointment: -50,
    appStatus: (n) => (n === "Omar" ? "ISSUED" : "REJECTED"),
    events: (n) => [["STATUS_SUBMITTED", "Biometrics done at VFS Wafi", 54], n === "Omar" ? ["STATUS_ISSUED", "Visa issued — 90 days multiple entry", 45] : ["STATUS_REJECTED", "Refused: marriage certificate not attested — re-apply with MOFA attestation", 45]],
  });

  // 6) Walk-in with nothing booked yet — passport expiring = renewal lead
  await household(
    { name: "Nimal Perera", phone: "+971561239876", source: "WALK_IN", emirate: "DXB", notes: "Asked about Georgia for December. Passport needs renewal first.", createdDaysAgo: 1 },
    [{ firstName: "Nimal", lastName: "Perera", relationship: "SELF", employmentType: "EMPLOYED", employerName: "Lulu Hypermarket", designation: "Section Supervisor", monthlySalaryAed: 7500, nationality: "LK", gender: "MALE", dateOfBirth: yearsAgo(37), passportNo: "N5544332", passportExpiry: d(95), residenceVisaExpiry: d(35), emiratesIdExpiry: d(35) }],
  );

  // Safar statement for last month's completed work
  const done = await db.application.findMany({ where: { enterpriseId: agency.id, status: { in: ["ISSUED", "REJECTED"] } } });
  const net = done.map((a) => JSON.parse(a.netPricing!)).reduce((s, p) => ({ t: s.t + p.taxableFils, v: s.v + p.vatFils, g: s.g + p.governmentFils }), { t: 0, v: 0, g: 0 });
  await db.invoice.create({
    data: {
      number: `SF-${d(-30).toISOString().slice(0, 7).replace("-", "")}-OASI-0001`, enterpriseId: agency.id, periodStart: d(-60), periodEnd: d(-30), issuedAt: d(-30), dueAt: d(0),
      taxableFils: net.t, vatFils: net.v, disbursementFils: net.g, totalFils: net.t + net.v + net.g, status: "ISSUED",
      applications: { connect: done.map((a) => ({ id: a.id })) },
    },
  });

  await db.message.createMany({
    data: [
      { enterpriseId: agency.id, authorName: "Ravi Kumar", body: "Mehta family — can we get all four on the same TLS slot? Kids have school." },
      { enterpriseId: agency.id, authorName: "Safar Concierge · Noura", fromAgent: true, body: "Done — family slot on Saturday 10:30 at TLScontact Dubai. Courier pickup from Al Barsha on Friday evening." },
    ],
  });
  for (const [action, entity, ago] of [["enterprise.created", "Enterprise", 180], ["pricing.updated", "Enterprise", 90], ["booking.quoted", "Booking", 12], ["payment.recorded", "Booking", 11]] as const) {
    await db.auditLog.create({ data: { enterpriseId: agency.id, actorId: huda.id, actorName: huda.name, action, entity, createdAt: d(-ago) } });
  }

  console.log(`Seeded "${agency.name}". Sign in as huda@oasistravel.ae (owner), ravi@ (agent), grace@ (accountant), sameer@ (branch manager) — password: ${DEMO_PASSWORD}`);
}

main().finally(() => db.$disconnect());
