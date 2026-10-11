import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { ACTIVE_STATUSES, can } from "@/lib/types";
import { addDays, daysBetween, fmtDate } from "@/lib/dates";
import { country } from "@/lib/countries";
import { formatAed } from "@/lib/money";
import { parseNetPricing } from "@/lib/applications";
import { Badge, Empty, PageHeader, Section, Stat, StatusBadge } from "@/components/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember();
  const locale = await getLocale();
  const E = user.enterpriseId;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [active, issued90, monthBookings, openBookings, docsWaiting, quotes, departing, travelers] = await Promise.all([
    db.application.count({ where: { enterpriseId: E, status: { in: ACTIVE_STATUSES } } }),
    db.application.count({ where: { enterpriseId: E, status: "ISSUED", decidedAt: { gte: addDays(now, -90) } } }),
    db.booking.findMany({ where: { enterpriseId: E, createdAt: { gte: monthStart }, status: { notIn: ["QUOTED", "CANCELLED"] } }, include: { applications: true } }),
    db.booking.findMany({ where: { enterpriseId: E, status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } }, include: { payments: true, customer: true } }),
    db.application.findMany({ where: { enterpriseId: E, status: "DOCS_PENDING" }, include: { traveler: true, booking: { include: { customer: true } } }, orderBy: { travelStart: "asc" }, take: 6 }),
    db.booking.findMany({ where: { enterpriseId: E, status: "QUOTED" }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.application.findMany({ where: { enterpriseId: E, travelStart: { gte: now, lte: addDays(now, 30) }, status: { notIn: ["CANCELLED", "REJECTED"] } }, include: { traveler: true }, orderBy: { travelStart: "asc" }, take: 6 }),
    db.traveler.findMany({ where: { enterpriseId: E, customerId: { not: null } }, include: { customer: true } }),
  ]);

  const sales = monthBookings.reduce((s, b) => s + b.sellTotalFils, 0);
  const cost = monthBookings.reduce((s, b) => s + b.applications.filter((a) => a.status !== "CANCELLED").reduce((x, a) => x + parseNetPricing(a).totalFils, 0), 0);
  const balances = openBookings
    .map((b) => ({ b, due: b.sellTotalFils - b.payments.reduce((s, p) => s + p.amountFils, 0) }))
    .filter((x) => x.due > 0)
    .sort((a, b) => b.due - a.due);
  const outstanding = balances.reduce((s, x) => s + x.due, 0);

  // Renewal radar: customers whose passports are expiring are tomorrow's walk-ins.
  const renewals = travelers
    .filter((tr) => tr.passportExpiry && daysBetween(now, tr.passportExpiry) < 240)
    .map((tr) => ({ tr, days: daysBetween(now, tr.passportExpiry!) }))
    .sort((a, b) => a.days - b.days);

  return (
    <div>
      {sp.denied && <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Your role doesn&apos;t have access to that page.</div>}
      <PageHeader
        title={`${t("dash.title", locale)}, ${user.name.split(" ")[0]}`}
        subtitle={`${user.enterprise.name} · ${fmtDate(now, locale)}`}
        actions={can(user.role, "applications.create") && <Link href="/app/bookings/new" className="btn-primary">{t("nav.new", locale)}</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("dash.revenue", locale)} value={formatAed(sales, locale)} hint={`${monthBookings.length} confirmed bookings`} href="/app/bookings" />
        {can(user.role, "billing.view")
          ? <Stat label={t("dash.margin", locale)} value={formatAed(sales - cost, locale)} hint={sales ? `${Math.round(((sales - cost) / sales) * 100)}% of sales` : "—"} />
          : <Stat label={t("dash.issued", locale)} value={issued90} />}
        <Stat label={t("dash.outstanding", locale)} value={formatAed(outstanding, locale)} hint={`${balances.length} families`} />
        <Stat label={t("dash.active", locale)} value={active} hint={`${issued90} issued in 90 days`} href="/app/applications?status=active" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Waiting for customer documents" actions={<Link href="/app/applications?status=DOCS_PENDING" className="text-xs text-brand-700">{t("common.viewAll", locale)}</Link>}>
          {docsWaiting.length === 0 ? <div className="p-6 text-sm text-slate-500">Nothing to chase. 🎉</div> : (
            <ul className="divide-y divide-slate-100">
              {docsWaiting.map((a) => (
                <li key={a.id}>
                  <Link href={a.bookingId ? `/app/bookings/${a.bookingId}` : `/app/applications/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div>
                      <div className="text-sm font-medium">{a.traveler.firstName} {a.traveler.lastName} <span className="text-slate-400">→</span> {country(a.destination).flag} {country(a.destination).en}</div>
                      <div className="text-xs text-slate-500">{a.booking?.customer.name ?? ""} · departs {fmtDate(a.travelStart, locale)}</div>
                    </div>
                    <StatusBadge status={a.status} locale={locale} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Open quotes — follow up">
          {quotes.length === 0 ? <div className="p-6 text-sm text-slate-500">No open quotes.</div> : (
            <ul className="divide-y divide-slate-100">
              {quotes.map((b) => (
                <li key={b.id}>
                  <Link href={`/app/bookings/${b.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div><div className="text-sm font-medium">{b.customer.name} · {country(b.destination).flag} {country(b.destination).en}</div><div className="text-xs text-slate-500">Quoted {fmtDate(b.createdAt, locale)} · {daysBetween(b.createdAt, now)}d ago</div></div>
                    <span className="text-sm font-medium tabular-nums">{formatAed(b.sellTotalFils, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Balances due">
          {balances.length === 0 ? <div className="p-6 text-sm text-slate-500">Every family is paid up.</div> : (
            <ul className="divide-y divide-slate-100">
              {balances.slice(0, 6).map(({ b, due }) => (
                <li key={b.id}>
                  <Link href={`/app/bookings/${b.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div><div className="text-sm font-medium">{b.customer.name}</div><div className="text-xs text-slate-500">{b.ref} · {b.customer.phone}</div></div>
                    <span className="text-sm font-medium tabular-nums text-amber-700">{formatAed(due, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Renewal leads — customer passports expiring" actions={<Badge tone={renewals.length ? "amber" : "green"}>{renewals.length}</Badge>}>
          {renewals.length === 0 ? <div className="p-6 text-sm text-slate-500">No customer passports expiring in the next 8 months.</div> : (
            <ul className="divide-y divide-slate-100">
              {renewals.slice(0, 6).map(({ tr, days }) => (
                <li key={tr.id}>
                  <Link href={`/app/customers/${tr.customerId}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div><div className="text-sm font-medium">{tr.firstName} {tr.lastName}</div><div className="text-xs text-slate-500">{tr.customer?.name} · {country(tr.nationality).en} passport · {fmtDate(tr.passportExpiry, locale)}</div></div>
                    <Badge tone={days < 0 ? "red" : days < 120 ? "amber" : "gray"}>{days < 0 ? "Expired" : `${days} days`}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Departing in the next 30 days" className="lg:col-span-2">
          {departing.length === 0 ? <Empty title="No departures soon" /> : (
            <ul className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
              {departing.map((a) => (
                <li key={a.id}>
                  <Link href={`/app/applications/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3"><span className="text-2xl">{country(a.destination).flag}</span><div><div className="text-sm font-medium">{a.traveler.firstName} {a.traveler.lastName}</div><div className="text-xs text-slate-500">{fmtDate(a.travelStart, locale)}</div></div></div>
                    <StatusBadge status={a.status} locale={locale} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
