"use client";

import React, { useEffect, useState, use } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Receipt, Calendar, ArrowLeft, CheckCircle2, Clock, AlertTriangle,
  User, ExternalLink, Loader2, ShieldCheck, Wallet
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { formatAddress } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFinancial } from "@/context/FinancialContext";
import { useAuth } from "@/context/AuthContext";

interface Invoice {
  id: string;
  user_id: string;
  type?: "sent" | "received";
  sender_address?: string;
  title: string;
  amount: number;
  currency: string;
  recipient_address: string;
  due_date: string;
  status: "pending" | "paid" | "expired" | "awaiting_confirmation";
  created_at: string;
  sender_username?: string;
  payer_address?: string;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;
  const router = useRouter();
  const { notify } = useNotify();
  const { user } = useAuth();
  const { balance, refreshData } = useFinancial();
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/${invoiceId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success && data.invoice) {
        setInvoice(data.invoice);
      } else {
        setInvoice(null);
        notify(data.error || "Invoice not found");
      }
    } catch (err: any) {
      setInvoice(null);
      notify("Error fetching invoice details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoiceDetails(); }, [invoiceId]);

  const handlePayClick = () => {
    if (!invoice) return;
    if (balance === null) { notify("Balance is loading. Please wait a moment."); return; }
    if (balance < invoice.amount) { notify("Insufficient balance. You need " + invoice.amount + " USDC"); return; }
    setShowConfirmModal(true);
  };

  const handlePayInvoice = async () => {
    try {
      setPaying(true);
      setShowConfirmModal(false);
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        credentials: "include", method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        notify("Payment of $" + invoice?.amount + " USDC sent successfully!");
        await refreshData();
        await fetchInvoiceDetails();
      } else { notify(data.error || "Payment execution failed"); }
    } catch (err: any) { notify("Network error executing payment"); }
    finally { setPaying(false); }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
        <p className="text-sm font-black uppercase tracking-widest">Loading invoice data...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-muted-foreground space-y-4">
        <AlertTriangle className="h-12 w-12 text-rose-500 mb-2" />
        <p className="text-sm font-black uppercase tracking-widest">Invoice Not Found</p>
        <p className="text-xs text-muted-foreground/60">The requested invoice reference could not be located on the ledger.</p>
        <Link href="/invoices">
          <Button variant="outline" className="rounded-xl font-bold mt-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const isPaid = invoice.status === "paid";
  const isAwaiting = invoice.status === "awaiting_confirmation";
  const isExpired = invoice.status === "expired";
  const isPending = invoice.status === "pending";
  const isCreator = invoice.type === "sent" || (!invoice.type && user?.id === invoice.user_id);
  const isRecipient = invoice.type === "received";

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 px-4 md:px-6">
      <div>
        <Link href="/invoices" className="inline-flex items-center text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Ledger
        </Link>
      </div>

      <div className="grid gap-8 md:grid-cols-12">
        <div className="md:col-span-8">
          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-border/40">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-tight">Invoice Receipt</h2>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Ref: {invoice.id.substring(0, 13)}</p>
                  </div>
                </div>
                <div>
                  <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border ${
                    isPaid ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25" :
                    isAwaiting ? "bg-blue-500/10 text-blue-500 border-blue-500/25 animate-pulse" :
                    isPending ? "bg-amber-500/10 text-amber-500 border-amber-500/25" :
                    "bg-rose-500/10 text-rose-500 border-rose-500/25"
                  }`}>
                    {invoice.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Billed For</p>
                <h3 className="text-xl font-black text-foreground mt-2">{invoice.title}</h3>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border/40">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Created</p>
                  <div className="flex items-center gap-2 mt-2 text-foreground font-black text-xs">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {new Date(invoice.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due Date</p>
                  <div className="flex items-center gap-2 mt-2 text-foreground font-black text-xs">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {new Date(invoice.due_date).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (USDC)</p>
                <p className="text-2xl font-black text-foreground mt-2">{invoice.amount.toLocaleString()} USDC</p>
              </div>

              <div className="pt-6 border-t border-border/40 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">USDC Settlement Route</p>
                <div className="p-4 rounded-xl bg-muted/20 border border-muted-foreground/10 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-muted-foreground">Network</span>
                    <span className="font-black text-foreground">Arc Testnet (Chain 4653)</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-muted-foreground">{isRecipient ? "Sender" : "Recipient"}</span>
                    <span className="font-mono text-foreground">
                      {isRecipient && invoice.sender_address
                        ? formatAddress(invoice.sender_address)
                        : formatAddress(invoice.recipient_address)}
                    </span>
                  </div>
                  {isRecipient && invoice.sender_username && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-muted-foreground">From</span>
                      <span className="font-bold text-primary">@{invoice.sender_username}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4 space-y-6">
          <Card className="border-none shadow-premium bg-card p-6 text-center space-y-6">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Settlement</h3>
            {!isCreator && !isPaid && !isExpired && (
              <div className="py-3 px-4 rounded-2xl bg-muted/20 border border-border/10 text-left flex items-start gap-3">
                <Wallet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">USDC Balance</span>
                  <p className="text-sm font-black text-foreground">
                    {balance !== null ? balance.toLocaleString() : "Loading..."} USDC
                  </p>
                </div>
              </div>
            )}
            {isCreator ? (() => {
              if (isPaid) {
                return (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mb-2">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">Invoice Settled</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Funds settled to your wallet</p>
                    </div>
                    {invoice.payer_address && (
                      <div className="text-[9px] font-mono text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg">
                        Paid by: {formatAddress(invoice.payer_address)}
                      </div>
                    )}
                  </div>
                );
              } else if (isAwaiting) {
                return (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center mb-2 animate-pulse">
                      <Clock className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">Awaiting Confirmation</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Payer has submitted a manual tx check</p>
                    </div>
                  </div>
                );
              } else if (isExpired) {
                return (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mb-2">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">Invoice Expired</p>
                      <p className="text-[10px] text-muted-foreground mt-1">This billing is no longer open</p>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mb-2">
                      <Clock className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">Invoice Sent</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Awaiting payment from recipient</p>
                    </div>
                  </div>
                );
              }
            })() : (() => {
              if (isPaid) {
                return (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mb-2">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">Invoice Settled</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Paid on-chain via Setra secure checkout</p>
                    </div>
                    {invoice.payer_address && (
                      <div className="text-[9px] font-mono text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg">
                        Payer: {formatAddress(invoice.payer_address)}
                      </div>
                    )}
                  </div>
                );
              } else if (isAwaiting) {
                return (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center mb-2 animate-pulse">
                      <Clock className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">Claim Awaiting Check</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Payer has submitted a manual tx check</p>
                    </div>
                  </div>
                );
              } else if (isExpired) {
                return (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mb-2">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">Invoice Expired</p>
                      <p className="text-[10px] text-muted-foreground mt-1">This billing is no longer open</p>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mb-2">
                      <Clock className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">Payment Due</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{invoice.amount.toLocaleString()} USDC owed to @{invoice.sender_username || "sender"}</p>
                    </div>
                    <div className="pt-2 w-full">
                      <Button onClick={handlePayClick} disabled={paying}
                        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        {paying ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Settling...</>
                        ) : "Pay Now"}
                      </Button>
                    </div>
                  </div>
                );
              }
            })()}
          </Card>

          <Card className="border-none shadow-premium bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Safe Checkout</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              This invoice uses Setra&apos;s Sandbox environment. Transfers are executed securely on the Arc Testnet.
            </p>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showConfirmModal && invoice && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-card border border-border/30 rounded-3xl p-8 shadow-2xl space-y-6"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Receipt className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Confirm Payment</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                    Pay <span className="text-emerald-500 font-bold font-mono">{invoice.amount} USDC</span> to <span className="text-primary font-bold">@{invoice.sender_username || "sender"}</span>? This will be deducted from your wallet.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowConfirmModal(false)}
                    className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-wider">Cancel</Button>
                  <Button onClick={handlePayInvoice}
                    className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Confirm Pay</Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
