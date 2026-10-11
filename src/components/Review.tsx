import type { DocReview } from "@/lib/review";
import { Badge } from "./ui";

export function ReviewBadge({ review }: { review: DocReview | null }) {
  if (!review) return null;
  switch (review.status) {
    case "PENDING": return <Badge tone="blue">AI checking…</Badge>;
    case "SKIPPED": return <Badge tone="gray">Not AI-checked</Badge>;
    case "ERROR": return <Badge tone="gray">Check manually</Badge>;
    case "VERIFIED": return <Badge tone="green">✓ AI verified</Badge>;
    case "WARNINGS": return <Badge tone="amber">{review.overridden ? "Accepted by agent" : `${review.findings.length} warning${review.findings.length === 1 ? "" : "s"}`}</Badge>;
    case "REJECTED": return <Badge tone="red">✗ {review.findings.filter((f) => f.severity === "BLOCKER").length} issue{review.findings.filter((f) => f.severity === "BLOCKER").length === 1 ? "" : "s"}</Badge>;
  }
}

export function Findings({ review, audience = "staff" }: { review: DocReview | null; audience?: "staff" | "customer" }) {
  if (!review) return null;
  if (review.status === "ERROR" && audience === "staff") return <p className="mt-1 text-xs text-slate-500">{review.error}</p>;
  if (!review.findings.length) return null;
  const shown = audience === "customer" ? review.findings.filter((f) => f.severity !== "INFO") : review.findings;
  return (
    <ul className="mt-2 space-y-1">
      {shown.map((f, i) => (
        <li key={i} className={`rounded-md px-2.5 py-1.5 text-xs ${f.severity === "BLOCKER" && !review.overridden ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900"}`}>
          <span className="font-medium">{f.message}</span>
          {f.fix && <span className="block opacity-80">→ {f.fix}</span>}
        </li>
      ))}
      {review.overridden && audience === "staff" && <li className="text-xs text-slate-500">Accepted by {review.overridden.by}: “{review.overridden.note}”</li>}
    </ul>
  );
}
