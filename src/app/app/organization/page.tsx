import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { EMIRATES, emirateName } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/types";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { addBranch, approveAccess, changeRole, denyAccess, removeMember, rotateCode, saveAgencyProfile } from "./actions";

export default async function Organization({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireMember("org.manage");
  const locale = await getLocale();
  const e = user.enterprise;
  const [members, requests, branches] = await Promise.all([
    db.user.findMany({ where: { enterpriseId: e.id }, orderBy: { createdAt: "asc" } }),
    db.accessRequest.findMany({ where: { enterpriseId: e.id, status: "PENDING" }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.branch.findMany({ where: { enterpriseId: e.id } }),
  ]);

  return (
    <div>
      <PageHeader title="Agency & team" subtitle={`${e.legalName} · ${e.licenseAuthority ?? ""} licence ${e.tradeLicenseNo ?? "—"} · ${emirateName(e.emirate, locale)}`} />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {requests.length > 0 && (
            <Section title={<span className="flex items-center gap-2">Access requests <Badge tone="amber">{requests.length}</Badge></span>}>
              <ul className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex-1"><div className="text-sm font-medium">{r.fullName}</div><div className="text-xs text-slate-500">{r.user.email}{r.designation ? ` · ${r.designation}` : ""} · {fmtDate(r.createdAt, locale)}</div></div>
                    <form action={approveAccess} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <select name="role" className="input w-40 py-1.5">{ROLES.filter((x) => x !== "OWNER").map((x) => <option key={x} value={x}>{ROLE_LABELS[x].en}</option>)}</select>
                      <button className="btn-primary">Approve</button>
                      <button formAction={denyAccess} className="btn-secondary">Deny</button>
                    </form>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`Staff · ${members.length}`}>
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex-1"><div className="text-sm font-medium">{m.name}{m.id === user.id && <span className="text-slate-400"> (you)</span>}</div><div className="text-xs text-slate-500">{m.email}</div></div>
                  {m.id === user.id || m.role === "OWNER" ? <Badge tone="violet">{ROLE_LABELS[m.role as Role].en}</Badge> : (
                    <>
                      <form action={changeRole} className="flex gap-2">
                        <input type="hidden" name="id" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input w-40 py-1.5">{ROLES.map((x) => <option key={x} value={x}>{ROLE_LABELS[x].en}</option>)}</select>
                        <button className="btn-secondary">Save</button>
                      </form>
                      <form action={removeMember}><input type="hidden" name="id" value={m.id} /><button className="btn-ghost text-rose-700">Remove</button></form>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Agency profile & branding">
            <form action={saveAgencyProfile} className="grid gap-4 p-4 sm:grid-cols-2">
              <label className="block"><span className="label">Trading name (shown to customers)</span><input name="name" defaultValue={e.name} className="input" /></label>
              <label className="block"><span className="label">Legal name (trade licence)</span><input name="legalName" defaultValue={e.legalName} className="input" /></label>
              <label className="block"><span className="label">Tourism / travel agency licence no.</span><input name="tourismLicenseNo" defaultValue={e.tourismLicenseNo ?? ""} className="input" /></label>
              <label className="block"><span className="label">Customer WhatsApp / phone</span><input name="phone" defaultValue={e.phone ?? ""} className="input" /></label>
              <label className="block"><span className="label">Email</span><input name="email" type="email" defaultValue={e.email ?? ""} className="input" /></label>
              <label className="block"><span className="label">Brand colour (portal & invoices)</span><input name="brandColor" type="color" defaultValue={e.brandColor} className="input h-[38px] p-1" /></label>
              <label className="block"><span className="label">Invoice type</span><select name="invoiceType" defaultValue={e.invoiceType} className="input"><option value="VAT">VAT tax invoices</option><option value="NON_VAT">Not VAT-registered</option></select></label>
              <label className="block"><span className="label">TRN</span><input name="trn" defaultValue={e.trn ?? ""} className="input" /></label>
              <label className="block"><span className="label">Invoice number prefix</span><input name="invoicePrefix" defaultValue={e.invoicePrefix} className="input" maxLength={6} /></label>
              <div className="sm:col-span-2"><button className="btn-primary">Save profile</button></div>
            </form>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Company code">
            <div className="p-4">
              <div className="select-all rounded-lg bg-slate-900 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white">{e.companyCode}</div>
              <p className="mt-2 text-xs text-slate-500">New staff enter this after signing up to join your agency. Rotate it if it leaks.</p>
              <form action={rotateCode} className="mt-3"><button className="btn-secondary w-full">Rotate code</button></form>
            </div>
          </Section>
          <Section title="Company details">
            <dl className="space-y-2 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Plan</dt><dd>{e.plan.toLowerCase()}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Invoice</dt><dd>{e.invoiceType === "VAT" ? "VAT tax invoice" : "Non-VAT"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">TRN</dt><dd className="font-mono">{e.trn ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Email domain</dt><dd>{e.domain ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Data region</dt><dd>UAE</dd></div>
            </dl>
          </Section>
          <Section title="Offices & addresses">
            <ul className="divide-y divide-slate-100">
              {branches.map((b) => <li key={b.id} className="px-4 py-2.5 text-sm"><div className="font-medium">{b.name} <Badge>{b.type.replace("_", " ").toLowerCase()}</Badge></div><div className="text-xs text-slate-500">{b.address}, {emirateName(b.emirate, locale)}</div></li>)}
            </ul>
            <form action={addBranch} className="space-y-2 border-t border-slate-100 p-4">
              <input name="name" placeholder="Branch name" className="input" required />
              <input name="address" placeholder="Address" className="input" required />
              <div className="flex gap-2">
                <select name="emirate" className="input">{EMIRATES.map((x) => <option key={x.code} value={x.code}>{x.en}</option>)}</select>
                <select name="type" className="input"><option value="BRANCH_OFFICE">Branch</option><option value="SHIPPING">Courier address</option><option value="BILLING">Billing</option></select>
              </div>
              <button className="btn-secondary w-full">Add address</button>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
