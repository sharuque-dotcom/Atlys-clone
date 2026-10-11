import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { DESTINATIONS } from "@/lib/catalog";
import { country } from "@/lib/countries";
import { formatAed } from "@/lib/money";
import { price, volumeDiscount } from "@/lib/pricing";
import { Flash, PageHeader, Section } from "@/components/ui";
import { savePricing } from "./actions";

export default async function Pricing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember("pricing.manage");
  const locale = await getLocale();
  const e = user.enterprise;
  const overrides = new Map((await db.agencyPrice.findMany({ where: { enterpriseId: e.id } })).map((p) => [p.productId, p.serviceFeeFils]));

  return (
    <div>
      <PageHeader title="Pricing & margins" subtitle={`You buy at Safar net rates (${e.plan.toLowerCase()} plan: ${Math.round(volumeDiscount(e.plan) * 100)}% off list) and set your own retail price. Embassy fees always pass through at cost.`} />
      <Flash searchParams={sp} />
      <form action={savePricing}>
        <Section title="Default markup" className="mb-6">
          <div className="flex flex-wrap items-end gap-4 p-4">
            <label className="block"><span className="label">Markup on Safar&apos;s net service fee</span>
              <div className="flex items-center gap-2"><input name="markupPct" type="number" min={0} max={500} defaultValue={e.markupPct} className="input w-28" /><span className="text-sm text-slate-500">%</span></div></label>
            <p className="max-w-md text-xs text-slate-500">Used for every visa without a fixed retail fee below, and for Priority/Protect bundles and courier.</p>
          </div>
        </Section>
        <Section title="Retail service fee per visa (AED, before VAT)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-100 bg-slate-50/60"><tr><th className="th">Visa</th><th className="th text-end">Embassy fee</th><th className="th text-end">Your cost</th><th className="th">Your fee</th><th className="th text-end">Margin</th><th className="th text-end">Customer pays (adult)</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {DESTINATIONS.flatMap((d) => d.products).map((p) => {
                  const net = price(p, "STANDARD", "NONE", e.plan);
                  const sellService = overrides.get(p.id) ?? Math.round(net.serviceFils * (1 + e.markupPct / 100));
                  const vat = e.invoiceType === "VAT" ? Math.round(sellService * 0.05) : 0;
                  return (
                    <tr key={p.id}>
                      <td className="td"><div className="font-medium">{country(p.destination).flag} {p.name}</div><div className="text-xs text-slate-500">{p.processingDays.standard} working days</div></td>
                      <td className="td text-end tabular-nums">{formatAed(net.governmentFils, locale)}</td>
                      <td className="td text-end tabular-nums">{formatAed(net.serviceFils, locale)}</td>
                      <td className="td"><input name={`fee_${p.id}`} type="number" step="1" min={0} defaultValue={overrides.has(p.id) ? overrides.get(p.id)! / 100 : ""} placeholder={String(Math.round(sellService / 100))} className="input w-28 py-1.5" /></td>
                      <td className="td text-end tabular-nums text-emerald-700">{formatAed(sellService - net.serviceFils, locale)}</td>
                      <td className="td text-end font-medium tabular-nums">{formatAed(net.governmentFils + sellService + vat, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-4"><button className="btn-primary">Save prices</button> <span className="ms-2 text-xs text-slate-500">Leave a fee blank to use the default markup. Fees below your cost are raised to cost.</span></div>
        </Section>
      </form>
    </div>
  );
}
