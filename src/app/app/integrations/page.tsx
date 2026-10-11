import { cookies } from "next/headers";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { fmtDate } from "@/lib/dates";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { addWebhook, createApiKey, deleteWebhook, revokeApiKey, testWebhooks } from "./actions";

const CONNECTORS = [
  { name: "WhatsApp Business API", desc: "Automatic status updates and document reminders from your own agency number." },
  { name: "Payment links (Telr / Network)", desc: "Send a card payment link with the quote; payments reconcile automatically." },
  { name: "Zoho Books / Tally", desc: "Push customer invoices, payments and VAT to your accounting." },
  { name: "Website enquiry form", desc: "Embed a visa checker on your site that creates customers and quotes here." },
  { name: "Meta lead ads", desc: "Instagram / Facebook visa enquiries land as customers with source tracking." },
  { name: "UAE PASS", desc: "Let staff sign in with the national digital identity." },
];
const EVENTS = ["booking.quoted", "application.status_changed", "ping"];

export default async function Integrations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember("integrations.manage");
  const locale = await getLocale();
  const newKey = (await cookies()).get("new_api_key")?.value;
  const [keys, hooks] = await Promise.all([
    db.apiKey.findMany({ where: { enterpriseId: user.enterpriseId }, orderBy: { createdAt: "desc" } }),
    db.webhook.findMany({ where: { enterpriseId: user.enterpriseId }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Integrations & API" subtitle="Connect WhatsApp, payments, accounting and your website." />
      <Flash searchParams={sp} />
      {newKey && <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4"><div className="text-sm font-medium text-emerald-900">Your new API key</div><code className="mt-1 block select-all break-all font-mono text-sm">{newKey}</code></div>}

      <Section title="Connectors" className="mb-6">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTORS.map((h) => (
            <div key={h.name} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between"><span className="font-medium">{h.name}</span><Badge>Not connected</Badge></div>
              <p className="mt-1 text-xs text-slate-500">{h.desc}</p>
              <a href={`mailto:integrations@safar.example?subject=${encodeURIComponent(`Connect ${h.name} for ${user.enterprise.name}`)}`} className="btn-secondary mt-3 w-full text-xs">Request connection</a>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="API keys">
          <ul className="divide-y divide-slate-100">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div><div className="font-medium">{k.name}</div><div className="font-mono text-xs text-slate-500">{k.prefix}… · created {fmtDate(k.createdAt, locale)}{k.lastUsedAt ? ` · last used ${fmtDate(k.lastUsedAt, locale)}` : ""}</div></div>
                {k.revokedAt ? <Badge tone="red">Revoked</Badge> : <form action={revokeApiKey}><input type="hidden" name="id" value={k.id} /><button className="btn-ghost text-xs text-rose-700">Revoke</button></form>}
              </li>
            ))}
          </ul>
          <form action={createApiKey} className="flex gap-2 border-t border-slate-100 p-4"><input name="name" placeholder="Key name, e.g. TMC integration" className="input" /><button className="btn-primary shrink-0">Create key</button></form>
          <div className="border-t border-slate-100 p-4 text-xs text-slate-600">
            <div className="font-medium">REST API</div>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">{`curl -H "Authorization: Bearer sk_live_…" \\
  ${process.env.APP_URL ?? "http://localhost:3000"}/api/v1/applications

GET  /api/v1/applications      list (filter ?status=)
GET  /api/v1/applications/:ref single application
GET  /api/v1/travelers         family members on file
GET  /api/v1/eligibility?nationality=IN&destination=FR&purpose=BUSINESS`}</pre>
          </div>
        </Section>

        <Section title="Webhooks" actions={hooks.length > 0 && <form action={testWebhooks}><button className="btn-ghost text-xs">Send test</button></form>}>
          <ul className="divide-y divide-slate-100">
            {hooks.map((h) => (
              <li key={h.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-xs">{h.url}</span><form action={deleteWebhook}><input type="hidden" name="id" value={h.id} /><button className="btn-ghost text-xs text-rose-700">Delete</button></form></div>
                <div className="text-xs text-slate-500">{h.events} · signing secret <code className="select-all">{h.secret}</code></div>
              </li>
            ))}
          </ul>
          <form action={addWebhook} className="space-y-2 border-t border-slate-100 p-4">
            <input name="url" placeholder="https://example.com/hooks/safar" className="input" required />
            <div className="flex flex-wrap gap-3 text-xs">{EVENTS.map((e) => <label key={e} className="flex items-center gap-1"><input type="checkbox" name="events" value={e} defaultChecked={e !== "ping"} /> {e}</label>)}</div>
            <button className="btn-secondary w-full">Add webhook</button>
            <p className="text-xs text-slate-500">Payloads are signed: <code>X-Safar-Signature: sha256=HMAC(secret, body)</code>.</p>
          </form>
        </Section>
      </div>
    </div>
  );
}
