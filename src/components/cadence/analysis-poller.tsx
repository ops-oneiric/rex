"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the page every few seconds while an analysis is running, for up to three minutes. */
export function AnalysisPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 3 * 60_000) clearInterval(timer);
      else router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
