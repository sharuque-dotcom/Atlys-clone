import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "@/lib/locale";
import { dirOf } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "Safar — the visa desk for UAE travel agencies", template: "%s · Safar" },
  description: "Quote families in minutes, collect documents through a branded portal, and let our Dubai back office process the visas. Your brand, your price.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
