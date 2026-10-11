import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LocaleToggle } from "@/components/LocaleToggle";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { DESTINATIONS } from "@/lib/catalog";
import { country } from "@/lib/countries";

const FEATURES = [
  {
    title: "Quote a whole family in two minutes",
    ar: "عرض سعر لعائلة كاملة في دقيقتين",
    body: "Pick the household, the destination and the dates. Safar works out each person's visa from their passport and UAE residence — including Schengen child fees, sponsored spouses and kids travelling with one parent.",
  },
  {
    title: "Your price, your margin",
    ar: "سعرك وهامش ربحك",
    body: "Buy at Safar net rates, set your own fee per visa or a default markup, and see the margin on every quote. Discounts come out of your margin — never below cost.",
  },
  {
    title: "Send the quote on WhatsApp",
    ar: "أرسل العرض عبر واتساب",
    body: "One tap sends the price breakdown and a private link. The family sees exactly what each person needs and uploads documents from their phone — no more chasing photos on WhatsApp.",
  },
  {
    title: "Refusal-risk check before you submit",
    ar: "فحص مخاطر الرفض قبل التقديم",
    body: "Passport and residence validity, sponsor income against family size, appointment backlog in Dubai & Abu Dhabi, previous refusals — each with the fix, so fewer customers come back angry.",
  },
  {
    title: "Letters done for you",
    ar: "الخطابات جاهزة",
    body: "Cover letters, itineraries, family sponsorship letters, parental consent for minors, and NOC / salary-certificate drafts for the customer's employer — bilingual and print-ready.",
  },
  {
    title: "Our back office does the processing",
    ar: "مكتبنا الخلفي يتولى المعالجة",
    body: "Form filling, appointment hunting at VFS, TLScontact and BLS, passport pickup across all seven emirates, embassy follow-up. Your counter staff stay with customers.",
  },
  {
    title: "Payments, balances & VAT invoices",
    ar: "المدفوعات والأرصدة والفواتير الضريبية",
    body: "Record cash, card, transfer or payment-link deposits. Customer tax invoices carry your TRN and branding; embassy fees are shown as disbursements. One monthly statement from Safar.",
  },
  {
    title: "Renewal leads on autopilot",
    ar: "فرص التجديد تلقائيًا",
    body: "Every passport and residence visa you've seen is tracked. When a customer's passport is about to expire, it shows up as a lead — before they walk into the agency next door.",
  },
  {
    title: "Arabic, English, and your brand",
    ar: "العربية والإنجليزية وعلامتك التجارية",
    body: "Bilingual app with right-to-left layout. Customers see your agency's name and colour on the portal, quotes and invoices — not ours.",
  },
];

const COMPARE = [
  ["Families with mixed ages & sponsorship", "One form per person", "One booking, per-person rules"],
  ["Child embassy fees (e.g. Schengen <6 free)", "Manual", "Automatic"],
  ["Customer document collection", "WhatsApp photos", "Branded upload portal"],
  ["Agency margin visibility", "Spreadsheet", "Per quote, per month"],
  ["UAE residence & Emirates ID checks", "—", "Automatic"],
  ["Invoicing", "Generic", "UAE VAT, your TRN, disbursements"],
  ["Language", "English", "English + Arabic (RTL)"],
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
            <a href="#pricing" className="btn-ghost hidden sm:inline-flex">Net rates</a>
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
              <div className="text-sm font-semibold">Mehta family · Paris · 12–22 Dec</div>
              <span className="text-xs text-slate-500">Quote BK-PARIS7</span>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {[
                ["Rohan · father", "IN", "Schengen C · AED 947.75", "green"],
                ["Priya · mother (sponsored)", "IN", "Schengen C · AED 947.75", "green"],
                ["Aarav · 9 yrs", "IN", "Child embassy fee · AED 762.75", "green"],
                ["Anaya · 4 yrs", "IN", "No embassy fee · AED 582.75", "green"],
                ["Grandmother", "IN", "Passport < 3 months — renew first", "red"],
              ].map(([n, c, s, tone]) => (
                <li key={n} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2"><span className="text-lg">{country(c).flag}</span>{n}</span>
                  <span className={`text-xs ${tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-rose-700"}`}>{s}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-brand-50 p-3 text-xs text-brand-900">
              Family discount AED 100 · total AED 3,136 · your margin AED 383.60. Sent on WhatsApp with the upload link.
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
        <h2 className="text-3xl font-semibold tracking-tight">Net rates that get better as you grow</h2>
        <p className="mt-2 text-slate-600">No setup fee, no minimum volume. You pay Safar a net service fee per visa and keep whatever you charge on top. Embassy fees pass through at cost.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Starter", "List net rates", ["Unlimited staff & customers", "Branded customer portal", "Weekly statement"]],
            ["Growth", "10% off net rates", ["From 30 visas / month", "Monthly statement, 30-day terms", "Priority back-office queue"]],
            ["Network", "20% off net rates", ["Multi-branch agencies", "API, webhooks & website widget", "Dedicated account manager"]],
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
              ["Who actually processes the visa?", "Safar's back office in Dubai: forms, appointments, biometrics coordination, passport courier and embassy follow-up. You own the customer, set the price and get paid."],
              ["Can my customers see Safar's name?", "No. Quotes, the customer portal and invoices carry your agency's name, colour and TRN."],
              ["How do families send documents?", "They open a private link from your WhatsApp message and upload straight from their phone camera. Everything lands in the right person's file."],
              ["What about children and dependent spouses?", "Each traveler's checklist follows their age, sponsor and relationship: birth certificates, attested marriage certificates, sponsor documents and parental consent are all handled."],
              ["Where is customer data stored?", "In a UAE cloud region, encrypted at rest. Every view and download is logged for PDPL accountability."],
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
