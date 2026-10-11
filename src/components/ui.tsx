import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_META, type AppStatus } from "@/lib/types";

const TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function StatusBadge({ status, locale = "en" }: { status: string; locale?: string }) {
  const meta = STATUS_META[status as AppStatus] ?? { en: status, ar: status, tone: "gray" as const };
  return <Badge tone={meta.tone}>{locale === "ar" ? meta.ar : meta.en}</Badge>;
}

export function RiskBadge({ level }: { level: string | null | undefined }) {
  if (!level) return <Badge>—</Badge>;
  const tone: Tone = level === "LOW" ? "green" : level === "MEDIUM" ? "amber" : "red";
  return <Badge tone={tone}>{level === "BLOCKED" ? "Blocked" : `${level[0]}${level.slice(1).toLowerCase()} risk`}</Badge>;
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Section({ title, actions, children, className = "" }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {actions}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Flash({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ok = typeof searchParams.ok === "string" ? searchParams.ok : null;
  const err = typeof searchParams.error === "string" ? searchParams.error : null;
  if (!ok && !err) return null;
  return (
    <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${err ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>
      {err ?? ok}
    </div>
  );
}
