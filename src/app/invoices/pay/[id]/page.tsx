"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Receipt, 
  Calendar, 
  Wallet, 
  User, 
  Copy, 
  Check, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck, 
  Clock,
  ArrowLeft
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";

interface PublicInvoice {
  id: string;
  title: string;
  amount: number;
  currency: string;
  recipient_address: string;
  due_date: string;
  status: "pending" | "paid" | "expired" | "awaiting_confirmation";
  sender_handle: string;
  recipient_email?: string;
  payer_address?: string;
}

export default function PublicInvoicePayPage() {
  const params = useParams();
  const router = useRouter();
  const { notify } = useNotify();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Option B Form States
  const [payerAddress, setPayerAddress] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState(false);

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/invoices/pay?id=${invoiceId}`);
      const data = await res.json();

      if (data.success && data.invoice) {
        setInvoice(data.invoice);
        if (data.invoice.payer_address) {
          setPayerAddress(data.invoice.payer_address);
        }
      } else {
        setError(data.error || "Failed to load invoice details");
      }
    } catch (err) {
      console.error(err);
      setError("Network error loading public invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetails();
    }
  }, [invoiceId]);

  const handleCopyRecipientAddress = () => {
    if (invoice) {
      navigator.clipboard.writeText(invoice.recipient_address);
      setCopiedAddress(true);
      notify("Recipient wallet address copied to clipboard!");
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleCopyInvoiceId = () => {
    if (invoice) {
      navigator.clipboard.writeText(invoice.id);
      setCopiedInvoiceId(true);
      notify("Invoice ID copied to clipboard!");
      setTimeout(() => setCopiedInvoiceId(false), 2000);
    }
  };

  const handleSubmitPaymentClaim = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!payerAddress.trim()) {
      notify("Please enter the wallet address you sent the payment from");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(payerAddress.trim())) {
      notify("Please provide a valid Ethereum wallet address format (starting with 0x)");
      return;
    }

    try {
      setSubmittingClaim(true);
      const res = await fetch("/api/invoices/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invoiceId,
          payerAddress: payerAddress.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        notify("Payment claim submitted successfully!");
        // Re-hydrate details to show awaiting_confirmation status
        await fetchInvoiceDetails();
      } else {
        notify(data.error || "Failed to submit payment claim");
      }
    } catch (err) {
      notify("Network error submitting claim");
    } finally {
      setSubmittingClaim(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E11] text-foreground flex flex-col items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Syncing Invoice Ledger...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#0B0E11] text-foreground flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full border-none shadow-premium bg-card overflow-hidden text-center p-8">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4 opacity-85 animate-pulse" />
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">Invoice Undelivered</h2>
          <p className="text-muted-foreground mt-3 text-sm font-medium leading-relaxed">
            {error || "The requested invoice could not be found or has been revoked"}
          </p>
          <div className="mt-8">
            <Link href="/">
              <Button className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 mx-auto">
                <ArrowLeft className="h-4 w-4" /> Return to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isPaid = invoice.status === "paid";
  const isAwaiting = invoice.status === "awaiting_confirmation";
  const isPending = invoice.status === "pending";
  const isExpired = invoice.status === "expired";

  const formattedDueDate = new Date(invoice.due_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#0B0E11] text-foreground py-16 px-4 md:px-8 relative overflow-hidden flex items-center justify-center">
      {/* Background Micro Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-35" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl opacity-35" />

      <div className="max-w-4xl w-full grid gap-8 lg:grid-cols-12 relative z-10">
        {/* Left Side: Invoice details overview card */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-teal-500 to-emerald-500" />
            <CardHeader className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Smart Invoice</span>
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  isPaid ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" :
                  isAwaiting ? "bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse" :
                  isPending ? "bg-primary/15 text-primary border border-primary/30" :
                  "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                }`}>
                  {isPaid ? "Paid" : isAwaiting ? "Awaiting Confirmation" : isPending ? "Pending" : "Expired"}
                </span>
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-foreground uppercase leading-tight">
                {invoice.title}
              </CardTitle>
              <CardDescription className="text-muted-foreground font-semibold mt-2">
                Issued by <span className="text-primary italic font-bold">{invoice.sender_handle}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-6">
              <div className="p-5 rounded-2xl bg-muted/20 border border-border/25">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount Outstanding</p>
                <h3 className="text-3xl font-black text-emerald-500 mt-2 tracking-tight">
                  {invoice.amount.toLocaleString()} <span className="text-base text-foreground font-bold">USDC</span>
                </h3>
              </div>

              <div className="space-y-4 text-xs font-semibold text-muted-foreground/80">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Due Date</span>
                  <span className="text-foreground font-bold">{formattedDueDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> Invoice ID</span>
                  <button 
                    onClick={handleCopyInvoiceId}
                    className="text-foreground hover:text-primary flex items-center gap-1.5 font-mono bg-muted/30 px-2 py-0.5 rounded transition-colors text-[10px]"
                  >
                    {invoice.id.slice(0, 8)}... {copiedInvoiceId ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Secure Payout Info */}
          <Card className="border-none shadow-premium bg-card p-6 border-l-4 border-emerald-500 flex items-start gap-4">
            <ShieldCheck className="h-8 w-8 text-emerald-500 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-black uppercase tracking-tight text-foreground">Setra Secure Escrow</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed font-semibold">
                This transaction settles securely directly inside Circle Programmatic Developer Wallets. Once verified on-chain, completion is recorded permanently on the immutable ledger.
              </p>
            </div>
          </Card>
        </div>

        {/* Right Side: Payment Form & Options */}
        <div className="lg:col-span-7 space-y-6">
          {isPaid ? (
            <Card className="border-none shadow-premium bg-emerald-500/5 border border-emerald-500/10 p-8 text-center rounded-3xl">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-foreground uppercase tracking-tight">Invoice Fully Settled</h3>
              <p className="text-muted-foreground mt-2 text-sm font-medium max-w-md mx-auto leading-relaxed">
                Thank you! Payment of <span className="text-emerald-500 font-bold">${invoice.amount} USDC</span> has been detected and successfully verified on-chain.
              </p>
              {invoice.payer_address && (
                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/30 border border-border/20 text-xs text-muted-foreground font-mono">
                  <span className="font-bold text-foreground">Payer Address:</span>
                  <span>{invoice.payer_address.slice(0, 8)}...{invoice.payer_address.slice(-8)}</span>
                </div>
              )}
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Option A Card */}
              <Card className="border-none shadow-premium bg-gradient-to-r from-primary/5 via-card to-card hover:border-primary/10 transition-all p-6 rounded-2xl border border-border/25">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/25">Option A</span>
                      <h4 className="text-sm font-black uppercase tracking-tight text-foreground">Pay Instantly with Setra</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                      Complete payment with single-click ledger execution if you are an authenticated Setra account holder.
                    </p>
                  </div>
                  <Link href={`/login?redirect=/invoices/pay/${invoice.id}`} className="shrink-0">
                    <Button className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider text-xs hover:scale-[1.02] transition-all flex items-center gap-2">
                      Login to Pay <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>

              {/* Option B Card */}
              <Card className="border-none shadow-premium bg-card overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border/20">Option B</span>
                    <CardTitle className="text-base font-black uppercase tracking-tight">Manual Blockchain USDC Transfer</CardTitle>
                  </div>
                  <CardDescription className="text-muted-foreground/70 font-semibold mt-1">
                    Send USDC on-chain directly to the invoice recipient wallet address below.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  {/* Step 1: Copy details */}
                  <div className="space-y-3.5">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Step 1: Recipient Wallet Address</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-12 bg-muted/40 rounded-xl px-4 flex items-center text-xs font-mono text-foreground font-bold border border-border/10 overflow-x-auto whitespace-nowrap">
                        {invoice.recipient_address}
                      </div>
                      <Button 
                        size="icon" 
                        onClick={handleCopyRecipientAddress}
                        className="h-12 w-12 rounded-xl border border-border bg-card shadow-soft hover:bg-muted text-muted-foreground hover:text-primary transition-colors shrink-0"
                      >
                        {copiedAddress ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Step 2: Instructions */}
                  <div className="p-5 rounded-2xl bg-muted/20 border border-border/15 space-y-3">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Step 2: Transfer Guidelines</Label>
                    <ul className="space-y-2 text-[11px] text-muted-foreground leading-relaxed font-semibold list-decimal list-inside pl-1">
                      <li>Open your preferred Web3/Ethereum wallet (e.g. MetaMask, Phantom, Coinbase Wallet).</li>
                      <li>Initiate a transfer of exactly <span className="text-emerald-500 font-bold font-mono">${invoice.amount} USDC</span>.</li>
                      <li>Paste the Recipient Wallet Address from Step 1 above.</li>
                      <li>Submit the transaction and wait for on-chain execution.</li>
                    </ul>
                  </div>

                  {/* Step 3: Confirmation form */}
                  <form onSubmit={handleSubmitPaymentClaim} className="space-y-4 border-t border-border/20 pt-6">
                    <div className="space-y-2">
                      <Label htmlFor="payerAddress" className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">
                        Step 3: Confirm Transfer (Enter your Sender Wallet Address)
                      </Label>
                      <div className="relative group">
                        <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                          id="payerAddress"
                          placeholder="e.g. 0xYourWalletAddress"
                          className="pl-11 h-12 bg-muted/40 border-none rounded-xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-mono font-bold text-xs"
                          value={payerAddress}
                          onChange={(e) => setPayerAddress(e.target.value)}
                          disabled={submittingClaim || isAwaiting}
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className={`w-full h-12 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all ${
                        isAwaiting 
                          ? "bg-amber-500/20 text-amber-500 border border-amber-500/30 cursor-not-allowed hover:bg-amber-500/20" 
                          : "bg-emerald-500 text-white hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-emerald-500/10"
                      }`}
                      disabled={submittingClaim || isAwaiting}
                    >
                      {submittingClaim ? (
                        <>
                          <Loader2 className="h-4.5 w-4.5 animate-spin" /> Submitting Confirmation...
                        </>
                      ) : isAwaiting ? (
                        <>
                          <Clock className="h-4.5 w-4.5 animate-pulse text-amber-500" /> Awaiting Blockchain Verification
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4.5 w-4.5" /> I Have Sent the Payment
                        </>
                      )}
                    </Button>
                  </form>

                  {/* Warning banner if awaiting */}
                  <AnimatePresence>
                    {isAwaiting && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-500 flex items-start gap-3 mt-4"
                      >
                        <AlertCircle className="h-5 w-5 shrink-0 animate-bounce mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-tight leading-none">Awaiting Settlement Check</p>
                          <p className="text-[10px] opacity-80 leading-relaxed font-semibold">
                            You have claimed a manual payment from <span className="font-mono font-black">{invoice.payer_address}</span>. Setra's background Circle Agent will scan for the USDC arrival at the wallet address and automatically finalize this invoice to "paid" upon on-chain confirmation.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
