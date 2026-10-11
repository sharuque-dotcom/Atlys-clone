import "server-only";
import { existsSync } from "node:fs";
import type { Browser } from "playwright-core";

// Letters are rendered by printing the app's own /print pages in headless Chromium, so the PDF
// is identical to what agents preview — including Arabic text and right-to-left layout.
const CANDIDATES = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].filter(Boolean) as string[];

export function chromiumPath() {
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

/** Opens one browser for the whole pack and returns a renderer, or null when Chromium isn't installed. */
export async function openLetterRenderer(origin: string, sessionCookie: { name: string; value: string } | null) {
  const exe = chromiumPath();
  if (!exe) return null;
  const { chromium } = await import("playwright-core");
  let browser: Browser;
  try {
    browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  } catch (e) {
    console.error("[pack] could not launch Chromium", e);
    return null;
  }
  const context = await browser.newContext();
  if (sessionCookie) await context.addCookies([{ ...sessionCookie, url: origin }]);
  // Letters must not depend on third-party resources (fonts fall back to system fonts).
  await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));

  async function render(applicationId: string, kind: string) {
    const page = await context.newPage();
    try {
      const res = await page.goto(`${origin}/print/${applicationId}/${kind}`, { waitUntil: "load", timeout: 20000 });
      if (!res || !res.ok()) return null;
      await page.emulateMedia({ media: "print" });
      return await page.pdf({ format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
    } catch (e) {
      console.error("[pack] letter render failed", kind, e);
      return null;
    } finally {
      await page.close();
    }
  }
  return { render, close: () => browser.close() };
}
