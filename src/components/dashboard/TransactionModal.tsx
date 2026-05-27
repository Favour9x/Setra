"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowUpRight, ArrowDownLeft, Calendar, Tag, ShieldCheck, Download, Share2 } from "lucide-react";
import { Transaction } from "@/types";
import { Button } from "@/components/ui/button";
import { useNotify } from "@/components/ui/notification";
import { formatAddress } from "@/lib/utils";

interface TransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export function TransactionModal({ transaction, onClose }: TransactionModalProps) {
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
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
          className="relative w-full h-full sm:h-auto sm:max-w-md bg-card border-none sm:border shadow-premium rounded-none sm:rounded-3xl overflow-y-auto flex flex-col"
        >
          <div className="p-6 flex items-center justify-between border-b bg-muted/30 flex-shrink-0">
            <h3 className="font-bold text-foreground">Transaction Details</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-8 space-y-8 flex-1 overflow-y-auto">
            <div className="text-center space-y-3">
              <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl ${
                transaction.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
              }`}>
                {transaction.avatar || transaction.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="text-xl font-bold text-foreground">{formatAddress(transaction.name)}</h4>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">{transaction.category}</p>
              </div>
              <p className={`text-3xl font-black ${transaction.type === "income" ? "text-emerald-600" : "text-foreground"}`}>
                {transaction.type === "income" ? "+" : "-"}${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                transaction.status === "success" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${transaction.status === "success" ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`} />
                {transaction.status}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" /> Date & Time
                </span>
                <span className="text-foreground font-bold">
                  {new Date(transaction.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" /> Transaction ID
                </span>
                <span className="text-foreground font-mono text-[10px] font-bold opacity-60">
                  {transaction.id.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" /> Security
                </span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  Verified <ShieldCheck className="h-3 w-3" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <Button variant="outline" onClick={() => notify("Receipt downloaded")} className="h-11 rounded-xl font-bold flex items-center gap-2 hover:bg-muted group">
                <Download className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" /> Receipt
              </Button>
              <Button variant="outline" onClick={() => notify("Share link copied")} className="h-11 rounded-xl font-bold flex items-center gap-2 hover:bg-muted group">
                <Share2 className="h-4 w-4 group-hover:scale-110 transition-transform" /> Share
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
