# Recon: enterprise.atlys.com (October 2026)

How we got here: [REA](https://github.com/morluto/rea) `inspect-web-page` + `analyze-web-bundle` against a headless
Chromium (CDP) session, plus manual inspection of the 35 first-party JS chunks and RSC payloads.
Only public, unauthenticated surfaces were observed. No Atlys code or assets were copied.

## Stack observed
- Next.js App Router, assets under `/b2e-assets/_next`, Tailwind, Cloudflare Zaraz, GTM.
- Auth: Firebase (project `vdcapp-54939`, custom tokens). Google sign-in and email/password via
  `POST /api/polaris/v1/enterprises/auth/{google,email-password,create-account,verify-account}`.
- Backend services in the client config: `polaris` (enterprise), `v0id`, `payment`.

## Enterprise API surface (from bundles)
| Endpoint | Purpose |
|---|---|
| `POST /enterprises/self-onboarding` | Register a company: `enterpriseInfo{taxId(GST/VAT)…}`, `billingType: B2E` |
| `GET /lookup?name=` | "Did you mean one of these?" company dedupe |
| `POST /verify-company-code` `{enterpriseId, code}` | Join with a shareable company code |
| `POST /access-requests`, `GET /access-requests/me`, `GET /access-requests?status=`, `POST /access-requests/:id/:decision` | Join requests that an admin approves or denies (PENDING/APPROVED/DENIED) |
| `POST /personal-onboarding` | Personal-email users |
| `POST /company-documents/upload` | Company KYC (e.g. GST certificate) |
| `GET /enterprises/branches` | Addresses: BILLING / SHIPPING / BRANCH_OFFICE |
| `POST /enterprises/travelers/search` `{filters, offset, limit}` | Traveler directory |
| `GET /enterprises/travelers/:id`, `GET/POST …/:id/documents[/upload]?key=` | Per-traveler document vault |

## Product features (marketing + B2C flows)
Application steps: Travelers → Dates → Profile → Documents → Sponsor → Appointment → Pickup → Delivery → Pay.
Bundles: Standard, +Comfort, +Cover (AtlysProtect denial refund), expedited processing, 24/7 concierge.
Also: AI form auto-fill, a reusable document repository, a "real-time risk report", instant itineraries,
cover letters and NOCs, HRMS integration (Darwinbox, Keka, Zoho…), group/bulk visas, GST input credit.

## Gaps for a UAE operator (what Safar addresses)
- India-centric: GST, Indian HRMS vendors, INR. UAE needs VAT/TRN, AED, trade licence, and emirates.
- Eligibility is keyed on destination only. UAE workforces span 40+ passports *and* need UAE-residence-validity rules.
- No approval workflow, policy, or cost centres in the enterprise surface.
- English only, with no WhatsApp channel. Data is hosted outside the UAE.
