"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AutomationWorkflow } from "@/lib/workflows/types";

interface WorkflowCardProps {
  workflow: AutomationWorkflow;
  onUpdate?: () => void;
  onDeleted?: (id: string) => void;
}

export function WorkflowCard({ workflow, onUpdate, onDeleted }: WorkflowCardProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this automation?")) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/workflows?id=${workflow.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete automation");
      }

      toast({
        title: "Success",
        description: "Automation deleted",
      });

      onDeleted?.(workflow.id);
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNextExecution = () => {
    if (!workflow.config.schedule?.next_execution_at) return null;
    
    const date = new Date(workflow.config.schedule.next_execution_at);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  const generateSummary = (): string => {
    const config = workflow.config || {};
    const type = workflow.workflow_type;

    if (type === "scheduled_payment" || type === "recurring_payment") {
      const amount = config.amount || "N/A";
      const recipient = config.recipient_address?.substring(0, 10) || "recipient";
      const frequency = config.schedule?.frequency || "once";
      return `Send ${amount} USDC to ${recipient}... ${frequency}`;
    }

    if (type === "split_revenue") {
      const percentage = config.percentage || "N/A";
      return `Split ${percentage}% of revenue automatically`;
    }

    if (type === "threshold_transfer") {
      const threshold = config.threshold_value || "N/A";
      return `Transfer when balance exceeds ${threshold} USDC`;
    }

    return workflow.intent_prompt?.substring(0, 50) || "Automated payment";
  };

  const getStatusColor = () => {
    switch (workflow.status as string) {
      case "active":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/25";
      case "completed":
        return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/25";
      case "paused":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/25";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/25";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/25";
    }
  };

  return (
    <Card className="border-none shadow-premium bg-card overflow-hidden hover:shadow-soft transition-all">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-base font-black text-foreground">{workflow.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 font-semibold">{generateSummary()}</p>
            </div>
            <Badge className={`rounded-xl border font-black text-[9px] uppercase px-3 py-1 ${getStatusColor()}`}>
              {workflow.status}
            </Badge>
          </div>

          {formatNextExecution() && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-bold">Next: {formatNextExecution()}</span>
            </div>
          )}

          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={loading}
              className="h-9 px-4 rounded-xl font-bold text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
