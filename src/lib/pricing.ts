// Pricing in AED with UAE VAT treatment.
//
// Two price layers per application:
//   net  — what Safar charges the agency (wholesale service fee, volume-discounted by plan)
//   sell — what the agency charges its retail customer (its own fee per product, or net × (1 + markup))
// In both layers service fees, bundles and courier are standard-rated (5% VAT) and government/embassy fees
// are passed through at cost as disbursements, outside the scope of VAT.

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

/** Wholesale volume discount on Safar's service fee, by agency plan. */
export function volumeDiscount(plan: string) {
  return plan === "ENTERPRISE" ? 0.2 : plan === "GROWTH" ? 0.1 : 0;
}

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

/** Safar's wholesale price to the agency. */
export function price(product: VisaProduct, bundle: Bundle, courier: Courier, plan = "STARTER", age?: number | null): PriceBreakdown {
  return breakdown(
    aedToFils(governmentFeeAed(product, age)),
    Math.round(aedToFils(product.serviceFeeAed) * (1 - volumeDiscount(plan))),
    aedToFils(BUNDLES[bundle].feeAed),
    product.passportSubmission ? aedToFils(COURIER_FEES_AED[courier]) : 0,
    true,
  );
}

export type AgencyPricing = {
  plan: string;
  markupPct: number;
  /** productId → agency's retail service fee in fils */
  overrides: Record<string, number>;
  vatRegistered: boolean;
};

export type Quote = { net: PriceBreakdown; sell: PriceBreakdown; marginFils: number };

/** Retail price for the customer plus the agency's margin over Safar's net price. */
export function quote(product: VisaProduct, bundle: Bundle, courier: Courier, agency: AgencyPricing, age?: number | null): Quote {
  const net = price(product, bundle, courier, agency.plan, age);
  const override = agency.overrides[product.id];
  const sellService = override ?? Math.round(net.serviceFils * (1 + agency.markupPct / 100));
  // Bundles and courier are resold at the same markup.
  const up = (fils: number) => Math.round(fils * (1 + agency.markupPct / 100));
  const sell = breakdown(net.governmentFils, sellService, up(net.bundleFils), up(net.courierFils), agency.vatRegistered);
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
