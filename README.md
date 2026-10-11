# Safar for Agencies

A visa platform for **UAE travel agencies** that serve retail customers: individuals and families who walk in,
message on WhatsApp, or come back every summer. It's a rebuild of the Atlys feature set
([recon notes](docs/RECON.md)), re-shaped as a B2B2C product.

```
Safar (back office, net rates)  →  Travel agency (your tenant: brand, price, customer)  →  Family / individual
```

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
3. **Price & margin.** Retail price = the agency's own fee per visa (or default markup on Safar's net rate), plus
   bundles and courier, plus 5% VAT on service only. Embassy fees pass through at cost. The agent sees margin;
   "Customer view" hides it when turning the screen. Family discounts come out of margin, never below cost.
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
   and branding). Separately, a periodic **Safar statement** to the agency at net rates.
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
npm test             # domain unit tests (eligibility, family rules, child fees, risk, pricing/VAT, MRZ, Emirates ID, TRN)
```
Demo agency **Oasis Travel & Tours** (password `Safar-Demo-2026!`): `huda@oasistravel.ae` (owner),
`ravi@…` (agent), `grace@…` (accountant), `sameer@…` (branch manager). Seeded households include an Indian
family of four going to France, a Filipino mother and son (open UK quote), an Emirati couple on UK ETAs, a
Pakistani Umrah traveler, and an Egyptian couple where the wife's visa was refused.

## Production notes
- Switch `prisma/schema.prisma` to PostgreSQL in a UAE region and `src/lib/storage.ts` to an encrypted
  UAE-region bucket.
- The visa catalog (`src/lib/catalog.ts`) is **indicative seed data**: fees, centres, child rates and
  timelines must be verified and maintained by an ops team.
- Not wired to real providers yet: WhatsApp Business API sending (quotes use `wa.me` links; automated
  messages are logged), payment-link gateway, OCR (passport MRZ is pasted by staff), courier booking,
  embassy/VFS integrations. The back-office console on each application simulates Safar ops status changes.
- The customer portal is authorised by an unguessable link (≈192-bit token, revocable). Consider adding
  OTP-to-WhatsApp verification and upload rate limiting before launch.
