import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { country } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { Empty, PageHeader } from "@/components/ui";

export default async function Trips() {
  const user = await requireMember("travelers.manage");
  const locale = await getLocale();
  const trips = await db.trip.findMany({ where: { enterpriseId: user.enterpriseId }, include: { applications: { select: { status: true } } }, orderBy: { startDate: "desc" } });
  return (
    <div>
      <PageHeader title="Group trips" subtitle="Offsites, delegations and exhibitions — one view across every traveler's visa." actions={<Link href="/app/applications/new" className="btn-primary">Plan a group trip</Link>} />
      {trips.length === 0 ? <Empty title="No group trips yet">Select several travelers in a new application to create one.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t) => {
            const issued = t.applications.filter((a) => a.status === "ISSUED").length;
            const pct = t.applications.length ? Math.round((issued / t.applications.length) * 100) : 0;
            return (
              <Link key={t.id} href={`/app/trips/${t.id}`} className="card p-5 hover:border-brand-300">
                <div className="flex items-center justify-between"><span className="text-3xl">{country(t.destination).flag}</span><span className="text-xs text-slate-500">{t.applications.length} travelers</span></div>
                <div className="mt-3 font-semibold">{t.name}</div>
                <div className="text-sm text-slate-500">{fmtDate(t.startDate, locale)} – {fmtDate(t.endDate, locale)}</div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                <div className="mt-1 text-xs text-slate-500">{issued}/{t.applications.length} visas issued</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
