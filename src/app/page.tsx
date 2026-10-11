import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LocaleToggle } from "@/components/LocaleToggle";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { DESTINATIONS } from "@/lib/catalog";
import { country } from "@/lib/countries";

const FEATURES = [
  {
    title: "AI checks every document the moment it's uploaded",
    ar: "الذكاء الاصطناعي يدقق كل مستند فور رفعه",
    body: "Passport validity, name and number mismatches, a residence visa still on the old passport, Emirates ID numbers, photo backgrounds, NOC dates, bank-statement periods and balances, insurance cover, unattested marriage certificates — each flagged with the fix.",
  },
  {
    title: "Cross-checks the whole family file",
    ar: "مطابقة ملف العائلة بالكامل",
    body: "Same salary on the NOC, salary certificate and profile. The sponsoring parent named on the child's birth certificate. Dates that match the trip. The things embassies refuse files for, caught before the appointment.",
  },
  {
    title: "One print-ready file per applicant",
    ar: "ملف جاهز للطباعة لكل متقدم",
    body: "Download one PDF in the embassy's order: checklist cover sheet, pre-filled application data sheet, cover letter, itinerary, sponsorship and consent letters, employer NOC drafts and every uploaded document. Print and go.",
  },
  {
    title: "Quote a whole family in two minutes",
    ar: "عرض سعر لعائلة كاملة في دقيقتين",
    body: "Each person's visa, checklist and price from their passport, UAE residence, age and sponsor — including Schengen child fees, sponsored spouses and children travelling with one parent.",
  },
  {
    title: "Customers upload from their phone",
    ar: "العملاء يرفعون المستندات من هواتفهم",
    body: "Send the quote on WhatsApp with a private link. The family uploads documents to a portal in your agency's name, and sees instantly if something needs replacing — no more chasing photos.",
  },
  {
    title: "Your price, your margin",
    ar: "سعرك وهامش ربحك",
    body: "Set your own fee per visa. One flat platform fee per application — the rest is yours. Margins, balances due and VAT on every booking.",
  },
  {
    title: "Payments, balances & VAT invoices",
    ar: "المدفوعات والأرصدة والفواتير الضريبية",
    body: "Record cash, card or transfer. Customer tax invoices carry your TRN and branding; embassy fees are shown as disbursements.",
  },
  {
    title: "Renewal leads on autopilot",
    ar: "فرص التجديد تلقائيًا",
    body: "Every passport and residence visa you've seen is tracked. Expiring passports show up as leads before the customer walks into the agency next door.",
  },
  {
    title: "Arabic, English, and your brand",
    ar: "العربية والإنجليزية وعلامتك التجارية",
    body: "Bilingual app with right-to-left layout and bilingual letters. Customers see your agency's name and colour — not ours.",
  },
];

const COMPARE = [
  ["Document checking", "Agent eyeballs each file", "AI review + rules on every upload"],
  ["Visa on old passport, name mismatches", "Found at the embassy", "Flagged on upload"],
  ["Families with mixed ages & sponsorship", "One form per person", "One booking, per-person rules"],
  ["Letters & form data", "Typed from scratch", "Pre-filled, bilingual, print-ready"],
  ["Final file", "Stapled by hand", "One PDF in submission order"],
  ["Customer document collection", "WhatsApp photos", "Branded upload portal"],
  ["Invoicing", "Generic", "UAE VAT, your TRN, disbursements"],
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
              🇦🇪 Built for UAE travel agencies
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">{t("landing.hero", locale)}</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">{t("landing.sub", locale)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/get-started?mode=signup" className="btn-primary px-5 py-3 text-base">{t("landing.cta", locale)}</Link>
              <Link href="/get-started?demo=1" className="btn-secondary px-5 py-3 text-base">Try the live demo</Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-6 text-sm">
              <div><dt className="text-slate-500">Destinations</dt><dd className="text-2xl font-semibold">23</dd></div>
              <div><dt className="text-slate-500">Nationalities</dt><dd className="text-2xl font-semibold">75+</dd></div>
              <div><dt className="text-slate-500">Setup fee</dt><dd className="text-2xl font-semibold">AED 0</dd></div>
            </dl>
          </div>
          <div className="card self-center p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Mehta family · Paris · AI review</div>
              <span className="text-xs text-slate-500">4 applicants · 31 documents</span>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {[
                ["Rohan · passport", "IN", "✓ AI verified", "green"],
                ["Priya · residence visa", "IN", "Issued under old passport — transfer first", "red"],
                ["Rohan · employer NOC", "IN", "Dated 41 days ago — ask for a fresh copy", "amber"],
                ["Aarav · photo", "IN", "Background not white — retake", "red"],
                ["Anaya · birth certificate", "IN", "✓ Sponsor named as parent", "green"],
              ].map(([n, c, s, tone]) => (
                <li key={n} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2"><span className="text-lg">{country(c).flag}</span>{n}</span>
                  <span className={`text-xs ${tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-rose-700"}`}>{s}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-brand-50 p-3 text-xs text-brand-900">
              2 issues to fix, then download one print-ready PDF per applicant — letters and form data pre-filled.
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
        <h2 className="text-3xl font-semibold tracking-tight">Everything your visa counter needs</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Walk-ins, WhatsApp enquiries and repeat families. Safar handles the visa work around your customer relationship, so you sell more and chase less.</p>
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
        <h2 className="text-3xl font-semibold tracking-tight">One flat fee per application</h2>
        <p className="mt-2 text-slate-600">No setup fee, no seat licences. You charge your customers what you like; Safar charges a platform fee per application, including the AI review and the print pack. Prices excl. 5% VAT.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Starter", "AED 39 / application", ["Unlimited staff & customers", "AI document review & print packs", "Branded customer portal"]],
            ["Growth", "AED 29 / application", ["From 50 applications / month", "Monthly statement, 30-day terms", "Priority support"]],
            ["Network", "AED 19 / application", ["Multi-branch agencies", "API, webhooks & website widget", "Dedicated account manager"]],
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
              ["What does the AI actually check?", "It reads each upload (passport, Emirates ID, residence visa, NOC, salary certificate, bank statement, insurance, certificates, photos) and our rules engine checks it against the destination's requirements, the trip dates and the family's other documents. Every flag says what's wrong and how to fix it; your agent can accept a flag with a reason."],
              ["Does the AI decide whether a file is good enough?", "No. The AI only reads; the pass/fail rules are explicit and explainable, and your agent always has the final say. It catches mistakes earlier — the embassy still decides."],
              ["Can my customers see Safar's name?", "No. Quotes, the customer portal and invoices carry your agency's name, colour and TRN."],
              ["How do families send documents?", "They open a private link from your WhatsApp message and upload straight from their phone camera. Everything lands in the right person's file."],
              ["What about children and dependent spouses?", "Each traveler's checklist follows their age, sponsor and relationship: birth certificates, attested marriage certificates, sponsor documents and parental consent are all handled."],
              ["Where is customer data stored?", "Files are stored encrypted in a UAE cloud region and every view and download is logged. Document images are sent to the AI provider only so they can be read; agencies should tell customers this in their privacy notice."],
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
