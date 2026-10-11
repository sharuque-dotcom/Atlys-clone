import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { country } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { getProduct } from "@/lib/catalog";
import { parsePricing } from "@/lib/applications";
import { BUNDLES, type Bundle } from "@/lib/types";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Tax invoice" };

// FTA tax-invoice particulars (Art. 59, Executive Regulation of Federal Decree-Law No. 8 of 2017):
// "Tax Invoice" title, supplier & recipient name/address/TRN, sequential number, date, description,
// rate and amount of tax per line, totals in AED.
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireMember("billing.view");
  const inv = await db.invoice.findFirst({
    where: { id, enterpriseId: user.enterpriseId },
    include: { enterprise: { include: { branches: true } }, applications: { include: { traveler: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!inv) notFound();
  const e = inv.enterprise;
  const billing = e.branches.find((b) => b.type === "BILLING") ?? e.branches[0];
  const isTax = e.invoiceType === "VAT";
  const supplierTrn = process.env.SAFAR_TRN || "TRN pending registration";

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[900px] justify-end px-4"><PrintButton /></div>
      <article className="mx-auto max-w-[900px] bg-white p-10 text-[12px] shadow print:shadow-none">
        <header className="flex justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <div className="text-lg font-bold">Safar Technologies FZ-LLC</div>
            <div className="text-slate-600">Dubai, United Arab Emirates</div>
            <div className="text-slate-600">TRN: {supplierTrn}</div>
          </div>
          <div className="text-end">
            <div className="text-2xl font-bold">{isTax ? "TAX INVOICE" : "INVOICE"}</div>
            <div dir="rtl" className="text-lg">{isTax ? "فاتورة ضريبية" : "فاتورة"}</div>
          </div>
        </header>
        <div className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Bill to</div>
            <div className="font-semibold">{e.legalName}</div>
            <div>{billing?.address}</div>
            {e.trn && <div>TRN: {e.trn}</div>}
          </div>
          <table className="ms-auto text-end">
            <tbody>
              <tr><td className="pe-4 text-slate-500">Invoice no.</td><td className="font-mono">{inv.number}</td></tr>
              <tr><td className="pe-4 text-slate-500">Date of issue / supply</td><td>{fmtDate(inv.issuedAt)}</td></tr>
              <tr><td className="pe-4 text-slate-500">Period</td><td>{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</td></tr>
              <tr><td className="pe-4 text-slate-500">Due</td><td>{fmtDate(inv.dueAt)}</td></tr>
            </tbody>
          </table>
        </div>
        <table className="mt-6 w-full border-collapse">
          <thead className="bg-slate-100 text-start">
            <tr>
              <th className="border p-2 text-start">Ref</th><th className="border p-2 text-start">Description</th>
              <th className="border p-2 text-end">Taxable (AED)</th><th className="border p-2 text-end">VAT 5%</th>
              <th className="border p-2 text-end">Govt fee (disbursement)</th><th className="border p-2 text-end">Line total</th>
            </tr>
          </thead>
          <tbody>
            {inv.applications.map((a) => {
              const p = parsePricing(a);
              return (
                <tr key={a.id}>
                  <td className="border p-2 font-mono">{a.ref}</td>
                  <td className="border p-2">{getProduct(a.productId)?.name} — {a.traveler.firstName} {a.traveler.lastName} ({country(a.destination).en}) · {BUNDLES[a.bundle as Bundle].en}{p.courierFils ? " + courier" : ""}</td>
                  <td className="border p-2 text-end tabular-nums">{(p.taxableFils / 100).toFixed(2)}</td>
                  <td className="border p-2 text-end tabular-nums">{(p.vatFils / 100).toFixed(2)}</td>
                  <td className="border p-2 text-end tabular-nums">{(p.governmentFils / 100).toFixed(2)}</td>
                  <td className="border p-2 text-end tabular-nums">{(p.totalFils / 100).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <table className="ms-auto mt-4 w-80">
          <tbody>
            <tr><td className="py-1 text-slate-600">Total taxable value</td><td className="text-end tabular-nums">{formatAed(inv.taxableFils)}</td></tr>
            <tr><td className="py-1 text-slate-600">VAT @ 5%</td><td className="text-end tabular-nums">{formatAed(inv.vatFils)}</td></tr>
            <tr><td className="py-1 text-slate-600">Disbursements (outside scope of VAT)</td><td className="text-end tabular-nums">{formatAed(inv.disbursementFils)}</td></tr>
            <tr className="border-t-2 border-slate-800 font-bold"><td className="py-2">Total payable (AED)</td><td className="text-end tabular-nums">{formatAed(inv.totalFils)}</td></tr>
          </tbody>
        </table>
        <p className="mt-8 text-[10px] text-slate-500">Government and embassy fees are paid on the customer&apos;s behalf and recharged at cost as disbursements; they are not consideration for a supply by Safar and are outside the scope of UAE VAT. Bank transfer: details on your account page. Questions: billing@safar.example</p>
      </article>
    </div>
  );
}
