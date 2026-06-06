"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Receipt, 
  Download, 
  Calendar, 
  X, 
  DollarSign, 
  Search,
  ArrowUpRight,
  Loader2
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { motion, AnimatePresence } from "motion/react";
import { formatAddress } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecipientInput } from "@/components/ui/RecipientInput";
import { useAuth } from "@/context/AuthContext";
import { useFinancial } from "@/context/FinancialContext";
import { createClient } from "@/lib/supabase-client";
import { useJsonFetch, getCachedData, setCachedData } from "@/hooks/useApiData";
import { InvoiceRowSkeleton, StatCardSkeleton } from "@/components/ui/PageSkeletons";

interface Invoice {
  id: string;
  user_id: string;
  type?: "sent" | "received";
  sender_id?: string;
  sender_username?: string;
  recipient_username?: string;
  title: string;
  amount: number;
  currency: string;
  recipient_address: string;
  due_date: string;
  status: "pending" | "paid" | "expired" | "awaiting_confirmation";
  created_at: string;
}

const INVOICES_CACHE_KEY = "invoices_data";

export default function InvoicesPage() {
  const { notify } = useNotify();
  const router = useRouter();
  const { user } = useAuth();
  const { walletAddress } = useFinancial();
  const [invoiceSubTab, setInvoiceSubTab] = useState<"sent" | "received">("sent");
  
  const [invoices, setInvoices] = useState<Invoice[]>(() => getCachedData<Invoice[]>(INVOICES_CACHE_KEY) || []);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isValidRecipient, setIsValidRecipient] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const savedTitle = localStorage.getItem("setra_draft_invoice_title");
    const savedAmount = localStorage.getItem("setra_draft_invoice_amount");
    const savedRecipient = localStorage.getItem("setra_draft_invoice_recipient");
    const savedEmail = localStorage.getItem("setra_draft_invoice_email");
    const savedDueDate = localStorage.getItem("setra_draft_invoice_due_date");

    if (savedTitle) setTitle(savedTitle);
    if (savedAmount) setAmount(savedAmount);
    if (savedRecipient) setRecipientAddress(savedRecipient);
    if (savedEmail) setRecipientEmail(savedEmail);
    if (savedDueDate) setDueDate(savedDueDate);
  }, []);

  useEffect(() => {
    if (title) localStorage.setItem("setra_draft_invoice_title", title);
    else localStorage.removeItem("setra_draft_invoice_title");
  }, [title]);

  useEffect(() => {
    if (amount) localStorage.setItem("setra_draft_invoice_amount", amount);
    else localStorage.removeItem("setra_draft_invoice_amount");
  }, [amount]);

  useEffect(() => {
    if (recipientAddress) localStorage.setItem("setra_draft_invoice_recipient", recipientAddress);
    else localStorage.removeItem("setra_draft_invoice_recipient");
  }, [recipientAddress]);

  useEffect(() => {
    if (recipientEmail) localStorage.setItem("setra_draft_invoice_email", recipientEmail);
    else localStorage.removeItem("setra_draft_invoice_email");
  }, [recipientEmail]);

  useEffect(() => {
    if (dueDate) localStorage.setItem("setra_draft_invoice_due_date", dueDate);
    else localStorage.removeItem("setra_draft_invoice_due_date");
  }, [dueDate]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "true" || params.get("create") === "true") {
        setShowCreateModal(true);
      }
    }
  }, []);

  const fetchUserInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const res = await fetch("/api/invoices", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
        setCachedData(INVOICES_CACHE_KEY, data.invoices || []);
      } else {
        notify(data.error || "Failed to load invoices");
      }
    } catch (err: any) {
      console.error("Invoice fetch error:", err);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    fetchUserInvoices();
  }, []);

  // Realtime subscription for invoice status changes
  useEffect(() => {
    let channel: any;
    try {
      const supabase = createClient();
      channel = supabase
        .channel("invoices-list-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "invoices",
            filter: `user_id=eq.${user?.id}`,
          },
          () => {
            fetchUserInvoices();
          }
        )
        .subscribe();
    } catch (err) {
      console.error("Failed to set up invoice realtime subscription:", err);
    }
    return () => {
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [user?.id]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !amount || !recipientAddress || !dueDate) {
      notify("Please fill out all invoice fields");
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
      const res = await fetch("/api/invoices", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amount: parseFloat(amount),
          recipient_address: recipientAddress,
          recipient_email: recipientEmail,
          due_date: new Date(dueDate).toISOString(),
          currency: "USDC"
        })
      });

      const data = await res.json();
      if (data.success && data.invoice) {
        notify("Invoice generated successfully");
        setShowCreateModal(false);
        setTitle("");
        setAmount("");
        setRecipientAddress("");
        setRecipientEmail("");
        setDueDate("");
        localStorage.removeItem("setra_draft_invoice_title");
        localStorage.removeItem("setra_draft_invoice_amount");
        localStorage.removeItem("setra_draft_invoice_recipient");
        localStorage.removeItem("setra_draft_invoice_email");
        localStorage.removeItem("setra_draft_invoice_due_date");
        router.push(`/invoices/${data.invoice.id}`);
      } else {
        notify(data.error || "Failed to create invoice");
      }
    } catch (err: any) {
      notify("Failed to execute invoice creation");
    } finally {
      setCreating(false);
    }
  };

  const sentInvoices = invoices.filter(inv => inv.type === "sent");
  const receivedInvoices = invoices.filter(inv => inv.type === "received");

  const targetInvoices = invoiceSubTab === "sent" ? sentInvoices : receivedInvoices;

  const filteredInvoices = targetInvoices.filter(inv => 
    inv.title.toLowerCase().includes(search.toLowerCase()) ||
    inv.recipient_address.toLowerCase().includes(search.toLowerCase()) ||
    inv.id.toLowerCase().includes(search.toLowerCase())
  );

  const pendingAmount = targetInvoices
    .filter(inv => inv.status === "pending")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const paidAmount = targetInvoices
    .filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="space-y-10 pb-12 px-4 md:px-6 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-secondary font-black text-[10px] uppercase tracking-[0.4em] mb-3">Billing Infrastructure</p>
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none">
            Invoices
          </h1>
          <p className="text-muted-foreground mt-3 text-lg font-medium opacity-80 max-w-xl">
            Send dynamic USDC invoices and track payment states on the ledger
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 font-black uppercase tracking-wider text-xs"
          >
            <Plus className="h-4 w-4" /> Create Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {invoiceSubTab === "sent" ? "Active Invoices" : "Received Invoices"}
            </p>
            <h3 className="text-3xl font-black mt-2 text-foreground tracking-tight">{filteredInvoices.length}</h3>
            <p className="text-xs text-muted-foreground/60 mt-1 font-bold">
              {invoiceSubTab === "sent" ? "Generated in current workspace" : "Awaiting your settlement"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-amber-500/10 overflow-hidden border-l-4 border-amber-500">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
              {invoiceSubTab === "sent" ? "Outstanding Receivables" : "Outstanding Payables"}
            </p>
            <h3 className="text-3xl font-black mt-2 text-amber-950 tracking-tight">${pendingAmount.toLocaleString()} USDC</h3>
            <p className="text-xs text-amber-600/70 mt-1 font-bold">
              {invoiceSubTab === "sent" ? "Awaiting client payment confirmation" : "Awaiting your transfer"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-emerald-500/10 overflow-hidden border-l-4 border-emerald-500">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
              {invoiceSubTab === "sent" ? "Settled Volume" : "Paid Volume"}
            </p>
            <h3 className="text-3xl font-black mt-2 text-emerald-950 tracking-tight">${paidAmount.toLocaleString()} USDC</h3>
            <p className="text-xs text-emerald-600/70 mt-1 font-bold">
              {invoiceSubTab === "sent" ? "Successfully finalized on chain" : "Paid to requesting merchants"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-border/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Ledger Invoices</CardTitle>
                  <CardDescription className="text-muted-foreground/70 font-bold font-mono">
                    Audit trails of user-mapped invoices
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-muted/50 p-1 rounded-xl items-center border border-muted-foreground/5 shadow-inner">
                    <button
                      onClick={() => setInvoiceSubTab("sent")}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        invoiceSubTab === "sent" 
                          ? "bg-card text-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Sent ({sentInvoices.length})
                    </button>
                    <button
                      onClick={() => setInvoiceSubTab("received")}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        invoiceSubTab === "received" 
                          ? "bg-card text-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Received ({receivedInvoices.length})
                    </button>
                  </div>
                  <div className="relative w-full md:w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search title" 
                      className="pl-9 h-10 bg-muted/40 border-none rounded-xl text-xs font-semibold focus-visible:ring-primary/20"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="mt-6 space-y-4">
                {loadingInvoices && invoices.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => <InvoiceRowSkeleton key={i} />)
                ) : filteredInvoices.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                    <Receipt className="h-16 w-16 mb-4 opacity-10" />
                    <p className="text-sm font-black uppercase tracking-widest">No Invoices Detected</p>
                    <p className="text-xs mt-1 text-muted-foreground/60 max-w-xs leading-relaxed">
                      {invoiceSubTab === "sent" 
                        ? "Create a new invoice to get started"
                        : "You have not received any invoice payment requests"}
                    </p>
                  </div>
                ) : (
                  filteredInvoices.map((inv, i) => (
                    <motion.div 
                      key={inv.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group p-5 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/10 hover:bg-muted/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                    >
                      <Link href={`/invoices/${inv.id}`} className="flex-1 flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-card shadow-soft flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{inv.title}</p>
                          {invoiceSubTab === "sent" ? (
                            <p className="text-[10px] font-mono text-muted-foreground mt-1">Recipient: {formatAddress(inv.recipient_address)}</p>
                          ) : (
                            <p className="text-[10px] font-mono text-muted-foreground mt-1">
                              Sender: {inv.sender_username ? `@${inv.sender_username}` : "Merchant"}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                              inv.status === "paid" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25" :
                              inv.status === "awaiting_confirmation" ? "bg-blue-500/10 text-blue-500 border-blue-500/25 animate-pulse" :
                              inv.status === "pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/25" :
                              "bg-rose-500/10 text-rose-500 border-rose-500/25"
                            }`}>
                              {inv.status.replace("_", " ")}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50 font-bold">
                              Created {new Date(inv.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40">
                        <div className="text-left sm:text-right">
                          <p className="text-lg font-black text-foreground">${inv.amount.toLocaleString()}</p>
                          <p className="text-[9px] font-black text-muted-foreground/50 mt-1 uppercase tracking-widest">Due {new Date(inv.due_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {inv.type === "received" && inv.status === "pending" && (
                            <Link href={`/invoices/${inv.id}`}>
                              <Button className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                Pay Now
                              </Button>
                            </Link>
                          )}
                          <Link href={`/invoices/${inv.id}`}>
                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary">
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-premium bg-card p-6">
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-4">Collection Rate</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <p className="text-xs font-bold text-muted-foreground uppercase opacity-60">Completion efficiency</p>
                <p className="text-sm font-black text-foreground">
                  {invoices.length > 0 
                    ? `${Math.round((invoices.filter(i => i.status === "paid").length / invoices.length) * 100)}%` 
                    : "0%"}
                </p>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ 
                    width: invoices.length > 0 
                      ? `${(invoices.filter(i => i.status === "paid").length / invoices.length) * 100}%` 
                      : "0%" 
                  }}
                  transition={{ duration: 1 }}
                  className="h-full bg-emerald-500 rounded-full" 
                />
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
                    <Receipt className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Create Invoice</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setShowCreateModal(false)} className="rounded-xl hover:bg-muted">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <form onSubmit={handleCreateInvoice} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Website Development"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-12 rounded-xl bg-muted/30 border-none font-semibold"
                      disabled={creating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (USDC)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-12 pl-11 rounded-xl bg-muted/30 border-none font-semibold"
                        disabled={creating}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recipient</Label>
                    <RecipientInput
                      value={recipientAddress}
                      onChange={setRecipientAddress}
                      onValidationChange={setIsValidRecipient}
                      disabled={creating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipientEmail" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recipient Email (Optional)</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      placeholder="client@example.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="h-12 rounded-xl bg-muted/30 border-none font-semibold"
                      disabled={creating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-12 rounded-xl bg-muted/30 border-none font-semibold"
                      disabled={creating}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={creating || !title || !amount || !recipientAddress || !dueDate || !isValidRecipient}
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                      </>
                    ) : (
                      "Create Invoice"
                    )}
                  </Button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
