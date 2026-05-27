"use client";

import React from "react";
import { TransactionStatus, TransactionType } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TransactionFiltersProps {
  statusFilter: TransactionStatus | "all";
  onStatusChange: (status: TransactionStatus | "all") => void;
  typeFilter: TransactionType | "all";
  onTypeChange: (type: TransactionType | "all") => void;
}

export function TransactionFilters({
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-6 p-6 border-b border-border/40 bg-muted/5">
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Flow Type</p>
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          {(["all", "income", "expense"] as const).map((type) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              onClick={() => onTypeChange(type)}
              className={cn(
                "h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                typeFilter === type ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status State</p>
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          {(["all", "success", "processing", "pending", "failed"] as const).map((status) => (
            <Button
              key={status}
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(status)}
              className={cn(
                "h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                statusFilter === status ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
