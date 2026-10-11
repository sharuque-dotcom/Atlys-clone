// Pricing in AED with UAE VAT treatment.
//
// Safar is software: the agency processes the visa and sets its own retail price. Two layers per application:
//   platform — Safar's per-application fee to the agency (by plan), billed on a periodic statement
//   sell     — what the agency charges its customer: its service fee (own price per visa, or the suggested
//              market price ± markup), optional express/VIP handling and courier, plus the embassy fee at cost.
// Service fees are standard-rated (5% VAT); embassy fees are disbursements outside the scope of VAT.

import type { VisaProduct } from "./catalog";
import { aedToFils, vatOn } from "./money";
import { BUNDLES, type Bundle } from "./types";

export type PriceBreakdown = {
  governmentFils: number;
  serviceFils: number;
  bundleFils: number;
  courierFils: number;
  taxableFils: number;
  vatFils: number;
  totalFils: number;
};

export const COURIER_FEES_AED = { NONE: 0, DROP_OFF: 0, PICKUP: 75 } as const;
export type Courier = keyof typeof COURIER_FEES_AED;

/** Safar's platform fee per application, by agency plan (AED, excl. VAT). */
export const PLATFORM_FEE_AED: Record<string, number> = { STARTER: 39, GROWTH: 29, ENTERPRISE: 19 };
export const platformFeeAed = (plan: string) => PLATFORM_FEE_AED[plan] ?? PLATFORM_FEE_AED.STARTER;

/** Embassy fee, with child reductions where the embassy offers them (e.g. Schengen: <6 free, 6–11 half). */
export function governmentFeeAed(product: VisaProduct, age?: number | null) {
  if (age != null && product.childGovtFeeAed) {
    if (age < 6) return product.childGovtFeeAed.under6;
    if (age < 12) return product.childGovtFeeAed.under12;
  }
  return product.govtFeeAed;
}

function breakdown(governmentFils: number, serviceFils: number, bundleFils: number, courierFils: number, chargeVat: boolean): PriceBreakdown {
  const taxableFils = serviceFils + bundleFils + courierFils;
  const vatFils = chargeVat ? vatOn(taxableFils) : 0;
  return { governmentFils, serviceFils, bundleFils, courierFils, taxableFils, vatFils, totalFils: governmentFils + taxableFils + vatFils };
}

/** What the agency pays Safar for one application. */
export function platformFee(plan: string): PriceBreakdown {
  return breakdown(0, aedToFils(platformFeeAed(plan)), 0, 0, true);
}

export type AgencyPricing = {
  plan: string;
  /** ± % applied to the suggested market service fee for visas without a fixed agency price */
  markupPct: number;
  /** productId → agency's retail service fee in fils */
  overrides: Record<string, number>;
  vatRegistered: boolean;
};

/** The agency's retail service fee for a product (before VAT). */
export function retailServiceFils(product: VisaProduct, agency: AgencyPricing) {
  return agency.overrides[product.id] ?? Math.round(aedToFils(product.serviceFeeAed) * (1 + agency.markupPct / 100));
}

export type Quote = { net: PriceBreakdown; sell: PriceBreakdown; marginFils: number };

/** Customer price and the agency's margin after Safar's platform fee. */
export function quote(product: VisaProduct, bundle: Bundle, courier: Courier, agency: AgencyPricing, age?: number | null): Quote {
  const up = (fils: number) => Math.round(fils * (1 + agency.markupPct / 100));
  const sell = breakdown(
    aedToFils(governmentFeeAed(product, age)),
    retailServiceFils(product, agency),
    up(aedToFils(BUNDLES[bundle].feeAed)),
    product.passportSubmission ? up(aedToFils(COURIER_FEES_AED[courier])) : 0,
    agency.vatRegistered,
  );
  const net = platformFee(agency.plan);
  return { net, sell, marginFils: sell.taxableFils - net.taxableFils };
}

/**
 * Totals for a booking. A family discount reduces the agency's taxable service value,
 * so VAT is charged on the discounted base (embassy fees are never discounted).
 */
export function bookingTotals(lines: PriceBreakdown[], discountFils: number, vatRegistered: boolean) {
  const grossTaxable = lines.reduce((s, l) => s + l.taxableFils, 0);
  const discount = Math.min(Math.max(0, discountFils), grossTaxable);
  const taxableFils = grossTaxable - discount;
  const vatFils = vatRegistered ? vatOn(taxableFils) : 0;
  const governmentFils = lines.reduce((s, l) => s + l.governmentFils, 0);
  return { discountFils: discount, taxableFils, vatFils, governmentFils, totalFils: taxableFils + vatFils + governmentFils };
}
