// Pricing in AED with UAE VAT treatment:
// - Safar service fees and bundle add-ons are standard-rated supplies → 5% VAT.
// - Government/embassy fees are paid on behalf of the client as disbursements → outside the scope of VAT
//   (FTA VAT Public Clarification on disbursements), shown separately on the tax invoice.

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

/** Volume discount on service fees by annual application volume tier. */
export function volumeDiscount(plan: string) {
  return plan === "ENTERPRISE" ? 0.2 : plan === "GROWTH" ? 0.1 : 0;
}

export function price(product: VisaProduct, bundle: Bundle, courier: Courier, plan = "STARTER"): PriceBreakdown {
  const governmentFils = aedToFils(product.govtFeeAed);
  const serviceFils = Math.round(aedToFils(product.serviceFeeAed) * (1 - volumeDiscount(plan)));
  const bundleFils = aedToFils(BUNDLES[bundle].feeAed);
  const courierFils = product.passportSubmission ? aedToFils(COURIER_FEES_AED[courier]) : 0;
  const taxableFils = serviceFils + bundleFils + courierFils;
  const vatFils = vatOn(taxableFils);
  return {
    governmentFils,
    serviceFils,
    bundleFils,
    courierFils,
    taxableFils,
    vatFils,
    totalFils: governmentFils + taxableFils + vatFils,
  };
}
