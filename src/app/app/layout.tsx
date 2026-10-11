import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { t, type DictKey } from "@/lib/i18n";
import { can, ROLE_LABELS, type Permission, type Role } from "@/lib/types";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { LocaleToggle } from "@/components/LocaleToggle";
import { signOut } from "@/app/get-started/actions";
import { NavLink } from "@/components/NavLink";

const NAV: { href: string; key: DictKey; perm?: Permission; icon: string }[] = [
  { href: "/app", key: "nav.dashboard", icon: "◧" },
  { href: "/app/applications", key: "nav.applications", icon: "▤" },
  { href: "/app/applications/new", key: "nav.new", perm: "applications.create", icon: "＋" },
  { href: "/app/approvals", key: "nav.approvals", perm: "applications.approve", icon: "✓" },
  { href: "/app/travelers", key: "nav.travelers", perm: "travelers.manage", icon: "☺" },
  { href: "/app/trips", key: "nav.trips", perm: "travelers.manage", icon: "✈" },
  { href: "/app/checker", key: "nav.checker", icon: "?" },
  { href: "/app/concierge", key: "nav.concierge", icon: "✆" },
  { href: "/app/billing", key: "nav.billing", perm: "billing.view", icon: "د.إ" },
  { href: "/app/organization", key: "nav.organization", perm: "org.manage", icon: "⌂" },
  { href: "/app/integrations", key: "nav.integrations", perm: "integrations.manage", icon: "⇄" },
  { href: "/app/audit", key: "nav.audit", perm: "audit.view", icon: "≡" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMember();
  const locale = await getLocale();
  const pendingApprovals = can(user.role, "applications.approve")
    ? await db.application.count({ where: { enterpriseId: user.enterpriseId, status: "PENDING_APPROVAL" } })
    : 0;
  const pendingAccess = can(user.role, "org.manage")
    ? await db.accessRequest.count({ where: { enterpriseId: user.enterpriseId, status: "PENDING" } })
    : 0;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-slate-200 bg-white lg:flex">
        <div className="px-4 py-4"><Link href="/app"><Logo /></Link></div>
        <div className="mx-3 mb-3 rounded-lg bg-slate-50 px-3 py-2">
          <div className="truncate text-sm font-medium">{user.enterprise.name}</div>
          <div className="text-xs text-slate-500">{user.enterprise.plan.toLowerCase()} plan</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV.filter((n) => !n.perm || can(user.role, n.perm)).map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.href === "/app" || n.href === "/app/applications"}>
              <span className="w-5 text-center text-slate-400">{n.icon}</span>
              <span className="flex-1">{t(n.key, locale)}</span>
              {n.href === "/app/approvals" && pendingApprovals > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs text-white">{pendingApprovals}</span>}
              {n.href === "/app/organization" && pendingAccess > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs text-white">{pendingAccess}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role as Role]?.[locale] ?? user.role} · {user.email}</div>
          <div className="mt-2 flex items-center justify-between">
            <LocaleToggle locale={locale} />
            <form action={signOut}><button className="btn-ghost text-xs">{t("nav.signout", locale)}</button></form>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <Link href="/app"><Logo /></Link>
          <details className="relative">
            <summary className="btn-secondary list-none">Menu</summary>
            <div className="absolute end-0 z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {NAV.filter((n) => !n.perm || can(user.role, n.perm)).map((n) => (
                <Link key={n.href} href={n.href} className="block rounded px-3 py-2 text-sm hover:bg-slate-50">{t(n.key, locale)}</Link>
              ))}
              <form action={signOut}><button className="w-full rounded px-3 py-2 text-start text-sm hover:bg-slate-50">{t("nav.signout", locale)}</button></form>
            </div>
          </details>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
