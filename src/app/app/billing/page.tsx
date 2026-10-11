import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { parseNetPricing, parsePricing } from "@/lib/applications";
import { bookingTotals } from "@/lib/pricing";
import { PAYMENT_METHODS } from "@/lib/types";
import { Badge, Empty, Flash, PageHeader, Section, Stat } from "@/components/ui";
import { generateInvoice, markPaid } from "./actions";

export default async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember("billing.view");
  const locale = await getLocale();
  const E = user.enterpriseId;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [invoices, unbilled, monthBookings, monthPayments] = await Promise.all([
    db.invoice.findMany({ where: { enterpriseId: E }, orderBy: { issuedAt: "desc" }, include: { _count: { select: { applications: true } } } }),
    db.application.findMany({ where: { enterpriseId: E, invoiceId: null, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
    db.booking.findMany({ where: { enterpriseId: E, createdAt: { gte: monthStart }, status: { notIn: ["QUOTED", "CANCELLED"] } }, include: { applications: true } }),
    db.payment.findMany({ where: { enterpriseId: E, createdAt: { gte: monthStart } } }),
  ]);
  const unbilledNet = unbilled.reduce((s, a) => s + parseNetPricing(a).totalFils, 0);
  const sales = monthBookings.reduce((s, b) => s + b.sellTotalFils, 0);
  const vatReg = user.enterprise.invoiceType === "VAT";
  const salesVat = monthBookings.reduce((s, b) => s + bookingTotals(b.applications.filter((a) => a.status !== "CANCELLED").map(parsePricing), b.discountFils, vatReg).vatFils, 0);
  const cost = monthBookings.reduce((s, b) => s + b.applications.filter((a) => a.status !== "CANCELLED").reduce((x, a) => x + parseNetPricing(a).totalFils, 0), 0);
  const inputVat = monthBookings.reduce((s, b) => s + b.applications.filter((a) => a.status !== "CANCELLED").reduce((x, a) => x + parseNetPricing(a).vatFils, 0), 0);
  const outstanding = invoices.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.totalFils, 0);
  const byMethod = Object.entries(PAYMENT_METHODS).map(([k, label]) => ({ label, total: monthPayments.filter((p) => p.method === k).reduce((s, p) => s + p.amountFils, 0) }));

  return (
    <div>
      <PageHeader title="Statements & VAT" subtitle={`${user.enterprise.legalName}${user.enterprise.trn ? ` · TRN ${user.enterprise.trn}` : " · not VAT-registered"}`} actions={<form action={generateInvoice}><button className="btn-primary">Close period — issue Safar statement ({unbilled.length})</button></form>} />
      <Flash searchParams={sp} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sales this month" value={formatAed(sales, locale)} hint={`margin ${formatAed(sales - cost, locale)}`} />
        <Stat label="Output VAT (this month)" value={formatAed(salesVat, locale)} hint={`input VAT on platform fees ${formatAed(inputVat, locale)}`} />
        <Stat label="Platform fees (unbilled)" value={formatAed(unbilledNet, locale)} hint={`${unbilled.length} applications`} />
        <Stat label="Safar statements unpaid" value={formatAed(outstanding, locale)} hint={user.enterprise.plan === "STARTER" ? "7-day terms" : "30-day terms"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Section title="Safar statements (platform fees)">
          {invoices.length === 0 ? <Empty title="No statements yet" /> : (
            <table className="w-full">
              <thead className="border-b border-slate-100"><tr><th className="th">Number</th><th className="th">Issued</th><th className="th">Due</th><th className="th text-end">Total</th><th className="th">Status</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="td"><Link href={`/invoice/${i.id}`} target="_blank" className="font-mono text-xs text-brand-700 hover:underline">{i.number}</Link><div className="text-xs text-slate-500">{i._count.applications} visas</div></td>
                    <td className="td text-xs">{fmtDate(i.issuedAt, locale)}</td>
                    <td className="td text-xs">{fmtDate(i.dueAt, locale)}</td>
                    <td className="td text-end tabular-nums">{formatAed(i.totalFils, locale)}</td>
                    <td className="td"><Badge tone={i.status === "PAID" ? "green" : i.dueAt < now ? "red" : "amber"}>{i.status === "PAID" ? "Paid" : i.dueAt < now ? "Overdue" : "Issued"}</Badge></td>
                    <td className="td">{i.status !== "PAID" && <form action={markPaid}><input type="hidden" name="id" value={i.id} /><button className="btn-ghost text-xs">Mark paid</button></form>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        <Section title="Collected from customers (this month)">
          <ul className="space-y-2 p-4 text-sm">
            {byMethod.map((m) => <li key={m.label} className="flex justify-between"><span className="text-slate-500">{m.label}</span><span className="tabular-nums">{formatAed(m.total, locale)}</span></li>)}
            <li className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><span>Total</span><span className="tabular-nums">{formatAed(monthPayments.reduce((s, p) => s + p.amountFils, 0), locale)}</span></li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
