"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotify } from "@/components/ui/notification";
import { PiggyBank, Plus, Target, Wallet, ArrowUpRight, ArrowDownLeft, Clock, Lock, Unlock, Trash2, TrendingUp, BarChart3, Percent, Calendar, Repeat, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  vault_type: "flexible" | "locked";
  target_date: string | null;
  locked_until_amount: number | null;
  active: boolean;
  created_at: string;
}

interface SavingsTx {
  id: string;
  goal_id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  created_at: string;
  savings_goals?: { name: string };
}

interface AutoRule {
  id: string;
  goal_id: string;
  rule_type: "fixed" | "percentage";
  amount: number | null;
  percentage: number | null;
  frequency: string | null;
  active: boolean;
  savings_goals?: { name: string };
}

interface SavingsSummary {
  totalSaved: number;
  totalTarget: number;
  goalCount: number;
  completedGoals: number;
  remainingToTarget: number;
}

export default function SavingsPage() {
  const { notify } = useNotify();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [activity, setActivity] = useState<SavingsTx[]>([]);
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: "", target_amount: "", vault_type: "flexible", target_date: "", locked_until_amount: "" });
  const [depositModal, setDepositModal] = useState<{ goal: SavingsGoal } | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState<{ goal: SavingsGoal } | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [ruleModal, setRuleModal] = useState<{ goal: SavingsGoal } | null>(null);
  const [newRule, setNewRule] = useState({ rule_type: "fixed", amount: "", percentage: "", frequency: "monthly" });
  const [creatingRule, setCreatingRule] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/savings", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setGoals(data.goals || []);
        setActivity(data.activity || []);
        setRules(data.rules || []);
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateGoal = async () => {
    if (!newGoal.name || !newGoal.target_amount) {
      notify("Name and target amount are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/savings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGoal.name,
          target_amount: parseFloat(newGoal.target_amount),
          vault_type: newGoal.vault_type,
          target_date: newGoal.target_date || null,
          locked_until_amount: newGoal.vault_type === "locked" && newGoal.locked_until_amount ? parseFloat(newGoal.locked_until_amount) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Savings goal created");
        setShowCreateGoal(false);
        setNewGoal({ name: "", target_amount: "", vault_type: "flexible", target_date: "", locked_until_amount: "" });
        fetchData();
      } else {
        notify(data.error || "Failed to create goal");
      }
    } catch (err: any) {
      notify(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositModal || !depositAmount || parseFloat(depositAmount) <= 0) {
      notify("Enter a valid amount");
      return;
    }
    setDepositing(true);
    try {
      const res = await fetch(`/api/savings/${depositModal.goal.id}/deposit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(depositAmount) }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.goalReached) {
          notify(`Goal reached! ${depositModal.goal.name} is fully funded`);
        }
        notify("Funds added to savings");
        setDepositModal(null);
        setDepositAmount("");
        fetchData();
      } else {
        notify(data.error || "Deposit failed");
      }
    } catch (err: any) {
      notify(err.message);
    } finally {
      setDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawModal || !withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      notify("Enter a valid amount");
      return;
    }
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/savings/${withdrawModal.goal.id}/withdraw`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(withdrawAmount) }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Funds withdrawn to wallet");
        setWithdrawModal(null);
        setWithdrawAmount("");
        fetchData();
      } else {
        notify(data.error || "Withdrawal failed");
      }
    } catch (err: any) {
      notify(err.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleCreateRule = async () => {
    if (!ruleModal) return;
    if (newRule.rule_type === "fixed" && (!newRule.amount || !newRule.frequency)) {
      notify("Amount and frequency required");
      return;
    }
    if (newRule.rule_type === "percentage" && !newRule.percentage) {
      notify("Percentage required");
      return;
    }
    setCreatingRule(true);
    try {
      const res = await fetch("/api/savings/auto-rules", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_id: ruleModal.goal.id,
          rule_type: newRule.rule_type,
          amount: newRule.rule_type === "fixed" ? parseFloat(newRule.amount) : null,
          percentage: newRule.rule_type === "percentage" ? parseFloat(newRule.percentage) : null,
          frequency: newRule.rule_type === "fixed" ? newRule.frequency : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Auto-save rule created");
        setRuleModal(null);
        setNewRule({ rule_type: "fixed", amount: "", percentage: "", frequency: "monthly" });
        fetchData();
      } else {
        notify(data.error || "Failed to create rule");
      }
    } catch (err: any) {
      notify(err.message);
    } finally {
      setCreatingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/savings/auto-rules/${ruleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        notify("Auto-save rule deleted");
        fetchData();
      }
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Delete this goal? Any remaining savings will be returned to your wallet.")) return;
    setDeleting(goalId);
    try {
      const res = await fetch(`/api/savings/${goalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        notify("Goal deleted, funds returned to wallet");
        fetchData();
      } else {
        notify(data.error || "Failed to delete goal");
      }
    } catch (err: any) {
      notify(err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progressPercent = (saved: number, target: number) => Math.min(100, Math.round((saved / target) * 100));
  const formatAmount = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <PiggyBank className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Savings</h1>
            <p className="text-sm text-muted-foreground">Save toward your financial goals</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateGoal(true)} className="h-10 px-5 rounded-xl font-black text-xs uppercase tracking-wider">
          <Plus className="h-4 w-4 mr-1.5" /> New Goal
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-premium bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Saved</p>
                <p className="text-lg font-black text-foreground">${formatAmount(summary?.totalSaved || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Goals</p>
                <p className="text-lg font-black text-foreground">{summary?.goalCount || 0} <span className="text-sm font-bold text-muted-foreground">active</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Completed</p>
                <p className="text-lg font-black text-foreground">{summary?.completedGoals || 0}<span className="text-sm font-bold text-muted-foreground">/{summary?.goalCount || 0}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-premium bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Remaining</p>
                <p className="text-lg font-black text-foreground">${formatAmount(summary?.remainingToTarget || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <Card className="border-none shadow-premium bg-card">
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <PiggyBank className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-black text-foreground">No savings goals yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Create your first savings goal and start building toward your financial future</p>
            <Button onClick={() => setShowCreateGoal(true)} className="mt-6 h-10 px-6 rounded-xl font-black text-xs uppercase tracking-wider">
              <Plus className="h-4 w-4 mr-1.5" /> Create Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const pct = progressPercent(goal.saved_amount, goal.target_amount);
            const isComplete = goal.saved_amount >= goal.target_amount;
            const goalRules = rules.filter(r => r.goal_id === goal.id);

            return (
              <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-none shadow-premium bg-card overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-foreground truncate">{goal.name}</h3>
                          {isComplete && (
                            <Badge className="rounded-full bg-emerald-500/10 text-emerald-500 border-none text-[8px] font-black uppercase px-2 py-0.5">Goal Reached</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`rounded-full border-none text-[8px] font-black uppercase px-2 py-0.5 ${
                            goal.vault_type === "flexible" 
                              ? "bg-blue-500/10 text-blue-500" 
                              : "bg-amber-500/10 text-amber-500"
                          }`}>
                            {goal.vault_type === "flexible" ? <Unlock className="h-2.5 w-2.5 mr-1" /> : <Lock className="h-2.5 w-2.5 mr-1" />}
                            {goal.vault_type === "flexible" ? "Flexible" : "Locked"}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)} disabled={deleting === goal.id} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-foreground">${formatAmount(goal.saved_amount)}</span>
                        <span className="text-muted-foreground font-semibold">${formatAmount(goal.target_amount)}</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-primary"}`}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground">{pct}% complete</span>
                        <span className="text-[10px] font-bold text-muted-foreground">${formatAmount(Math.max(0, goal.target_amount - goal.saved_amount))} remaining</span>
                      </div>
                    </div>

                    {goal.target_date && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Target date: {new Date(goal.target_date).toLocaleDateString()}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" onClick={() => setDepositModal({ goal })} className="h-8 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider">
                        <Plus className="h-3 w-3 mr-1" /> Add Funds
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setWithdrawModal({ goal })} disabled={goal.saved_amount <= 0} className="h-8 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider">
                        <ArrowUpRight className="h-3 w-3 mr-1" /> Withdraw
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRuleModal({ goal })} className="h-8 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" /> Auto-Save
                      </Button>
                    </div>

                    {/* Auto-Save Rules for this goal */}
                    {goalRules.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <Separator className="opacity-30" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Auto-Save Rules</p>
                        {goalRules.map((rule) => (
                          <div key={rule.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                              {rule.rule_type === "fixed" ? (
                                <><Repeat className="h-3 w-3 text-primary" /> ${formatAmount(rule.amount || 0)} {rule.frequency}</>
                              ) : (
                                <><Percent className="h-3 w-3 text-emerald-500" /> {rule.percentage}% of incoming</>
                              )}
                            </div>
                            <button onClick={() => handleDeleteRule(rule.id)} className="text-muted-foreground/50 hover:text-red-500 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Recent Activity */}
      {activity.length > 0 && (
        <Card className="border-none shadow-premium bg-card">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <div className="space-y-1">
              {activity.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.type === "deposit" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                    }`}>
                      {tx.type === "deposit" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground capitalize">{tx.type}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold">
                        {tx.savings_goals?.name || "Unknown goal"} · {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-black ${tx.type === "deposit" ? "text-emerald-500" : "text-red-500"}`}>
                    {tx.type === "deposit" ? "+" : "-"}${formatAmount(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Goal Modal */}
      <AnimatePresence>
        {showCreateGoal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !creating && setShowCreateGoal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full max-w-md bg-card rounded-3xl p-6 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-primary" /> New Savings Goal
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Goal Name</Label>
                  <Input value={newGoal.name} onChange={e => setNewGoal(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Emergency Fund" className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Amount (USDC)</Label>
                  <Input type="number" value={newGoal.target_amount} onChange={e => setNewGoal(p => ({ ...p, target_amount: e.target.value }))} placeholder="1000" className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vault Type</Label>
                  <Select value={newGoal.vault_type} onValueChange={v => setNewGoal(p => ({ ...p, vault_type: v }))}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flexible">Flexible — Withdraw anytime</SelectItem>
                      <SelectItem value="locked">Locked — Locked until conditions met</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newGoal.vault_type === "locked" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lock Until Amount (USDC) — optional</Label>
                      <Input type="number" value={newGoal.locked_until_amount} onChange={e => setNewGoal(p => ({ ...p, locked_until_amount: e.target.value }))} placeholder="Min amount before withdrawal allowed" className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Date — optional</Label>
                      <Input type="date" value={newGoal.target_date} onChange={e => setNewGoal(p => ({ ...p, target_date: e.target.value }))} className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowCreateGoal(false)} disabled={creating} className="flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider">Cancel</Button>
                <Button onClick={handleCreateGoal} disabled={creating} className="flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Goal"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deposit Modal */}
      <AnimatePresence>
        {depositModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !depositing && setDepositModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Add Funds</h3>
              <p className="text-xs text-muted-foreground font-semibold">Adding to: <span className="text-foreground font-black">{depositModal.goal.name}</span></p>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (USDC)</Label>
                <Input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" className="h-12 rounded-xl bg-muted/30 border-none font-black text-lg" autoFocus />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setDepositModal(null)} disabled={depositing} className="flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider">Cancel</Button>
                <Button onClick={handleDeposit} disabled={depositing} className="flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider">
                  {depositing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deposit"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {withdrawModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !withdrawing && setWithdrawModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Withdraw Funds</h3>
              <p className="text-xs text-muted-foreground font-semibold">From: <span className="text-foreground font-black">{withdrawModal.goal.name}</span></p>
              <p className="text-[10px] font-bold text-muted-foreground">Available: ${formatAmount(withdrawModal.goal.saved_amount)} USDC</p>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (USDC)</Label>
                <Input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00" className="h-12 rounded-xl bg-muted/30 border-none font-black text-lg" autoFocus />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setWithdrawModal(null)} disabled={withdrawing} className="flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider">Cancel</Button>
                <Button onClick={handleWithdraw} disabled={withdrawing} className="flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider">
                  {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Withdraw"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Save Rule Modal */}
      <AnimatePresence>
        {ruleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !creatingRule && setRuleModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full max-w-md bg-card rounded-3xl p-6 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Auto-Save Rule
              </h3>
              <p className="text-xs text-muted-foreground font-semibold">Goal: <span className="text-foreground font-black">{ruleModal.goal.name}</span></p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rule Type</Label>
                  <Select value={newRule.rule_type} onValueChange={v => setNewRule(p => ({ ...p, rule_type: v }))}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed recurring amount</SelectItem>
                      <SelectItem value="percentage">Percentage of incoming payments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newRule.rule_type === "fixed" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (USDC)</Label>
                      <Input type="number" value={newRule.amount} onChange={e => setNewRule(p => ({ ...p, amount: e.target.value }))} placeholder="50" className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Frequency</Label>
                      <Select value={newRule.frequency} onValueChange={v => setNewRule(p => ({ ...p, frequency: v }))}>
                        <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Percentage of Incoming Payments</Label>
                    <Input type="number" value={newRule.percentage} onChange={e => setNewRule(p => ({ ...p, percentage: e.target.value }))} placeholder="10" className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                    <p className="text-[9px] text-muted-foreground font-semibold">Every time you receive a payment, this percentage will automatically move to savings</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setRuleModal(null)} disabled={creatingRule} className="flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider">Cancel</Button>
                <Button onClick={handleCreateRule} disabled={creatingRule} className="flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider">
                  {creatingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Rule"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}