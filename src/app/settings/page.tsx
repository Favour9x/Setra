"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFinancial } from "@/context/FinancialContext";

export default function SettingsRedirect() {
  const router = useRouter();
  const { setSettingsOpen } = useFinancial();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    
    setSettingsOpen(true);
    router.replace("/");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground font-bold animate-pulse">Opening settings...</p>
    </div>
  );
}
