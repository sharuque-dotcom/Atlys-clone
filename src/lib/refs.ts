import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

export function randomCode(len: number) {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const newApplicationRef = () => `SF-${randomCode(6)}`;
export const newCompanyCode = () => randomCode(8);
export const newBookingRef = () => `BK-${randomCode(6)}`;
/** Unguessable token for the customer self-service portal (≈192 bits). */
export const newPortalToken = () => randomBytes(24).toString("base64url");
