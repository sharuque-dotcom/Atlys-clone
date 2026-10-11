import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { currentUser } from "@/lib/auth";
import { demoSignIn, signIn, signUp } from "./actions";

type SP = Promise<Record<string, string | undefined>>;

export default async function GetStarted({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (user) redirect(user.enterpriseId ? "/app" : "/get-started/onboarding");
  const mode = sp.mode === "signup" ? "signup" : "signin";
  const emailType = sp.email === "personal" ? "PERSONAL" : "CORPORATE";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sand-50 px-4 py-10">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className="card w-full max-w-md p-7">
        <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <Link href="/get-started" className={`rounded-md py-1.5 text-center ${mode === "signin" ? "bg-white shadow-sm" : "text-slate-500"}`}>Sign in</Link>
          <Link href="/get-started?mode=signup" className={`rounded-md py-1.5 text-center ${mode === "signup" ? "bg-white shadow-sm" : "text-slate-500"}`}>Sign up</Link>
        </div>

        {sp.error && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{sp.error}</div>}

        {mode === "signin" ? (
          <>
            <h1 className="text-center text-xl font-semibold">Sign in to Safar</h1>
            <form action={signIn} className="mt-6 space-y-4">
              <input type="hidden" name="next" value={sp.redirect ?? "/app"} />
              <div><label className="label" htmlFor="email">Work email</label><input id="email" name="email" type="email" required className="input" placeholder="name@youragency.ae" autoComplete="email" /></div>
              <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required className="input" autoComplete="current-password" /></div>
              <button className="btn-primary w-full py-2.5">Sign in</button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
            <div className="space-y-2">
              {process.env.UAEPASS_CLIENT_ID ? (
                <a href="/api/auth/uaepass" className="btn-secondary w-full py-2.5">Sign in with UAE PASS</a>
              ) : null}
              <form action={demoSignIn}>
                <button className="btn-secondary w-full py-2.5">Explore the demo workspace →</button>
              </form>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-center text-xl font-semibold">Create your account</h1>
            <p className="mt-1 text-center text-xs text-slate-500">Which email will you be using?</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Link href="/get-started?mode=signup" className={`rounded-lg border p-3 ${emailType === "CORPORATE" ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
                <div className="font-medium">Work email</div><div className="text-xs text-slate-500">name@yourcompany.ae</div>
              </Link>
              <Link href="/get-started?mode=signup&email=personal" className={`rounded-lg border p-3 ${emailType === "PERSONAL" ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
                <div className="font-medium">Personal email</div><div className="text-xs text-slate-500">Gmail, Outlook and the like</div>
              </Link>
            </div>
            <form action={signUp} className="mt-5 space-y-4">
              <input type="hidden" name="emailType" value={emailType} />
              <div><label className="label" htmlFor="name">Full name (as on passport)</label><input id="name" name="name" required className="input" autoComplete="name" /></div>
              <div><label className="label" htmlFor="su-email">{emailType === "CORPORATE" ? "Work email" : "Personal email"}</label><input id="su-email" name="email" type="email" required className="input" autoComplete="email" /></div>
              <div><label className="label" htmlFor="su-pw">Password</label><input id="su-pw" name="password" type="password" required minLength={12} className="input" autoComplete="new-password" />
                <p className="mt-1 text-xs text-slate-500">At least 12 chars incl. upper, lower, number &amp; special character.</p></div>
              <div><label className="label" htmlFor="su-c">Confirm password</label><input id="su-c" name="confirm" type="password" required className="input" autoComplete="new-password" /></div>
              <button className="btn-primary w-full py-2.5">Create account</button>
            </form>
          </>
        )}
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-slate-500">Data is stored in the UAE and processed under the UAE Personal Data Protection Law.</p>
    </div>
  );
}
