import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EMIRATES } from "@/lib/countries";
import { emailDomain, isCorporateEmail } from "@/lib/validators";
import { registerEnterprise, requestAccess, signOut } from "../actions";

type SP = Promise<Record<string, string | undefined>>;

export default async function Onboarding({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/get-started");
  const step = sp.step ?? "start";

  if (step === "code" && user.enterprise) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-brand-700">Agency code generated</div>
          <div className="mt-4 select-all rounded-xl bg-slate-900 py-5 font-mono text-3xl tracking-[0.3em] text-white">{user.enterprise.companyCode}</div>
          <p className="mt-4 text-sm text-slate-600">Share this code with your staff. They&apos;ll use it to join <b>{user.enterprise.name}</b> on Safar.</p>
          <p className="mt-1 text-xs text-slate-500">You can find it again any time under Agency &amp; team.</p>
          <Link href="/app/pricing" className="btn-primary mt-6 w-full py-2.5">Next: set your prices</Link>
        </div>
      </Shell>
    );
  }
  if (user.enterpriseId) redirect("/app");

  const pending = await db.accessRequest.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { enterprise: true } });
  if (step === "pending" || pending) {
    if (pending?.status === "PENDING") {
      return (
        <Shell>
          <h1 className="text-center text-xl font-semibold">Request sent to admin</h1>
          <p className="mt-2 text-center text-sm text-slate-600">An admin at <b>{pending.enterprise.name}</b> will review it and let you in. We&apos;ll notify you by email and WhatsApp.</p>
          <form action={signOut} className="mt-6"><button className="btn-secondary w-full">Sign out</button></form>
        </Shell>
      );
    }
    if (pending?.status === "DENIED" && step !== "register") {
      return (
        <Shell>
          <h1 className="text-center text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-center text-sm text-slate-600">Your admin didn&apos;t approve this request. If you think that&apos;s a mistake, you can send it again or join with a company code.</p>
          <form action={requestAccess} className="mt-6"><input type="hidden" name="enterpriseId" value={pending.enterpriseId} /><button className="btn-primary w-full">Re-send request</button></form>
        </Shell>
      );
    }
  }

  const domain = isCorporateEmail(user.email) ? emailDomain(user.email) : null;
  const match = domain ? await db.enterprise.findUnique({ where: { domain } }) : null;

  if (step === "register") {
    return (
      <Shell wide>
        <div className="text-xs font-medium text-slate-500">Step 2 of 2</div>
        <h1 className="mt-1 text-xl font-semibold">Register your travel agency</h1>
        {sp.error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{sp.error}</div>}
        <form action={registerEnterprise} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Agency name (shown to customers)</label><input name="name" required className="input" placeholder="Oasis Travel & Tours" /></div>
          <div className="sm:col-span-2"><label className="label">Legal name (as on trade licence)</label><input name="legalName" required className="input" placeholder="Oasis Travel & Tourism L.L.C" /></div>
          <div><label className="label">Trade licence no.</label><input name="tradeLicenseNo" required className="input" /></div>
          <div><label className="label">Licensing authority</label>
            <select name="licenseAuthority" className="input">
              {["DED Dubai", "ADDED Abu Dhabi", "SEDD Sharjah", "DMCC", "JAFZA", "DIFC", "ADGM", "Dubai South", "RAKEZ", "SAIF Zone", "Other free zone"].map((a) => <option key={a}>{a}</option>)}
            </select></div>
          <div><label className="label">Emirate</label>
            <select name="emirate" className="input" defaultValue="DXB">{EMIRATES.map((e) => <option key={e.code} value={e.code}>{e.en}</option>)}</select></div>
          <div><label className="label">Tourism / travel agency licence no.</label><input name="tourismLicenseNo" className="input" /></div>
          <div><label className="label">Invoice type</label>
            <select name="invoiceType" className="input"><option value="VAT">VAT tax invoice (VAT-registered)</option><option value="NON_VAT">Non-VAT invoice</option></select></div>
          <div><label className="label">TRN (15 digits)</label><input name="trn" className="input" inputMode="numeric" placeholder="100XXXXXXXXXXXX" /></div>
          <div className="sm:col-span-2"><label className="label">Office address</label><input name="address" required className="input" placeholder="Shop 12, Al Karama, Dubai" /></div>
          <div><label className="label">Customer WhatsApp / phone</label><input name="agencyPhone" required className="input" placeholder="04 123 4567 or 050 123 4567" /></div>
          <div><label className="label">Your mobile (for WhatsApp updates)</label><input name="phone" className="input" placeholder="050 123 4567" /></div>
          <div className="flex gap-2 sm:col-span-2"><Link href="/get-started/onboarding" className="btn-secondary">Back</Link><button className="btn-primary flex-1">Register company</button></div>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-xs font-medium text-slate-500">Step 1 of 2</div>
      <h1 className="mt-1 text-xl font-semibold">What&apos;s your organization called?</h1>
      <p className="mt-1 text-sm text-slate-600">We&apos;ll check whether your agency is already on Safar.</p>
      {sp.error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{sp.error}</div>}
      {match && (
        <div className="mt-5 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="text-sm font-medium">Did you mean {match.name}?</div>
          <p className="mt-1 text-xs text-slate-600">Colleagues at @{domain} already use Safar. Join your agency instead of creating a duplicate.</p>
          <form action={requestAccess} className="mt-3 flex gap-2">
            <input type="hidden" name="enterpriseId" value={match.id} />
            <input name="designation" className="input" placeholder="Your designation" />
            <button className="btn-primary shrink-0">Request access</button>
          </form>
        </div>
      )}
      <form action={requestAccess} className="mt-5">
        <label className="label">Have an agency code from your manager?</label>
        <div className="flex gap-2"><input name="code" className="input font-mono uppercase tracking-widest" placeholder="ABCD2345" maxLength={8} /><button className="btn-secondary shrink-0">Join</button></div>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
      <Link href="/get-started/onboarding?step=register" className="btn-primary w-full py-2.5">Register a new agency</Link>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sand-50 px-4 py-10">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className={`card w-full p-7 ${wide ? "max-w-2xl" : "max-w-md"}`}>{children}</div>
    </div>
  );
}
