import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { country, EMIRATES } from "@/lib/countries";
import { daysBetween, fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { ageOn } from "@/lib/requirements";
import { BOOKING_STATUSES, CUSTOMER_SOURCES, EMPLOYMENT, RELATIONSHIPS, type BookingStatus } from "@/lib/types";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { TravelerForm } from "../../travelers/TravelerForm";
import { saveCustomer } from "../actions";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireMember("customers.manage");
  const locale = await getLocale();
  const c = await db.customer.findFirst({
    where: { id, enterpriseId: user.enterpriseId },
    include: {
      members: { include: { _count: { select: { documents: true } } }, orderBy: { createdAt: "asc" } },
      bookings: { include: { payments: true, _count: { select: { applications: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();
  const now = new Date();
  const wa = c.phone?.replace(/\D/g, "");

  return (
    <div>
      <div className="mb-2 text-sm text-slate-500"><Link href="/app/customers" className="hover:underline">Customers</Link> / {c.name}</div>
      <PageHeader
        title={c.name}
        subtitle={<>{c.phone} {c.email ? `· ${c.email}` : ""} · {CUSTOMER_SOURCES[c.source as keyof typeof CUSTOMER_SOURCES]}</>}
        actions={<>
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" className="btn-secondary">WhatsApp</a>}
          {c.members.length > 0 && <Link href={`/app/bookings/new?customer=${c.id}`} className="btn-primary">New booking</Link>}
        </>}
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title={`Household · ${c.members.length}`}>
            {c.members.length === 0 ? <p className="p-4 text-sm text-slate-500">Add the family members who will travel.</p> : (
              <ul className="divide-y divide-slate-100">
                {c.members.map((m) => {
                  const age = ageOn(m.dateOfBirth, now);
                  const pDays = m.passportExpiry ? daysBetween(now, m.passportExpiry) : null;
                  const rDays = m.residenceVisaExpiry ? daysBetween(now, m.residenceVisaExpiry) : null;
                  return (
                    <li key={m.id}>
                      <Link href={`/app/travelers/${m.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
                        <span className="text-2xl">{country(m.nationality).flag}</span>
                        <div className="min-w-[180px] flex-1">
                          <div className="text-sm font-medium">{m.firstName} {m.lastName}</div>
                          <div className="text-xs text-slate-500">{RELATIONSHIPS[m.relationship as keyof typeof RELATIONSHIPS]?.en}{age != null ? ` · ${age} yrs` : ""} · {EMPLOYMENT[m.employmentType as keyof typeof EMPLOYMENT]?.en} · {m._count.documents} docs</div>
                        </div>
                        {pDays == null ? <Badge tone="amber">No passport</Badge> : pDays < 0 ? <Badge tone="red">Passport expired</Badge> : pDays < 210 ? <Badge tone="amber">Passport {pDays}d</Badge> : <Badge tone="green">Passport OK</Badge>}
                        {m.uaeResident && m.nationality !== "AE" && rDays != null && rDays < 120 && <Badge tone="amber">Residence {rDays}d</Badge>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
          <Section title="Add family member"><TravelerForm customerId={c.id} household={c.members} /></Section>
        </div>

        <div className="space-y-6">
          <Section title="Bookings">
            {c.bookings.length === 0 ? <p className="p-4 text-sm text-slate-500">No bookings yet.</p> : (
              <ul className="divide-y divide-slate-100">
                {c.bookings.map((b) => {
                  const paid = b.payments.reduce((s, p) => s + p.amountFils, 0);
                  const st = BOOKING_STATUSES[b.status as BookingStatus];
                  return (
                    <li key={b.id}>
                      <Link href={`/app/bookings/${b.id}`} className="block px-4 py-3 hover:bg-slate-50">
                        <div className="flex items-center justify-between"><span className="text-sm font-medium">{country(b.destination).flag} {country(b.destination).en} · {b._count.applications} pax</span><Badge tone={st.tone}>{st.en}</Badge></div>
                        <div className="text-xs text-slate-500">{b.ref} · {fmtDate(b.travelStart, locale)} · {formatAed(b.sellTotalFils, locale)}{b.sellTotalFils > paid && b.status !== "QUOTED" && b.status !== "CANCELLED" ? ` · ${formatAed(b.sellTotalFils - paid, locale)} due` : ""}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
          <Section title="Customer details">
            <form action={saveCustomer} className="space-y-3 p-4">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} className="input" required />
              <input name="phone" defaultValue={c.phone ?? ""} className="input" required />
              <input name="email" defaultValue={c.email ?? ""} className="input" placeholder="Email" />
              <div className="grid grid-cols-2 gap-2">
                <select name="emirate" defaultValue={c.emirate ?? "DXB"} className="input">{EMIRATES.map((e) => <option key={e.code} value={e.code}>{e.en}</option>)}</select>
                <select name="source" defaultValue={c.source} className="input">{Object.entries(CUSTOMER_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </div>
              <textarea name="notes" defaultValue={c.notes ?? ""} rows={3} className="input" placeholder="Notes (preferences, past issues…)" />
              <button className="btn-secondary w-full">Save</button>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
