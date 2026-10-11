import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { applicationScope } from "@/lib/scope";
import { ACTIVE_STATUSES, APP_STATUSES, STATUS_META, can, type AppStatus } from "@/lib/types";
import { country } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { getProduct } from "@/lib/catalog";
import { parsePricing, parseRisk } from "@/lib/applications";
import { Empty, Flash, PageHeader, RiskBadge, StatusBadge } from "@/components/ui";

type SP = Promise<Record<string, string | undefined>>;

export default async function Applications({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireMember();
  const locale = await getLocale();
  const where: Prisma.ApplicationWhereInput = { ...applicationScope(user) };
  if (sp.status === "active") where.status = { in: ACTIVE_STATUSES };
  else if (sp.status && APP_STATUSES.includes(sp.status as AppStatus)) where.status = sp.status;
  if (sp.destination) where.destination = sp.destination;
  if (sp.q) {
    where.AND = [{ OR: [{ ref: { contains: sp.q.toUpperCase() } }, { traveler: { firstName: { contains: sp.q } } }, { traveler: { lastName: { contains: sp.q } } }] }];
  }
  const apps = await db.application.findMany({ where, include: { traveler: true, costCenter: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const destinations = await db.application.findMany({ where: applicationScope(user), distinct: ["destination"], select: { destination: true } });

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle={`${apps.length} shown`}
        actions={<>
          <a href={`/api/export/applications?${new URLSearchParams(sp as Record<string, string>).toString()}`} className="btn-secondary">Export CSV</a>
          {can(user.role, "applications.create") && <Link href="/app/applications/new" className="btn-primary">New application</Link>}
        </>}
      />
      <Flash searchParams={sp} />
      <form className="card mb-4 flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={sp.q} placeholder="Search name or reference" className="input max-w-xs" />
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[200px]">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          {APP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].en}</option>)}
        </select>
        <select name="destination" defaultValue={sp.destination ?? ""} className="input max-w-[200px]">
          <option value="">All destinations</option>
          {destinations.map((d) => <option key={d.destination} value={d.destination}>{country(d.destination).flag} {country(d.destination).en}</option>)}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      {apps.length === 0 ? <Empty title="No applications match">Try clearing filters, or start a new application.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-slate-100 bg-slate-50/60">
              <tr><th className="th">Reference</th><th className="th">Traveler</th><th className="th">Visa</th><th className="th">Travel</th><th className="th">Risk</th><th className="th">Status</th><th className="th text-end">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="td"><Link href={`/app/applications/${a.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{a.ref}</Link></td>
                  <td className="td"><div className="font-medium">{a.traveler.firstName} {a.traveler.lastName}</div><div className="text-xs text-slate-500">{country(a.traveler.nationality).flag} {country(a.traveler.nationality).en}{a.costCenter ? ` · ${a.costCenter.code}` : ""}</div></td>
                  <td className="td"><div>{country(a.destination).flag} {country(a.destination).en}</div><div className="text-xs text-slate-500">{getProduct(a.productId)?.name ?? a.productId}</div></td>
                  <td className="td text-xs">{fmtDate(a.travelStart, locale)}<br />{fmtDate(a.travelEnd, locale)}</td>
                  <td className="td"><RiskBadge level={parseRisk(a)?.level} /></td>
                  <td className="td"><StatusBadge status={a.status} locale={locale} /></td>
                  <td className="td text-end tabular-nums">{formatAed(parsePricing(a).totalFils, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
