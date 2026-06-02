"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Bot, 
  Cpu, 
  Play, 
  Pause, 
  Trash2,
  ChevronRight, 
  Loader2, 
  RefreshCw, 
  Terminal,
  Activity,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Receipt,
  PiggyBank,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { motion, AnimatePresence } from "motion/react";
import { formatAddress } from "@/lib/utils";

interface WorkflowLog {
  id?: string;
  created_at: string;
  log_level: string;
  message: string;
  details?: any;
}

interface WorkflowExecution {
  id: string;
  status: "pending" | "running" | "success" | "failed";
  tx_hash?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

interface IntentWorkflow {
  id: string;
  user_id: string;
  name: string;
  intent_prompt: string;
  workflow_type: string;
  status: string;
  config: any;
  active: boolean;
  created_at: string;
  updated_at: string;
  schedules?: any[];
  triggers?: any[];
  executions?: WorkflowExecution[];
  logs?: WorkflowLog[];
}

export default function Page() {
  const { notify } = useNotify();
  const [workflows, setWorkflows] = useState<IntentWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [parsing, setParsing] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<IntentWorkflow | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const fetchUserWorkflows = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/workflows", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        const list = data.workflows || [];
        setWorkflows(list);
        if (list.length > 0) {
          // Keep selection if exists, else select first
          setSelectedWorkflow(prev => list.find((w: any) => w.id === prev?.id) || list[0]);
        } else {
          setSelectedWorkflow(null);
        }
      } else {
        notify(data.error || "Failed to load workflows", "error");
      }
    } catch (err: any) {
      notify("Error loading workflow rules", "error");
    } finally {
      setLoading(false);
    }
  };

  const checkSubscription = async () => {
    try {
      const res = await fetch("/api/user/profile", { credentials: "include" });
      const data = await res.json();
      if (data.success && data.profile) {
        const isPro = data.profile.is_pro === true;
        setSubscriptionTier(isPro ? "pro" : "free");
        if (!isPro) {
          setShowUpgradePrompt(true);
        }
      }
    } catch (err) {
      console.error("Failed to check subscription:", err);
    }
  };

  useEffect(() => {
    fetchUserWorkflows();
    checkSubscription();
  }, []);



  const generateSummary = (workflow: IntentWorkflow): string => {
    const config = workflow.config || {};
    const type = workflow.workflow_type;

    if (type === "scheduled_payment" || type === "recurring_payment") {
      return `${config.amount || 0} ${config.token || "USDC"} to ${config.recipient_name || config.recipient_address || "recipient"}`;
    }
    if (type === "savings_sweep") {
      return `Save ${config.percentage || 15}% of incoming payments to ${config.recipient_name || "savings wallet"}`;
    }
    if (type === "threshold_transfer") {
      const comparison = config.trigger?.conditions?.comparison || "greater_than";
      return `Transfer ${config.amount || 0} ${config.token || "USDC"} when balance ${comparison === "greater_than" ? "exceeds" : "falls below"} ${config.threshold_value || 0}`;
    }
    if (type === "split_revenue") {
      const splits = config.splits || [];
      return `Split revenue across ${splits.length} recipient${splits.length === 1 ? "" : "s"}`;
    }
    if (type === "payroll_automation") {
      const recipients = config.recipients || [];
      return `Pay ${recipients.length} team member${recipients.length === 1 ? "" : "s"} ${config.schedule?.frequency || "monthly"}`;
    }
    if (type === "subscription_payment") {
      return `${config.amount || 0} ${config.token || "USDC"} subscription to ${config.recipient_name || "service"}`;
    }
    if (type === "auto_invoice_pay") {
      return `Auto-pay pending invoices up to ${config.max_amount_per_invoice || 1000} ${config.token || "USDC"}`;
    }

    return config.plain_english || config.description || "Custom automation workflow";
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows?id=${id}`, {
        credentials: "include",
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        notify("Workflow deleted");
        setWorkflows(prev => prev.filter(w => w.id !== id));
        if (selectedWorkflow?.id === id) {
          setSelectedWorkflow(null);
        }
      } else {
        notify(data.error || "Failed to delete workflow", "error");
      }
    } catch (err) {
      notify("Delete network error", "error");
    }
  };

  const handleAgentPromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      notify("Please enter a payment intent", "error");
      return;
    }

    try {
      setParsing(true);

      if (!parsedPreview || previewPrompt !== prompt) {
        const parseRes = await fetch("/api/workflows/parse", {
          credentials: "include",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: prompt })
        });
        const parsed = await parseRes.json();
        if (!parseRes.ok || !parsed.success) {
          notify(parsed.error || "Failed to parse intent instructions", "error");
          return;
        }
        setParsedPreview(parsed);
        setPreviewPrompt(prompt);
        notify("Review the parsed intent, then confirm it");
        return;
      }

      const res = await fetch("/api/workflows/agent", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();
      if (data.success) {
        notify(data.message || "Intent automation compiled!");
        setPrompt("");
        setParsedPreview(null);
        setPreviewPrompt("");
        await fetchUserWorkflows();
      } else {
        notify(data.message || "Failed to parse intent instructions", "error");
      }
    } catch (err: any) {
      notify("Agent parser error", "error");
    } finally {
      setParsing(false);
    }
  };

  const getWorkflowBadgeColor = (type: string) => {
    switch (type) {
      case "savings_sweep": return "bg-pink-500/10 text-pink-400 border border-pink-500/20";
      case "threshold_transfer": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "auto_invoice_pay": return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
      case "split_revenue": return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      case "scheduled_payment":
      case "recurring_payment": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      default: return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
    }
  };

  const getWorkflowIcon = (type: string) => {
    switch (type) {
      case "savings_sweep": return <PiggyBank className="h-4 w-4" />;
      case "threshold_transfer": return <TrendingUp className="h-4 w-4" />;
      case "auto_invoice_pay": return <Receipt className="h-4 w-4" />;
      case "split_revenue": return <Layers className="h-4 w-4" />;
      case "recurring_payment": return <RefreshCw className="h-4 w-4" />;
      case "scheduled_payment": return <Calendar className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* Header section */}
      <div>
        <p className="text-primary font-black text-xs uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
          <Activity className="h-3 w-3 text-primary animate-pulse" /> INTENT-BASED CASH OPS
        </p>
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white uppercase leading-none">
          Programmable <span className="text-primary italic">Money Engine</span>
        </h1>
        <p className="text-muted-foreground/80 mt-2 text-md max-w-2xl font-medium">
          Deploy AI-driven automation workflows with natural language instructions. Set schedules, revenue sweeps, triggers, and splits instantly.
        </p>
      </div>

      {/* Spawning input */}
      <Card className="border-none shadow-xl bg-[#0b0c16] border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest bg-primary/10 px-3 py-1 rounded-full w-fit">
            <Sparkles className="h-3 w-3" /> Spawn New Intent
          </div>

          <form onSubmit={handleAgentPromptSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intent" className="text-xs font-bold text-zinc-400">
                Describe your payment rule in plain English
              </Label>
              <textarea
                id="intent"
                placeholder="Example: Pay 30 USDC to @favour11 @creator @chidrex21 for their salaries on the 30th of each month by 3pm"
                className="w-full min-h-[150px] p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-sm font-medium text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-y transition-all"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (parsedPreview && e.target.value !== previewPrompt) {
                    setParsedPreview(null);
                    setPreviewPrompt("");
                  }
                }}
                disabled={parsing}
              />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Include the amount, recipient username or wallet address, purpose, and when you want it to execute.
              </p>
            </div>

            {parsedPreview && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Parsed Payment Intent</p>
                  <span className="text-[10px] font-black text-zinc-400 uppercase">{parsedPreview.workflow_type?.replace(/_/g, " ")}</span>
                </div>
                <p className="text-sm text-white font-semibold">{parsedPreview.plain_english || parsedPreview.config?.plain_english}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-bold text-zinc-400">
                  <span>Recipient: {parsedPreview.config?.recipient_name || parsedPreview.config?.recipient_address || "Not set"}</span>
                  <span>Amount: {parsedPreview.config?.amount || "-"} {parsedPreview.config?.token || "USDC"}</span>
                  <span>Schedule: {parsedPreview.config?.schedule?.frequency || "triggered"}</span>
                  <span>Starts: {parsedPreview.config?.schedule?.next_execution_at ? new Date(parsedPreview.config.schedule.next_execution_at).toLocaleString() : "On trigger"}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 w-full md:w-auto">
              <Button
                type="submit"
                disabled={parsing}
                className="w-full md:w-auto h-11 px-8 rounded-xl bg-primary text-black font-extrabold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" /> Compiling Intent...
                  </>
                ) : (
                  <>
                    <Bot className="h-4.5 w-4.5" /> {parsedPreview && previewPrompt === prompt ? "Confirm Intent" : "Review Intent"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column - list */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
            <h2 className="text-lg font-black uppercase text-white tracking-tight flex items-center gap-2">
              <Cpu className="h-4.5 w-4.5 text-primary" /> Active Automation Engine Rules
            </h2>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400" onClick={fetchUserWorkflows}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-xs font-bold uppercase tracking-widest">Hydrating state...</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="py-20 border border-dashed border-zinc-800 rounded-3xl text-center flex flex-col items-center justify-center text-zinc-500">
              <Cpu className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-xs font-black uppercase tracking-widest">No Active Workflows</p>
              <p className="text-[11px] mt-1 text-zinc-600">Type or click a template above to generate automation rules.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((wf) => {
                const getStatusBadge = () => {
                  if (wf.status === "completed") return { bg: "bg-zinc-500/10", text: "text-zinc-400", label: "Completed" };
                  if (wf.status === "failed") return { bg: "bg-rose-500/10", text: "text-rose-500", label: "Failed" };
                  if (!wf.active) return { bg: "bg-amber-500/10", text: "text-amber-500", label: "Paused" };
                  return { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Active" };
                };
                
                const statusBadge = getStatusBadge();
                const nextExecution = wf.config?.schedule?.next_execution_at;
                const summary = generateSummary(wf);
                
                return (
                  <div
                    key={wf.id}
                    onClick={() => setSelectedWorkflow(wf)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      selectedWorkflow?.id === wf.id
                        ? "bg-zinc-900/60 border-primary/40"
                        : "bg-[#0b0c16]/30 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-white">{wf.name}</h3>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 font-medium">{summary}</p>
                        {nextExecution && wf.active && wf.status !== "completed" && (
                          <p className="text-[10px] text-zinc-500 font-bold">
                            Next: {new Date(nextExecution).toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric', 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteWorkflow(wf.id)}
                          className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column - details / logs terminal */}
        <div className="lg:col-span-5">
          <AnimatePresence mode="wait">
            {selectedWorkflow ? (
              <motion.div
                key={selectedWorkflow.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                {/* Parameter Details */}
                <Card className="border-none bg-zinc-950/60 border border-zinc-900 p-6 rounded-3xl space-y-4">
                  <div>
                    <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${getWorkflowBadgeColor(selectedWorkflow.workflow_type)}`}>
                      {selectedWorkflow.workflow_type.replace("_", " ")}
                    </span>
                    <h3 className="text-md font-black text-white mt-2 uppercase">{selectedWorkflow.name}</h3>
                    <p className="text-[10px] text-zinc-500 mt-1 font-bold">Created at {new Date(selectedWorkflow.created_at).toLocaleString()}</p>
                  </div>

                  <div className="border-t border-zinc-900 pt-4 space-y-3 text-xs font-semibold">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Intent Prompt</span>
                      <span className="text-white text-right font-medium italic">"{selectedWorkflow.intent_prompt}"</span>
                    </div>

                    {selectedWorkflow.config?.recipient_address && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Recipient Address</span>
                        <span className="text-white font-mono">{formatAddress(selectedWorkflow.config.recipient_address)}</span>
                      </div>
                    )}

                    {selectedWorkflow.config?.amount && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Transfer Amount</span>
                        <span className="text-primary font-bold">{selectedWorkflow.config.amount} {selectedWorkflow.config.token || "USDC"}</span>
                      </div>
                    )}

                    {selectedWorkflow.config?.plain_english && (
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Confirmation</span>
                        <span className="text-white text-right font-medium">{selectedWorkflow.config.plain_english}</span>
                      </div>
                    )}

                    {selectedWorkflow.config?.schedule && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Schedule</span>
                        <span className="text-white text-right font-medium">
                          {selectedWorkflow.config.schedule.frequency}
                          {selectedWorkflow.config.schedule.next_execution_at ? ` from ${new Date(selectedWorkflow.config.schedule.next_execution_at).toLocaleString()}` : ""}
                        </span>
                      </div>
                    )}

                    {selectedWorkflow.config?.percentage && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Sweep Percentage</span>
                        <span className="text-pink-400 font-bold">{selectedWorkflow.config.percentage}%</span>
                      </div>
                    )}

                    {selectedWorkflow.config?.splits && (
                      <div className="space-y-1">
                        <span className="text-zinc-500 block mb-1">Revenue Split Matrix</span>
                        {selectedWorkflow.config.splits.map((s: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-[11px] bg-zinc-900/40 p-2 rounded-lg border border-zinc-900">
                            <span className="text-white font-bold">{s.name || `Partner ${idx + 1}`}</span>
                            <span className="text-primary font-black">{s.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Audit Executions Console */}
                <Card className="border-none bg-black border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2 font-mono">
                      <Terminal className="h-4 w-4 text-primary" /> Engine Audit Console
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>

                  <CardContent className="p-4 font-mono text-[10px] text-zinc-300 space-y-4 max-h-[300px] overflow-y-auto min-h-[200px]">
                    {/* Execution Logs */}
                    {(!selectedWorkflow.executions || selectedWorkflow.executions.length === 0) && 
                     (!selectedWorkflow.logs || selectedWorkflow.logs.length === 0) ? (
                      <p className="text-zinc-600 text-center py-10">No execution history recorded. Workflows execute automatically on schedule.</p>
                    ) : (
                      <div className="space-y-3">
                        {/* Render active logs */}
                        {selectedWorkflow.logs?.map((log, idx) => (
                          <div key={idx} className="space-y-0.5 border-l border-zinc-800 pl-2">
                            <div className="flex items-center gap-2 text-zinc-500 text-[9px]">
                              <span>[{new Date(log.created_at).toLocaleTimeString()}]</span>
                              <span className={log.log_level === "error" ? "text-rose-500 font-bold" : "text-emerald-500"}>
                                {log.log_level ? log.log_level.toUpperCase() : "INFO"}
                              </span>
                            </div>
                            <p className="text-white text-[10px] leading-relaxed">{log.message}</p>
                          </div>
                        ))}

                        {/* Render past execution events */}
                        {selectedWorkflow.executions?.map((exec, idx) => (
                          <div key={idx} className="space-y-1 p-2 bg-zinc-900/40 rounded-lg border border-zinc-900">
                            <div className="flex items-center justify-between text-[9px]">
                              <span className="text-zinc-500">[{new Date(exec.created_at).toLocaleDateString()}] Run #{exec.id.substring(0,6)}</span>
                              <span className={
                                exec.status === "success" ? "text-emerald-400 font-bold" : 
                                exec.status === "failed" ? "text-rose-500 font-bold" : "text-zinc-400"
                              }>
                                {exec.status.toUpperCase()}
                              </span>
                            </div>
                            {exec.tx_hash && (
                              <p className="text-[9px] text-primary truncate font-mono">TxHash: {exec.tx_hash}</p>
                            )}
                            {exec.error && (
                              <p className="text-[9px] text-rose-400 font-bold leading-normal">{exec.error}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full border border-dashed border-zinc-900 rounded-3xl p-10 text-center flex flex-col items-center justify-center text-zinc-500">
                <Layers className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Select Workflow</p>
                <p className="text-[10px] mt-1 text-zinc-600">Choose an automation workflow to view logs and configurations.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
