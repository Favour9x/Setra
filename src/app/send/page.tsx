"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFinancial } from "@/context/FinancialContext";
import { useAuth } from "@/context/AuthContext";
import { useNotify } from "@/components/ui/notification";
import { Send, DollarSign, Loader2, ArrowLeft, CheckCircle2, QrCode, Camera, Download, X, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { RecipientInput } from "@/components/ui/RecipientInput";
import { QRCode } from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";
import { useSearchParams } from "next/navigation";

function SendPageContent() {
  const { refreshData, refreshBalance, walletAddress, balance, walletId } = useFinancial();
  const { user } = useAuth();
  const { notify } = useNotify();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [isValidRecipient, setIsValidRecipient] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Transfer");
  const [completed, setCompleted] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  // Load address from URL params
  useEffect(() => {
    const addressParam = searchParams.get('address');
    if (addressParam) {
      setRecipient(addressParam);
    }
  }, [searchParams]);

  // Load drafts on mount
  useEffect(() => {
    const savedRecipient = localStorage.getItem("setra_draft_recipient");
    const savedAmount = localStorage.getItem("setra_draft_amount");
    const savedCategory = localStorage.getItem("setra_draft_category");
    
    if (!searchParams.get('address') && savedRecipient) {
      setRecipient(savedRecipient);
    }
    if (savedAmount) setAmount(savedAmount);
    if (savedCategory) setCategory(savedCategory);
  }, [searchParams]);

  const handleRefreshBalance = async () => {
    setRefreshingBalance(true);
    await refreshBalance();
    setRefreshingBalance(false);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startQRScanner = async () => {
    if (!scannerDivRef.current) return;
    
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setRecipient(decodedText);
          stopQRScanner();
          notify("QR code scanned successfully!");
        },
        () => {}
      );
    } catch (err: any) {
      notify("Failed to start camera: " + err.message);
      setShowQRScanner(false);
    }
  };

  const stopQRScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {}
    }
    setShowQRScanner(false);
  };

  const downloadQR = () => {
    const svg = document.getElementById("my-qr-code");
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
      downloadLink.download = "setra-wallet-qr.png";
      downloadLink.href = pngFile;
      downloadLink.click();
      
      notify("QR code downloaded!");
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  // Save drafts on change
  useEffect(() => {
    if (recipient) localStorage.setItem("setra_draft_recipient", recipient);
    else localStorage.removeItem("setra_draft_recipient");
  }, [recipient]);

  useEffect(() => {
    if (amount) localStorage.setItem("setra_draft_amount", amount);
    else localStorage.removeItem("setra_draft_amount");
  }, [amount]);

  useEffect(() => {
    if (category) localStorage.setItem("setra_draft_category", category);
    else localStorage.removeItem("setra_draft_category");
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      notify("Please login to send payments");
      return;
    }

    if (!recipient || !isValidRecipient) {
      notify("Please provide a valid recipient username or wallet address");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      notify("Please provide a valid amount");
      return;
    }

    if (!walletId) {
      notify("No wallet found. Please create a wallet first.");
      return;
    }

    if (numAmount > (balance ?? 0)) {
      notify("Insufficient balance for this transaction");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/payments/send', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          toAddress: recipient,
          amount: amount,
          userId: user.id,
          category: category,
        }),
      });

      const result = await response.json();

      if (result.success) {
        notify(`Payment of $${numAmount.toLocaleString()} sent successfully`);
        setCompleted(true);
        setRecipient("");
        setAmount("");
        localStorage.removeItem("setra_draft_recipient");
        localStorage.removeItem("setra_draft_amount");
        await refreshData();
      } else {
        notify(result.error || "Payment failed");
      }
    } catch (error: any) {
      notify(error.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 px-4 md:px-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground text-pretty">Send Payment</h1>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              {completed ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground">Payment Sent!</h3>
                  <p className="text-muted-foreground mt-2">Your payment has been processed successfully.</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setCompleted(false)} 
                    className="mt-8 h-11 rounded-xl font-bold w-full md:w-auto"
                  >
                    Send Another
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6 mt-4">

                  <div className="space-y-2 p-1">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                      Recipient
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <RecipientInput
                          value={recipient}
                          onChange={setRecipient}
                          onValidationChange={(isValid) => setIsValidRecipient(isValid)}
                          disabled={loading}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setShowQRScanner(true);
                          setTimeout(() => startQRScanner(), 100);
                        }}
                        className="h-12 w-12 rounded-xl flex-shrink-0"
                        disabled={loading}
                      >
                        <Camera className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 p-1">
                    <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Amount</Label>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00" 
                        className="pl-11 h-12 bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-bold"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      className="w-full md:w-auto h-12 px-8 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" /> Confirm Payment
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>


        </div>

        <div className="lg:col-span-5 space-y-8">
          <Card className="border-none shadow-premium bg-primary text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <CardContent className="p-8 relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/60 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                  Arc Testnet Balance
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10">USDC</span>
                </p>
                <button
                  onClick={handleRefreshBalance}
                  disabled={refreshingBalance}
                  className="text-white/60 hover:text-white transition-colors p-1"
                  title="Refresh balance"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingBalance ? "animate-spin" : ""}`} />
                </button>
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight">
                ${(balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <div className="mt-12 flex justify-between items-center text-white/80">
                <div className="flex gap-2 items-center">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold">Default Currency</span>
                </div>
                <span className="text-sm font-bold opacity-60">USD</span>
              </div>
            </CardContent>
          </Card>

          {/* Your QR Code Section - Centered */}
          {walletAddress && (
            <Card className="border-none shadow-premium bg-card overflow-hidden">
              <CardHeader className="p-6 text-center">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  Your QR Code — Share to receive payments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-white rounded-xl">
                    <QRCode 
                      id="my-qr-code"
                      value={walletAddress} 
                      size={200}
                      level="H"
                    />
                  </div>
                  <Button
                    onClick={downloadQR}
                    variant="outline"
                    className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download QR Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showQRScanner && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={stopQRScanner}
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
                    <Camera className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Scan QR Code</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={stopQRScanner} className="rounded-xl hover:bg-muted">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div id="qr-reader" ref={scannerDivRef} className="w-full rounded-xl overflow-hidden"></div>
                <p className="text-xs text-muted-foreground text-center">
                  Position the QR code within the frame to scan
                </p>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SendPageContent />
    </Suspense>
  );
}
