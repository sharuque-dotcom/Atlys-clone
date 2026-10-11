import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { fmtDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/ui";

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember("audit.view");
  const locale = await getLocale();
  const logs = await db.auditLog.findMany({
    where: { enterpriseId: user.enterpriseId, ...(sp.q ? { OR: [{ action: { contains: sp.q } }, { actorName: { contains: sp.q } }] } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every sign-in-scoped action on personal data — kept for PDPL accountability." />
      <form className="card mb-4 flex gap-2 p-3"><input name="q" defaultValue={sp.q} placeholder="Filter by action or person" className="input" /><button className="btn-secondary">Filter</button></form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="border-b border-slate-100 bg-slate-50/60"><tr><th className="th">When (GST)</th><th className="th">Who</th><th className="th">Action</th><th className="th">Entity</th><th className="th">Details</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap text-xs">{fmtDateTime(l.createdAt, locale)}</td>
                <td className="td text-xs">{l.actorName}</td>
                <td className="td font-mono text-xs">{l.action}</td>
                <td className="td text-xs">{l.entity}{l.entityId ? <span className="text-slate-400"> · {l.entityId.slice(-6)}</span> : null}</td>
                <td className="td max-w-xs truncate font-mono text-[11px] text-slate-500">{l.meta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
