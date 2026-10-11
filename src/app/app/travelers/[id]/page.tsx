import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { travelerScope } from "@/lib/scope";
import { country } from "@/lib/countries";
import { DOCUMENT_LABELS } from "@/lib/catalog";
import { daysBetween, fmtDate } from "@/lib/dates";
import { can, DOC_TYPES } from "@/lib/types";
import { getProduct } from "@/lib/catalog";
import { Badge, Flash, Section, StatusBadge } from "@/components/ui";
import { TravelerForm } from "../TravelerForm";
import { deleteDocument, uploadDocument } from "../actions";

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | undefined>>;

export default async function TravelerPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireMember();
  const locale = await getLocale();
  const t = await db.traveler.findFirst({
    where: { id, ...travelerScope(user) },
    include: { documents: { orderBy: { createdAt: "desc" } }, applications: { orderBy: { createdAt: "desc" } } },
  });
  if (!t) notFound();
  const manage = can(user.role, "travelers.manage");
  const [branches, managers] = manage
    ? await Promise.all([
        db.branch.findMany({ where: { enterpriseId: user.enterpriseId } }),
        db.user.findMany({ where: { enterpriseId: user.enterpriseId, role: { in: ["OWNER", "ADMIN", "APPROVER", "TRAVEL_MANAGER"] } } }),
      ])
    : [[], []];
  const now = new Date();

  const health = [
    { label: "Passport", date: t.passportExpiry, warn: 210 },
    ...(t.nationality !== "AE" && t.uaeResident ? [{ label: "UAE residence visa", date: t.residenceVisaExpiry, warn: 120 }] : []),
    ...(t.uaeResident ? [{ label: "Emirates ID", date: t.emiratesIdExpiry, warn: 60 }] : []),
  ];

  return (
    <div>
      <div className="mb-2 text-sm text-slate-500">{manage && <><Link href="/app/travelers" className="hover:underline">Travelers</Link> / </>}{t.firstName} {t.lastName}</div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-800">{t.firstName[0]}{t.lastName[0]}</div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.firstName} {t.lastName}</h1>
            <div className="text-sm text-slate-500">{country(t.nationality).flag} {country(t.nationality).en}{t.designation ? ` · ${t.designation}` : ""}{t.department ? ` · ${t.department}` : ""}</div>
          </div>
        </div>
        {can(user.role, "applications.create") && <Link href={`/app/applications/new?traveler=${t.id}`} className="btn-primary">New application</Link>}
      </div>
      <Flash searchParams={sp} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {health.map((h) => {
          const d = h.date ? daysBetween(now, h.date) : null;
          return (
            <div key={h.label} className="card p-4">
              <div className="text-xs text-slate-500">{h.label}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-semibold">{fmtDate(h.date, locale)}</span>
                {d == null ? <Badge tone="amber">Missing</Badge> : d < 0 ? <Badge tone="red">Expired</Badge> : d < h.warn ? <Badge tone="amber">{d} days left</Badge> : <Badge tone="green">Valid</Badge>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section title={`Document vault · ${t.documents.length}`}>
            {t.documents.length === 0 ? <p className="p-4 text-sm text-slate-500">Nothing uploaded yet. Documents are stored once and reused across every application.</p> : (
              <ul className="divide-y divide-slate-100">
                {t.documents.map((d) => {
                  const ex = d.extracted ? (JSON.parse(d.extracted) as { mrzValid?: boolean }) : null;
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{d.type in DOCUMENT_LABELS ? DOCUMENT_LABELS[d.type as keyof typeof DOCUMENT_LABELS].en : d.type}</div>
                        <div className="truncate text-xs text-slate-500"><a href={`/api/files/${d.id}`} className="text-brand-700 hover:underline">{d.fileName}</a> · {(d.size / 1024).toFixed(0)} KB · {fmtDate(d.createdAt, locale)}{d.expiresAt ? ` · expires ${fmtDate(d.expiresAt, locale)}` : ""}</div>
                      </div>
                      {ex && <Badge tone={ex.mrzValid ? "green" : "red"}>{ex.mrzValid ? "MRZ verified" : "MRZ mismatch"}</Badge>}
                      {d.expiresAt && d.expiresAt < now && <Badge tone="red">Expired</Badge>}
                      {manage && <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><button className="btn-ghost text-xs text-rose-700">Remove</button></form>}
                    </li>
                  );
                })}
              </ul>
            )}
            <form action={uploadDocument} className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
              <input type="hidden" name="travelerId" value={t.id} />
              <label className="block"><span className="label">Document type</span>
                <select name="type" className="input">{DOC_TYPES.map((k) => <option key={k} value={k}>{k in DOCUMENT_LABELS ? DOCUMENT_LABELS[k as keyof typeof DOCUMENT_LABELS].en : "Other"}</option>)}</select></label>
              <label className="block"><span className="label">Expiry date (if any)</span><input type="date" name="expiresAt" className="input" /></label>
              <label className="block sm:col-span-2"><span className="label">File (PDF/JPG/PNG, max 10 MB)</span><input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" className="block w-full text-sm" /></label>
              <label className="block sm:col-span-2"><span className="label">Passport MRZ (optional — the two lines at the bottom of the bio page)</span>
                <textarea name="mrz" rows={2} className="input font-mono text-xs uppercase" placeholder={"P<INDSHARMA<<ROHAN<<<<<<<<<<<<<<<<<<<<<<<<<<\nZ1234567<0IND8805123M3101015<<<<<<<<<<<<<<04"} /></label>
              <div className="sm:col-span-2"><button className="btn-primary">Upload to vault</button></div>
            </form>
          </Section>

          {manage && <Section title="Profile"><TravelerForm traveler={t} branches={branches} managers={managers} /></Section>}
        </div>

        <Section title="Applications">
          {t.applications.length === 0 ? <p className="p-4 text-sm text-slate-500">No applications yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {t.applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/app/applications/${a.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                    <div><div className="text-sm font-medium">{country(a.destination).flag} {getProduct(a.productId)?.name ?? a.productId}</div><div className="text-xs text-slate-500">{a.ref} · {fmtDate(a.travelStart, locale)}</div></div>
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
