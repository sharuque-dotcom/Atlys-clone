import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { COUNTRIES, country } from "@/lib/countries";
import { DESTINATIONS, DESTINATION_BY_CODE, DOCUMENT_LABELS, type Purpose } from "@/lib/catalog";
import { eligibility, requirementsFor } from "@/lib/requirements";
import { formatAed, aedToFils } from "@/lib/money";
import { Badge, PageHeader, Section } from "@/components/ui";

type SP = Promise<Record<string, string | undefined>>;
const PURPOSES: Purpose[] = ["BUSINESS", "CONFERENCE", "TRAINING", "TOURISM", "FAMILY"];

export default async function Checker({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireMember();
  const nationality = sp.nationality ?? "IN";
  const destination = sp.destination ?? "FR";
  const purpose = (PURPOSES.includes(sp.purpose as Purpose) ? sp.purpose : "BUSINESS") as Purpose;
  const resident = sp.resident !== "0";
  const result = eligibility(destination, { nationality, uaeResident: resident }, purpose);
  const dest = DESTINATION_BY_CODE.get(destination);

  // Workforce readiness: how does the whole company look for this destination?
  const workforce = await db.traveler.groupBy({ by: ["nationality"], where: { enterpriseId: user.enterpriseId }, _count: true });
  const readiness = workforce
    .map((w) => ({ nat: w.nationality, n: w._count, e: eligibility(destination, { nationality: w.nationality, uaeResident: true }, purpose) }))
    .sort((a, b) => b.n - a.n);
  const free = readiness.filter((r) => r.e.status === "VISA_FREE" || r.e.status === "VISA_ON_ARRIVAL").reduce((s, r) => s + r.n, 0);
  const totalPeople = readiness.reduce((s, r) => s + r.n, 0);

  return (
    <div>
      <PageHeader title="Visa checker" subtitle="Passport × UAE residence × destination × purpose, answered instantly." />
      <form className="card grid gap-3 p-4 sm:grid-cols-5">
        <label className="block"><span className="label">Passport</span>
          <select name="nationality" defaultValue={nationality} className="input">{[...COUNTRIES].sort((a, b) => a.en.localeCompare(b.en)).map((c) => <option key={c.code} value={c.code}>{c.flag} {c.en}</option>)}</select></label>
        <label className="block"><span className="label">Lives in UAE</span>
          <select name="resident" defaultValue={resident ? "1" : "0"} className="input"><option value="1">Yes — UAE resident</option><option value="0">No</option></select></label>
        <label className="block"><span className="label">Destination</span>
          <select name="destination" defaultValue={destination} className="input">{DESTINATIONS.map((d) => <option key={d.code} value={d.code}>{country(d.code).flag} {country(d.code).en}</option>)}</select></label>
        <label className="block"><span className="label">Purpose</span>
          <select name="purpose" defaultValue={purpose} className="input">{PURPOSES.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}</select></label>
        <div className="flex items-end"><button className="btn-primary w-full">Check</button></div>
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Section title={<>{country(nationality).flag} {country(nationality).en} → {country(destination).flag} {country(destination).en}</>}>
          <div className="p-4">
            <Badge tone={result.status === "VISA_REQUIRED" ? "amber" : result.status === "NOT_SUPPORTED" ? "gray" : "green"}>
              {result.status === "VISA_REQUIRED" ? "Visa required" : result.status === "VISA_FREE" ? "No visa needed" : result.status === "VISA_ON_ARRIVAL" ? "Visa on arrival" : "Ask concierge"}
            </Badge>
            <p className="mt-2 text-sm text-slate-700">{result.message}</p>
            {dest?.notes && <p className="mt-2 rounded-lg bg-sand-50 p-3 text-xs text-slate-700">ℹ {dest.notes}</p>}
            {result.status === "VISA_REQUIRED" && result.products.map((p) => (
              <div key={p.id} className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm"><span className="text-slate-500">from </span><b>{formatAed(aedToFils(p.govtFeeAed + p.serviceFeeAed))}</b> <span className="text-xs text-slate-500">+ VAT on service</span></div>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <div>⏱ {p.processingDays.standard} working days{p.processingDays.priority ? ` (priority ${p.processingDays.priority})` : ""}</div>
                  <div>🛂 {p.maxStayDays} days stay · {p.entries.toLowerCase()} entry</div>
                  <div>📍 {p.centers.join(" · ")}</div>
                </div>
                <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  {requirementsFor(p, { nationality, uaeResident: resident }, purpose).map((r) => (
                    <li key={r.key} className="flex gap-2"><span className={r.autoGenerated ? "text-brand-600" : "text-slate-400"}>{r.autoGenerated ? "⚙" : "○"}</span>{DOCUMENT_LABELS[r.key].en}</li>
                  ))}
                </ul>
                <Link href={`/app/applications/new?destination=${destination}`} className="btn-primary mt-4">Start application</Link>
              </div>
            ))}
          </div>
        </Section>

        <Section title={`Your workforce → ${country(destination).en}`}>
          <div className="p-4">
            <div className="text-3xl font-semibold">{totalPeople ? Math.round((free / totalPeople) * 100) : 0}%</div>
            <div className="text-xs text-slate-500">of your {totalPeople} travelers can go without applying in advance</div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {readiness.map((r) => (
                <li key={r.nat} className="flex items-center justify-between">
                  <span>{country(r.nat).flag} {country(r.nat).en} <span className="text-slate-400">· {r.n}</span></span>
                  <Badge tone={r.e.status === "VISA_REQUIRED" ? "amber" : r.e.status === "NOT_SUPPORTED" ? "gray" : "green"}>{r.e.status === "VISA_REQUIRED" ? "Visa" : r.e.status === "VISA_FREE" ? "Free" : r.e.status === "VISA_ON_ARRIVAL" ? "On arrival" : "—"}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </div>
    </div>
  );
}
