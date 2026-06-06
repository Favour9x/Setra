"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateWorkflowDialogProps {
  onWorkflowCreated?: () => void;
}

export function CreateWorkflowDialog({ onWorkflowCreated }: CreateWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [intent, setIntent] = useState("");
  const [workflowType, setWorkflowType] = useState<string>("scheduled_payment");

  const handleCreate = async () => {
    if (!intent.trim()) {
      toast({
        title: "Error",
        description: "Please describe your automation",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/workflows/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ intent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse intent");
      }

      // Determine final type/config:
      // - If parser returned custom_intent or low confidence, use dropdown type
      // - If parser has incomplete config (missing amount or recipient for payment types), force custom_intent
      let finalType = workflowType;
      let finalConfig = data.config || {};

      if (data.workflow_type && data.workflow_type !== "custom_intent" && (data.confidence || 0) >= 0.5) {
        const hasAmount = (finalConfig.amount || 0) > 0;
        const hasRecipient = !!finalConfig.recipient_address || !!finalConfig.recipient_name;
        const hasSplits = Array.isArray(finalConfig.splits) && finalConfig.splits.length > 0;
        const hasRecipients = Array.isArray(finalConfig.recipients) && finalConfig.recipients.length > 0;

        if (hasAmount || hasRecipient || hasSplits || hasRecipients || finalConfig.percentage) {
          finalType = data.workflow_type;
        } else {
          finalType = "custom_intent";
          finalConfig = { description: intent, plain_english: intent };
        }
      } else {
        finalType = "custom_intent";
        finalConfig = { description: intent, plain_english: intent };
      }

      const createResponse = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || intent.substring(0, 50),
          intent_prompt: intent,
          workflow_type: finalType,
          config: finalConfig,
        }),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        const details = createData.validation_errors?.length ? ": " + createData.validation_errors.join(", ") : "";
        throw new Error((createData.error || "Failed to save automation") + details);
      }

      toast({
        title: "Success",
        description: "Automation created successfully",
      });

      setIntent("");
      setWorkflowType("scheduled_payment");
      setOpen(false);
      onWorkflowCreated?.();
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 px-6 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 font-black uppercase tracking-wider text-xs">
          <Plus className="h-4 w-4" /> Create Automation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create Automation
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Textarea
              placeholder="Describe your payment rule in plain english"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="min-h-[150px] resize-none rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-semibold"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-bold">Example:</span> Pay 30 USDC to @favour11 @creator @chidrex21 for their salaries on the 30th of each month by 3pm
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Workflow Type</label>
            <Select value={workflowType} onValueChange={setWorkflowType} disabled={loading}>
              <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl"
              >
                <SelectItem value="scheduled_payment">Scheduled Payment</SelectItem>
                <SelectItem value="recurring_payment">Recurring Payment</SelectItem>
                <SelectItem value="split_revenue">Split Revenue</SelectItem>
                <SelectItem value="threshold_transfer">Threshold Transfer</SelectItem>
                <SelectItem value="savings_sweep">Savings Sweep</SelectItem>
                <SelectItem value="auto_invoice_pay">Auto Invoice Pay</SelectItem>
                <SelectItem value="conditional_transfer">Conditional Transfer</SelectItem>
                <SelectItem value="payroll_automation">Payroll Automation</SelectItem>
                <SelectItem value="subscription_payment">Subscription Payment</SelectItem>
                <SelectItem value="custom_intent">Custom Intent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading || !intent.trim()}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wider"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Automation"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
