"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus, Download, X, DollarSign, Loader2, Link2, Copy, CheckCircle2,
  HandCoins, Users, TrendingUp, Gift, Trophy, MessageSquare, ExternalLink,
  Settings2, QrCode, Repeat, Calendar, ArrowUp, ArrowDown, Sparkles
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/context/AuthContext";
import { useFinancial } from "@/context/FinancialContext";
import { formatAddress } from "@/lib/utils";
import { QRCode } from "react-qr-code";
import { getCachedData, setCachedData } from "@/hooks/useApiData";
import { StatCardSkeleton, TipMessageSkeleton } from "@/components/ui/PageSkeletons";
import { Skeleton } from "@/components/ui/skeleton";

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

const TIPS_CACHE_KEY = "tips_data";

export default function TipsDashboardPage() {
  const { notify } = useNotify();
  const { user } = useAuth();
  const { walletAddress } = useFinancial();

  const cached = getCachedData<any>(TIPS_CACHE_KEY);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<TipsPage | null>(cached?.page || null);
  const [messages, setMessages] = useState<TipMessage[]>(cached?.messages || []);
  const [topSupporters, setTopSupporters] = useState<TopSupporter[]>(cached?.topSupporters || []);
  const [analytics, setAnalytics] = useState<{
    thisWeekTotal: number; lastWeekTotal: number;
    bestTipper: { address: string; username: string | null; total: number } | null;
    bestDay: string | null;
  } | null>(cached?.analytics || null);
  const [profile, setProfile] = useState<{ username: string; wallet_address: string } | null>(cached?.profile || null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [createTitle, setCreateTitle] = useState("Tips");
  const [createGoalTitle, setCreateGoalTitle] = useState("");
  const [createGoalAmount, setCreateGoalAmount] = useState("");
  const [createBronze, setCreateBronze] = useState("");
  const [createSilver, setCreateSilver] = useState("");
  const [createGold, setCreateGold] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editGoalTitle, setEditGoalTitle] = useState("");
  const [editGoalAmount, setEditGoalAmount] = useState("");
  const [editBronze, setEditBronze] = useState("");
  const [editSilver, setEditSilver] = useState("");
  const [editGold, setEditGold] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tips/stats", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPage(data.page);
          setMessages(data.messages || []);
          setTopSupporters(data.topSupporters || []);
          setAnalytics(data.analytics);
          setProfile(data.profile);
          setCachedData(TIPS_CACHE_KEY, {
            page: data.page,
            messages: data.messages || [],
            topSupporters: data.topSupporters || [],
            analytics: data.analytics,
            profile: data.profile,
          });
        }
      }
    } catch (e) {
      if (!page) console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setCreateTitle("Tips");
    setCreateGoalTitle("");
    setCreateGoalAmount("");
    setCreateBronze("");
    setCreateSilver("");
    setCreateGold("");
    setShowCreateModal(true);
  };

  const openSettings = () => {
    if (!page) return;
    setEditTitle(page.title);
    setEditGoalTitle(page.goal_title || "");
    setEditGoalAmount(page.goal_amount ? String(page.goal_amount) : "");
    setEditBronze(page.bronze_amount ? String(page.bronze_amount) : "");
    setEditSilver(page.silver_amount ? String(page.silver_amount) : "");
    setEditGold(page.gold_amount ? String(page.gold_amount) : "");
    setShowSettingsModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return notify("Enter a title");
    setCreating(true);
    try {
      const res = await fetch("/api/tips/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          goal_title: createGoalTitle.trim() || undefined,
          goal_amount: createGoalAmount ? Number(createGoalAmount) : undefined,
          bronze_amount: createBronze ? Number(createBronze) : undefined,
          silver_amount: createSilver ? Number(createSilver) : undefined,
          gold_amount: createGold ? Number(createGold) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Tips page created!");
        setShowCreateModal(false);
        await fetchData();
      } else {
        notify(data.error || "Failed to create");
      }
    } catch {
      notify("Failed to create tips page");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/tips/update", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          goal_title: editGoalTitle.trim() || null,
          goal_amount: editGoalAmount ? Number(editGoalAmount) : null,
          bronze_amount: editBronze ? Number(editBronze) : null,
          silver_amount: editSilver ? Number(editSilver) : null,
          gold_amount: editGold ? Number(editGold) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Settings saved!");
        setShowSettingsModal(false);
        await fetchData();
      } else {
        notify(data.error || "Failed to save");
      }
    } catch {
      notify("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!page) return;
    const url = `${window.location.origin}/pay/${page.creator_username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    notify("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const svg = document.getElementById("dash-qr-code");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "setra-tips-qr.png";
      link.href = pngFile;
      link.click();
      notify("QR code downloaded!");
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const toggleActive = async () => {
    if (!page) return;
    try {
      const res = await fetch("/api/tips/update", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !page.active }),
      });
      const data = await res.json();
      if (data.success) {
        setPage({ ...page, active: !page.active });
        notify(page.active ? "Tips page disabled" : "Tips page enabled");
      }
    } catch {
      notify("Failed to toggle");
    }
  };

  const progress = page?.goal_amount && page.goal_amount > 0
    ? Math.min((page.raised_amount / page.goal_amount) * 100, 100)
    : 0;

  if (loading && !page) {
    return (
      <div className="space-y-10 pb-12 px-4 md:px-6 relative">
        <p className="text-secondary font-black text-[10px] uppercase tracking-[0.4em] mb-3">Creator Tools</p>
        <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground uppercase leading-none">Tips</h1>
        <div className="grid gap-4 md:grid-cols-4 mt-8">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid gap-8 lg:grid-cols-12 mt-8">
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-premium bg-card overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-full rounded-full" />
              </CardContent>
            </Card>
            <Card className="border-none shadow-premium bg-card overflow-hidden">
              <CardHeader className="p-6 pb-3">
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <TipMessageSkeleton key={i} />)}
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-premium bg-card overflow-hidden">
              <CardContent className="p-6 flex flex-col items-center space-y-4">
                <Skeleton className="h-40 w-40 rounded-2xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-secondary font-black text-[10px] uppercase tracking-[0.4em] mb-3">Creator Tools</p>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground uppercase leading-none">
            Tips
          </h1>
          <p className="text-muted-foreground mt-3 text-lg font-medium opacity-80 max-w-xl">
            Accept tips from your audience with a shareable public page
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            onClick={openCreate}
            className="w-full md:w-auto h-11 px-6 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-black uppercase tracking-wider text-xs"
          >
            <Plus className="h-4 w-4" /> Create Tips Page
          </Button>
          {page && (
            <Button
              variant="outline"
              onClick={openSettings}
              className="h-11 px-6 rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-2"
            >
              <Settings2 className="h-4 w-4" /> Settings
            </Button>
          )}
        </div>
      </div>

      {!page ? (
        /* No Tips Page State */
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardContent className="p-12 md:p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <HandCoins className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-black mb-3">No Tips Page Yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8 text-sm leading-relaxed">
                Create a shareable tips page where anyone can send you USDC tips,
                leave messages, and support your work &mdash; with optional
                goals, tier rewards, and recurring support.
              </p>
              <div className="grid gap-4 md:grid-cols-3 max-w-2xl mx-auto mb-8 text-left">
                <div className="p-4 rounded-xl bg-muted/20 text-center">
                  <Gift className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-xs font-black uppercase tracking-wider">Live Ticker</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Real-time tip notifications</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/20 text-center">
                  <Trophy className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-xs font-black uppercase tracking-wider">Goal & Tiers</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Fundraising goals + reward tiers</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/20 text-center">
                  <Repeat className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-xs font-black uppercase tracking-wider">Recurring</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Weekly/monthly subscriptions</p>
                </div>
              </div>
              <Button
                onClick={openCreate}
                className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider shadow-lg shadow-primary/20"
              >
                <Plus className="h-4 w-4 mr-2" /> Create Your Tips Page
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-none shadow-premium bg-card overflow-hidden">
              <CardContent className="p-5">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">This Week</p>
                <h3 className="text-2xl font-black mt-1 text-foreground">${(analytics?.thisWeekTotal || 0).toLocaleString()}</h3>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-bold">USDC received</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-premium bg-card overflow-hidden">
              <CardContent className="p-5">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Last Week</p>
                <h3 className="text-2xl font-black mt-1 text-foreground">${(analytics?.lastWeekTotal || 0).toLocaleString()}</h3>
                <div className="flex items-center gap-1 mt-0.5">
                  {(analytics?.thisWeekTotal || 0) > (analytics?.lastWeekTotal || 0) ? (
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                  ) : (analytics?.thisWeekTotal || 0) < (analytics?.lastWeekTotal || 0) ? (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  ) : null}
                  <p className="text-[10px] text-muted-foreground/60 font-bold">vs previous week</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-premium bg-card overflow-hidden">
              <CardContent className="p-5">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Messages</p>
                <h3 className="text-2xl font-black mt-1 text-foreground">{messages.length}</h3>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-bold">Total tips + messages</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-premium bg-card overflow-hidden">
              <CardContent className="p-5">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Top Supporter</p>
                {analytics?.bestTipper ? (
                  <>
                    <p className="text-sm font-black mt-1 text-foreground truncate">
                      {analytics.bestTipper.username ? `@${analytics.bestTipper.username}` : formatAddress(analytics.bestTipper.address)}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">${analytics.bestTipper.total.toLocaleString()} total</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-black mt-1 text-muted-foreground/40">&mdash;</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-bold">No tips yet</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Main Content */}
            <div className="lg:col-span-8 space-y-6">
              {/* Goal Progress */}
              <Card className="border-none shadow-premium bg-card overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="text-xs font-black uppercase tracking-widest">{page.goal_title || "No goal set"}</p>
                    </div>
                    {page.goal_amount && (
                      <p className="text-sm font-black">${page.raised_amount.toLocaleString()} / ${page.goal_amount.toLocaleString()}</p>
                    )}
                  </div>
                  {page.goal_amount && page.goal_amount > 0 && (
                    <div>
                      <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground text-center mt-1">{progress.toFixed(0)}% funded</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant={page.active ? "default" : "secondary"} className="text-[9px] font-black uppercase tracking-wider">
                      {page.active ? "Active" : "Inactive"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={toggleActive} className="h-7 rounded-lg text-[9px] font-black">
                      {page.active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={openSettings} className="h-7 rounded-lg text-[9px] font-black">
                      <Settings2 className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Messages */}
              <Card className="border-none shadow-premium bg-card overflow-hidden">
                <CardHeader className="p-6 pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Recent Tips & Messages</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                  {messages.length === 0 ? (
                    <div className="py-8 text-center">
                      <Gift className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-xs font-black text-muted-foreground/40 uppercase tracking-widest">No tips yet</p>
                      <p className="text-[10px] text-muted-foreground/30 mt-1">Share your page to start receiving tips</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {messages.map((msg) => (
                        <div key={msg.id} className="p-3 rounded-xl bg-muted/20 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold">
                                {msg.sender_username ? `@${msg.sender_username}` : formatAddress(msg.sender_address)}
                              </span>
                              {msg.tier_label && (
                                <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 font-black uppercase">
                                  {msg.tier_label}
                                </Badge>
                              )}
                              <span className="text-[9px] text-muted-foreground/40">{formatTimeAgo(msg.created_at)}</span>
                            </div>
                            {msg.message && <p className="text-xs text-muted-foreground mt-1">{msg.message}</p>}
                          </div>
                          <span className="text-xs font-black text-emerald-600 flex-shrink-0">+${Number(msg.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Supporters */}
              {topSupporters.length > 0 && (
                <Card className="border-none shadow-premium bg-card overflow-hidden">
                  <CardHeader className="p-6 pb-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <CardTitle className="text-sm font-black uppercase tracking-widest">Top Supporters</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-2 space-y-2">
                    {topSupporters.map((s, i) => (
                      <div key={s.sender_address + i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${
                            i === 0 ? "bg-amber-500/20 text-amber-600" :
                            i === 1 ? "bg-slate-400/20 text-slate-500 dark:text-slate-300" :
                            i === 2 ? "bg-orange-600/20 text-orange-700" :
                            "bg-muted-foreground/10 text-muted-foreground/60"
                          }`}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                          <span className="text-sm font-bold">{s.sender_username ? `@${s.sender_username}` : formatAddress(s.sender_address)}</span>
                        </div>
                        <span className="text-sm font-black">${Number(s.total_amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar - QR Code & Info */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-premium bg-card overflow-hidden">
                <CardHeader className="p-6 pb-3 text-center">
                  <QrCode className="h-6 w-6 text-primary mx-auto mb-2" />
                  <CardTitle className="text-sm font-black uppercase tracking-widest">Share Your Page</CardTitle>
                  <CardDescription className="text-[10px] font-bold text-muted-foreground/60">
                    {window.location.origin}/pay/{page.creator_username}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-2 space-y-4">
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-2xl shadow-sm">
                      <QRCode id="dash-qr-code" value={`${window.location.origin}/pay/${page.creator_username}`} size={160} level="H" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={handleCopyLink} variant="outline" className="h-10 rounded-xl text-[10px] font-black flex items-center gap-1.5">
                      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button onClick={downloadQR} variant="outline" className="h-10 rounded-xl text-[10px] font-black flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" /> QR Code
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full h-10 rounded-xl text-[10px] font-black flex items-center gap-1.5"
                    onClick={() => window.open(`/pay/${page.creator_username}`, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Preview Public Page
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-premium bg-primary text-white p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl opacity-50" />
                <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-4 relative z-10">Your Page</h3>
                <div className="space-y-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Gift className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black">{page.title}</p>
                      <p className="text-[10px] text-white/60 font-bold">@{page.creator_username}</p>
                    </div>
                  </div>
                  <Separator className="bg-white/10" />
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white/60">Total raised</span>
                    <span>${(page.raised_amount || 0).toLocaleString()} USDC</span>
                  </div>
                  {page.bronze_amount && (
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white/60">Bronze tier</span>
                      <span>${page.bronze_amount} USDC</span>
                    </div>
                  )}
                  {page.silver_amount && (
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white/60">Silver tier</span>
                      <span>${page.silver_amount} USDC</span>
                    </div>
                  )}
                  {page.gold_amount && (
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white/60">Gold tier</span>
                      <span>${page.gold_amount} USDC</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-card border border-border/30 rounded-3xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HandCoins className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Create Tips Page</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setShowCreateModal(false)} className="rounded-xl hover:bg-muted">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <form onSubmit={handleCreate} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Page Title</Label>
                    <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} className="h-12 rounded-xl bg-muted/30 border-none font-semibold" disabled={creating} />
                  </div>
                  <Separator />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Goal (Optional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Goal Title</Label>
                      <Input placeholder="e.g. New Camera Fund" value={createGoalTitle} onChange={(e) => setCreateGoalTitle(e.target.value)} className="h-11 rounded-xl bg-muted/30 border-none text-sm font-semibold" disabled={creating} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Amount ($)</Label>
                      <Input type="number" placeholder="1000" value={createGoalAmount} onChange={(e) => setCreateGoalAmount(e.target.value)} className="h-11 rounded-xl bg-muted/30 border-none text-sm font-semibold" disabled={creating} />
                    </div>
                  </div>
                  <Separator />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tip Tiers (Optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Bronze ($)</Label>
                      <Input type="number" placeholder="5" value={createBronze} onChange={(e) => setCreateBronze(e.target.value)} className="h-10 rounded-xl bg-muted/30 border-none text-xs font-semibold" disabled={creating} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Silver ($)</Label>
                      <Input type="number" placeholder="25" value={createSilver} onChange={(e) => setCreateSilver(e.target.value)} className="h-10 rounded-xl bg-muted/30 border-none text-xs font-semibold" disabled={creating} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Gold ($)</Label>
                      <Input type="number" placeholder="100" value={createGold} onChange={(e) => setCreateGold(e.target.value)} className="h-10 rounded-xl bg-muted/30 border-none text-xs font-semibold" disabled={creating} />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 font-semibold">
                    Your page will be live at <span className="font-mono font-bold">/pay/your-username</span>.
                    You can edit everything later.
                  </p>
                  <Button type="submit" disabled={creating || !createTitle.trim()} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider">
                    {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : "Create Tips Page"}
                  </Button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-card border border-border/30 rounded-3xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Tips Page Settings</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setShowSettingsModal(false)} className="rounded-xl hover:bg-muted">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Page Title</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-12 rounded-xl bg-muted/30 border-none font-semibold" />
                  </div>
                  <Separator />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Goal</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title</Label>
                      <Input placeholder="e.g. New Camera Fund" value={editGoalTitle} onChange={(e) => setEditGoalTitle(e.target.value)} className="h-11 rounded-xl bg-muted/30 border-none text-sm font-semibold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target ($)</Label>
                      <Input type="number" placeholder="1000" value={editGoalAmount} onChange={(e) => setEditGoalAmount(e.target.value)} className="h-11 rounded-xl bg-muted/30 border-none text-sm font-semibold" />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">Raised so far: <span className="font-bold text-foreground">${(page?.raised_amount || 0).toLocaleString()}</span></p>
                  <Separator />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tip Tiers</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Bronze ($)</Label>
                      <Input type="number" placeholder="5" value={editBronze} onChange={(e) => setEditBronze(e.target.value)} className="h-10 rounded-xl bg-muted/30 border-none text-xs font-semibold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Silver ($)</Label>
                      <Input type="number" placeholder="25" value={editSilver} onChange={(e) => setEditSilver(e.target.value)} className="h-10 rounded-xl bg-muted/30 border-none text-xs font-semibold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Gold ($)</Label>
                      <Input type="number" placeholder="100" value={editGold} onChange={(e) => setEditGold(e.target.value)} className="h-10 rounded-xl bg-muted/30 border-none text-xs font-semibold" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowSettingsModal(false)} className="flex-1 h-12 rounded-xl font-black uppercase tracking-wider text-xs">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider">
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
