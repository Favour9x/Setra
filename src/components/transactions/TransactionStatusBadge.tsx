"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { TransactionStatus } from "@/types";
import { Clock, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  className?: string;
  showIcon?: boolean;
}

export function TransactionStatusBadge({ status, className, showIcon = true }: TransactionStatusBadgeProps) {
  const config: Record<TransactionStatus, { label: string; bg: string; text: string; icon: any; dot: string; animate?: string }> = {
    pending: {
      label: "Pending",
      bg: "bg-amber-500/10",
      text: "text-amber-600",
      icon: Clock,
      dot: "bg-amber-500"
    },
    processing: {
      label: "Processing",
      bg: "bg-blue-500/10",
      text: "text-blue-600",
      icon: RefreshCw,
      dot: "bg-blue-500",
      animate: "animate-spin"
    },
    success: {
      label: "Success",
      bg: "bg-emerald-500/10",
      text: "text-emerald-600",
      icon: CheckCircle2,
      dot: "bg-emerald-500"
    },
    failed: {
      label: "Failed",
      bg: "bg-rose-500/10",
      text: "text-rose-600",
      icon: XCircle,
      dot: "bg-rose-500"
    }
  };

  const { label, bg, text, icon: Icon, dot, animate } = config[status];

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all duration-300",
      bg,
      text,
      className
    )}>
      {showIcon && <Icon className={cn("h-3 w-3", animate)} />}
      <div className={cn("w-1 h-1 rounded-full", dot, !animate && "animate-pulse")} />
      {label}
    </div>
  );
}
