"use client";

import React, { useEffect, useState, use, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2, AlertCircle, Wallet, ArrowRight, DollarSign, User, Copy, Check, ShieldCheck, Users, MessageSquare, TrendingUp, Star, Sparkles, Repeat, RefreshCw, HandCoins, Gift, Zap, Award, Trophy } from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { useAuth } from "@/context/AuthContext";
import { useFinancial } from "@/context/FinancialContext";
import { formatAddress } from "@/lib/utils";
import { QRCode } from "react-qr-code";

interface PaymentLink {
  id: string; user_id: string; title: string; amount: number | null; currency: string;
  recipient_address: string; active: boolean; created_at: string;
}

interface TipsPage {
  id: string; user_id: string; title: string; creator_username: string;
  recipient_address: string; active: boolean;
  goal_title: string | null; goal_amount: number | null; raised_amount: number;
  bronze_amount: number | null; silver_amount: number | null; gold_amount: number | null;
  created_at: string;
}

interface TipMessage {
  id: string; sender_address: string; sender_username: string | null;
  amount: number; message: string | null; tier_label: string | null; created_at: string;
}

interface TopSupporter {
  sender_address: string; sender_username: string | null; total_amount: number;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function getTierLabel(amount: number, page: TipsPage): string | null {
  if (page.gold_amount && amount >= page.gold_amount) return "Gold";
  if (page.silver_amount && amount >= page.silver_amount) return "Silver";
  if (page.bronze_amount && amount >= page.bronze_amount) return "Bronze";
  return null;
}

function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PayPage() {
  const params = useParams();
  const router = useRouter();
  const { notify } = useNotify();
  const paramId = params.id as string;
  const isUsername = !isUUID(paramId);

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"payment_link" | "tips_page" | "not_found">("payment_link");
  const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null);
  const [tipsPage, setTipsPage] = useState<TipsPage | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<{ username: string; displayName: string; avatar: string | null } | null>(null);
  const [messages, setMessages] = useState<TipMessage[]>([]);
  const [topSupporters, setTopSupporters] = useState<TopSupporter[]>([]);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [tipMessage, setTipMessage] = useState("");
  const [payerName, setPayerName] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"" | "weekly" | "monthly">("");
  const [settingRecurring, setSettingRecurring] = useState(false);

  const { user } = useAuth();
  const { walletId, walletAddress, refreshData } = useFinancial();

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isUsername) {
          const res = await fetch(`/api/tips/${paramId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setMode("tips_page");
              setTipsPage(data.page);
              setCreatorInfo(data.creator);
              setMessages(data.messages || []);
              setTopSupporters(data.topSupporters || []);
            }
          }
        } else {
          const res = await fetch(`/api/payment-links/${paramId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.link) {
              setMode("payment_link");
              setPaymentLink(data.link);
            }
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (paramId) fetchData();
  }, [paramId]);

  const liveTickerRef = useRef<TipMessage[]>([]);
  useEffect(() => {
    if (mode !== "tips_page" || !tipsPage) return;
    liveTickerRef.current = messages;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tips/${paramId}/messages?limit=5`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.messages?.length > 0) {
            setMessages(data.messages);
            const newest = data.messages[0];
            if (!liveTickerRef.current.find(m => m.id === newest.id)) {
              liveTickerRef.current = data.messages;
            }
          }
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [mode, tipsPage, paramId]);

  const recentTips = messages.slice(0, 5);

  const presets = tipsPage
    ? [
        ...(tipsPage.bronze_amount ? [{ label: "Bronze", amount: tipsPage.bronze_amount }] : []),
        ...(tipsPage.silver_amount ? [{ label: "Silver", amount: tipsPage.silver_amount }] : []),
        ...(tipsPage.gold_amount ? [{ label: "Gold", amount: tipsPage.gold_amount }] : []),
      ]
    : [];

  const displayAmount = selectedAmount || (customAmount ? parseFloat(customAmount) : null);

  const handlePay = async () => {
    if (!tipsPage || !displayAmount) return notify("Select an amount");
    if (displayAmount <= 0) return notify("Invalid amount");
    if (!user) return notify("You must be logged in to send a tip");
    if (!walletId) return notify("Wallet not ready. Please try again in a moment");
    if (!paramId || typeof paramId !== "string") return notify("Invalid page URL");

    setPaying(true);
    try {
      const res = await fetch(`/api/tips/${encodeURIComponent(paramId)}/pay`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: displayAmount, message: tipMessage, senderAddress: walletAddress, senderUsername: user.user_metadata?.username || null, walletId }),
      });
      const data = await res.json();
      if (data.success) {
        setPaymentSuccess(true);
        notify(`Tip of $${displayAmount} sent!`);
        if (refreshData) await refreshData();
      } else notify(data.error || "Payment failed");
    } catch (e: any) { notify("Payment failed"); }
    finally { setPaying(false); }
  };

  const handleSetupRecurring = async () => {
    if (!tipsPage || !displayAmount || !recurringFrequency) return;
    setSettingRecurring(true);
    try {
      const res = await fetch(`/api/tips/${paramId}/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: displayAmount, frequency: recurringFrequency, senderAddress: walletAddress || payerName || "anonymous", senderUsername: user?.user_metadata?.username || null }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`Recurring ${recurringFrequency} tip of $${displayAmount} set up!`);
        setRecurringFrequency("");
      } else notify(data.error || "Failed to setup recurring tip");
    } catch { notify("Failed to setup"); }
    finally { setSettingRecurring(false); }
  };

  if (loading) return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (mode === "payment_link" && paymentLink) {
    const showManualFlow = !user || !walletId;
    const effectiveAmount = paymentLink.amount || (customAmount ? parseFloat(customAmount) : null);

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">
          <div className="flex items-center justify-center mb-8 gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center"><span className="text-primary-foreground font-black text-xl">S</span></div>
            <h2 className="text-3xl font-black tracking-tighter uppercase opacity-90">Setra</h2>
          </div>
          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardHeader className="p-8 pb-4 text-center border-b border-border/40">
              <CardTitle className="text-2xl font-black">{paymentLink.title}</CardTitle>
              <CardDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 mt-2">Payment Request</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {paymentLink.amount ? (
                <div className="p-6 rounded-xl bg-primary/5 border-2 border-primary/20 text-center">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Amount</p>
                  <p className="text-4xl font-black text-foreground">${paymentLink.amount.toLocaleString()}</p>
                  <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-wider">USDC</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Enter Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input type="number" placeholder="0.00" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} className="h-14 pl-12 rounded-xl bg-muted/30 border-none text-lg font-bold" />
                  </div>
                </div>
              )}
              {!showManualFlow ? (
                <Button onClick={async () => {
                  if (!effectiveAmount) return notify("Enter an amount");
                  setPaying(true);
                  try {
                    const res = await fetch(`/api/payment-links/${paramId}/pay`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: effectiveAmount }) });
                    const data = await res.json();
                    if (data.success) { setPaymentSuccess(true); notify("Payment sent!"); if (refreshData) await refreshData(); } else notify(data.error || "Payment failed");
                  } catch { notify("Payment failed"); }
                  finally { setPaying(false); }
                }} disabled={paying || !effectiveAmount} className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-wider shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  {paying ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</> : <><CheckCircle2 className="h-5 w-5" /> Pay with Setra</>}
                </Button>
              ) : (
                <>
                  <div className="p-5 rounded-2xl bg-muted/30 border border-border/20 space-y-3">
                    <p className="text-xs font-bold text-foreground">Send {effectiveAmount || "[amount]"} USDC to:</p>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-card">
                      <p className="text-xs font-mono text-foreground font-bold flex-1 break-all">{paymentLink.recipient_address}</p>
                      <Button onClick={() => { navigator.clipboard.writeText(paymentLink.recipient_address); setCopiedAddress(true); notify("Address copied!"); setTimeout(() => setCopiedAddress(false), 2000); }} variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted flex-shrink-0">
                        {copiedAddress ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Network: <span className="font-bold text-foreground">Arc Testnet</span></p>
                  </div>
                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Your name or wallet</Label>
                    <Input placeholder="e.g. @favour11 or 0x" value={payerName} onChange={(e) => setPayerName(e.target.value)} disabled={paying} className="h-12 px-4 rounded-xl bg-muted/30 border-none font-bold" />
                  </div>
                  <Button onClick={async () => {
                    if (!effectiveAmount) return notify("Enter amount");
                    if (!payerName.trim()) return notify("Enter your name");
                    setPaying(true);
                    try {
                      const res = await fetch(`/api/payment-links/${paramId}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: effectiveAmount, isManualAttempt: true, payerName: payerName.trim() }) });
                      const data = await res.json();
                      if (data.success) { setPaymentSuccess(true); notify("Payment logged!"); } else notify(data.error || "Failed");
                    } catch { notify("Failed"); }
                    finally { setPaying(false); }
                  }} disabled={paying || !effectiveAmount || !payerName.trim()} className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                    {paying ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</> : <><CheckCircle2 className="h-5 w-5" /> I Have Sent Payment</>}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/30 font-black uppercase tracking-[0.3em] text-[10px]">Powered by Setra</div>
        </motion.div>
        {paymentSuccess && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <Card className="border-none shadow-premium bg-card max-w-lg w-full mx-4">
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-black mb-2">Payment Submitted!</h2>
                <p className="text-sm text-muted-foreground mb-6">Your payment has been logged. The merchant will verify it on Arc Testnet.</p>
                <Button onClick={() => router.push(user ? "/" : "/login")} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider">{user ? "Dashboard" : "Login"}</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    );
  }

  if (mode === "payment_link" && !paymentLink) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="border-none shadow-premium bg-card max-w-md w-full">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-black mb-2">Payment Link Not Found</h2>
            <p className="text-sm text-muted-foreground">This link may have been deactivated or does not exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "tips_page" && tipsPage && creatorInfo) {
    const progress = tipsPage.goal_amount && tipsPage.goal_amount > 0 ? Math.min((tipsPage.raised_amount / tipsPage.goal_amount) * 100, 100) : 0;
    const totalRaised = tipsPage.raised_amount || messages.reduce((s, m) => s + Number(m.amount || 0), 0);

    if (paymentSuccess) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg">
            <Card className="border-none shadow-premium bg-card">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-black mb-2">Tip Sent!</h2>
                <p className="text-sm text-muted-foreground mb-4">Thank you for supporting {creatorInfo.displayName || creatorInfo.username}!</p>
                {displayAmount && <p className="text-3xl font-black text-primary mb-6">${displayAmount} USDC</p>}
                {tipMessage && <p className="text-sm italic text-muted-foreground mb-6">"{tipMessage}"</p>}
                <Button onClick={() => router.push(user ? "/" : "/login")} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider">{user ? "Dashboard" : "Return"}</Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full bg-background relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-[1400px] mx-auto px-6 md:px-10 lg:px-16 py-8 md:py-12 space-y-8">
          {/* Creator Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
            <Avatar className="w-20 h-20 mx-auto border-2 border-primary/20 shadow-lg">
              {creatorInfo.avatar && <AvatarImage src={creatorInfo.avatar} />}
              <AvatarFallback className="text-xl font-black bg-primary/10 text-primary">{creatorInfo.displayName?.charAt(0) || creatorInfo.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">{creatorInfo.displayName || creatorInfo.username}</h1>
              <p className="text-muted-foreground font-semibold">@{creatorInfo.username}</p>
            </div>
            <p className="text-lg font-medium text-muted-foreground max-w-md mx-auto">{tipsPage.title || "Support my work!"}</p>
          </motion.div>

          {/* Goal Progress */}
          {tipsPage.goal_title && tipsPage.goal_amount && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-none shadow-premium bg-card overflow-hidden">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{tipsPage.goal_title}</p>
                    <p className="text-sm font-black">${totalRaised.toLocaleString()} / ${tipsPage.goal_amount.toLocaleString()}</p>
                  </div>
                  <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full bg-primary" />
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground text-center">{progress.toFixed(0)}% funded</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Main Content */}
            <div className="lg:col-span-7 space-y-6">
              {/* Live Ticker */}
              {recentTips.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <Card className="border-none shadow-premium bg-card overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <CardTitle className="text-xs font-black uppercase tracking-widest">Live Tips</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="space-y-2">
                        <AnimatePresence>
                          {recentTips.map((tip, i) => (
                            <motion.div key={tip.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                              <div className="flex items-center gap-2 min-w-0">
                                <Gift className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                <span className="text-xs font-bold truncate">
                                  {tip.sender_username ? `@${tip.sender_username}` : formatAddress(tip.sender_address)}
                                </span>
                                {tip.tier_label && (
                                  <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 font-black uppercase">
                                    {tip.tier_label === "Gold" ? "🥇" : tip.tier_label === "Silver" ? "🥈" : "🥉"} {tip.tier_label}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-black text-emerald-600">+${Number(tip.amount).toLocaleString()}</span>
                                <span className="text-[9px] text-muted-foreground/50">{formatTimeAgo(tip.created_at)}</span>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Message Wall */}
              {messages.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <Card className="border-none shadow-premium bg-card overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <CardTitle className="text-xs font-black uppercase tracking-widest">Message Wall ({messages.length})</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 max-h-80 overflow-y-auto space-y-2">
                      {messages.map((msg) => (
                        <div key={msg.id} className="p-3 rounded-xl bg-muted/20 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold">{msg.sender_username ? `@${msg.sender_username}` : formatAddress(msg.sender_address)}</span>
                              {msg.tier_label && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">{msg.tier_label}</span>
                              )}
                            </div>
                            <span className="text-xs font-black text-emerald-600">+${Number(msg.amount).toLocaleString()}</span>
                          </div>
                          {msg.message && <p className="text-xs text-muted-foreground">{msg.message}</p>}
                          <p className="text-[9px] text-muted-foreground/40">{formatTimeAgo(msg.created_at)}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Top Supporters */}
              {topSupporters.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  <Card className="border-none shadow-premium bg-card overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-xs font-black uppercase tracking-widest">Top Supporters</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-2">
                      {topSupporters.slice(0, 5).map((s, i) => (
                        <div key={s.sender_address + i} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${i === 0 ? "bg-amber-500/20 text-amber-600" : i === 1 ? "bg-slate-400/20 text-slate-500 dark:text-slate-300" : i === 2 ? "bg-orange-600/20 text-orange-700" : "bg-muted-foreground/10 text-muted-foreground/60"}`}>
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                            </span>
                            <span className="text-xs font-bold">{s.sender_username ? `@${s.sender_username}` : formatAddress(s.sender_address)}</span>
                          </div>
                          <span className="text-xs font-black">${Number(s.total_amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Tip Form Sidebar */}
            <div className="lg:col-span-5">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="sticky top-8">
                <Card className="border-none shadow-premium bg-card overflow-hidden">
                  <CardHeader className="p-6 pb-3 text-center">
                    <HandCoins className="h-8 w-8 text-primary mx-auto mb-2" />
                    <CardTitle className="text-lg font-black">Send a Tip</CardTitle>
                    <CardDescription className="text-xs font-bold text-muted-foreground/60">Support {creatorInfo.displayName || creatorInfo.username}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-3 space-y-4">
                    {/* Preset Tiers */}
                    {presets.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tip Tiers</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {presets.map((p) => (
                            <Button key={p.label} variant={selectedAmount === p.amount ? "default" : "outline"} onClick={() => { setSelectedAmount(p.amount); setCustomAmount(""); }} className="h-16 rounded-xl flex-col gap-0.5 text-xs font-black">
                              <span>{p.label}</span>
                              <span className="text-[10px] opacity-80">${p.amount}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preset Amounts */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quick Amounts</Label>
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {PRESET_AMOUNTS.map((amt) => (
                          <Button key={amt} variant={selectedAmount === amt ? "default" : "outline"} size="sm" onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }} className="h-9 rounded-lg text-xs font-black">{amt}</Button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Amount */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Custom Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" placeholder="0.00" value={customAmount} onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }} className="h-11 pl-10 rounded-xl bg-muted/30 border-none font-bold text-sm" />
                      </div>
                    </div>

                    {displayAmount && (
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                        <p className="text-xs font-bold text-muted-foreground">You'll tip</p>
                        <p className="text-2xl font-black text-primary">${displayAmount.toLocaleString()} USDC</p>
                        {(() => {
                          const tier = getTierLabel(displayAmount, tipsPage);
                          return tier ? <Badge className="mt-1 text-[9px] font-black uppercase tracking-wider">{tier === "Gold" ? "🥇 " : tier === "Silver" ? "🥈 " : "🥉 "}{tier}</Badge> : null;
                        })()}
                      </div>
                    )}

                    {/* Message */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Message (optional)</Label>
                      <Textarea placeholder="Say something nice" value={tipMessage} onChange={(e) => setTipMessage(e.target.value)} className="rounded-xl bg-muted/30 border-none text-sm min-h-[60px]" />
                    </div>

                    {!user ? (
                      <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 text-center space-y-4">
                        <HandCoins className="h-10 w-10 text-primary mx-auto" />
                        <div>
                          <p className="text-sm font-black">Create a free Setra account to send a tip</p>
                          <p className="text-xs text-muted-foreground mt-1">Sign up to send USDC tips directly and support creators</p>
                        </div>
                        <Button onClick={() => router.push("/signup")} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider shadow-lg shadow-primary/20">
                          <Wallet className="h-4 w-4 mr-2" /> Sign Up
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button onClick={handlePay} disabled={paying || !displayAmount} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                          {paying ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><Gift className="h-4 w-4" /> Send Tip</>}
                        </Button>

                        <div className="space-y-2 pt-2 border-t border-border/20">
                          <div className="flex items-center gap-2">
                            <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Make it recurring</span>
                          </div>
                          <div className="flex gap-2">
                            <Button variant={recurringFrequency === "weekly" ? "default" : "outline"} size="sm" onClick={() => setRecurringFrequency(recurringFrequency === "weekly" ? "" : "weekly")} className="flex-1 h-9 rounded-lg text-[10px] font-black">Weekly</Button>
                            <Button variant={recurringFrequency === "monthly" ? "default" : "outline"} size="sm" onClick={() => setRecurringFrequency(recurringFrequency === "monthly" ? "" : "monthly")} className="flex-1 h-9 rounded-lg text-[10px] font-black">Monthly</Button>
                          </div>
                          {recurringFrequency && displayAmount && (
                            <Button onClick={handleSetupRecurring} disabled={settingRecurring} variant="outline" className="w-full h-10 rounded-xl text-xs font-black flex items-center gap-2">
                              {settingRecurring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />}
                              {recurringFrequency === "weekly" ? "Weekly" : "Monthly"} ${displayAmount}
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Footer QR */}
          <div className="text-center pt-8 pb-4">
            <div className="inline-flex flex-col items-center gap-3 p-4 rounded-2xl bg-card/50 border border-border/20">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Share this page</p>
              <div className="p-2 bg-card rounded-xl">
                <QRCode value={typeof window !== "undefined" ? window.location.href : ""} size={140} level="H" />
              </div>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black" onClick={() => { navigator.clipboard.writeText(window.location.href); notify("Link copied!"); }}>
                <Copy className="h-3 w-3 mr-1.5" /> Copy Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="border-none shadow-premium bg-card max-w-md w-full">
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-black text-foreground mb-2">Not Found</h2>
          <p className="text-sm text-muted-foreground">This page doesn't exist.</p>
        </CardContent>
      </Card>
    </div>
  );
}
