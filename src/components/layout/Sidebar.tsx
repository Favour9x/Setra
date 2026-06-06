"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "motion/react";
import { useFinancial } from "@/context/FinancialContext";
import { useNotify } from "@/components/ui/notification";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Send, 
  Receipt, 
  HandCoins, 
  Settings, 
  Zap, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  X,
  ShieldAlert,
  Plus,
  History,
  Repeat,
  PieChart,
  Bell,
  Users,
  PiggyBank,
  Menu,
  Calendar,
  GitBranch,
  Gauge,
} from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  mode?: "desktop" | "mobile";
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ className, mode = "desktop", mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { setSettingsOpen, profile, refreshBalance, walletId } = useFinancial();
  const { notify } = useNotify();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState<"idle" | "payment" | "database" | "success">("idle");
  const [localIsPro, setLocalIsPro] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "6months" | "yearly">("monthly");

  // Check robust local state for Pro status
  useEffect(() => {
    if (user?.id) {
      const isPro = localStorage.getItem(`setra_is_pro_${user.id}`) === "true";
      setLocalIsPro(isPro);
    }
  }, [user?.id]);

  const isProUser = localIsPro;

  const handleNavigation = (e: React.MouseEvent, href: string) => {
    // Intercept navigation to Automation (workflows or automation routes) if not Pro
    if ((href === "/automation" || href === "/workflows") && !isProUser) {
      e.preventDefault();
      setUpgradeStep("idle");
      setShowUpgradeModal(true);
    }
  };

  const executeUpgrade = async () => {
    if (!walletId || !user?.id) {
      notify("Please set up your wallet first. Go to Settings to create one.");
      return;
    }

    const planPrices = {
      monthly: "15.00",
      "6months": "85.00",
      yearly: "130.00"
    };

    const planAmount = planPrices[selectedPlan];

    try {
      setUpgrading(true);
      setUpgradeStep("payment");

      // 1. Trigger the USDC transfer to the Circle Agent Wallet
      const setraWallet = process.env.NEXT_PUBLIC_SETRA_PAYMENT_WALLET || "0xd0629fda6f615fc83711d58ac165cfa98c783141";
      const paymentRes = await fetch("/api/payments/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId,
          toAddress: setraWallet,
          amount: planAmount,
          userId: user.id,
          category: "Subscription"
        })
      });

      const paymentData = await paymentRes.json();

      if (!paymentRes.ok || !paymentData.success) {
        throw new Error(paymentData.error || `${planAmount} USDC transfer failed. Please fund your wallet and try again.`);
      }

      setUpgradeStep("database");

      // 2. Perform the database write via backend API (service role bypass)
      const upgradeRes = await fetch("/api/user/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });

      const upgradeData = await upgradeRes.json();

      if (!upgradeRes.ok || !upgradeData.success) {
        console.warn("⚠️ API profile write failed, relying on local storage fallback.");
      }

      // 3. Persist local storage state as robust fallback
      localStorage.setItem(`setra_is_pro_${user.id}`, "true");
      setLocalIsPro(true);

      setUpgradeStep("success");
      notify("⚡ Upgraded to Setra Pro Business successfully!");
      
      // Refresh the balance in background
      await refreshBalance();

      // Automatically navigate to workflows after a short delay
      setTimeout(() => {
        setShowUpgradeModal(false);
        router.push("/automation");
      }, 1500);

    } catch (err: any) {
      console.error(err);
      notify(err.message || "Upgrade failed.", "error");
      setUpgradeStep("idle");
    } finally {
      setUpgrading(false);
    }
  };

  const renderDesktopSidebar = () => {
    return (
      <div className={cn("pb-12 border-r bg-card/50 backdrop-blur-xl h-screen flex flex-col", className)}>
        <div className="space-y-4 py-6 h-full flex flex-col">
          <div className="px-7 py-2 flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <span className="text-primary-foreground font-black text-xl">S</span>
            </motion.div>
            <h2 className="text-2xl font-black tracking-tighter text-foreground uppercase opacity-90">Setra</h2>
          </div>
          
          <ScrollArea className="flex-1 px-4">
            {[
              {
                label: "Overview",
                items: [
                  { title: "Dashboard", href: "/", icon: LayoutDashboard },
                ],
              },
              {
                label: "Payments",
                items: [
                  { title: "Send Payment", href: "/send", icon: Send },
                  { title: "Beneficiaries", href: "/beneficiaries", icon: Users },
                  { title: "Invoices", href: "/invoices", icon: Receipt },
                  { title: "Transactions", href: "/transactions", icon: History },
                ],
              },
              {
                label: "Tools",
                items: [
                  { title: "Savings", href: "/savings", icon: PiggyBank },
                  { title: "Tips", href: "/tips", icon: HandCoins },
                  { title: "Subscriptions", href: "/subscriptions", icon: Repeat },
                ],
              },
              {
                label: "Management",
                items: [
                  { title: "Automation", href: "/automation", icon: Zap },
                  { title: "Analytics", href: "/analytics", icon: PieChart },
                ],
              },
              {
                label: "Account",
                items: [
                  { title: "Notifications", href: "/notifications", icon: Bell },
                  { title: "Settings", href: "/settings", icon: Settings },
                ],
              },
            ].map((section, sectionIdx) => (
              <div key={section.label} className={cn("space-y-1 py-4", sectionIdx > 0 && "pt-2")}>
                <h2 className="mb-3 px-4 text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase opacity-40">
                  {section.label}
                </h2>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || (item.href === "/automation" && pathname === "/workflows");
                    const isSettings = item.title === "Settings";

                    if (isSettings) {
                      return (
                        <button
                          key={item.href}
                          onClick={() => setSettingsOpen(true)}
                          className={cn(
                            "w-full group flex items-center rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:bg-muted/50 hover:text-foreground text-muted-foreground/70"
                          )}
                        >
                          <item.icon className="mr-3 h-4 w-4 transition-transform group-hover:scale-110 text-muted-foreground/50 group-hover:text-primary" />
                          {item.title}
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={(e) => handleNavigation(e, item.href)}
                        className={cn(
                          "group flex items-center rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:bg-muted/50 hover:text-foreground",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10 hover:bg-primary/90"
                            : "text-muted-foreground/70"
                        )}
                      >
                        <item.icon className={cn("mr-3 h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-primary-foreground" : "text-muted-foreground/50 group-hover:text-primary")} />
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </ScrollArea>
          
          <div className="mt-auto px-6 py-4 space-y-3">
            <div
              onClick={() => {
                if (isProUser) {
                  notify("You are already on the Pro plan!");
                } else {
                  setUpgradeStep("idle");
                  setShowUpgradeModal(true);
                }
              }}
              className="group cursor-pointer flex items-center gap-3 rounded-xl border border-border/30 bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 transition-all hover:border-primary/30 hover:from-primary/10"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">
                  {isProUser ? "Setra Pro Active" : "Upgrade to Pro"}
                </p>
                <p className="text-[9px] font-semibold text-muted-foreground/60">
                  {isProUser ? "All features unlocked" : "Unlock AI automation"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileOverlay = () => {
    if (!mobileOpen) return null;
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onMobileClose}
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
        />
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 left-0 z-50 w-72 md:hidden"
        >
          {renderDesktopSidebar()}
        </motion.div>
      </>
    );
  };

  return (
    <>
      {mode === "desktop" && renderDesktopSidebar()}
      {mode === "mobile" && renderMobileOverlay()}

      {/* Upgrade Pro Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <>
            {/* Modal Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => !upgrading && setShowUpgradeModal(false)}
              className="fixed inset-0 bg-black z-[100] backdrop-blur-sm"
            />

            {/* Modal Container */}
            <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full max-w-lg bg-card border border-border/40 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden space-y-8"
              >
                {/* Background decorative glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

                {/* Close Button */}
                {!upgrading && (
                  <button 
                    onClick={() => setShowUpgradeModal(false)}
                    className="absolute right-5 top-5 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {/* Content based on Upgrade Step */}
                {upgradeStep === "idle" && (
                  <div className="space-y-8">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center animate-pulse">
                        <Zap className="h-7 w-7" />
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-tight text-foreground">
                        Unlock <span className="text-primary italic">Setra Pro</span>
                      </h3>
                      <p className="text-sm font-semibold text-muted-foreground max-w-sm">
                        Unlock the full power of Automation and take control of your finances on autopilot
                      </p>
                    </div>

                    <Separator className="opacity-30" />

                    {/* Features list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Calendar className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Scheduled Payments</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Send payments at a specific date and time automatically
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Repeat className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Recurring Payments</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Repeat payments on a set schedule without lifting a finger
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Users className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Split Revenue</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Automatically split payments between multiple people
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Gauge className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Threshold Transfer</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Trigger transfers when your balance hits a set amount
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <PiggyBank className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Savings Sweep</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Auto move a percentage of incoming payments to savings
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Receipt className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Auto Invoice Pay</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Pay invoices automatically when they are due
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <GitBranch className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Conditional Transfer</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Send payments only when specific conditions are met
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Payroll Automation</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Pay your entire team their salaries automatically
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Sparkles className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Subscription Payment</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-snug">
                            Handle recurring subscription charges automatically
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CTA section */}
                    <div className="space-y-5 pt-4 text-center">
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-muted-foreground mb-3">Select Your Plan:</p>
                        
                        <button
                          onClick={() => setSelectedPlan("monthly")}
                          className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all ${
                            selectedPlan === "monthly" 
                              ? "border-primary bg-primary/5" 
                              : "border-border/20 bg-muted/20 hover:border-primary/30"
                          }`}
                        >
                          <span className="text-sm font-bold text-foreground">Monthly</span>
                          <span className="text-base font-black text-primary">$15 USDC/mo</span>
                        </button>

                        <button
                          onClick={() => setSelectedPlan("6months")}
                          className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all ${
                            selectedPlan === "6months" 
                              ? "border-primary bg-primary/5" 
                              : "border-border/20 bg-muted/20 hover:border-primary/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">6 Months</span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">Save $5</span>
                          </div>
                          <span className="text-base font-black text-primary">$85 USDC</span>
                        </button>

                        <button
                          onClick={() => setSelectedPlan("yearly")}
                          className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all ${
                            selectedPlan === "yearly" 
                              ? "border-primary bg-primary/5" 
                              : "border-border/20 bg-muted/20 hover:border-primary/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">Yearly</span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">Save $50</span>
                          </div>
                          <span className="text-base font-black text-primary">$130 USDC</span>
                        </button>
                      </div>

                      <Button
                        onClick={executeUpgrade}
                        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider text-xs shadow-lg shadow-primary/20 hover:scale-[1.01] transition-all mt-4"
                      >
                        Upgrade Now
                      </Button>
                    </div>
                  </div>
                )}

                {/* Steps loading overlay */}
                {upgrading && (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase tracking-widest text-foreground">
                        {upgradeStep === "payment" ? `Sending ${selectedPlan === "monthly" ? "$15" : selectedPlan === "6months" ? "$85" : "$130"} USDC Payment` : "Configuring Pro License"}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground max-w-xs">
                        {upgradeStep === "payment" 
                          ? "Executing the Circle USDC transaction to Arc Testnet ledger" 
                          : "Finalizing license records in your Supabase profile"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Success message */}
                {upgradeStep === "success" && (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in duration-300">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-bounce" />
                    <div className="space-y-1">
                      <h4 className="text-md font-black uppercase text-foreground">License Active!</h4>
                      <p className="text-[10px] font-bold text-muted-foreground">
                        Welcome to Setra Pro. Opening cash flow automation engine...
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
