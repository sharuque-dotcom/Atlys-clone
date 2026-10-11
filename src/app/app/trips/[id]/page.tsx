import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { country } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { STATUS_META, type AppStatus } from "@/lib/types";
import { parsePricing, parseRisk } from "@/lib/applications";
import { Flash, PageHeader, RiskBadge, StatusBadge, Stat } from "@/components/ui";

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireMember("travelers.manage");
  const locale = await getLocale();
  const trip = await db.trip.findFirst({ where: { id, enterpriseId: user.enterpriseId }, include: { applications: { include: { traveler: true }, orderBy: { createdAt: "asc" } } } });
  if (!trip) notFound();
  const total = trip.applications.reduce((s, a) => s + parsePricing(a).totalFils, 0);
  const byStatus = trip.applications.reduce<Record<string, number>>((m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }), {});
  const atRisk = trip.applications.filter((a) => ["HIGH", "BLOCKED"].includes(parseRisk(a)?.level ?? "")).length;
  return (
    <div>
      <div className="mb-2 text-sm text-slate-500"><Link href="/app/trips" className="hover:underline">Group trips</Link> / {trip.name}</div>
      <PageHeader title={<>{country(trip.destination).flag} {trip.name}</>} subtitle={`${fmtDate(trip.startDate, locale)} – ${fmtDate(trip.endDate, locale)} · ${trip.purpose.toLowerCase()}`} actions={<a className="btn-secondary" href={`/api/export/applications?trip=${trip.id}`}>Export manifest (CSV)</a>} />
      <Flash searchParams={sp} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Travelers needing visas" value={trip.applications.length} />
        <Stat label="Issued" value={byStatus.ISSUED ?? 0} />
        <Stat label="High risk / blocked" value={atRisk} hint={atRisk ? "Fix these first" : "All clear"} />
        <Stat label="Trip visa budget" value={formatAed(total, locale)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">{Object.entries(byStatus).map(([s, n]) => <span key={s} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-slate-200">{STATUS_META[s as AppStatus]?.en ?? s}: {n}</span>)}</div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="border-b border-slate-100 bg-slate-50/60"><tr><th className="th">Traveler</th><th className="th">Passport</th><th className="th">Reference</th><th className="th">Risk</th><th className="th">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {trip.applications.map((a) => (
              <tr key={a.id}>
                <td className="td font-medium">{a.traveler.firstName} {a.traveler.lastName}</td>
                <td className="td">{country(a.traveler.nationality).flag} {country(a.traveler.nationality).en}</td>
                <td className="td"><Link href={`/app/applications/${a.id}`} className="font-mono text-xs text-brand-700 hover:underline">{a.ref}</Link></td>
                <td className="td"><RiskBadge level={parseRisk(a)?.level} /></td>
                <td className="td"><StatusBadge status={a.status} locale={locale} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
