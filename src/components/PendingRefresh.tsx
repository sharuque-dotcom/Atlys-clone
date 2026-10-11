"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the page every few seconds while AI reviews are running (stops after ~3 minutes). */
export function PendingRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const id = setInterval(() => {
      if (++n > 45) return clearInterval(id);
      router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
