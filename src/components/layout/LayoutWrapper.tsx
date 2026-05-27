"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import { SettingsModal } from "@/components/dashboard/SettingsModal";
import { useFinancial } from "@/context/FinancialContext";
import { useAuth } from "@/context/AuthContext";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings, isLoaded, username } = useFinancial();
  const { loading: authLoading, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/diag") || pathname?.startsWith("/pay/");
  const isSetupUsernamePage = pathname?.startsWith("/setup-username");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Safety timeout: if auth is still loading after 4 seconds, continue anyway
  useEffect(() => {
    if (!authLoading) return;
    const t = setTimeout(() => setAuthTimeout(true), 4000);
    return () => clearTimeout(t);
  }, [authLoading]);

  // Theme application logic
  useEffect(() => {
    if (!mounted || isAuthPage) return;
    
    const root = window.document.documentElement;
    const theme = settings.theme;
    
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.remove("light", "dark");
      root.classList.add(systemTheme);
    } else {
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    }
  }, [settings.theme, mounted, isAuthPage]);

  // For auth pages, render immediately without loading checks
  if (isAuthPage) {
    return <main className="min-h-screen font-sans antialiased">{children}</main>;
  }

  // Redirect logic in useEffect to avoid render-time state updates
  useEffect(() => {
    if (!mounted || authLoading || isAuthPage) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (isLoaded && !username && !isSetupUsernamePage) {
      router.push("/setup-username");
    }
  }, [mounted, authLoading, user, isLoaded, username, isSetupUsernamePage, isAuthPage, router]);

  // For protected pages, show loading state (with safety timeout)
  if (!mounted || (authLoading && !authTimeout)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary animate-pulse" />
        </div>
      </div>
    );
  }

  // Show loading while redirecting (briefly shown during router.push transitions)
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
        {/* Desktop Sidebar */}
        <Sidebar mode="desktop" className="w-72 flex-shrink-0" />
        
        <div className="flex flex-col flex-1 overflow-hidden">
          {pathname !== "/" && pathname !== "/dashboard" && <Navbar />}
          
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 bg-background/50">
            <div className="max-w-7xl mx-auto">
              <PageTransition>
                {children}
              </PageTransition>
            </div>
          </main>
        </div>
      </div>
      
      {/* Mobile Bottom Tab Bar */}
      <Sidebar mode="mobile" />
    </div>
  );
}
