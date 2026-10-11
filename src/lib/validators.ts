// UAE-specific identifier validation.

/** Emirates ID: 784-YYYY-NNNNNNN-C where C is a Luhn check digit over all 15 digits. */
export function normalizeEmiratesId(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 15) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
}

export function luhnValid(digits: string) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function isValidEmiratesId(input: string) {
  const digits = input.replace(/\D/g, "");
  return digits.length === 15 && digits.startsWith("784") && luhnValid(digits);
}

/** UAE VAT Tax Registration Number — 15 digits, issued by the FTA starting with "100". */
export function isValidTrn(input: string) {
  return /^100\d{12}$/.test(input.replace(/\s|-/g, ""));
}

/** UAE mobile numbers: +971 5X XXX XXXX */
export function normalizeUaeMobile(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00971")) d = d.slice(2);
  if (d.startsWith("05")) d = "971" + d.slice(1);
  if (d.startsWith("5") && d.length === 9) d = "971" + d;
  return /^9715[024568]\d{7}$/.test(d) ? `+${d}` : null;
}

const FREE_MAIL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "yandex.com", "mail.ru"];

export function isCorporateEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && !FREE_MAIL.includes(domain);
}

export function emailDomain(email: string) {
  return email.split("@")[1]?.toLowerCase() ?? "";
}
