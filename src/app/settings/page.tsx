"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFinancial } from "@/context/FinancialContext";

export default function SettingsRedirect() {
  const router = useRouter();
  const { setSettingsOpen } = useFinancial();

  useEffect(() => {
    setSettingsOpen(true);
    router.replace("/");
  }, [router, setSettingsOpen]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground font-bold animate-pulse">Opening settings...</p>
    </div>
  );
}
