import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** At least 12 chars incl. upper, lower, number and special character. */
export function passwordPolicyErrors(pw: string) {
  const errs: string[] = [];
  if (pw.length < 12) errs.push("at least 12 characters");
  if (!/[a-z]/.test(pw)) errs.push("a lowercase letter");
  if (!/[A-Z]/.test(pw)) errs.push("an uppercase letter");
  if (!/\d/.test(pw)) errs.push("a number");
  if (!/[^A-Za-z0-9]/.test(pw)) errs.push("a special character");
  return errs;
}
