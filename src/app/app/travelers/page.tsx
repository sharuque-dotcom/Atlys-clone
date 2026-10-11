import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { country } from "@/lib/countries";
import { daysBetween, fmtDate } from "@/lib/dates";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { TravelerForm } from "./TravelerForm";
import { importTravelers } from "./actions";

type SP = Promise<Record<string, string | undefined>>;

export default async function Travelers({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireMember("travelers.manage");
  const locale = await getLocale();
  const where: Prisma.TravelerWhereInput = { enterpriseId: user.enterpriseId };
  if (sp.q) where.OR = [{ firstName: { contains: sp.q } }, { lastName: { contains: sp.q } }, { employeeId: { contains: sp.q } }, { designation: { contains: sp.q } }, { passportNo: { contains: sp.q.toUpperCase() } }];
  if (sp.nationality) where.nationality = sp.nationality;
  const [travelers, nationalities, branches, managers] = await Promise.all([
    db.traveler.findMany({ where, include: { _count: { select: { documents: true, applications: true } } }, orderBy: [{ firstName: "asc" }] }),
    db.traveler.groupBy({ by: ["nationality"], where: { enterpriseId: user.enterpriseId }, _count: true, orderBy: { _count: { nationality: "desc" } } }),
    db.branch.findMany({ where: { enterpriseId: user.enterpriseId } }),
    db.user.findMany({ where: { enterpriseId: user.enterpriseId, role: { in: ["OWNER", "ADMIN", "APPROVER", "TRAVEL_MANAGER"] } } }),
  ]);
  const now = new Date();

  return (
    <div>
      <PageHeader title="Travelers" subtitle={`${travelers.length} people · ${nationalities.length} nationalities`} />
      <Flash searchParams={sp} />
      <div className="mb-4 flex flex-wrap gap-2">
        {nationalities.slice(0, 12).map((n) => (
          <Link key={n.nationality} href={sp.nationality === n.nationality ? "/app/travelers" : `/app/travelers?nationality=${n.nationality}`} className={`rounded-full border px-3 py-1 text-xs ${sp.nationality === n.nationality ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}`}>
            {country(n.nationality).flag} {country(n.nationality).en} · {n._count}
          </Link>
        ))}
      </div>
      <form className="card mb-4 flex gap-2 p-3">
        <input name="q" defaultValue={sp.q} placeholder="Search name, employee ID, designation, passport no." className="input" />
        <button className="btn-secondary">Search</button>
      </form>

      {travelers.length === 0 ? <Empty title="No travelers yet">Add people one by one, import a CSV, or connect your HRMS.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-100 bg-slate-50/60"><tr><th className="th">Name</th><th className="th">Passport</th><th className="th">Passport expiry</th><th className="th">Residence expiry</th><th className="th">Docs</th><th className="th">Trips</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {travelers.map((t) => {
                const pDays = t.passportExpiry ? daysBetween(now, t.passportExpiry) : null;
                const rDays = t.residenceVisaExpiry ? daysBetween(now, t.residenceVisaExpiry) : null;
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="td"><Link href={`/app/travelers/${t.id}`} className="font-medium text-brand-700 hover:underline">{t.firstName} {t.lastName}</Link><div className="text-xs text-slate-500">{t.designation ?? "—"}{t.employeeId ? ` · ${t.employeeId}` : ""}</div></td>
                    <td className="td">{country(t.nationality).flag} <span className="font-mono text-xs">{t.passportNo ?? "—"}</span></td>
                    <td className="td">{fmtDate(t.passportExpiry, locale)} {pDays != null && pDays < 210 && <Badge tone={pDays < 90 ? "red" : "amber"}>{pDays}d</Badge>}</td>
                    <td className="td">{t.nationality === "AE" ? <span className="text-xs text-slate-400">UAE national</span> : <>{fmtDate(t.residenceVisaExpiry, locale)} {rDays != null && rDays < 120 && <Badge tone={rDays < 60 ? "red" : "amber"}>{rDays}d</Badge>}</>}</td>
                    <td className="td">{t._count.documents}</td>
                    <td className="td">{t._count.applications}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Section title="Add a traveler"><TravelerForm branches={branches} managers={managers} /></Section>
        <div className="space-y-6">
          <Section title="Bulk import (CSV)">
            <form action={importTravelers} className="space-y-3 p-4">
              <p className="text-xs text-slate-500">Columns: <code className="break-all">first_name,last_name,email,phone,nationality,designation,department,employee_id,monthly_salary_aed,passport_no,passport_expiry,residence_visa_expiry</code></p>
              <a href="/travelers-template.csv" className="text-xs text-brand-700 hover:underline">Download template</a>
              <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-xs" />
              <button className="btn-secondary w-full">Import</button>
            </form>
          </Section>
          <Section title="HRMS sync">
            <p className="p-4 text-sm text-slate-600">Keep the directory in sync with Bayzat, ZenHR, Darwinbox or SAP SuccessFactors. <Link href="/app/integrations" className="text-brand-700 hover:underline">Connect →</Link></p>
          </Section>
        </div>
      </div>
    </div>
  );
}
