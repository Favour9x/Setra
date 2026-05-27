"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Download, 
  X, 
  DollarSign, 
  Search,
  Loader2,
  Link2,
  Copy,
  CheckCircle2,
  HandCoins,
  Users,
  TrendingUp
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { motion, AnimatePresence } from "motion/react";
import { formatAddress } from "@/lib/utils";
import { RecipientInput } from "@/components/ui/RecipientInput";
import { useAuth } from "@/context/AuthContext";
import { useFinancial } from "@/context/FinancialContext";
import { QRCode } from "react-qr-code";

interface PaymentLinkType {
  id: string;
  user_id: string;
  title: string;
  amount: number | null;
  currency: string;
  recipient_address: string;
  active: boolean;
  created_at: string;
  history?: Array<{
    id: string;
    payer: string;
    amount: number;
    timestamp: string;
    status: string;
  }>;
}

export default function TipsPage() {
  const { notify } = useNotify();
  const { user } = useAuth();
  const { walletAddress } = useFinancial();
  
  const [links, setLinks] = useState<PaymentLinkType[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [latestCheckoutLink, setLatestCheckoutLink] = useState("");

  const [linkTitle, setLinkTitle] = useState("");
  const [linkAmount, setLinkAmount] = useState("");
  const [linkRecipientAddress, setLinkRecipientAddress] = useState("");
  const [isValidLinkRecipient, setIsValidLinkRecipient] = useState(false);
  const [search, setSearch] = useState("");
  const [totalReceived, setTotalReceived] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);

  const downloadQR = () => {
    const svg = document.getElementById("tips-qr-code");
    if (!svg || !walletAddress) return;
    
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
      downloadLink.download = "setra-wallet-qr.png";
      downloadLink.href = pngFile;
      downloadLink.click();
      
      notify("QR code downloaded!");
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const fetchUserLinks = async () => {
    try {
      setLoadingLinks(true);
      const res = await fetch("/api/payment-links", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setLinks(data.links || []);
      } else {
        notify(data.error || "Failed to load tips");
      }
    } catch (err: any) {
      notify("Network error fetching tips");
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    fetchUserLinks();
  }, []);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!linkTitle || !linkRecipientAddress) {
      notify("Please fill out title and recipient address");
      return;
    }

    if (!isValidLinkRecipient) {
      notify("Please provide a valid recipient username or wallet address");
      return;
    }

    if (linkAmount && parseFloat(linkAmount) <= 0) {
      notify("Amount must be greater than zero");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/payment-links", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: linkTitle,
          amount: linkAmount ? parseFloat(linkAmount) : null,
          recipient_address: linkRecipientAddress,
          currency: "USDC"
        })
      });

      const data = await res.json();
      if (data.success) {
        const shareableLink = `${window.location.origin}/pay/${data.link.id}`;
        setLatestCheckoutLink(shareableLink);
        setLinks((prev) => [{ ...data.link, history: [] }, ...prev.filter((link) => link.id !== data.link.id)]);
        notify("Tips link created successfully!");
        setLinkTitle("");
        setLinkAmount("");
        setLinkRecipientAddress("");
        await fetchUserLinks();
      } else {
        notify(data.error || "Failed to create tips link");
      }
    } catch (err: any) {
      notify("Failed to create tips link");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = (id: string) => {
    if (typeof window !== "undefined") {
      const shareableUrl = `${window.location.origin}/pay/${id}`;
      navigator.clipboard.writeText(shareableUrl);
      setCopiedLinkId(id);
      notify("Tips link copied!");
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  const handleCopyGeneratedLink = () => {
    if (!latestCheckoutLink) return;
    navigator.clipboard.writeText(latestCheckoutLink);
    notify("Tips link copied!");
  };

  const filteredLinks = links.filter(lk => 
    lk.title.toLowerCase().includes(search.toLowerCase()) ||
    lk.recipient_address.toLowerCase().includes(search.toLowerCase()) ||
    lk.id.toLowerCase().includes(search.toLowerCase())
  );

  // Fetch real stats from Supabase
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      try {
        const res = await fetch("/api/user/profile", { credentials: "include" });
        const { profile } = await res.json();
        
        if (!profile?.id) return;

        // Fetch total received amount
        const amountRes = await fetch(`/api/transactions?user_id=${profile.id}&type=income`, {
          credentials: "include"
        });
        const amountData = await amountRes.json();
        
        if (amountData.success && amountData.transactions) {
          const total = amountData.transactions
            .filter((t: any) => t.category === "Tips")
            .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
          setTotalReceived(total);
          setTotalPayments(amountData.transactions.filter((t: any) => t.category === "Tips").length);
        }
      } catch (err) {
        console.error("Failed to fetch tips stats:", err);
      }
    };

    fetchStats();
  }, [user, links]);

  const activeLinksCount = filteredLinks.filter(lk => lk.active).length;

  return (
    <div className="space-y-10 pb-12 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-secondary font-black text-[10px] uppercase tracking-[0.4em] mb-3">Payment Links</p>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground uppercase leading-none">
            Tips
          </h1>
          <p className="text-muted-foreground mt-3 text-lg font-medium opacity-80 max-w-xl">
            Shareable payment links for instant USDC settlement
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="w-full md:w-auto h-11 px-6 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-black uppercase tracking-wider text-xs"
          >
            <Plus className="h-4 w-4" /> Create Tips Link
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Links</p>
            <h3 className="text-3xl font-black mt-2 text-foreground tracking-tight">{activeLinksCount}</h3>
            <p className="text-xs text-muted-foreground/60 mt-1 font-bold">Accepting payments</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-emerald-500/10 overflow-hidden border-l-4 border-emerald-500">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Total Received</p>
            <h3 className="text-3xl font-black mt-2 text-emerald-950 tracking-tight">${totalReceived.toLocaleString()} USDC</h3>
            <p className="text-xs text-emerald-600/70 mt-1 font-bold">All-time tips volume</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-blue-500/10 overflow-hidden border-l-4 border-blue-500">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Total Payments</p>
            <h3 className="text-3xl font-black mt-2 text-blue-950 tracking-tight">{totalPayments}</h3>
            <p className="text-xs text-blue-600/70 mt-1 font-bold">Successful transactions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-border/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Active Tips Links</CardTitle>
                  <CardDescription className="text-muted-foreground/70 font-bold">Shareable links for instant USDC settlement</CardDescription>
                </div>
                <div className="relative w-full md:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search..." 
                    className="pl-9 h-10 bg-muted/40 border-none rounded-xl text-xs font-semibold focus-visible:ring-primary/20"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="mt-6 space-y-4">
                {loadingLinks ? (
                  <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-sm font-bold uppercase tracking-widest">Loading tips...</p>
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                    <HandCoins className="h-16 w-16 mb-4 opacity-10" />
                    <p className="text-sm font-black uppercase tracking-widest">No Tips Links</p>
                    <p className="text-xs mt-1 text-muted-foreground/60 max-w-xs leading-relaxed">
                      Create your first tips link to start accepting payments
                    </p>
                  </div>
                ) : (
                  filteredLinks.map((lk, i) => {
                    const linkTotal = (lk.history || []).reduce((s, h) => s + h.amount, 0);
                    const paymentCount = lk.history?.length || 0;
                    
                    return (
                      <motion.div 
                        key={lk.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group p-5 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/10 hover:bg-muted/40 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <HandCoins className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-foreground">{lk.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {lk.amount !== null ? `$${lk.amount.toLocaleString()} USDC` : "Custom Amount"}
                                </p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="p-3 rounded-xl bg-card">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Total Received</p>
                                <p className="text-lg font-black text-foreground mt-1">${linkTotal.toLocaleString()}</p>
                              </div>
                              <div className="p-3 rounded-xl bg-card">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Payments</p>
                                <p className="text-lg font-black text-foreground mt-1">{paymentCount}</p>
                              </div>
                            </div>

                            {lk.history && lk.history.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Recent Payments</p>
                                {lk.history.slice(0, 3).map((h, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-card/50">
                                    <span className="font-mono text-muted-foreground">{h.payer.length > 20 ? formatAddress(h.payer) : h.payer}</span>
                                    <span className="font-black text-foreground">${h.amount}</span>
                                    <span className="text-[10px] text-muted-foreground/60">{new Date(h.timestamp).toLocaleDateString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={() => handleCopyLink(lk.id)}
                            variant="outline"
                            className="h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2"
                          >
                            {copiedLinkId === lk.id ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy Link
                              </>
                            )}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-premium bg-card p-6">
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-4">Tips</h3>
            <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
              Tips links are reusable payment pages that accept instant stablecoin settlements. Share them with anyone to receive payments.
            </p>
          </Card>

          <Card className="border-none shadow-premium bg-primary text-white p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl opacity-50" />
            <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-4 relative z-10">Features</h3>
            <div className="space-y-3 relative z-10">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-semibold">Unlimited payments per link</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-semibold">Fixed or custom amounts</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-semibold">Payment history tracking</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowCreateModal(false); setLatestCheckoutLink(""); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-card border border-border/30 rounded-3xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
              >
                {latestCheckoutLink ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <h3 className="text-lg font-black uppercase tracking-tight">Tips Link Created!</h3>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { setShowCreateModal(false); setLatestCheckoutLink(""); }} className="rounded-xl hover:bg-muted">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/20">
                      <p className="text-xs font-bold text-muted-foreground mb-2">Shareable Link</p>
                      <p className="text-xs font-mono text-foreground break-all">{latestCheckoutLink}</p>
                    </div>
                    <Button onClick={handleCopyGeneratedLink} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black">
                      <Copy className="h-4 w-4 mr-2" /> Copy Link
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-black uppercase tracking-tight">Create Tips Link</h3>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { setShowCreateModal(false); setLatestCheckoutLink(""); }} className="rounded-xl hover:bg-muted">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <form onSubmit={handleCreateLink} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="linkTitle" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</Label>
                        <Input
                          id="linkTitle"
                          placeholder="e.g. Coffee Tips"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                          className="h-12 rounded-xl bg-muted/30 border-none font-semibold"
                          disabled={creating}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="linkAmount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (Optional)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="linkAmount"
                            type="number"
                            step="0.01"
                            placeholder="Leave empty for custom amount"
                            value={linkAmount}
                            onChange={(e) => setLinkAmount(e.target.value)}
                            className="h-12 pl-11 rounded-xl bg-muted/30 border-none font-semibold"
                            disabled={creating}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recipient</Label>
                        <RecipientInput
                          value={linkRecipientAddress}
                          onChange={setLinkRecipientAddress}
                          onValidationChange={setIsValidLinkRecipient}
                          disabled={creating}
                        />
                      </div>
                      <Button 
                        type="submit" 
                        disabled={creating || !linkTitle || !isValidLinkRecipient}
                        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                          </>
                        ) : (
                          "Create Tips Link"
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
