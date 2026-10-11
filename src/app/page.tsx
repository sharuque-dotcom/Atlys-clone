import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LocaleToggle } from "@/components/LocaleToggle";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { DESTINATIONS } from "@/lib/catalog";
import { country } from "@/lib/countries";

const FEATURES = [
  {
    title: "Nationality-aware eligibility",
    ar: "أهلية حسب الجنسية",
    body: "Your payroll spans 40+ passports. Safar checks passport × UAE residence × destination × purpose and tells each traveler exactly what they need — or that they need nothing at all.",
  },
  {
    title: "Real-time refusal-risk report",
    ar: "تقرير مخاطر الرفض الفوري",
    body: "Passport and residence validity, salary thresholds, appointment backlog in Dubai & Abu Dhabi, prior refusals — every factor scored with a concrete fix before anything is submitted.",
  },
  {
    title: "NOCs & salary certificates in one click",
    ar: "خطابات عدم الممانعة وشهادات الراتب بنقرة",
    body: "Generated from HR data on your letterhead, bilingual, with leave dates and return-to-work confirmation. Plus cover letters, itineraries and verifiable reservations.",
  },
  {
    title: "Document vault with expiry radar",
    ar: "خزنة المستندات مع رادار الانتهاء",
    body: "Passports read via MRZ, Emirates ID validated, residence visas tracked. You'll hear about a passport expiring in 5 months before it kills a Schengen trip.",
  },
  {
    title: "Approvals, policy & cost centres",
    ar: "الموافقات والسياسات ومراكز التكلفة",
    body: "Auto-approve under a threshold, route the rest to line managers, block destinations, charge every visa to a cost centre and watch budgets in real time.",
  },
  {
    title: "FTA-compliant tax invoices in AED",
    ar: "فواتير ضريبية متوافقة مع الهيئة الاتحادية للضرائب",
    body: "5% VAT on service fees only, government fees shown as disbursements, your TRN and ours on every invoice, monthly consolidated billing on credit terms.",
  },
  {
    title: "WhatsApp-first updates",
    ar: "تحديثات عبر واتساب أولاً",
    body: "Travelers get status changes, appointment reminders and document requests on WhatsApp — in English or Arabic. A human specialist replies in under 2 minutes, 24/7.",
  },
  {
    title: "Passport pickup across all 7 emirates",
    ar: "استلام الجوازات في الإمارات السبع",
    body: "Insured courier collects and returns passports for sticker visas, with live tracking and chain-of-custody in the audit log.",
  },
  {
    title: "HRMS sync & open API",
    ar: "مزامنة أنظمة الموارد البشرية وواجهة برمجة مفتوحة",
    body: "Pull employees from Bayzat, ZenHR, Darwinbox or SAP SuccessFactors. REST API with scoped keys and signed webhooks for your TMC or travel-booking tool.",
  },
];

const COMPARE = [
  ["Eligibility by nationality + UAE residence", "Destination only", "Full matrix"],
  ["UAE residence-visa & Emirates ID validity checks", "—", "Automatic"],
  ["Employer NOC generation", "Manual", "1-click, bilingual"],
  ["Invoicing", "GST (India)", "UAE VAT, TRN, disbursements"],
  ["Approval workflows & cost centres", "—", "Built-in"],
  ["Language", "English", "English + Arabic (RTL)"],
  ["Data residency", "Outside UAE", "UAE region, PDPL-aligned"],
  ["Notifications", "Email", "WhatsApp + email"],
];

export default async function Landing() {
  const locale = await getLocale();
  const popular = DESTINATIONS.filter((d) => d.popular);
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#features" className="btn-ghost hidden sm:inline-flex">Features</a>
            <a href="#pricing" className="btn-ghost hidden sm:inline-flex">Pricing</a>
            <LocaleToggle locale={locale} />
            <Link href="/get-started" className="btn-secondary">{t("landing.signin", locale)}</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-sand-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
              🇦🇪 Built in & for the UAE
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">{t("landing.hero", locale)}</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">{t("landing.sub", locale)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/get-started?mode=signup" className="btn-primary px-5 py-3 text-base">{t("landing.cta", locale)}</Link>
              <Link href="/get-started?demo=1" className="btn-secondary px-5 py-3 text-base">Try the live demo</Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-6 text-sm">
              <div><dt className="text-slate-500">Avg. prep time</dt><dd className="text-2xl font-semibold">7 min</dd></div>
              <div><dt className="text-slate-500">Nationalities</dt><dd className="text-2xl font-semibold">75+</dd></div>
              <div><dt className="text-slate-500">Support reply</dt><dd className="text-2xl font-semibold">&lt; 2 min</dd></div>
            </dl>
          </div>
          <div className="card self-center p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Paris sales offsite · 12–18 Dec</div>
              <span className="text-xs text-slate-500">12 travelers · 6 nationalities</span>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {[
                ["Aisha Al Mansoori", "AE", "Visa-free", "green"],
                ["Rohan Mehta", "IN", "Schengen C · Low risk", "green"],
                ["Maria Santos", "PH", "Schengen C · Residence renews in 70d", "amber"],
                ["Omar Khalid", "EG", "Schengen C · Salary note added", "green"],
                ["James Carter", "GB", "Visa-free", "green"],
                ["Bilal Ahmed", "PK", "Passport < 3 months — renew first", "red"],
              ].map(([n, c, s, tone]) => (
                <li key={n} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2"><span className="text-lg">{country(c).flag}</span>{n}</span>
                  <span className={`text-xs ${tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-rose-700"}`}>{s}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-brand-50 p-3 text-xs text-brand-900">
              NOCs, cover letters, itineraries and insurance generated for 4 applicants. TLScontact Dubai slots held for 9 Nov.
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-xs uppercase tracking-widest text-slate-400">Popular from the UAE</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {popular.map((d) => (
              <span key={d.code} className="rounded-full border border-slate-200 px-3 py-1 text-sm">
                {country(d.code).flag} {locale === "ar" ? country(d.code).ar : country(d.code).en}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">Everything a UAE travel desk actually needs</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Generic visa tools stop at the form. Safar handles the UAE-specific work around it: residence validity, NOCs, VAT invoices and passport courier.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <h3 className="font-semibold">{locale === "ar" ? f.ar : f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-3xl font-semibold tracking-tight">Why it&apos;s a step-change</h2>
          <div className="mt-8 overflow-hidden rounded-xl ring-1 ring-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr><th className="px-4 py-3 text-start font-medium">Capability</th><th className="px-4 py-3 text-start font-medium">Typical platforms</th><th className="px-4 py-3 text-start font-medium text-brand-200">Safar</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {COMPARE.map(([a, b, c]) => (
                  <tr key={a}><td className="px-4 py-3">{a}</td><td className="px-4 py-3 text-slate-400">{b}</td><td className="px-4 py-3 font-medium text-brand-200">{c}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">Transparent, per-visa pricing</h2>
        <p className="mt-2 text-slate-600">No setup fee, no minimum volume. Government fees passed through at cost. All prices in AED, excl. 5% VAT on service fees.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Starter", "Pay as you go", ["Full platform", "Standard service fees", "Card or bank transfer"]],
            ["Growth", "10% off service fees", ["Approval workflows", "Cost centres & budgets", "Monthly invoicing (30 days)"]],
            ["Enterprise", "20% off service fees", ["HRMS sync, SSO & UAE PASS", "API & webhooks", "Dedicated account manager & SLA"]],
          ].map(([name, price, items]) => (
            <div key={name as string} className="card p-6">
              <div className="text-sm font-semibold text-brand-700">{name}</div>
              <div className="mt-2 text-2xl font-semibold">{price}</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {(items as string[]).map((i) => <li key={i}>✓ {i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-sand-50 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-semibold tracking-tight">Frequently asked</h2>
          <div className="mt-8 space-y-3">
            {[
              ["Do you issue UAE VAT tax invoices?", "Yes. Every invoice carries your TRN and ours, VAT at 5% on service fees, and government fees itemised as disbursements so your finance team can reclaim input VAT correctly."],
              ["Where is our data stored?", "In a UAE cloud region, encrypted at rest. Access is role-based and every view/download is written to an immutable audit log. We align with the UAE PDPL (Federal Decree-Law 45/2021)."],
              ["Can you collect passports from our office?", "Yes, across all seven emirates. Insured pickup and return for sticker visas (Schengen, UK, US, Canada, China, Japan)."],
              ["Our team holds many nationalities. Does that matter?", "That's what Safar is built for. Requirements are computed per passport and per UAE-residence status — an Emirati, an Indian and a Briton going to the same conference get three different checklists."],
              ["Do you handle visas for guests visiting the UAE?", "Inbound UAE visit visas for clients and new joiners are on the roadmap; today our concierge handles them manually."],
            ].map(([q, a]) => (
              <details key={q} className="card group p-4">
                <summary className="cursor-pointer list-none font-medium">{q}</summary>
                <p className="mt-2 text-sm text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-slate-500">
          <Logo />
          <span>Dubai · Abu Dhabi — © {new Date().getFullYear()} Safar Technologies</span>
        </div>
      </footer>
    </div>
  );
}
