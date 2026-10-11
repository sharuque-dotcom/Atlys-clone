import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { applicationScope, travelerScope } from "@/lib/scope";
import { ACTIVE_STATUSES, can } from "@/lib/types";
import { addDays, daysBetween, fmtDate } from "@/lib/dates";
import { country } from "@/lib/countries";
import { formatAed } from "@/lib/money";
import { Badge, PageHeader, Section, Stat, StatusBadge, Empty } from "@/components/ui";
import type { PriceBreakdown } from "@/lib/pricing";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember();
  const locale = await getLocale();
  const scope = applicationScope(user);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [active, issued90, decided90, monthApps, waiting, upcoming, travelers, recentEvents] = await Promise.all([
    db.application.count({ where: { ...scope, status: { in: ACTIVE_STATUSES } } }),
    db.application.count({ where: { ...scope, status: "ISSUED", decidedAt: { gte: addDays(now, -90) } } }),
    db.application.count({ where: { ...scope, status: { in: ["ISSUED", "REJECTED"] }, decidedAt: { gte: addDays(now, -90) } } }),
    db.application.findMany({ where: { ...scope, createdAt: { gte: monthStart }, status: { not: "CANCELLED" } }, select: { pricing: true } }),
    db.application.findMany({
      where: { ...scope, status: { in: can(user.role, "applications.approve") ? ["PENDING_APPROVAL", "DOCS_PENDING"] : ["DOCS_PENDING"] } },
      include: { traveler: true },
      orderBy: { travelStart: "asc" },
      take: 6,
    }),
    db.application.findMany({
      where: { ...scope, travelStart: { gte: now, lte: addDays(now, 45) }, status: { notIn: ["CANCELLED", "REJECTED"] } },
      include: { traveler: true },
      orderBy: { travelStart: "asc" },
      take: 6,
    }),
    db.traveler.findMany({ where: travelerScope(user) }),
    db.applicationEvent.findMany({ where: { application: scope }, include: { application: { include: { traveler: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const spend = monthApps.reduce((s, a) => s + (JSON.parse(a.pricing) as PriceBreakdown).totalFils, 0);
  const approvalRate = decided90 ? Math.round((issued90 / decided90) * 100) : null;

  type Alert = { id: string; name: string; doc: string; date: Date; days: number };
  const alerts: Alert[] = [];
  for (const tr of travelers) {
    const name = `${tr.firstName} ${tr.lastName}`;
    if (tr.passportExpiry && daysBetween(now, tr.passportExpiry) < 210) alerts.push({ id: tr.id, name, doc: "Passport", date: tr.passportExpiry, days: daysBetween(now, tr.passportExpiry) });
    if (tr.residenceVisaExpiry && daysBetween(now, tr.residenceVisaExpiry) < 120) alerts.push({ id: tr.id, name, doc: "UAE residence visa", date: tr.residenceVisaExpiry, days: daysBetween(now, tr.residenceVisaExpiry) });
    if (tr.emiratesIdExpiry && daysBetween(now, tr.emiratesIdExpiry) < 60) alerts.push({ id: tr.id, name, doc: "Emirates ID", date: tr.emiratesIdExpiry, days: daysBetween(now, tr.emiratesIdExpiry) });
  }
  alerts.sort((a, b) => a.days - b.days);

  return (
    <div>
      {sp.denied && <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Your role doesn&apos;t have access to that page.</div>}
      <PageHeader
        title={`${t("dash.title", locale)}, ${user.name.split(" ")[0]}`}
        subtitle={`${user.enterprise.name} · ${fmtDate(now, locale)}`}
        actions={can(user.role, "applications.create") && <Link href="/app/applications/new" className="btn-primary">{t("nav.new", locale)}</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("dash.active", locale)} value={active} href="/app/applications?status=active" />
        <Stat label={t("dash.issued", locale)} value={issued90} />
        <Stat label={t("dash.approval", locale)} value={approvalRate == null ? "—" : `${approvalRate}%`} hint={decided90 ? `${decided90} decisions` : "No decisions yet"} />
        <Stat label={t("dash.spend", locale)} value={formatAed(spend, locale)} hint="incl. VAT & govt fees" href={can(user.role, "billing.view") ? "/app/billing" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title={t("dash.pending", locale)} actions={<Link href="/app/applications" className="text-xs text-brand-700">{t("common.viewAll", locale)}</Link>}>
          {waiting.length === 0 ? <div className="p-6 text-sm text-slate-500">Nothing needs your attention. 🎉</div> : (
            <ul className="divide-y divide-slate-100">
              {waiting.map((a) => (
                <li key={a.id}>
                  <Link href={`/app/applications/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div>
                      <div className="text-sm font-medium">{a.traveler.firstName} {a.traveler.lastName} <span className="text-slate-400">→</span> {country(a.destination).flag} {country(a.destination).en}</div>
                      <div className="text-xs text-slate-500">{a.ref} · departs {fmtDate(a.travelStart, locale)}</div>
                    </div>
                    <StatusBadge status={a.status} locale={locale} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("dash.expiring", locale)} actions={<Badge tone={alerts.length ? "amber" : "green"}>{alerts.length}</Badge>}>
          {alerts.length === 0 ? <div className="p-6 text-sm text-slate-500">All passports, residence visas and Emirates IDs are healthy.</div> : (
            <ul className="divide-y divide-slate-100">
              {alerts.slice(0, 7).map((a, i) => (
                <li key={i}>
                  <Link href={`/app/travelers/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div><div className="text-sm font-medium">{a.name}</div><div className="text-xs text-slate-500">{a.doc} · {fmtDate(a.date, locale)}</div></div>
                    <Badge tone={a.days < 0 ? "red" : a.days < 90 ? "amber" : "gray"}>{a.days < 0 ? "Expired" : `${a.days} days`}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Departing in the next 45 days">
          {upcoming.length === 0 ? <Empty title="No upcoming departures" /> : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link href={`/app/applications/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{country(a.destination).flag}</span>
                      <div><div className="text-sm font-medium">{a.traveler.firstName} {a.traveler.lastName}</div><div className="text-xs text-slate-500">{fmtDate(a.travelStart, locale)} – {fmtDate(a.travelEnd, locale)}</div></div>
                    </div>
                    <StatusBadge status={a.status} locale={locale} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent activity">
          {recentEvents.length === 0 ? <Empty title="No activity yet" /> : (
            <ul className="divide-y divide-slate-100">
              {recentEvents.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <Link href={`/app/applications/${e.applicationId}`} className="text-sm hover:underline">
                    <span className="font-medium">{e.application.ref}</span> · {e.message}
                  </Link>
                  <div className="text-xs text-slate-500">{e.application.traveler.firstName} {e.application.traveler.lastName} · {fmtDate(e.createdAt, locale)}{e.actorName ? ` · ${e.actorName}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
