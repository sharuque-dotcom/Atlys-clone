import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { country } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { BOOKING_STATUSES, can, type BookingStatus } from "@/lib/types";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

type SP = Promise<Record<string, string | undefined>>;

export default async function Bookings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireMember();
  const locale = await getLocale();
  const where: Prisma.BookingWhereInput = { enterpriseId: user.enterpriseId };
  if (sp.status && sp.status in BOOKING_STATUSES) where.status = sp.status;
  if (sp.q) where.OR = [{ ref: { contains: sp.q.toUpperCase() } }, { customer: { name: { contains: sp.q } } }];
  const bookings = await db.booking.findMany({ where, include: { customer: true, payments: true, _count: { select: { applications: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <div>
      <PageHeader title="Bookings" subtitle="Every quote and sale, one per family trip." actions={can(user.role, "applications.create") && <Link href="/app/bookings/new" className="btn-primary">New booking</Link>} />
      <Flash searchParams={sp} />
      <form className="card mb-4 flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={sp.q} placeholder="Search customer or BK reference" className="input max-w-xs" />
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[200px]"><option value="">All</option>{Object.entries(BOOKING_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}</select>
        <button className="btn-secondary">Filter</button>
      </form>
      {bookings.length === 0 ? <Empty title="No bookings yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-100 bg-slate-50/60"><tr><th className="th">Booking</th><th className="th">Customer</th><th className="th">Trip</th><th className="th">Status</th><th className="th text-end">Total</th><th className="th text-end">Due</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => {
                const paid = b.payments.reduce((s, p) => s + p.amountFils, 0);
                const st = BOOKING_STATUSES[b.status as BookingStatus];
                const due = ["QUOTED", "CANCELLED"].includes(b.status) ? 0 : b.sellTotalFils - paid;
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="td"><Link href={`/app/bookings/${b.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{b.ref}</Link><div className="text-xs text-slate-500">{fmtDate(b.createdAt, locale)}</div></td>
                    <td className="td font-medium">{b.customer.name}</td>
                    <td className="td">{country(b.destination).flag} {country(b.destination).en} · {b._count.applications} pax<div className="text-xs text-slate-500">{fmtDate(b.travelStart, locale)}</div></td>
                    <td className="td"><Badge tone={st.tone}>{st.en}</Badge></td>
                    <td className="td text-end tabular-nums">{formatAed(b.sellTotalFils, locale)}</td>
                    <td className={`td text-end tabular-nums ${due > 0 ? "text-amber-700" : "text-slate-400"}`}>{due > 0 ? formatAed(due, locale) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
