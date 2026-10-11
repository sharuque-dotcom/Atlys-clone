import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { applicationScope } from "@/lib/scope";
import { getProduct } from "@/lib/catalog";
import { country } from "@/lib/countries";
import { addDays, daysBetween, fmtDate } from "@/lib/dates";
import { ageOn } from "@/lib/requirements";
import { RELATIONSHIPS } from "@/lib/types";
import { PrintButton } from "@/components/PrintButton";
import { audit } from "@/lib/audit";

type Params = Promise<{ id: string; kind: string }>;

export const metadata = { title: "Letter" };

const KINDS = ["noc", "salary", "cover", "itinerary", "sponsorship", "consent"] as const;
const PURPOSE_EN: Record<string, string> = { BUSINESS: "business meetings", CONFERENCE: "attending an event", TRAINING: "a training course", TOURISM: "tourism", FAMILY: "visiting family" };
const PURPOSE_AR: Record<string, string> = { BUSINESS: "اجتماعات عمل", CONFERENCE: "حضور فعالية", TRAINING: "دورة تدريبية", TOURISM: "السياحة", FAMILY: "زيارة العائلة" };

export default async function Letter({ params }: { params: Params }) {
  const { id, kind } = await params;
  const user = await requireMember();
  if (!KINDS.includes(kind as (typeof KINDS)[number])) notFound();
  const app = await db.application.findFirst({
    where: { id, ...applicationScope(user) },
    include: { traveler: true, booking: { include: { customer: { include: { members: true } }, applications: { include: { traveler: true } } } } },
  });
  if (!app) notFound();
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, `letter.generated.${kind}`, "Application", app.id);

  const t = app.traveler;
  const product = getProduct(app.productId);
  const dest = country(app.destination);
  const name = (x: { firstName: string; lastName: string }) => `${x.firstName} ${x.lastName}`;
  const household = app.booking?.customer.members ?? [t];
  const companions = app.booking?.applications.map((a) => a.traveler) ?? [t];
  const sponsor = household.find((h) => h.id === t.sponsorId) ?? household.find((h) => h.relationship === "SELF" && h.id !== t.id) ?? (t.relationship === "SELF" ? t : household[0]);
  const nights = daysBetween(app.travelStart, app.travelEnd);
  const pEn = PURPOSE_EN[app.purpose] ?? app.purpose.toLowerCase();
  const pAr = PURPOSE_AR[app.purpose] ?? "";
  const pron = t.gender === "FEMALE" ? "her" : t.gender === "MALE" ? "his" : "their";
  const isEmployerDraft = kind === "noc" || kind === "salary";
  const employer = (isEmployerDraft ? t : sponsor).employerName ?? "[Employer name]";
  const subjectOfIncome = kind === "salary" || kind === "noc" ? t : sponsor;

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[800px] items-center justify-between gap-4 px-4">
        <span className="text-sm text-slate-600">
          {isEmployerDraft ? `Draft for ${employer}: give it to the customer to print on the employer's letterhead, sign and stamp.` : "Review, then print or save as PDF for the customer to sign."}
        </span>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[800px] bg-white p-12 text-[13px] leading-relaxed shadow print:shadow-none">
        {isEmployerDraft ? (
          <header className="border-b-2 border-dashed border-slate-400 pb-4 text-center text-slate-400">[ {employer} — company letterhead ]</header>
        ) : (
          <header className="border-b border-slate-300 pb-3 text-xs text-slate-500">{name(kind === "sponsorship" || kind === "consent" ? sponsor : t)} · {(kind === "sponsorship" || kind === "consent" ? sponsor : t).phone ?? app.booking?.customer.phone ?? ""} · United Arab Emirates</header>
        )}
        <div className="mt-6 flex justify-between text-xs"><span>{isEmployerDraft ? "Ref: ________" : `Ref: ${app.ref}`}</span><span>Date: {fmtDate(new Date())}</span></div>

        {kind === "noc" && (
          <>
            <p className="mt-6">To,<br />The Visa Officer<br />Embassy / Consulate of {dest.en}</p>
            <h1 className="mt-6 text-center text-base font-bold underline">NO OBJECTION CERTIFICATE</h1>
            <p className="mt-4">This is to certify that <b>{name(t)}</b>, holder of {country(t.nationality).en} passport no. <b>{t.passportNo ?? "________"}</b>{t.emiratesIdNo ? <>, Emirates ID <b>{t.emiratesIdNo}</b></> : null}, is employed with <b>{employer}</b> as <b>{t.designation ?? "________"}</b>{t.joinedAt ? <> since <b>{fmtDate(t.joinedAt)}</b></> : null}{t.monthlySalaryAed ? <>, drawing a monthly salary of <b>AED {t.monthlySalaryAed.toLocaleString()}</b></> : null}.</p>
            <p className="mt-3">We have no objection to {pron} travel to <b>{dest.en}</b> from <b>{fmtDate(app.travelStart)}</b> to <b>{fmtDate(app.travelEnd)}</b> for <b>{pEn}</b>{companions.length > 1 ? <> together with {pron} family</> : null}. Leave has been approved for this period and {t.firstName} will resume duties on <b>{fmtDate(addDays(app.travelEnd, 1))}</b>.</p>
            <p className="mt-3">This certificate is issued at the employee&apos;s request for visa purposes only.</p>
            <hr className="my-6 border-dashed" />
            <div dir="rtl" className="text-end">
              <h2 className="text-center text-base font-bold underline">شهادة عدم ممانعة</h2>
              <p className="mt-3">نشهد بأن <b>{name(t)}</b>، حامل جواز السفر رقم <b>{t.passportNo ?? "________"}</b>، يعمل لدينا بوظيفة <b>{t.designation ?? "________"}</b>، ولا مانع لدينا من سفره إلى <b>{dest.ar}</b> خلال الفترة من <b>{fmtDate(app.travelStart, "ar")}</b> إلى <b>{fmtDate(app.travelEnd, "ar")}</b> بغرض <b>{pAr}</b>، على أن يعود لمباشرة عمله بعد انتهاء الإجازة.</p>
            </div>
            <Signature left="Authorised signatory · HR" right="المفوَّض بالتوقيع" stamp />
          </>
        )}

        {kind === "salary" && (
          <>
            <h1 className="mt-6 text-center text-base font-bold underline">SALARY CERTIFICATE</h1>
            <p className="mt-4">To whom it may concern,</p>
            <p className="mt-3">This is to certify that <b>{name(t)}</b> ({country(t.nationality).en} national, passport no. {t.passportNo ?? "—"}) is employed with <b>{employer}</b> as <b>{t.designation ?? "—"}</b>{t.joinedAt ? `, since ${fmtDate(t.joinedAt)}` : ""}.</p>
            <table className="mt-4 w-full border text-sm"><tbody>
              <tr className="border-b"><td className="p-2">Gross monthly salary</td><td className="p-2 text-end font-semibold">AED {t.monthlySalaryAed?.toLocaleString() ?? "________"}</td></tr>
              <tr className="border-b"><td className="p-2">Annual gross salary</td><td className="p-2 text-end font-semibold">AED {t.monthlySalaryAed ? (t.monthlySalaryAed * 12).toLocaleString() : "________"}</td></tr>
              <tr><td className="p-2">Salary paid via</td><td className="p-2 text-end">UAE Wage Protection System (WPS)</td></tr>
            </tbody></table>
            <p className="mt-4">This certificate is issued upon the employee&apos;s request without any liability on the company.</p>
            <Signature left="Authorised signatory · HR" right="المفوَّض بالتوقيع" stamp />
          </>
        )}

        {kind === "cover" && (
          <>
            <p className="mt-6">To,<br />The Visa Section<br />Embassy / Consulate of {dest.en}</p>
            <p className="mt-4"><b>Subject: {product?.name ?? "Visa"} application — {name(t)}</b></p>
            <p className="mt-3">Dear Sir/Madam,</p>
            {(() => {
              const age = ageOn(t.dateOfBirth, app.travelStart);
              const minor = age != null && age < 18;
              const rel = RELATIONSHIPS[t.relationship as keyof typeof RELATIONSHIPS]?.en.toLowerCase();
              if (minor || ["DEPENDENT", "STUDENT", "UNEMPLOYED"].includes(t.employmentType)) {
                return (
                  <p className="mt-3">I, <b>{name(sponsor)}</b>, {country(sponsor.nationality).en} national{sponsor.uaeResident ? " residing in the United Arab Emirates" : ""}, kindly request a {product?.name ?? "visa"} for my {rel === "main applicant" ? "family member" : rel}, <b>{name(t)}</b>{minor ? ` (aged ${age})` : ""}, to travel with our family to {dest.en} from {fmtDate(app.travelStart)} to {fmtDate(app.travelEnd)} ({nights} nights) for {pEn}. I am employed as {sponsor.designation ?? "________"} with {sponsor.employerName ?? "________"}{sponsor.monthlySalaryAed ? `, earning AED ${sponsor.monthlySalaryAed.toLocaleString()} per month` : ""}, and I will bear all expenses of the trip. We will return to the UAE on {fmtDate(app.travelEnd)}{minor ? " and my child will resume school thereafter" : ""}.</p>
                );
              }
              return (
                <p className="mt-3">I, <b>{name(t)}</b>, a {country(t.nationality).en} national{t.uaeResident ? " residing in the United Arab Emirates" : ""}, am applying for a {product?.entries.toLowerCase()}-entry {product?.name ?? "visa"} to travel to {dest.en} from {fmtDate(app.travelStart)} to {fmtDate(app.travelEnd)} ({nights} nights) for {pEn}{companions.length > 1 ? `, together with my family (${companions.filter((c) => c.id !== t.id).map((c) => c.firstName).join(", ")})` : ""}. I work as {t.designation ?? "________"} with {t.employerName ?? "________"}{t.monthlySalaryAed ? `, earning AED ${t.monthlySalaryAed.toLocaleString()} per month` : ""}. {t.uaeResident && t.residenceVisaExpiry ? `My UAE residence visa is valid until ${fmtDate(t.residenceVisaExpiry)}. ` : ""}I will return to the UAE to resume work on {fmtDate(addDays(app.travelEnd, 1))}.</p>
              );
            })()}
            {t.travelHistory && <p className="mt-3">Previous travel: {t.travelHistory.split(",").map((c) => country(c).en).join(", ")} — all visa conditions were respected.</p>}
            <p className="mt-3">Please find enclosed the passport, photographs, proof of employment and funds, travel itinerary, reservations and travel insurance. I kindly request you to consider this application favourably.</p>
            <p className="mt-6">Yours faithfully,<br /><br /><br />{name(minorOrDependent(t, app.travelStart) ? sponsor : t)}</p>
          </>
        )}

        {kind === "sponsorship" && (
          <>
            <p className="mt-6">To,<br />The Visa Officer<br />Embassy / Consulate of {dest.en}</p>
            <h1 className="mt-6 text-center text-base font-bold underline">FAMILY SPONSORSHIP LETTER</h1>
            <p className="mt-4">I, <b>{name(sponsor)}</b>, holder of {country(sponsor.nationality).en} passport no. <b>{sponsor.passportNo ?? "________"}</b>{sponsor.emiratesIdNo ? <>, Emirates ID {sponsor.emiratesIdNo}</> : null}, employed as {sponsor.designation ?? "________"} with {sponsor.employerName ?? "________"}{sponsor.monthlySalaryAed ? <> (monthly salary AED {sponsor.monthlySalaryAed.toLocaleString()})</> : null}, confirm that I will bear all costs — travel, accommodation, insurance and daily expenses — for the following family members travelling to <b>{dest.en}</b> from <b>{fmtDate(app.travelStart)}</b> to <b>{fmtDate(app.travelEnd)}</b>:</p>
            <table className="mt-4 w-full border text-sm">
              <thead className="bg-slate-50"><tr><th className="border p-2 text-start">Name</th><th className="border p-2 text-start">Relationship</th><th className="border p-2 text-start">Passport</th><th className="border p-2 text-start">Date of birth</th></tr></thead>
              <tbody>
                {companions.filter((c) => c.id !== sponsor.id).map((c) => (
                  <tr key={c.id}><td className="border p-2">{name(c)}</td><td className="border p-2">{RELATIONSHIPS[c.relationship as keyof typeof RELATIONSHIPS]?.en}</td><td className="border p-2">{c.passportNo ?? "—"}</td><td className="border p-2">{fmtDate(c.dateOfBirth)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4">We will all return to the United Arab Emirates at the end of the trip.</p>
            <Signature left={name(sponsor)} right="التوقيع" />
          </>
        )}

        {kind === "consent" && (
          <>
            <h1 className="mt-6 text-center text-base font-bold underline">PARENTAL CONSENT FOR TRAVEL OF A MINOR</h1>
            <p className="mt-4">I, ______________________________, holder of passport no. ______________, parent of <b>{name(t)}</b> (born {fmtDate(t.dateOfBirth)}, {country(t.nationality).en} passport no. {t.passportNo ?? "________"}), hereby give my full consent for my child to travel to <b>{dest.en}</b> from <b>{fmtDate(app.travelStart)}</b> to <b>{fmtDate(app.travelEnd)}</b> accompanied by <b>{companions.filter((c) => c.id !== t.id && ["SELF", "SPOUSE"].includes(c.relationship)).map(name).join(" and ") || "________"}</b>.</p>
            <p className="mt-3">I can be contacted at: ______________________.</p>
            <hr className="my-6 border-dashed" />
            <div dir="rtl" className="text-end">
              <h2 className="text-center text-base font-bold underline">موافقة ولي الأمر على سفر قاصر</h2>
              <p className="mt-3">أنا الموقع أدناه، ولي أمر الطفل/الطفلة <b>{name(t)}</b>، أوافق موافقة تامة على سفره إلى <b>{dest.ar}</b> خلال الفترة من <b>{fmtDate(app.travelStart, "ar")}</b> إلى <b>{fmtDate(app.travelEnd, "ar")}</b>.</p>
            </div>
            <Signature left="Signature of non-travelling parent" right="توقيع ولي الأمر" />
            <p className="mt-4 text-xs text-slate-500">Most embassies require this letter to be notarised (UAE notary public / court) with a copy of the signing parent&apos;s passport and Emirates ID.</p>
          </>
        )}

        {kind === "itinerary" && (
          <>
            <h1 className="mt-6 text-center text-base font-bold">TRAVEL ITINERARY</h1>
            <p className="mt-2 text-center text-xs text-slate-600">{companions.map(name).join(", ")} · {dest.en} · {fmtDate(app.travelStart)} – {fmtDate(app.travelEnd)}</p>
            <table className="mt-6 w-full border text-sm">
              <thead className="bg-slate-50"><tr><th className="border p-2 text-start">Day</th><th className="border p-2 text-start">Date</th><th className="border p-2 text-start">Plan</th></tr></thead>
              <tbody>
                {Array.from({ length: nights + 1 }, (_, i) => {
                  const plan = i === 0 ? `Depart Dubai (DXB) / Abu Dhabi (AUH) → arrive ${dest.en}; hotel check-in`
                    : i === nights ? "Hotel check-out; return flight to the UAE"
                    : app.purpose === "TOURISM" || app.purpose === "FAMILY" ? "Sightseeing & family activities"
                    : app.purpose === "CONFERENCE" ? "Event sessions" : app.purpose === "TRAINING" ? "Training sessions" : "Business meetings";
                  return <tr key={i}><td className="border p-2">{i + 1}</td><td className="border p-2">{fmtDate(addDays(app.travelStart, i))}</td><td className="border p-2">{plan}</td></tr>;
                })}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-slate-500">Flight and hotel reservations are attached separately.</p>
          </>
        )}
      </article>
    </div>
  );
}

function minorOrDependent(t: { dateOfBirth: Date | null; employmentType: string }, on: Date) {
  const age = ageOn(t.dateOfBirth, on);
  return (age != null && age < 18) || ["DEPENDENT", "STUDENT", "UNEMPLOYED"].includes(t.employmentType);
}

function Signature({ left, right, stamp }: { left: string; right: string; stamp?: boolean }) {
  return (
    <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
      <div><div className="h-14 border-b border-slate-400" /><div className="mt-1">{left}</div>{stamp && <div className="text-xs text-slate-500">Company stamp</div>}</div>
      <div dir="rtl" className="text-end"><div className="h-14 border-b border-slate-400" /><div className="mt-1">{right}</div></div>
    </div>
  );
}
