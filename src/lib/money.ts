// All money is stored as integer fils (1 AED = 100 fils) to avoid floating-point drift.

export const VAT_RATE = 0.05; // UAE standard VAT rate

export function aedToFils(aed: number) {
  return Math.round(aed * 100);
}

export function formatAed(fils: number, locale: string = "en") {
  const value = fils / 100;
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** VAT on a taxable amount, rounded half-up to the nearest fils. */
export function vatOn(taxableFils: number) {
  return Math.round(taxableFils * VAT_RATE);
}
