import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { applicationScope } from "@/lib/scope";
import { getProduct } from "@/lib/catalog";
import { country, emirateName } from "@/lib/countries";
import { addDays, daysBetween, fmtDate } from "@/lib/dates";
import { PrintButton } from "@/components/PrintButton";
import { audit } from "@/lib/audit";

type Params = Promise<{ id: string; kind: string }>;

export const metadata = { title: "Document" };

export default async function Letter({ params }: { params: Params }) {
  const { id, kind } = await params;
  const user = await requireMember();
  const app = await db.application.findFirst({
    where: { id, ...applicationScope(user) },
    include: { traveler: { include: { branch: true } }, enterprise: { include: { branches: true } } },
  });
  if (!app || !["noc", "salary", "cover", "itinerary"].includes(kind)) notFound();
  await audit({ id: user.id, name: user.name, enterpriseId: user.enterpriseId }, `letter.generated.${kind}`, "Application", app.id);

  const t = app.traveler;
  const e = app.enterprise;
  const product = getProduct(app.productId);
  const dest = country(app.destination);
  const office = t.branch ?? e.branches.find((b) => b.type === "BILLING") ?? e.branches[0];
  const fullName = `${t.firstName} ${t.lastName}`;
  const nights = daysBetween(app.travelStart, app.travelEnd);
  const today = new Date();
  const purposeEn = { BUSINESS: "business meetings", CONFERENCE: "attending a conference", TRAINING: "professional training", TOURISM: "tourism", FAMILY: "visiting family" }[app.purpose] ?? app.purpose.toLowerCase();
  const purposeAr = { BUSINESS: "اجتماعات عمل", CONFERENCE: "حضور مؤتمر", TRAINING: "تدريب مهني", TOURISM: "السياحة", FAMILY: "زيارة العائلة" }[app.purpose] ?? "";

  const Letterhead = (
    <header className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
      <div>
        <div className="text-xl font-bold">{e.legalName}</div>
        <div className="text-xs text-slate-600">{office?.address}, {emirateName(e.emirate)}, United Arab Emirates</div>
        <div className="text-xs text-slate-600">Trade Licence {e.tradeLicenseNo ?? "—"} ({e.licenseAuthority ?? "—"}){e.trn ? ` · TRN ${e.trn}` : ""}</div>
      </div>
      <div className="text-end text-xs text-slate-600" dir="rtl">
        <div className="text-base font-bold text-slate-800">{e.name}</div>
        <div>الإمارات العربية المتحدة</div>
      </div>
    </header>
  );

  const Sign = (
    <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
      <div>
        <div className="h-14 border-b border-slate-400" />
        <div className="mt-1">Authorised signatory · HR Department</div>
        <div className="text-xs text-slate-500">Company stamp</div>
      </div>
      <div dir="rtl" className="text-end">
        <div className="h-14 border-b border-slate-400" />
        <div className="mt-1">المفوَّض بالتوقيع · إدارة الموارد البشرية</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[800px] justify-between px-4">
        <span className="text-sm text-slate-600">Review, then print or save as PDF. Print on company letterhead and stamp.</span>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[800px] bg-white p-12 text-[13px] leading-relaxed shadow print:shadow-none">
        {Letterhead}
        <div className="mt-6 flex justify-between text-xs"><span>Ref: {app.ref}/{kind.toUpperCase()}</span><span>Date: {fmtDate(today)}</span></div>

        {kind === "noc" && (
          <>
            <p className="mt-6">To,<br />The Visa Officer<br />Embassy / Consulate of {dest.en}<br />{product?.centers[0]?.split("—").pop()?.trim() ?? "United Arab Emirates"}</p>
            <h1 className="mt-6 text-center text-base font-bold underline">NO OBJECTION CERTIFICATE</h1>
            <p className="mt-4">This is to certify that <b>{fullName}</b>, holder of {country(t.nationality).en} passport no. <b>{t.passportNo ?? "________"}</b>{t.emiratesIdNo ? <>, Emirates ID <b>{t.emiratesIdNo}</b></> : null}, is employed with <b>{e.legalName}</b> as <b>{t.designation ?? "________"}</b>{t.joinedAt ? <> since <b>{fmtDate(t.joinedAt)}</b></> : null}{t.monthlySalaryAed ? <>, drawing a monthly salary of <b>AED {t.monthlySalaryAed.toLocaleString()}</b></> : null}.</p>
            <p className="mt-3">The company has no objection to {t.gender === "FEMALE" ? "her" : t.gender === "MALE" ? "his" : "their"} travel to <b>{dest.en}</b> from <b>{fmtDate(app.travelStart)}</b> to <b>{fmtDate(app.travelEnd)}</b> for the purpose of <b>{purposeEn}</b>. Leave has been approved for this period and the employee will resume duties on <b>{fmtDate(addDays(app.travelEnd, 1))}</b>.</p>
            {(app.purpose === "BUSINESS" || app.purpose === "CONFERENCE" || app.purpose === "TRAINING") && <p className="mt-3">All expenses related to this trip, including travel, accommodation and medical insurance, will be borne by the company.</p>}
            <p className="mt-3">This certificate is issued at the request of the employee for visa purposes only.</p>
            <hr className="my-6 border-dashed" />
            <div dir="rtl" className="text-end">
              <h2 className="text-center text-base font-bold underline">شهادة عدم ممانعة</h2>
              <p className="mt-3">نشهد بأن السيد/السيدة <b>{fullName}</b>، حامل جواز السفر رقم <b>{t.passportNo ?? "________"}</b>، يعمل لدى <b>{e.name}</b> بوظيفة <b>{t.designation ?? "________"}</b>. ولا مانع لدى الشركة من سفره إلى <b>{dest.ar}</b> خلال الفترة من <b>{fmtDate(app.travelStart, "ar")}</b> إلى <b>{fmtDate(app.travelEnd, "ar")}</b> بغرض <b>{purposeAr}</b>، على أن يعود لمباشرة عمله بعد انتهاء الإجازة.</p>
            </div>
          </>
        )}

        {kind === "salary" && (
          <>
            <h1 className="mt-6 text-center text-base font-bold underline">SALARY CERTIFICATE</h1>
            <p className="mt-4">To whom it may concern,</p>
            <p className="mt-3">This is to certify that <b>{fullName}</b> ({country(t.nationality).en} national, passport no. {t.passportNo ?? "—"}) is employed with <b>{e.legalName}</b> as <b>{t.designation ?? "—"}</b>{t.department ? `, ${t.department} department` : ""}{t.joinedAt ? `, since ${fmtDate(t.joinedAt)}` : ""}.</p>
            <table className="mt-4 w-full border text-sm">
              <tbody>
                <tr className="border-b"><td className="p-2">Gross monthly salary</td><td className="p-2 text-end font-semibold">AED {t.monthlySalaryAed?.toLocaleString() ?? "—"}</td></tr>
                <tr className="border-b"><td className="p-2">Annual gross salary</td><td className="p-2 text-end font-semibold">AED {t.monthlySalaryAed ? (t.monthlySalaryAed * 12).toLocaleString() : "—"}</td></tr>
                <tr><td className="p-2">Salary paid via</td><td className="p-2 text-end">UAE Wage Protection System (WPS)</td></tr>
              </tbody>
            </table>
            <p className="mt-4">This certificate is issued upon the employee&apos;s request without any liability on the company.</p>
          </>
        )}

        {kind === "cover" && (
          <>
            <p className="mt-6">To,<br />The Visa Section<br />Embassy / Consulate of {dest.en}</p>
            <p className="mt-4"><b>Subject: Application for {product?.name ?? "visa"} — {fullName}</b></p>
            <p className="mt-3">Dear Sir/Madam,</p>
            <p className="mt-3">I, <b>{fullName}</b>, a {country(t.nationality).en} national{t.uaeResident ? " and resident of the United Arab Emirates" : ""}, am applying for a {product?.entries.toLowerCase()}-entry {product?.name ?? "visa"} to travel to {dest.en} from {fmtDate(app.travelStart)} to {fmtDate(app.travelEnd)} ({nights} nights) for {purposeEn}.</p>
            <p className="mt-3">I am employed as {t.designation ?? "an employee"} with {e.legalName}, {emirateName(e.emirate)}{t.monthlySalaryAed ? `, earning AED ${t.monthlySalaryAed.toLocaleString()} per month` : ""}. {t.uaeResident && t.residenceVisaExpiry ? `My UAE residence visa is valid until ${fmtDate(t.residenceVisaExpiry)}. ` : ""}My employer has approved my leave and I will return to the UAE to resume my duties on {fmtDate(addDays(app.travelEnd, 1))}.</p>
            {app.notes && <p className="mt-3">{app.notes}</p>}
            {t.travelHistory && <p className="mt-3">I have previously travelled to {t.travelHistory.split(",").map((c) => country(c).en).join(", ")} and have always complied with the conditions of my visas.</p>}
            <p className="mt-3">Please find enclosed my passport, photographs, employer NOC, salary certificate, bank statements, travel itinerary, reservations and travel insurance. I kindly request you to consider my application favourably.</p>
            <p className="mt-6">Yours faithfully,<br /><br />{fullName}<br />{t.phone ?? ""} {t.email ? `· ${t.email}` : ""}</p>
          </>
        )}

        {kind === "itinerary" && (
          <>
            <h1 className="mt-6 text-center text-base font-bold">TRAVEL ITINERARY — {fullName.toUpperCase()}</h1>
            <p className="mt-2 text-center text-xs text-slate-600">{dest.en} · {fmtDate(app.travelStart)} – {fmtDate(app.travelEnd)} · Purpose: {purposeEn}</p>
            <table className="mt-6 w-full border text-sm">
              <thead className="bg-slate-50"><tr><th className="border p-2 text-start">Day</th><th className="border p-2 text-start">Date</th><th className="border p-2 text-start">Plan</th></tr></thead>
              <tbody>
                {Array.from({ length: nights + 1 }, (_, i) => {
                  const d = addDays(app.travelStart, i);
                  const plan = i === 0 ? `Depart Dubai (DXB) / Abu Dhabi (AUH) → arrive ${dest.en}; hotel check-in`
                    : i === nights ? `Hotel check-out; return flight to the UAE`
                    : app.purpose === "TOURISM" || app.purpose === "FAMILY" ? "Sightseeing & local activities"
                    : app.purpose === "CONFERENCE" ? "Conference sessions & networking"
                    : app.purpose === "TRAINING" ? "Training sessions"
                    : "Business meetings with host company";
                  return <tr key={i}><td className="border p-2">{i + 1}</td><td className="border p-2">{fmtDate(d)}</td><td className="border p-2">{plan}</td></tr>;
                })}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-slate-500">Flight and hotel reservations are attached separately and are verifiable with the issuing provider.</p>
          </>
        )}

        {kind !== "cover" && kind !== "itinerary" && Sign}
        <footer className="mt-10 border-t pt-2 text-[10px] text-slate-400">Generated via Safar Enterprise · {app.ref}</footer>
      </article>
    </div>
  );
}
