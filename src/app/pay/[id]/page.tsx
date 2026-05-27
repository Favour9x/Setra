"use client";

import React, { useEffect, useState, use } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Wallet, ArrowRight, DollarSign, User, Copy, Check, ShieldCheck } from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { useAuth } from "@/context/AuthContext";
import { useFinancial } from "@/context/FinancialContext";
import { motion } from "motion/react";
import { formatAddress } from "@/lib/utils";

interface PaymentLink {
  id: string;
  user_id: string;
  title: string;
  amount: number | null;
  currency: string;
  recipient_address: string;
  active: boolean;
  created_at: string;
}

export default function PublicPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { notify } = useNotify();
  const { user } = useAuth();
  
  // Safe invocation of useFinancial context (ignore if not logged in or throws)
  let walletId: string | null = null;
  let refreshData: (() => Promise<void>) | null = null;
  try {
    const fin = useFinancial();
    walletId = fin.walletId;
    refreshData = fin.refreshData;
  } catch (e) {
    // Ignore error if loaded without financial context / auth context active
  }
  
  const linkId = params.id as string;
  
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [copiedAddress, setCopiedAddress] = useState(false);

  useEffect(() => {
    const fetchLink = async () => {
      try {
        const res = await fetch(`/api/payment-links/${linkId}`);
        const data = await res.json();
        
        if (data.success && data.link) {
          setLink(data.link);
        } else {
          notify("Payment link not found");
        }
      } catch (err) {
        notify("Failed to load payment link");
      } finally {
        setLoading(false);
      }
    };

    if (linkId) {
      fetchLink();
    }
  }, [linkId, notify]);

  const handleCopyAddress = () => {
    if (link?.recipient_address) {
      navigator.clipboard.writeText(link.recipient_address);
      setCopiedAddress(true);
      notify("Recipient address copied!");
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleManualSent = async () => {
    if (!link) return;

    const amountToPay = link.amount || parseFloat(customAmount);

    if (!amountToPay || amountToPay <= 0) {
      notify("Please enter a valid amount");
      return;
    }

    if (!payerName.trim()) {
      notify("Please enter your name or wallet address to submit payment");
      return;
    }

    try {
      setPaying(true);
      const res = await fetch(`/api/payment-links/${linkId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountToPay,
          isManualAttempt: true,
          payerName: payerName.trim()
        })
      });

      const data = await res.json();

      if (data.success) {
        setPaymentSuccess(true);
        notify("Payment attempt logged successfully!");
        if (refreshData) {
          await refreshData();
        }
      } else {
        notify(data.error || "Failed to log payment attempt");
      }
    } catch (err: any) {
      notify("Failed to process payment claim");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="border-none shadow-premium bg-card max-w-md w-full">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-black text-foreground mb-2">Payment Link Not Found</h2>
            <p className="text-sm text-muted-foreground">This payment link may have been deactivated or does not exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!link.active) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="border-none shadow-premium bg-card max-w-md w-full">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-foreground mb-2">Link Inactive</h2>
            <p className="text-sm text-muted-foreground">This payment link is no longer accepting payments.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="border-none shadow-premium bg-card">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Payment Submitted!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your payment attempt has been logged. The merchant will verify it on the Arc Testnet.
              </p>
              
              <div className="p-4 rounded-xl bg-muted/40 mb-6 text-left space-y-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Receipt Summary</p>
                <div className="flex justify-between text-xs font-bold text-foreground">
                  <span>Merchant:</span>
                  <span className="font-mono">{formatAddress(link.recipient_address)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-foreground">
                  <span>Amount:</span>
                  <span>${link.amount || customAmount} USDC</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-foreground">
                  <span>Payer:</span>
                  <span>{payerName}</span>
                </div>
              </div>

              <Button
                onClick={() => router.push(user ? "/" : "/login")}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider"
              >
                {user ? "Go to Dashboard" : "Return to Setra Login"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 md:p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center mb-8 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-black text-xl">S</span>
          </div>
          <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase opacity-90">Setra</h2>
        </div>

        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardHeader className="p-8 pb-4 text-center border-b border-border/40">
            <CardTitle className="text-2xl font-black">{link.title}</CardTitle>
            <CardDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 mt-2">
              Payment Request
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 space-y-6">
            {link.amount ? (
              <div className="p-6 rounded-xl bg-primary/5 border-2 border-primary/20 text-center">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Amount</p>
                <p className="text-4xl font-black text-foreground">${link.amount.toLocaleString()}</p>
                <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-wider">{link.currency}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Enter Amount
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="h-14 pl-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 text-lg font-bold"
                  />
                </div>
              </div>
            )}

            {user && walletId ? (
              <Button
                onClick={async () => {
                  const amountToPay = link.amount || parseFloat(customAmount);
                  if (!amountToPay || amountToPay <= 0) {
                    notify("Please enter a valid amount");
                    return;
                  }
                  
                  try {
                    setPaying(true);
                    const res = await fetch(`/api/payment-links/${linkId}/pay`, {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ amount: amountToPay })
                    });

                    const data = await res.json();
                    if (data.success) {
                      setPaymentSuccess(true);
                      notify("Payment sent successfully!");
                      if (refreshData) await refreshData();
                    } else {
                      notify(data.error || "Payment failed");
                    }
                  } catch (err: any) {
                    notify("Failed to process payment");
                  } finally {
                    setPaying(false);
                  }
                }}
                disabled={paying || (!link.amount && !customAmount)}
                className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Pay with Setra
                  </>
                )}
              </Button>
            ) : (
              <>
                <div className="p-5 rounded-2xl bg-muted/30 border border-border/20 space-y-3">
                  <p className="text-xs font-bold text-foreground">Send {link.amount || customAmount || "[amount]"} USDC to this address:</p>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-card">
                    <p className="text-xs font-mono text-foreground font-bold flex-1 break-all">{link.recipient_address}</p>
                    <Button 
                      onClick={handleCopyAddress} 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-muted flex-shrink-0"
                    >
                      {copiedAddress ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Network: <span className="font-bold text-foreground">Arc Testnet</span></p>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="payerName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    Your Setra tag or wallet address
                  </Label>
                  <Input
                    id="payerName"
                    placeholder="e.g. @favour11 or 0x4B3c...98ef"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    disabled={paying}
                    className="h-12 px-4 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-bold"
                  />
                </div>

                <Button
                  onClick={handleManualSent}
                  disabled={paying || (!link.amount && !customAmount) || !payerName.trim()}
                  className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {paying ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      I Have Sent Payment
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/30 font-black uppercase tracking-[0.3em] text-[10px]">
          Powered by Setra
        </div>
      </motion.div>
    </div>
  );
}
