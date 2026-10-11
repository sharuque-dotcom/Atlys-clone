import "server-only";
import { cookies } from "next/headers";
import type { Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get("locale")?.value;
  return v === "ar" ? "ar" : "en";
}
