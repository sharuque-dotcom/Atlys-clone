# Safar Enterprise

A UAE-first enterprise visa and travel-document platform: a full rebuild of the Atlys Enterprise
feature set ([recon notes](docs/RECON.md)), redesigned for companies operating from the UAE.

## What it does
- **Onboarding:** sign-up that distinguishes work vs personal email, company dedupe by domain ("Did you mean…?"), company
  registration (trade licence, licensing authority, emirate, VAT TRN), shareable company code, and join requests that
  admins approve.
- **Eligibility engine:** passport × UAE residence × destination × purpose → visa-free / on-arrival / product choices,
  with per-traveler document checklists (Emirates ID, residence visa, NOC, salary certificate, trade licence for owners…).
  Covers 23 destinations (8 Schengen states, UK, US, CA, JP, SG, SA, TR, EG, GE, AZ, TH, CN, IN, AU).
- **Refusal-risk report:** passport and residence validity margins, UAE working-day timelines, salary thresholds, tenure,
  prior refusals and travel history. Each factor comes with a fix and a "latest safe submission" date.
- **Application wizard:** single or group (one trip, many passports), bundles (Standard / Priority / Protect), insured
  passport pickup, cost centres, and a live price with VAT.
- **Policy & approvals:** auto-approve threshold, blocked destinations, bundle restrictions, approver queue, RBAC
  (Owner, Admin, Travel manager, Approver, Finance, Employee) with row-level scoping for employees.
- **Document vault:** uploads reused across trips, ICAO 9303 MRZ parsing with check digits (auto-fills the profile),
  Emirates ID Luhn validation, and an expiry radar on the dashboard.
- **Generated documents:** bilingual EN/AR employer NOC, salary certificate, cover letter and itinerary. All printable.
- **Billing:** consolidated FTA-style **tax invoices** in AED: 5% VAT on service fees only, government fees as
  disbursements, both TRNs, cost-centre budgets, YTD reclaimable input VAT.
- **Ops & comms:** status pipeline with a timeline, ops console, per-application specialist chat, WhatsApp Cloud API
  notifications (logged in dev).
- **Integrations:** REST API with hashed, scoped keys (`/api/v1/applications`, `/travelers` upsert for HRMS sync,
  `/eligibility`), HMAC-signed webhooks, and CSV import/export (formula-injection safe).
- **Compliance:** an audit log of every create, view, download and export (PDPL accountability), security headers, and
  scrypt passwords with a 12-character policy.
- **English / Arabic** with full RTL layout.

## Run it
```bash
npm install
cp .env.example .env
npm run setup        # creates the SQLite DB and seeds the demo company
npm run dev          # http://localhost:3000 → "Explore the demo workspace"
npm test             # domain unit tests (MRZ, Emirates ID, TRN, eligibility, risk, VAT, dates)
```
Demo users (password `Safar-Demo-2026!`): `layla@falconlogistics.ae` (owner), `arjun@…` (approver),
`fatima@…` (finance), `maria@…` (employee).

## Production notes
- Switch `prisma/schema.prisma` to PostgreSQL in a UAE region (AWS me-central-1 / Azure UAE North), and replace
  `src/lib/storage.ts` with an encrypted UAE-region bucket.
- The visa catalog (`src/lib/catalog.ts`) is **indicative seed data**. Fees, centres and timelines must be verified and
  maintained by an ops team.
- Not yet wired to real providers: UAE PASS / SSO login, HRMS connectors (cards only), card payments, OCR (the MRZ is
  pasted; plug in an OCR service), courier booking, and embassy/VFS integrations (the ops console simulates status changes).
- Marketing figures on the landing page are placeholders.
