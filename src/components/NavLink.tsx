"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-brand-50 font-medium text-brand-800" : "text-slate-600 hover:bg-slate-50"}`}
    >
      {children}
    </Link>
  );
}
