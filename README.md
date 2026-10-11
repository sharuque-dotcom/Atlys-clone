# Safar for Agencies

Visa software for **UAE travel agencies** that serve retail customers: individuals and families who walk in,
message on WhatsApp, or come back every summer. It's a rebuild of the Atlys feature set
([recon notes](docs/RECON.md)), re-shaped as SaaS.

```
Safar (software + AI review, platform fee per application)  →  Travel agency (processes the visa, own brand & price)  →  Family
```

## AI document review
Every upload (staff or customer portal) is read by Claude (`src/lib/review/ai.ts`), which **only transcribes**
the document into a strict schema (`extraction.ts`): names, numbers, dates, MRZ, the passport number a residence
visa is issued under, employer, salary, statement period and balance, stamps and attestation, photo background.
A **deterministic rules engine** (`rules.ts`, unit-tested) then judges it against the visa's requirements, the
trip dates and the family's other documents. Every finding has a severity and a concrete fix, for example:

- passport expired, or valid < 90 days after return (Schengen) / 180 days (Saudi, US); MRZ check digits failed;
  MRZ disagrees with the printed data; a different passport number than the profile (new passport?);
- **UAE residence visa still on the old passport** → transfer via ICP/GDRFA or submit both passports;
- Emirates ID number invalid (Luhn) or expiring during the trip; name on a document doesn't match the passport
  (transliteration-tolerant: MOHAMED ≈ MOHAMMED);
- photo background not white, glasses; NOC older than 30 days, unstamped, or leave dates not covering the trip;
  NOC vs salary certificate salary mismatch; visa sponsor ≠ employer on the NOC;
- bank statement < 6 months, older than 30 days, wrong account holder, balance too low for the family and trip
  length; Schengen insurance < €30,000 or not covering every day;
- sponsoring parent not named on a child's birth certificate; marriage certificate not attested (a common Schengen
  refusal reason); wrong document uploaded in the slot; unreadable scans; password-protected PDFs.

Results show on the application, the booking (per traveler) and in the customer portal (so families replace bad
copies themselves). Agents can re-check, replace, or **accept with a reason**, which is written to the audit log.
The AI never decides on its own: rules are explicit and the agent has the final say.

## Print pack
`Download print pack` (per applicant) or `Download family pack` (per booking) builds **one PDF** per applicant in
submission order:
1. cover sheet: READY / NOT READY with the blocking issues, and the checklist;
2. **pre-filled form data sheet** (Schengen harmonised form / GOV.UK / DS-160 / generic) built from the profile
   and the AI-extracted document data, with unknown fields left blank to ask;
3. generated letters (cover letter, itinerary, family sponsorship, parental consent, plus NOC and salary-certificate
   drafts when the employer's signed copy isn't uploaded yet), rendered by headless Chromium so the Arabic prints
   correctly;
4. every uploaded document, merged (PDFs) or placed on A4 (JPG/PNG).

## How an agency uses it
1. **Customer walks in.** Create the customer (WhatsApp number), then add the family members who are travelling:
   spouse, children (date of birth), parents. Each person records relationship, occupation status (employed,
   business owner, dependent, student, retired) and who sponsors them.
2. **Quote in two minutes.** Pick the household, destination and dates. Each person gets their own result from
   their passport, UAE residence, age and sponsor:
   - visa-free / on arrival / which visa, with a per-person document checklist (a dependent spouse uses the
     sponsor's documents plus an attested marriage certificate; a child needs a birth certificate, and parental
     consent if one parent stays home);
   - a **refusal-risk check**: passport and residence validity, sponsor income vs family size, timeline vs
     appointment backlog, previous refusals;
   - **child embassy fees** applied automatically (Schengen: under 6 free, 6–11 half).
3. **Price & margin.** Retail price = the agency's own fee per visa (or the suggested market fee ± adjustment), plus
   Express handling and courier, plus 5% VAT on service only. Embassy fees pass through at cost. Margin = service
   income minus Safar's platform fee (AED 39 / 29 / 19 per application by plan). "Customer view" hides it.
4. **Send on WhatsApp.** One tap opens WhatsApp with the breakdown and a private **customer portal** link.
5. **Customer portal** (`/c/<token>`, no login): the family sees each person's checklist, uploads documents from
   the phone camera and follows progress, all in the agency's name and colour. Uploads land in the right
   person's vault, refresh the risk score, and appear in the agent's timeline. Links can be revoked.
6. **Payment confirms the booking.** Record cash / card / transfer / payment-link deposits. The first payment
   confirms the booking and starts processing. Balances due show on the dashboard.
7. **Letters prepared for you:** cover letter (written from the sponsor's voice for dependents), itinerary,
   family sponsorship letter, parental consent (bilingual), and NOC / salary-certificate drafts for the
   customer's employer to print on letterhead.
8. **Invoices:** a quotation, then a tax invoice and receipt from the **agency** to the customer (agency TRN
   and branding). Separately, a periodic **Safar statement** of platform fees to the agency.
9. **Dashboard:** sales, margin, balances due, documents to chase, open quotes to follow up, and **renewal
   leads** (customer passports about to expire).

Also: agency staff roles (Owner, Branch manager, Visa agent, Accountant), company-code staff onboarding and
access requests, per-visa pricing table, visa checker by passport, age and occupation, customer CSV export,
REST API with hashed keys and HMAC-signed webhooks, audit log of every view/download/export, English/Arabic
with RTL.

## Run it
```bash
npm install
cp .env.example .env
npm run setup        # creates the SQLite DB and seeds the demo agency
npm run dev          # http://localhost:3000 → "Explore the demo workspace"
npm test             # unit tests: document review rules, eligibility, family rules, child fees, risk, pricing/VAT, MRZ, Emirates ID, TRN
```
Set `ANTHROPIC_API_KEY` to enable AI review of new uploads. The demo data ships with recorded document readings
(marked `seed (recorded demo reading)`) so the review is visible without a key. Specimen files are clearly
watermarked. Demo agency **Oasis Travel & Tours** (password `Safar-Demo-2026!`): `huda@oasistravel.ae` (owner),
`ravi@…` (agent), `grace@…` (accountant), `sameer@…` (branch manager). Seeded households include an Indian
family of four going to France, a Filipino mother and son (open UK quote), an Emirati couple on UK ETAs, a
Pakistani Umrah traveler, and an Egyptian couple where the wife's visa was refused. Open booking **BK-PARIS7**:
the mother's residence visa is on her old passport, the son's photo has a coloured background, the father's NOC
is 41 days old and the bank balance is thin for a family of four.

## Production notes
- Switch `prisma/schema.prisma` to PostgreSQL in a UAE region and `src/lib/storage.ts` to an encrypted
  UAE-region bucket.
- The visa catalog (`src/lib/catalog.ts`) is **indicative seed data**: fees, centres, child rates and
  timelines must be verified and maintained by an ops team.
- **Personal data & AI:** document images are sent to the Anthropic API for reading. Review this against the UAE
  PDPL (cross-border transfer, customer notice/consent) and your Anthropic commercial terms before launch.
  The review model is configurable (`SAFAR_AI_MODEL`); requests use a refusal fallback (`fallbacks: "default"`).
- The print pack needs Chromium on the server for letters (`CHROMIUM_PATH`); without it the pack still contains
  the cover sheet, data sheet and uploaded documents.
- Not wired to real providers yet: WhatsApp Business API sending (quotes use `wa.me` links; automated
  messages are logged), payment-link gateway, courier booking, embassy/VFS integrations (agents update status).
- The customer portal is authorised by an unguessable link (≈192-bit token, revocable). Consider adding
  OTP-to-WhatsApp verification and upload rate limiting before launch.
