import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { country, emirateName } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { getProduct } from "@/lib/catalog";
import { bookingBalance, parsePricing } from "@/lib/applications";
import { bookingTotals } from "@/lib/pricing";
import { BUNDLES, PAYMENT_METHODS, type Bundle } from "@/lib/types";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Quote / invoice" };

// The AGENCY's document to its retail customer: a quotation while QUOTED, then a tax invoice + receipt.
export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireMember();
  const b = await db.booking.findFirst({
    where: { id, enterpriseId: user.enterpriseId },
    include: { enterprise: { include: { branches: true } }, customer: true, payments: { orderBy: { createdAt: "asc" } }, applications: { include: { traveler: true }, where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "asc" } } },
  });
  if (!b) notFound();
  const e = b.enterprise;
  const office = e.branches.find((x) => x.type === "BILLING") ?? e.branches[0];
  const isQuote = b.status === "QUOTED";
  const isTax = e.invoiceType === "VAT";
  const title = isQuote ? ["QUOTATION", "عرض سعر"] : isTax ? ["TAX INVOICE", "فاتورة ضريبية"] : ["INVOICE", "فاتورة"];
  const lines = b.applications.map((a) => ({ a, p: parsePricing(a) }));
  const totals = bookingTotals(lines.map((l) => l.p), b.discountFils, isTax);
  const { taxableFils: taxable, vatFils: vat, totalFils: total } = totals;
  const { paid, due } = bookingBalance(b, b.payments);

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[860px] justify-end px-4"><PrintButton /></div>
      <article className="mx-auto max-w-[860px] bg-white p-10 text-[12px] shadow print:shadow-none">
        <header className="flex justify-between border-b-2 pb-4" style={{ borderColor: e.brandColor }}>
          <div>
            <div className="text-lg font-bold" style={{ color: e.brandColor }}>{e.legalName}</div>
            <div className="text-slate-600">{office?.address}, {emirateName(office?.emirate ?? e.emirate)}, UAE</div>
            <div className="text-slate-600">{e.phone}{e.email ? ` · ${e.email}` : ""}</div>
            {e.tourismLicenseNo && <div className="text-slate-600">Tourism licence {e.tourismLicenseNo}</div>}
            {isTax && e.trn && <div className="text-slate-600">TRN: {e.trn}</div>}
          </div>
          <div className="text-end"><div className="text-2xl font-bold">{title[0]}</div><div dir="rtl" className="text-lg">{title[1]}</div></div>
        </header>
        <div className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">{isQuote ? "Prepared for" : "Bill to"}</div>
            <div className="font-semibold">{b.customer.name}</div>
            <div>{b.customer.phone}{b.customer.email ? ` · ${b.customer.email}` : ""}</div>
          </div>
          <table className="ms-auto text-end"><tbody>
            <tr><td className="pe-4 text-slate-500">{isQuote ? "Quote no." : "Invoice no."}</td><td className="font-mono">{e.invoicePrefix}-{b.ref.slice(3)}</td></tr>
            <tr><td className="pe-4 text-slate-500">Date</td><td>{fmtDate(isQuote ? b.createdAt : b.updatedAt)}</td></tr>
            <tr><td className="pe-4 text-slate-500">Trip</td><td>{country(b.destination).en} · {fmtDate(b.travelStart)} – {fmtDate(b.travelEnd)}</td></tr>
          </tbody></table>
        </div>
        <table className="mt-6 w-full border-collapse">
          <thead className="bg-slate-100"><tr>
            <th className="border p-2 text-start">Traveler & service</th><th className="border p-2 text-end">Service (AED)</th>
            {isTax && <th className="border p-2 text-end">VAT 5%</th>}<th className="border p-2 text-end">Embassy fee*</th><th className="border p-2 text-end">Total</th>
          </tr></thead>
          <tbody>
            {lines.map(({ a, p }) => (
              <tr key={a.id}>
                <td className="border p-2">{a.traveler.firstName} {a.traveler.lastName} — {getProduct(a.productId)?.name} ({BUNDLES[a.bundle as Bundle].en})</td>
                <td className="border p-2 text-end tabular-nums">{(p.taxableFils / 100).toFixed(2)}</td>
                {isTax && <td className="border p-2 text-end tabular-nums">{(p.vatFils / 100).toFixed(2)}</td>}
                <td className="border p-2 text-end tabular-nums">{(p.governmentFils / 100).toFixed(2)}</td>
                <td className="border p-2 text-end tabular-nums">{(p.totalFils / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="ms-auto mt-4 w-80"><tbody>
          {b.discountFils > 0 && <tr><td className="py-1 text-slate-600">Family discount</td><td className="text-end">− {formatAed(b.discountFils)}</td></tr>}
          <tr><td className="py-1 text-slate-600">Taxable value</td><td className="text-end tabular-nums">{formatAed(taxable)}</td></tr>
          {isTax && <tr><td className="py-1 text-slate-600">VAT @ 5%</td><td className="text-end tabular-nums">{formatAed(vat)}</td></tr>}
          <tr><td className="py-1 text-slate-600">Embassy fees (disbursement)</td><td className="text-end tabular-nums">{formatAed(totals.governmentFils)}</td></tr>
          <tr className="border-t-2 border-slate-800 font-bold"><td className="py-2">Total (AED)</td><td className="text-end tabular-nums">{formatAed(total)}</td></tr>
          {!isQuote && <tr><td className="py-1 text-slate-600">Paid</td><td className="text-end tabular-nums">{formatAed(paid)}</td></tr>}
          {!isQuote && <tr className="font-semibold"><td className="py-1">Balance due</td><td className="text-end tabular-nums">{formatAed(due)}</td></tr>}
        </tbody></table>
        {!isQuote && b.payments.length > 0 && (
          <div className="mt-6"><div className="text-xs font-semibold uppercase text-slate-500">Payments received</div>
            <ul className="mt-1">{b.payments.map((p) => <li key={p.id}>{fmtDate(p.createdAt)} — {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]} {p.reference ? `(${p.reference})` : ""} — {formatAed(p.amountFils)}</li>)}</ul></div>
        )}
        <p className="mt-8 text-[10px] text-slate-500">* Embassy/government fees are collected on your behalf and paid at cost; they are outside the scope of UAE VAT. {isQuote ? "Quotation valid for 7 days; embassy fees may change without notice." : ""} Visa issuance is at the sole discretion of the embassy; service fees are non-refundable once the application is submitted unless the Protect bundle was purchased.</p>
      </article>
    </div>
  );
}
