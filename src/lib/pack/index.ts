import "server-only";
import { db } from "../db";
import { checklist, householdContext } from "../applications";
import { getProduct } from "../catalog";
import { reviewChecklist } from "../review";
import { parseExtraction, type Extraction } from "../review/extraction";
import { audit } from "../audit";
import { buildSheet } from "./datasheet";
import { buildPack, type PackApplicant } from "./build";
import { openLetterRenderer } from "./letters";

/** Assembles the consolidated, print-ready PDF for one or more applications of the same agency. */
export async function generatePack(opts: {
  enterpriseId: string;
  agencyName: string;
  applicationIds: string[];
  origin: string;
  sessionCookie: { name: string; value: string } | null;
  actor: { id: string; name: string };
}) {
  const apps = await db.application.findMany({
    where: { id: { in: opts.applicationIds }, enterpriseId: opts.enterpriseId, status: { not: "CANCELLED" } },
    include: {
      traveler: { include: { documents: true } },
      booking: { include: { customer: { include: { members: true } }, applications: { include: { traveler: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!apps.length) return null;

  const applicants: PackApplicant[] = apps.map((a) => {
    const household = a.booking?.customer.members ?? [a.traveler];
    const companions = a.booking?.applications.map((x) => x.traveler) ?? [a.traveler];
    const ctx = householdContext(a.traveler, companions, household);
    const sponsor = household.find((m) => m.id === a.traveler.sponsorId) ?? household.find((m) => m.relationship === "SELF" && m.id !== a.traveler.id) ?? null;
    const review = reviewChecklist(checklist(a, a.traveler, ctx), a.traveler, {
      sponsor,
      trip: { start: a.travelStart, end: a.travelEnd, destination: a.destination, productId: a.productId, familySize: ctx.familySize },
    });
    const docs: Partial<Record<string, Extraction>> = {};
    for (const d of [...a.traveler.documents].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
      const x = parseExtraction(d.extracted);
      if (x) docs[d.type] = x;
    }
    const product = getProduct(a.productId);
    return {
      applicationId: a.id,
      name: `${a.traveler.firstName} ${a.traveler.lastName}`,
      ref: a.ref,
      visa: product?.name ?? a.productId,
      center: a.appointmentCenter ?? product?.centers[0] ?? "",
      items: review.items,
      sheet: buildSheet({
        traveler: a.traveler,
        sponsor,
        household,
        customer: a.booking?.customer ?? { name: `${a.traveler.firstName} ${a.traveler.lastName}`, phone: a.traveler.phone, email: a.traveler.email, emirate: null },
        application: a,
        docs,
      }),
    };
  });

  const renderer = await openLetterRenderer(opts.origin, opts.sessionCookie);
  try {
    const bytes = await buildPack({ agency: opts.agencyName, applicants, renderLetter: renderer?.render ?? null });
    await audit({ id: opts.actor.id, name: opts.actor.name, enterpriseId: opts.enterpriseId }, "pack.generated", "Application", apps[0].id, { applications: apps.map((a) => a.ref), lettersRendered: !!renderer });
    return { bytes, applicants };
  } finally {
    await renderer?.close();
  }
}
