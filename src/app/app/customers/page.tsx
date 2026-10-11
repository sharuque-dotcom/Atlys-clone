import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { COUNTRIES, EMIRATES, country } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { CUSTOMER_SOURCES } from "@/lib/types";
import { Empty, Flash, PageHeader, Section } from "@/components/ui";
import { saveCustomer } from "./actions";

type SP = Promise<Record<string, string | undefined>>;

export default async function Customers({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireMember("customers.manage");
  const locale = await getLocale();
  const where: Prisma.CustomerWhereInput = { enterpriseId: user.enterpriseId };
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { phone: { contains: sp.q.replace(/\D/g, "").slice(-7) || sp.q } }, { members: { some: { OR: [{ firstName: { contains: sp.q } }, { passportNo: { contains: sp.q.toUpperCase() } }] } } }];
  const customers = await db.customer.findMany({
    where,
    include: { members: { select: { nationality: true } }, bookings: { select: { sellTotalFils: true, createdAt: true, status: true } }, assignedTo: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${customers.length} households`} />
      <Flash searchParams={sp} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <form className="card mb-4 flex gap-2 p-3">
            <input name="q" defaultValue={sp.q} placeholder="Search name, mobile, family member or passport no." className="input" />
            <button className="btn-secondary">Search</button>
          </form>
          {customers.length === 0 ? <Empty title="No customers yet">Add your first walk-in on the right.</Empty> : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-slate-100 bg-slate-50/60"><tr><th className="th">Customer</th><th className="th">Family</th><th className="th">Bookings</th><th className="th text-end">Lifetime value</th><th className="th">Since</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => {
                    const ltv = c.bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "QUOTED").reduce((s, b) => s + b.sellTotalFils, 0);
                    const flags = [...new Set(c.members.map((m) => m.nationality))].map((n) => country(n).flag).join(" ");
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="td"><Link href={`/app/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link><div className="text-xs text-slate-500">{c.phone} · {CUSTOMER_SOURCES[c.source as keyof typeof CUSTOMER_SOURCES] ?? c.source}</div></td>
                        <td className="td">{c.members.length} {flags}</td>
                        <td className="td">{c.bookings.length}</td>
                        <td className="td text-end tabular-nums">{formatAed(ltv, locale)}</td>
                        <td className="td text-xs">{fmtDate(c.createdAt, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Section title="New customer">
          <form action={saveCustomer} className="space-y-3 p-4">
            <label className="block"><span className="label">Full name</span><input name="name" required className="input" placeholder="Rohan Mehta" /></label>
            <label className="block"><span className="label">WhatsApp number</span><input name="phone" required className="input" placeholder="050 123 4567" /></label>
            <label className="block"><span className="label">Their nationality (adds them as main applicant)</span>
              <select name="nationality" className="input" defaultValue=""><option value="">— add later —</option>{[...COUNTRIES].sort((a, b) => a.en.localeCompare(b.en)).map((c) => <option key={c.code} value={c.code}>{c.flag} {c.en}</option>)}</select></label>
            <label className="block"><span className="label">Email</span><input name="email" type="email" className="input" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="label">Emirate</span><select name="emirate" className="input">{EMIRATES.map((e) => <option key={e.code} value={e.code}>{e.en}</option>)}</select></label>
              <label className="block"><span className="label">Came via</span><select name="source" className="input">{Object.entries(CUSTOMER_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <button className="btn-primary w-full">Create customer</button>
          </form>
        </Section>
      </div>
    </div>
  );
}
