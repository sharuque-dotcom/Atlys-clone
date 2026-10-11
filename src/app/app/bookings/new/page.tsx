import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { country } from "@/lib/countries";
import { agencyPricing } from "@/lib/applications";
import { Empty, PageHeader } from "@/components/ui";
import { BookingWizard, type WizardMember } from "./BookingWizard";

type SP = Promise<Record<string, string | undefined>>;

export default async function NewBooking({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireMember("applications.create");

  if (!sp.customer) {
    const customers = await db.customer.findMany({
      where: { enterpriseId: user.enterpriseId, ...(sp.q ? { OR: [{ name: { contains: sp.q } }, { phone: { contains: sp.q } }] } : {}) },
      include: { members: { select: { nationality: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return (
      <div>
        <PageHeader title="New booking" subtitle="Step 1 — who is the customer?" actions={<Link href="/app/customers" className="btn-primary">+ New customer</Link>} />
        <form className="card mb-4 flex gap-2 p-3"><input name="q" defaultValue={sp.q} placeholder="Search by name or mobile" className="input" autoFocus /><button className="btn-secondary">Search</button></form>
        {customers.length === 0 ? <Empty title="No matching customer">Create the customer first, then add their family members.</Empty> : (
          <ul className="card divide-y divide-slate-100">
            {customers.map((c) => (
              <li key={c.id}>
                <Link href={c.members.length ? `/app/bookings/new?customer=${c.id}` : `/app/customers/${c.id}?error=Add+family+members+first`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div><div className="text-sm font-medium">{c.name}</div><div className="text-xs text-slate-500">{c.phone}</div></div>
                  <span className="text-sm">{c.members.map((m) => country(m.nationality).flag).join(" ")} <span className="text-slate-400">· {c.members.length}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const customer = await db.customer.findFirst({ where: { id: sp.customer, enterpriseId: user.enterpriseId }, include: { members: { include: { documents: true }, orderBy: { createdAt: "asc" } } } });
  if (!customer) return <Empty title="Customer not found" />;
  const now = new Date();
  const members: WizardMember[] = customer.members.map((t) => ({
    id: t.id,
    name: `${t.firstName} ${t.lastName}`,
    relationship: t.relationship,
    employmentType: t.employmentType,
    nationality: t.nationality,
    uaeResident: t.uaeResident,
    dateOfBirth: t.dateOfBirth?.toISOString() ?? null,
    sponsorId: t.sponsorId,
    passportExpiry: t.passportExpiry?.toISOString() ?? null,
    residenceVisaExpiry: t.residenceVisaExpiry?.toISOString() ?? null,
    emiratesIdExpiry: t.emiratesIdExpiry?.toISOString() ?? null,
    monthlySalaryAed: t.monthlySalaryAed,
    joinedAt: t.joinedAt?.toISOString() ?? null,
    priorRejections: t.priorRejections,
    travelHistory: t.travelHistory.split(",").filter(Boolean),
    docTypes: t.documents.filter((d) => !d.expiresAt || d.expiresAt > now).map((d) => d.type),
  }));
  const pricing = await agencyPricing(user.enterpriseId);
  const address = customer.emirate ? "" : "";

  return (
    <div>
      <div className="mb-2 text-sm text-slate-500"><Link href={`/app/customers/${customer.id}`} className="hover:underline">{customer.name}</Link> / New booking</div>
      <PageHeader title={`Quote for ${customer.name}`} subtitle="Pick who's travelling and where — every passport gets its own visa, checklist and price." />
      <BookingWizard customerId={customer.id} members={members} preselected={sp.traveler ? [sp.traveler] : members.map((m) => m.id)} presetDestination={sp.destination} pricing={pricing} defaultAddress={address} />
    </div>
  );
}
