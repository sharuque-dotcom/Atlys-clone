import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { fmtDateTime } from "@/lib/dates";
import { PageHeader, Section } from "@/components/ui";

async function send(formData: FormData) {
  "use server";
  const user = await requireMember();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await db.message.create({ data: { enterpriseId: user.enterpriseId, authorName: user.name, body: body.slice(0, 4000) } });
  await db.message.create({ data: { enterpriseId: user.enterpriseId, authorName: "Safar Concierge", fromAgent: true, body: "Got it — a visa specialist is on this and will reply here and on WhatsApp within 2 minutes." } });
  revalidatePath("/app/concierge");
}

export default async function Concierge() {
  const user = await requireMember();
  const locale = await getLocale();
  const messages = await db.message.findMany({ where: { enterpriseId: user.enterpriseId }, include: { application: true }, orderBy: { createdAt: "asc" }, take: 200 });
  return (
    <div>
      <PageHeader title="Concierge" subtitle="24/7 visa specialists in Dubai — English, Arabic, Hindi, Urdu, Tagalog." actions={process.env.SUPPORT_WHATSAPP ? <a href={`https://wa.me/${process.env.SUPPORT_WHATSAPP}`} className="btn-secondary">Open WhatsApp</a> : null} />
      <Section title="Company thread">
        <div className="space-y-3 p-4">
          {messages.length === 0 && <p className="text-sm text-slate-500">Ask about any destination, an urgent appointment, a refusal — anything.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.fromAgent ? "bg-slate-100" : "ms-auto bg-brand-600 text-white"}`}>
              <div className={`text-xs ${m.fromAgent ? "text-slate-500" : "text-brand-100"}`}>{m.authorName} · {fmtDateTime(m.createdAt, locale)}{m.application && <> · <Link href={`/app/applications/${m.application.id}`} className="underline">{m.application.ref}</Link></>}</div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
          <form action={send} className="flex gap-2 pt-2"><input name="body" required placeholder="Message our specialists…" className="input" /><button className="btn-primary">Send</button></form>
        </div>
      </Section>
    </div>
  );
}
