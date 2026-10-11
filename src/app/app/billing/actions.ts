"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseNetPricing } from "@/lib/applications";
import { audit } from "@/lib/audit";
import { addDays } from "@/lib/dates";

/** Safar → agency: consolidates all un-invoiced, confirmed applications at NET rates into one FTA tax invoice. */
export async function generateInvoice() {
  const user = await requireMember("billing.view");
  const apps = await db.application.findMany({
    where: { enterpriseId: user.enterpriseId, invoiceId: null, status: { notIn: ["DRAFT", "CANCELLED"] } },
    orderBy: { createdAt: "asc" },
  });
  if (apps.length === 0) redirect("/app/billing?error=Nothing+to+invoice+yet");
  let taxable = 0, vat = 0, disb = 0;
  for (const a of apps) {
    const p = parseNetPricing(a);
    taxable += p.taxableFils;
    vat += p.vatFils;
    disb += p.governmentFils;
  }
  const count = await db.invoice.count({ where: { enterpriseId: user.enterpriseId } });
  const now = new Date();
  const invoice = await db.invoice.create({
    data: {
      number: `SF-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${user.enterprise.companyCode.slice(0, 4)}-${String(count + 1).padStart(4, "0")}`,
      enterpriseId: user.enterpriseId,
      periodStart: apps[0].createdAt,
      periodEnd: now,
      dueAt: addDays(now, user.enterprise.plan === "STARTER" ? 7 : 30),
      taxableFils: taxable,
      vatFils: vat,
      disbursementFils: disb,
      totalFils: taxable + vat + disb,
      applications: { connect: apps.map((a) => ({ id: a.id })) },
    },
  });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "invoice.issued", "Invoice", invoice.id, { number: invoice.number, totalFils: invoice.totalFils });
  revalidatePath("/app/billing");
  redirect(`/app/billing?ok=Invoice+${invoice.number}+issued`);
}

export async function markPaid(formData: FormData) {
  const user = await requireMember("billing.view");
  const id = String(formData.get("id"));
  const inv = await db.invoice.findFirst({ where: { id, enterpriseId: user.enterpriseId } });
  if (!inv) redirect("/app/billing?error=Invoice+not+found");
  await db.invoice.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, "invoice.paid", "Invoice", id);
  revalidatePath("/app/billing");
  redirect("/app/billing?ok=Marked+as+paid");
}
