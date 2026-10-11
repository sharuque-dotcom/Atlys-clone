import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { parsePricing } from "@/lib/applications";
import { Badge, Empty, Flash, PageHeader, Section, Stat } from "@/components/ui";
import { generateInvoice, markPaid } from "./actions";

export default async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember("billing.view");
  const locale = await getLocale();
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [invoices, unbilled, costCenters, ytd] = await Promise.all([
    db.invoice.findMany({ where: { enterpriseId: user.enterpriseId }, orderBy: { issuedAt: "desc" }, include: { _count: { select: { applications: true } } } }),
    db.application.findMany({ where: { enterpriseId: user.enterpriseId, invoiceId: null, status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED"] } } }),
    db.costCenter.findMany({ where: { enterpriseId: user.enterpriseId }, include: { applications: { where: { status: { not: "CANCELLED" }, createdAt: { gte: yearStart } } } } }),
    db.application.findMany({ where: { enterpriseId: user.enterpriseId, status: { not: "CANCELLED" }, createdAt: { gte: yearStart } } }),
  ]);
  const sum = (xs: { pricing: string }[], k: "totalFils" | "vatFils") => xs.reduce((s, a) => s + parsePricing(a)[k], 0);
  const outstanding = invoices.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.totalFils, 0);

  return (
    <div>
      <PageHeader title="Billing & VAT" subtitle={`${user.enterprise.legalName}${user.enterprise.trn ? ` · TRN ${user.enterprise.trn}` : " · non-VAT invoicing"}`} actions={<form action={generateInvoice}><button className="btn-primary">Issue invoice for unbilled ({unbilled.length})</button></form>} />
      <Flash searchParams={sp} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Spend year-to-date" value={formatAed(sum(ytd, "totalFils"), locale)} />
        <Stat label="Input VAT reclaimable (YTD)" value={formatAed(sum(ytd, "vatFils"), locale)} hint="5% on service fees" />
        <Stat label="Unbilled" value={formatAed(sum(unbilled, "totalFils"), locale)} hint={`${unbilled.length} applications`} />
        <Stat label="Outstanding" value={formatAed(outstanding, locale)} hint={user.enterprise.plan === "STARTER" ? "7-day terms" : "30-day terms"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Section title="Tax invoices">
          {invoices.length === 0 ? <Empty title="No invoices yet" /> : (
            <table className="w-full">
              <thead className="border-b border-slate-100"><tr><th className="th">Number</th><th className="th">Issued</th><th className="th">Due</th><th className="th text-end">Total</th><th className="th">Status</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="td"><Link href={`/invoice/${i.id}`} target="_blank" className="font-mono text-xs text-brand-700 hover:underline">{i.number}</Link><div className="text-xs text-slate-500">{i._count.applications} applications</div></td>
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
        <Section title="Cost centres (YTD vs budget)">
          <ul className="space-y-4 p-4">
            {costCenters.map((c) => {
              const spent = sum(c.applications, "totalFils");
              const pct = c.budgetFils ? Math.min(100, Math.round((spent / c.budgetFils) * 100)) : 0;
              return (
                <li key={c.id}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{c.code} · {c.name}</span><span className="tabular-nums">{formatAed(spent, locale)}</span></div>
                  {c.budgetFils > 0 && <>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} /></div>
                    <div className="mt-0.5 text-xs text-slate-500">{pct}% of {formatAed(c.budgetFils, locale)}</div>
                  </>}
                </li>
              );
            })}
          </ul>
        </Section>
      </div>
    </div>
  );
}
