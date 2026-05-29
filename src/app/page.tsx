"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Receipt, 
  Plus, 
  Send, 
  History, 
  Copy, 
  CheckCircle2 as CheckIcon, 
  RefreshCw,
  Settings as SettingsIcon,
  Bell,
  ArrowRight,
  QrCode,
  X,
  ScanLine,
  Download,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useFinancial } from "@/context/FinancialContext";
import { useAuth } from "@/context/AuthContext";
import { useNotificationCenter, getNotificationIcon } from "@/context/NotificationCenterContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/ui/notification";
import { formatAddress } from "@/lib/utils";
import { Transaction } from "@/types";
import { DashboardStatSkeleton, TransactionSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionDetailsModal } from "@/components/transactions/TransactionDetailsModal";
import { QRCode } from "react-qr-code";

export default function Page() {
  const { 
    balance, 
    transactions, 
    isLoaded, 
    profile, 
    username, 
    walletAddress, 
    refreshBalance,
    setSettingsOpen 
  } = useFinancial();
  const { user } = useAuth();
  const router = useRouter();
  const { notify } = useNotify();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationCenter();

  const [mounted, setMounted] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const [txFilter, setTxFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const panelRef = useRef<HTMLDivElement>(null);

  const userInitial = profile.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U";
  const userName = `${profile.firstName} ${profile.lastName}`.trim() || user?.email?.split("@")[0] || "User";

  // Mount check
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-fetch fresh balance on every page visit
  useEffect(() => {
    if (walletAddress && isLoaded) {
      refreshBalance();
    }
  }, [walletAddress, isLoaded]);

  // Close notifications dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      notify("Wallet address copied to clipboard");
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleRefreshBalance = async () => {
    setRefreshingBalance(true);
    await refreshBalance();
    setTimeout(() => setRefreshingBalance(false), 600);
  };

  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Custom Dashboard Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Welcome back, <span className="text-primary">{profile.firstName || user?.email?.split("@")[0] || "User"}</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Show My QR Code Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowMyQR(true)}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            title="Show my QR code"
          >
            <QrCode className="h-5 w-5" />
          </Button>

          {/* Scan QR Code Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/send')}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            title="Scan QR code"
          >
            <ScanLine className="h-5 w-5" />
          </Button>

          {/* Notifications Dropdown Container */}
          <div className="relative" ref={panelRef}>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setPanelOpen(!panelOpen)}
              className={`relative h-10 w-10 rounded-xl transition-all ${
                panelOpen 
                  ? "bg-muted text-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white border-2 border-background animate-in zoom-in duration-200">
                  {unreadCount}
                </span>
              )}
            </Button>

            <AnimatePresence>
              {panelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 md:w-96 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-premium p-4 z-50 text-left"
                >
                  {/* Dropdown Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <p className="text-sm font-black text-foreground">Notifications</p>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-[10px] font-bold text-primary hover:underline hover:opacity-80 transition-all cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Dropdown Content */}
                  <div className="mt-3 max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                          <Bell className="h-5 w-5 text-muted-foreground/60" />
                        </div>
                        <p className="text-xs font-black text-foreground">No notifications yet</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[200px]">We'll let you know when something important happens.</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id}
                          onClick={() => {
                            if (!n.read) markAsRead(n.id);
                            setPanelOpen(false);
                            
                            if (n.metadata?.link) {
                              router.push(n.metadata.link);
                            } else if (n.metadata?.invoice_id) {
                              router.push(`/invoices/${n.metadata.invoice_id}`);
                            } else if (n.type === "payment_received" || n.type === "payment_sent") {
                              router.push("/transactions");
                            } else if (n.type === "subscription_renewed") {
                              router.push("/subscriptions");
                            } else if (n.type === "workflow_executed") {
                              router.push("/workflows");
                            }
                          }}
                          className={`flex gap-3 p-3 rounded-xl hover:bg-muted/40 transition-all text-left cursor-pointer relative ${
                            n.read 
                              ? 'opacity-65 bg-transparent' 
                              : 'bg-muted/10 border border-border/20 shadow-sm'
                          }`}
                        >
                          {!n.read && (
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                          )}
                          
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center ${!n.read ? 'ml-2' : ''}`}>
                            {getNotificationIcon(n.type, "h-4 w-4")}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-foreground leading-tight">{n.title}</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1 leading-normal pr-1">{n.message}</p>
                            <p className="text-[8px] font-bold text-muted-foreground/50 mt-1.5 uppercase tracking-wider">
                              {formatTimeAgo(n.created_at)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSettingsOpen(true)}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
          
          <Separator orientation="vertical" className="h-8 mx-1 opacity-40 hidden sm:block" />
          
          <div 
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 cursor-pointer group pl-2"
          >
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black leading-none group-hover:text-primary transition-colors">
                {username ? `@${username}` : userName}
              </p>
              <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-wider opacity-60">Personal Account</p>
            </div>
            <Avatar className="h-9 w-9 border border-border group-hover:border-primary/30 transition-all shadow-sm">
              {profile.avatar && <AvatarImage src={profile.avatar} />}
              <AvatarFallback className="font-black text-xs">{userInitial}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* 2. Premium Centered Live Balance Section */}
      <div className="w-full max-w-xl mx-auto text-center py-4 sm:py-6 px-4">
        {!isLoaded ? (
          <DashboardStatSkeleton />
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Live Balance</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mt-2 text-foreground tracking-tighter flex items-center justify-center gap-2 flex-wrap">
                <span>{balance !== null ? `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}</span>
                <span className="text-xs sm:text-sm font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-lg">USDC</span>
              </h2>
            </div>

            {/* Wallet Address & Status Pill Row */}
            {walletAddress && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                {/* Network Badge */}
                <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Arc Testnet
                </div>

                {/* Wallet Address Pill */}
                <div className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 bg-muted/60 border border-border/20 rounded-full text-[9px] sm:text-[10px] font-mono font-bold text-foreground">
                  <Wallet className="h-3 w-3 text-muted-foreground" />
                  <span className="hidden xs:inline">{`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}</span>
                  <span className="xs:hidden">{`${walletAddress.substring(0, 4)}...${walletAddress.substring(walletAddress.length - 3)}`}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyWalletAddress}
                    className="h-5 w-5 rounded-md hover:bg-muted ml-0.5"
                    title="Copy Address"
                  >
                    {copiedAddress ? (
                      <CheckIcon className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>
                </div>

                {/* Sync Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshBalance}
                  disabled={refreshingBalance}
                  className="h-6 w-6 rounded-full hover:bg-muted/80"
                  title="Refresh Balance"
                >
                  <RefreshCw className={`h-3 w-3 text-primary ${refreshingBalance ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Side-by-Side Quick Action Buttons */}
      <div className="w-full max-w-xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={() => router.push('/send')}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider text-xs shadow-md shadow-primary/10 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 border-none"
          >
            <Send className="h-4.5 w-4.5" />
            Send
          </Button>
          <Button 
            onClick={() => router.push('/invoices?create=true')}
            variant="outline"
            className="flex-1 h-12 rounded-xl border-border bg-card text-foreground font-black uppercase tracking-wider text-xs shadow-sm hover:bg-muted hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="h-4.5 w-4.5 text-primary" />
            Invoice
          </Button>
        </div>
      </div>

      {/* 4. History Ledger Section */}
      <div className="max-w-2xl mx-auto pt-4">
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardHeader className="p-6 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                History
              </CardTitle>
              <Link href="/transactions">
                <Button variant="ghost" className="text-[10px] font-black text-primary group uppercase tracking-widest leading-none h-auto p-0 hover:bg-transparent">
                  View all <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
            {/* Filter Pills */}
            <div className="flex gap-2 mt-4">
              {(["ALL", "INCOME", "EXPENSE"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-all ${
                    txFilter === f
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f === "ALL" ? "All" : f === "INCOME" ? "Received" : "Sent"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {!isLoaded ? (
                Array.from({ length: 5 }).map((_, i) => <TransactionSkeleton key={i} />)
              ) : (() => {
                const filtered = txFilter === "ALL"
                  ? transactions
                  : transactions.filter(tx =>
                      txFilter === "INCOME" ? tx.type === "income" : tx.type === "expense"
                    );
                return filtered.length > 0 ? (
                  filtered.slice(0, 5).map((tx) => (
                    <div 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className="flex items-center justify-between p-5 hover:bg-muted/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-black text-foreground/40 group-hover:bg-primary/10 group-hover:text-primary transition-colors overflow-hidden flex-shrink-0">
                          {tx.avatar && (tx.avatar.startsWith("http") || tx.avatar.startsWith("data:image")) ? (
                            <img src={tx.avatar} alt="Avatar" className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            tx.avatar || tx.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground leading-tight group-hover:text-primary transition-colors truncate">
                            {tx.recipientUsername ? `@${tx.recipientUsername}` : formatAddress(tx.recipientAddress || tx.name)}
                          </p>
                          <p className="text-[10px] font-black text-muted-foreground/60 mt-1 uppercase tracking-[0.1em] flex items-center gap-1 flex-wrap">
                             {tx.recipientUsername && tx.recipientAddress && (
                               <span className="text-primary font-mono tracking-normal lowercase">{formatAddress(tx.recipientAddress)} •</span>
                             )}
                            {tx.category} • {new Date(tx.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className={`text-sm font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-foreground'}`}>
                          {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <div className="flex justify-end mt-1">
                          <div className={`h-1.5 w-1.5 rounded-full ${tx.status === 'success' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState 
                    icon={History}
                    title={txFilter === "INCOME" ? "No Received Payments" : txFilter === "EXPENSE" ? "No Sent Payments" : "No Transactions"}
                    description={txFilter === "INCOME" ? "Payments sent to you will appear here." : txFilter === "EXPENSE" ? "Your sent payments will appear here." : "Your financial footprint begins with your first payment."}
                  />
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      <TransactionDetailsModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />

      {/* My QR Code Modal */}
      <AnimatePresence>
        {showMyQR && walletAddress && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMyQR(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-card border border-border/30 rounded-3xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black uppercase tracking-tight">
                      Scan to pay {username ? `@${username}` : "me"}
                    </h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setShowMyQR(false)} className="rounded-xl hover:bg-muted">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="p-4 bg-white rounded-xl">
                    <QRCode 
                      id="dashboard-qr-code"
                      value={walletAddress} 
                      size={200}
                      level="H"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const svg = document.getElementById("dashboard-qr-code");
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
                        
                        const downloadLink = document.createElement("a");
                        downloadLink.download = "my-wallet-qr.png";
                        downloadLink.href = pngFile;
                        downloadLink.click();
                        
                        notify("QR code downloaded!");
                      };
                      
                      img.src = "data:image/svg+xml;base64," + btoa(svgData);
                    }}
                    variant="outline"
                    className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download QR
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
