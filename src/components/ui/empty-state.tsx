"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, className, action }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center", className)}>
      <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-6">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-black text-foreground">{title}</h3>
      <p className="text-sm font-bold text-muted-foreground mt-2 max-w-[250px] mx-auto leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
