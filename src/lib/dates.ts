export const DAY = 24 * 60 * 60 * 1000;

export function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / DAY);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}

/** Adds UAE working days (Mon–Fri since the 2022 weekend change). */
export function addWorkingDays(d: Date, n: number) {
  const out = new Date(d);
  let left = n;
  while (left > 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    const wd = out.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return out;
}

export function fmtDate(d: Date | string | null | undefined, locale = "en") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(date);
}

export function fmtDateTime(d: Date | string | null | undefined, locale = "en") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }).format(date);
}

export function toInputDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}
