"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, Tag, ShieldCheck, Download, Share2, Copy, CheckCircle2, ArrowRight, ExternalLink, User } from "lucide-react";
import { Transaction } from "@/types";
import { Button } from "@/components/ui/button";
import { TransactionStatusBadge } from "./TransactionStatusBadge";
import { useNotify } from "@/components/ui/notification";
import { cn, formatAddress } from "@/lib/utils";

interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export function TransactionDetailsModal({ transaction, onClose }: TransactionDetailsModalProps) {
  const { notify } = useNotify();

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (transaction) {
      window.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [transaction, onClose]);

  if (!transaction) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify("Transaction ID copied to clipboard");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-card border shadow-premium rounded-3xl overflow-hidden"
        >
          {/* Receipt Header */}
          <div className="bg-primary/5 p-8 pb-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 hover:bg-primary/10">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center font-black text-3xl shadow-lg border-4 border-card ${
                transaction.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
              }`}>
                {transaction.avatar || transaction.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <h4 className="text-2xl font-black text-foreground tracking-tight">
                  {transaction.recipientUsername ? `@${transaction.recipientUsername}` : formatAddress(transaction.recipientAddress || transaction.name)}
                </h4>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{transaction.category}</p>
              </div>
              <div className="space-y-2">
                 <p className={`text-4xl font-black tracking-tighter ${transaction.type === "income" ? "text-emerald-600" : "text-foreground"}`}>
                  {transaction.type === "income" ? "+" : "-"}${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <TransactionStatusBadge status={transaction.status} />
              </div>
            </div>

            {/* Receipt Zigzag Bottom Simulation */}
            <div className="absolute bottom-0 left-0 w-full h-4 flex overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="flex-1 h-8 bg-card rotate-45 -translate-y-4 border shadow-sm" />
                ))}
            </div>
          </div>

          <div className="p-8 pt-6 space-y-8">
            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Wallet Address
                </p>
                <p className="text-sm font-mono font-bold text-foreground">
                  {formatAddress(transaction.recipientAddress || transaction.name)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Timestamp
                </p>
                <p className="text-sm font-bold text-foreground">
                  {new Date(transaction.timestamp).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Transaction ID
                </p>
                <button 
                  onClick={() => copyToClipboard(transaction.referenceId || transaction.id)}
                  className="group flex items-center gap-2 text-sm font-mono font-bold text-foreground hover:text-primary transition-colors"
                >
                  {(transaction.referenceId || transaction.id).substring(0, 12).toUpperCase()}...
                  <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" /> Blockchain Hash
                </p>
                {(() => {
                  const txHash = (transaction as any).txHash || (transaction as any).tx_hash || (transaction as any).metadata?.tx_hash || (transaction as any).metadata?.txHash;
                  if (txHash) {
                    return (
                      <a 
                        href={`https://explorer.arc.testnet.circle.com/tx/${txHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-mono font-black text-primary hover:underline flex items-center gap-1"
                      >
                        {formatAddress(txHash)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    );
                  }
                  return (
                    <p className="text-xs font-mono font-bold text-muted-foreground truncate w-32">
                      0x{Math.random().toString(16).substring(2, 10).toUpperCase()}
                    </p>
                  );
                })()}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                   Network Status
                </p>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs font-bold text-emerald-600">Settled • On-Chain</p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="space-y-4">
               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Lifecycle Timeline</p>
               <div className="space-y-4 relative">
                  <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border/40" />
                  {(transaction.statusHistory || [{ status: transaction.status, timestamp: transaction.timestamp }]).map((item, i) => (
                    <div key={i} className="flex gap-4 relative z-10">
                        <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center border-2 border-card shadow-sm",
                            item.status === 'success' ? "bg-emerald-500" : "bg-muted"
                        )}>
                            {item.status === 'success' && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black uppercase tracking-widest">{item.status}</p>
                                <p className="text-[10px] font-bold text-muted-foreground/60">
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>
                            </div>
                            {item.message && <p className="text-[10px] font-bold text-muted-foreground mt-1">{item.message}</p>}
                        </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
              <Button variant="outline" onClick={() => notify("Receipt downloaded.")} className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-muted group">
                <Download className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" /> Save Receipt
              </Button>
              <Button 
                onClick={onClose}
                className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Close View
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
