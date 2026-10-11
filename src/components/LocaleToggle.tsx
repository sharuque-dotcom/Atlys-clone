import { setLocale } from "@/app/actions";
import type { Locale } from "@/lib/i18n";

export function LocaleToggle({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <form action={setLocale} className={className}>
      <input type="hidden" name="locale" value={locale === "ar" ? "en" : "ar"} />
      <button className="btn-ghost text-xs" type="submit" aria-label="Switch language">
        {locale === "ar" ? "English" : "العربية"}
      </button>
    </form>
  );
}
