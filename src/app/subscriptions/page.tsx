"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Repeat, 
  Play, 
  Pause, 
  Trash2, 
  Calendar, 
  Loader2, 
  X, 
  DollarSign, 
  User, 
  FileText,
  RefreshCw
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { motion, AnimatePresence } from "motion/react";
import { formatAddress } from "@/lib/utils";
import { RecipientInput } from "@/components/ui/RecipientInput";

interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  recipient_address: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  status: "active" | "paused" | "cancelled";
  cancel_at_period_end: boolean;
  retry_count: number;
  start_date: string | null;
  next_billing_date: string;
  created_at: string;
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const hasTz = /[Z+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith("Z");
  const d = new Date(hasTz ? dateStr : dateStr + "Z");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function nextCycleDisplay(sub: Subscription): string {
  if (!sub.start_date || sub.next_billing_date !== sub.start_date) {
    return formatDateTime(sub.next_billing_date);
  }
  const d = new Date(sub.start_date);
  if (sub.frequency === "daily") d.setDate(d.getDate() + 1);
  else if (sub.frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (sub.frequency === "yearly") d.setDate(d.getDate() + 365);
  else d.setMonth(d.getMonth() + 1);
  return formatDateTime(d.toISOString());
}

export default function Page() {
  const { notify } = useNotify();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isValidRecipient, setIsValidRecipient] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [startDate, setStartDate] = useState("");

  const fetchUserSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/subscriptions", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setSubscriptions(data.subscriptions || []);
      } else {
        notify(data.error || "Failed to load subscriptions");
      }
    } catch (err: any) {
      notify("Error loading subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserSubscriptions();
  }, []);

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !amount || !recipientAddress || !frequency) {
      notify("Please fill out all subscription fields");
      return;
    }

    if (!isValidRecipient) {
      notify("Please provide a valid recipient username or wallet address");
      return;
    }

    if (parseFloat(amount) <= 0) {
      notify("Amount must be greater than zero");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/subscriptions", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          amount: parseFloat(amount),
          recipient_address: recipientAddress,
          frequency,
          currency: "USDC",
          start_date: startDate ? new Date(startDate).toISOString() : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        notify("Recurring subscription registered successfully");
        setShowCreateModal(false);
        // Reset form
        setName("");
        setAmount("");
        setRecipientAddress("");
        setFrequency("monthly");
        setStartDate("");
        // Re-hydrate
        await fetchUserSubscriptions();
        await refreshVolumes();
      } else {
        notify(data.error || "Failed to register subscription");
      }
    } catch (err: any) {
      notify("Failed to execute subscription creation");
    } finally {
      setCreating(false);
    }
  };

  const handleTriggerRenewal = async (id: string) => {
    try {
      setRenewingId(id);
      const res = await fetch(`/api/subscriptions/${id}/renew`, {
        credentials: "include",
        method: "POST"
      });

      const data = await res.json();
      if (data.success) {
        notify("Subscription renewed and settled successfully on Arc!");
        await fetchUserSubscriptions();
        await refreshVolumes();
      } else {
        notify(data.error || "Renewal settlement failed");
      }
    } catch (err: any) {
      notify("Renewal network error");
    } finally {
      setRenewingId(null);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: "active" | "paused" | "cancelled") => {
    try {
      setUpdatingStatusId(id);
      const res = await fetch(`/api/subscriptions/${id}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (data.success) {
        notify(`Subscription ${newStatus === "active" ? "resumed" : newStatus}`);
        await fetchUserSubscriptions();
        await refreshVolumes();
      } else {
        notify(data.error || "Status update failed");
      }
    } catch (err: any) {
      notify("Status update network error");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const activeSubscriptions = subscriptions.filter(s => s.status === "active");

  const [volumes, setVolumes] = useState({ daily: 0, weekly: 0, monthly: 0 });

  useEffect(() => {
    fetch("/api/subscriptions/volume", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.success) setVolumes(d.volumes); })
      .catch(() => {});
  }, []);

  const refreshVolumes = async () => {
    try {
      const r = await fetch("/api/subscriptions/volume", { credentials: "include" });
      const d = await r.json();
      if (d.success) setVolumes(d.volumes);
    } catch {}
  };

  return (
    <div className="space-y-10 pb-12 px-4 md:px-6 relative">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground uppercase leading-none">
            Subscriptions & <span className="text-primary italic">Recurrings</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg font-medium opacity-80 max-w-xl">Manage and track all your subscriptions and recurring payments in one place.</p>
        </div>
        <div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 font-black uppercase tracking-wider text-xs"
          >
            <Plus className="h-4 w-4" /> Add Subscription
          </Button>
        </div>
      </div>

      {/* Analytics widgets */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardContent className="p-5">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Plans</p>
            <h3 className="text-2xl font-black mt-2 text-foreground tracking-tight">{activeSubscriptions.length}</h3>
            <p className="text-[10px] text-muted-foreground/60 mt-1 font-bold">Billing cycle</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-sky-500/10 border-l-4 border-sky-500 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-[10px] font-black text-sky-700 uppercase tracking-widest">Daily Volume</p>
            <h3 className="text-2xl font-black mt-2 text-sky-900 tracking-tight">${volumes.daily.toLocaleString()} USDC</h3>
            <p className="text-[10px] text-sky-600/70 mt-1 font-bold">Subscription payments today</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-amber-500/10 border-l-4 border-amber-500 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Weekly Volume</p>
            <h3 className="text-2xl font-black mt-2 text-amber-900 tracking-tight">${volumes.weekly.toLocaleString()} USDC</h3>
            <p className="text-[10px] text-amber-600/70 mt-1 font-bold">Subscription payments this week</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-emerald-500/10 border-l-4 border-emerald-500 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Monthly Volume</p>
            <h3 className="text-2xl font-black mt-2 text-emerald-900 tracking-tight">${volumes.monthly.toLocaleString()} USDC</h3>
            <p className="text-[10px] text-emerald-600/70 mt-1 font-bold">Subscription payments this month</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-premium bg-card overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight">Recurring Ledger</CardTitle>
          <CardDescription className="text-muted-foreground/70 font-bold">Automated cycles list</CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm font-bold uppercase tracking-widest">Syncing schedules...</p>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                <Repeat className="h-16 w-16 mb-4 opacity-10" />
                <p className="text-sm font-black uppercase tracking-widest">No Subscriptions Found</p>
                <p className="text-xs mt-1 text-muted-foreground/60 max-w-xs leading-relaxed">Setup a new recurring subscription link to automate client billing logs.</p>
              </div>
            ) : (
              subscriptions.map((sub, i) => (
                <motion.div 
                  key={sub.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group p-5 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/10 hover:bg-muted/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-card shadow-soft flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                      <Repeat className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">{sub.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1">Recipient: {formatAddress(sub.recipient_address)}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          sub.status === "active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25" :
                          sub.status === "paused" ? "bg-amber-500/10 text-amber-500 border-amber-500/25" :
                          "bg-rose-500/10 text-rose-500 border-rose-500/25"
                        }`}>
                          {sub.status}
                        </span>
                        <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          {sub.frequency}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-bold">
                          Created: {formatDateTime(sub.created_at)}
                        </span>
                        {sub.start_date && (
                          <span className="text-[10px] text-muted-foreground/60 font-bold">
                            Starts: {formatDateTime(sub.start_date)}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/50 font-bold">
                          Next: {nextCycleDisplay(sub)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40">
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-black text-foreground">${sub.amount.toLocaleString()} USDC</p>
                      <p className="text-[9px] font-black text-muted-foreground/50 mt-1 uppercase tracking-widest">{sub.status}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.status === "active" && (
                        <>
                          <Button 
                            onClick={() => handleTriggerRenewal(sub.id)}
                            disabled={renewingId === sub.id || updatingStatusId === sub.id}
                            className="h-9 rounded-xl border border-border bg-card hover:bg-primary hover:text-white transition-all text-xs font-black px-4 uppercase tracking-wider"
                          >
                            {renewingId === sub.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1.5" /> Renew
                              </>
                            )}
                          </Button>
                          <Button 
                            onClick={() => handleUpdateStatus(sub.id, "paused")}
                            disabled={renewingId === sub.id || updatingStatusId === sub.id}
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-xl hover:bg-amber-500/10 hover:text-amber-600"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {sub.status === "paused" && (
                        <Button 
                          onClick={() => handleUpdateStatus(sub.id, "active")}
                          disabled={renewingId === sub.id || updatingStatusId === sub.id}
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-600"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {sub.status !== "cancelled" && (
                        <Button 
                          onClick={() => handleUpdateStatus(sub.id, "cancelled")}
                          disabled={renewingId === sub.id || updatingStatusId === sub.id}
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Creation Slider */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-2xl border-l border-border z-50 p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Repeat className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-black uppercase tracking-tight">Add Subscription</h3>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setShowCreateModal(false)} className="rounded-xl hover:bg-muted">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <form onSubmit={handleCreateSubscription} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="subName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Subscription Name</Label>
                  <div className="relative group">
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      id="subName"
                      placeholder="e.g. OpenAI Infrastructure Services"
                      className="pl-11 h-12 bg-muted/40 border-none rounded-xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-semibold"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subAmount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Billing Amount (USDC)</Label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      id="subAmount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-11 h-12 bg-muted/40 border-none rounded-xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-black text-sm"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subRecipient" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Recipient</Label>
                  <RecipientInput
                    value={recipientAddress}
                    onChange={setRecipientAddress}
                    onValidationChange={(isValid) => setIsValidRecipient(isValid)}
                    disabled={creating}
                    placeholder="Enter @username or 0x address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subFrequency" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Billing Cycle Frequency</Label>
                    <select 
                      id="subFrequency"
                      className="w-full h-12 bg-muted/40 border-none rounded-xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-semibold text-sm px-4 outline-none"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as any)}
                      disabled={creating}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subStartDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Start Date & Time (optional)</Label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="subStartDate"
                      type="datetime-local"
                      className="pl-11 h-12 bg-muted/40 border-none rounded-xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-semibold text-sm"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={creating}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1 ml-1">Leave empty to start immediately</p>
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Setting Up...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Issue Subscription
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
