import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { country } from "@/lib/countries";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { getProduct } from "@/lib/catalog";
import { bookingBalance, parseNetPricing, parsePricing, parseRisk } from "@/lib/applications";
import { BOOKING_STATUSES, PAYMENT_METHODS, RELATIONSHIPS, can, type BookingStatus } from "@/lib/types";
import { Badge, Flash, PageHeader, RiskBadge, Section, StatusBadge } from "@/components/ui";
import { cancelBooking, confirmBookingAction, recordPayment, rotatePortalLink } from "./actions";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireMember();
  const locale = await getLocale();
  const b = await db.booking.findFirst({
    where: { id, enterpriseId: user.enterpriseId },
    include: { customer: true, applications: { include: { traveler: true }, orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "asc" } }, createdBy: true },
  });
  if (!b) notFound();
  const { paid, due } = bookingBalance(b, b.payments);
  const st = BOOKING_STATUSES[b.status as BookingStatus];
  const portal = `${process.env.APP_URL ?? "http://localhost:3000"}/c/${b.portalToken}`;
  const net = b.applications.filter((a) => a.status !== "CANCELLED").reduce((s, a) => s + parseNetPricing(a).totalFils, 0);
  const margin = b.sellTotalFils - net;
  const agency = user.enterprise.name;
  const lines = b.applications.map((a) => `• ${a.traveler.firstName}: ${getProduct(a.productId)?.name} — ${formatAed(parsePricing(a).totalFils)}`).join("\n");
  const waText = b.status === "QUOTED"
    ? `Hello ${b.customer.name.split(" ")[0]}, here is your ${country(b.destination).en} visa quote from ${agency} (${b.ref}):\n${lines}\n${b.discountFils ? `Family discount: −${formatAed(b.discountFils)}\n` : ""}Total: ${formatAed(b.sellTotalFils)} (incl. embassy fees${user.enterprise.invoiceType === "VAT" ? " & VAT" : ""}).\n\nSee the document checklist for each traveler and upload from your phone: ${portal}`
    : `Hello ${b.customer.name.split(" ")[0]}, track your ${country(b.destination).en} visas (${b.ref}) and upload documents here: ${portal}${due > 0 ? `\nBalance due: ${formatAed(due)}` : ""}`;
  const wa = b.customer.phone ? `https://wa.me/${b.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}` : null;

  return (
    <div>
      <div className="mb-2 text-sm text-slate-500"><Link href="/app/bookings" className="hover:underline">Bookings</Link> / <span className="font-mono">{b.ref}</span></div>
      <PageHeader
        title={<>{country(b.destination).flag} {b.customer.name} → {country(b.destination).en}</>}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={st.tone}>{st.en}</Badge>{fmtDate(b.travelStart, locale)} – {fmtDate(b.travelEnd, locale)} · {b.purpose.toLowerCase()} · by {b.createdBy.name}</span>}
        actions={<>
          {wa && <a href={wa} target="_blank" className="btn-primary">{b.status === "QUOTED" ? "Send quote on WhatsApp" : "WhatsApp update"}</a>}
          <a href={`/receipt/${b.id}`} target="_blank" className="btn-secondary">{b.status === "QUOTED" ? "Print quote" : "Invoice / receipt"}</a>
        </>}
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title={`Travelers · ${b.applications.length} visa${b.applications.length === 1 ? "" : "s"}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="border-b border-slate-100"><tr><th className="th">Traveler</th><th className="th">Visa</th><th className="th">Risk</th><th className="th">Status</th><th className="th text-end">Price</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {b.applications.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="td"><Link href={`/app/applications/${a.id}`} className="font-medium text-brand-700 hover:underline">{a.traveler.firstName} {a.traveler.lastName}</Link><div className="text-xs text-slate-500">{country(a.traveler.nationality).flag} {RELATIONSHIPS[a.traveler.relationship as keyof typeof RELATIONSHIPS]?.en} · <span className="font-mono">{a.ref}</span></div></td>
                      <td className="td text-xs">{getProduct(a.productId)?.name}</td>
                      <td className="td"><RiskBadge level={parseRisk(a)?.level} /></td>
                      <td className="td"><StatusBadge status={a.status} locale={locale} /></td>
                      <td className="td text-end tabular-nums">{formatAed(parsePricing(a).totalFils, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {b.status === "QUOTED" && can(user.role, "applications.create") && (
              <form action={confirmBookingAction} className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
                <input type="hidden" name="id" value={b.id} />
                <span className="text-sm text-slate-600">Customer agreed? Confirm to start processing (recording a payment also confirms).</span>
                <button className="btn-primary">Confirm booking</button>
              </form>
            )}
          </Section>

          <Section title="Customer portal">
            <div className="space-y-2 p-4 text-sm">
              <p className="text-slate-600">The family opens this link on their phone to see each person&apos;s checklist, upload documents (including passport photos straight from the camera) and follow progress. No login needed.</p>
              <code className="block select-all break-all rounded-lg bg-slate-100 px-3 py-2 text-xs">{portal}</code>
              <div className="flex gap-2">
                <a href={`/c/${b.portalToken}`} target="_blank" className="btn-secondary text-xs">Open as customer</a>
                <form action={rotatePortalLink}><input type="hidden" name="id" value={b.id} /><button className="btn-ghost text-xs">Revoke & regenerate link</button></form>
              </div>
            </div>
          </Section>

          {b.notes && <Section title="Internal notes"><p className="p-4 text-sm text-slate-700">{b.notes}</p></Section>}
        </div>

        <div className="space-y-6">
          <Section title="Payment">
            <dl className="space-y-1.5 p-4 text-sm">
              {b.discountFils > 0 && <div className="flex justify-between"><dt className="text-slate-500">Family discount</dt><dd>− {formatAed(b.discountFils, locale)}</dd></div>}
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatAed(b.sellTotalFils, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd className="tabular-nums">{formatAed(paid, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Balance</dt><dd className={`tabular-nums font-medium ${due > 0 ? "text-amber-700" : "text-emerald-700"}`}>{due > 0 ? formatAed(due, locale) : "Paid in full"}</dd></div>
            </dl>
            {b.payments.length > 0 && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100 text-xs">
                {b.payments.map((p) => <li key={p.id} className="flex justify-between px-4 py-2"><span>{fmtDateTime(p.createdAt, locale)} · {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]}{p.reference ? ` · ${p.reference}` : ""}</span><span className="tabular-nums">{formatAed(p.amountFils, locale)}</span></li>)}
              </ul>
            )}
            {due > 0 && b.status !== "CANCELLED" && can(user.role, "payments.record") && (
              <form action={recordPayment} className="space-y-2 border-t border-slate-100 p-4">
                <input type="hidden" name="id" value={b.id} />
                <div className="flex gap-2">
                  <input name="amount" type="number" step="0.01" min="0.01" max={due / 100} defaultValue={due / 100} className="input" />
                  <select name="method" className="input">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </div>
                <input name="reference" placeholder="Reference (receipt / transfer no.)" className="input" />
                <button className="btn-primary w-full">Record payment</button>
              </form>
            )}
          </Section>

          {can(user.role, "billing.view") && (
            <Section title="Your margin">
              <dl className="space-y-1.5 p-4 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Sold to customer</dt><dd className="tabular-nums">{formatAed(b.sellTotalFils, locale)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Safar net cost</dt><dd className="tabular-nums">{formatAed(net, locale)}</dd></div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><dt>Margin (before VAT)</dt><dd className="tabular-nums text-emerald-700">{formatAed(margin, locale)}</dd></div>
              </dl>
            </Section>
          )}

          <Section title="Customer">
            <div className="p-4 text-sm">
              <Link href={`/app/customers/${b.customer.id}`} className="font-medium text-brand-700 hover:underline">{b.customer.name}</Link>
              <div className="text-slate-500">{b.customer.phone}{b.customer.email ? ` · ${b.customer.email}` : ""}</div>
            </div>
          </Section>

          {!["CANCELLED", "COMPLETED"].includes(b.status) && (
            <form action={cancelBooking}><input type="hidden" name="id" value={b.id} /><button className="btn-ghost w-full text-rose-700">Cancel booking</button></form>
          )}
        </div>
      </div>
    </div>
  );
}
