import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { country } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { formatAed } from "@/lib/money";
import { getProduct } from "@/lib/catalog";
import { parsePricing, parseRisk } from "@/lib/applications";
import { Empty, Flash, PageHeader, RiskBadge } from "@/components/ui";
import { approveApplication, declineApplication } from "../applications/[id]/actions";

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember("applications.approve");
  const locale = await getLocale();
  const apps = await db.application.findMany({
    where: { enterpriseId: user.enterpriseId, status: "PENDING_APPROVAL" },
    include: { traveler: true, createdBy: true, costCenter: true },
    orderBy: { travelStart: "asc" },
  });
  return (
    <div>
      <PageHeader title="Approvals" subtitle="Requests above your auto-approve limit. Approving moves them straight to our specialists." />
      <Flash searchParams={sp} />
      {apps.length === 0 ? <Empty title="You're all caught up">No requests are waiting for approval.</Empty> : (
        <div className="space-y-3">
          {apps.map((a) => {
            const risk = parseRisk(a);
            return (
              <div key={a.id} className="card flex flex-wrap items-center gap-4 p-4">
                <span className="text-3xl">{country(a.destination).flag}</span>
                <div className="min-w-[220px] flex-1">
                  <Link href={`/app/applications/${a.id}`} className="font-medium hover:underline">{a.traveler.firstName} {a.traveler.lastName} → {country(a.destination).en}</Link>
                  <div className="text-xs text-slate-500">{getProduct(a.productId)?.name} · {fmtDate(a.travelStart, locale)} – {fmtDate(a.travelEnd, locale)} · requested by {a.createdBy.name}{a.costCenter ? ` · ${a.costCenter.code}` : ""}</div>
                </div>
                <RiskBadge level={risk?.level} />
                <div className="w-28 text-end font-semibold tabular-nums">{formatAed(parsePricing(a).totalFils, locale)}</div>
                <form action={approveApplication} className="flex gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <button className="btn-primary">Approve</button>
                  <button formAction={declineApplication} className="btn-secondary">Decline</button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
