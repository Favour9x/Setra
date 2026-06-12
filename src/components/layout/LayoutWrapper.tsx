"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import { SettingsModal } from "@/components/dashboard/SettingsModal";
import { useFinancial } from "@/context/FinancialContext";
import { useAuth } from "@/context/AuthContext";
import { AnimatePresence } from "motion/react";
import { Menu, PiggyBank } from "lucide-react";
import Link from "next/link";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings, isLoaded, username } = useFinancial();
  const { loading: authLoading, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/diag") || pathname?.startsWith("/pay/");
  const isSetupUsernamePage = pathname?.startsWith("/setup-username");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth guard: once auth finishes loading with no user, redirect to login
  const redirectGuard = useRef(false);
  useEffect(() => {
    if (!mounted || authLoading || isAuthPage) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (isLoaded && !username && !isSetupUsernamePage && !redirectGuard.current) {
      redirectGuard.current = true;
      router.push("/setup-username");
    }
  }, [mounted, authLoading, user?.id, isLoaded, username, isSetupUsernamePage, isAuthPage, router]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  if (isAuthPage) {
    return <main className="min-h-screen font-sans antialiased">{children}</main>;
  }

  if (!mounted || authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user || (isLoaded && !username && !isSetupUsernamePage)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased">
      <SettingsModal />
      <div className="flex h-screen overflow-hidden">
        <div className="hidden md:flex flex-col h-screen flex-shrink-0">
          <Sidebar mode="desktop" className="w-72" />
        </div>

        <AnimatePresence>
          {mobileSidebarOpen && (
            <Sidebar mode="mobile" mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
          )}
        </AnimatePresence>

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <div className="md:hidden flex items-center justify-between px-4 h-14 bg-card/80 backdrop-blur-md border-b border-border/30 flex-shrink-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="h-9 w-9 rounded-xl bg-muted/30 flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-black text-sm">S</span>
              </div>
              <span className="text-lg font-black tracking-tighter text-foreground uppercase">Setra</span>
            </Link>
            <div className="w-9" />
          </div>

          {pathname !== "/" && pathname !== "/dashboard" && <Navbar />}

          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background/50">
            <div className="max-w-7xl mx-auto">
              <PageTransition>
                {children}
              </PageTransition>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
