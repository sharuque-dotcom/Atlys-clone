export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0f7a69" />
        <path d="M7 20c3.5-6 8-9 18-9-4 2-6.5 4.5-8 9" stroke="#f4ecdc" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="22" cy="21" r="2.4" fill="#c9a465" />
      </svg>
      <span>Safar<span className="font-normal text-slate-500"> Enterprise</span></span>
    </span>
  );
}
