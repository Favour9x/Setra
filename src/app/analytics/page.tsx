"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Receipt, 
  Wallet, 
  Repeat, 
  Loader2, 
  Calendar,
  DollarSign,
  TrendingDown,
  ArrowUpRight,
  RefreshCw
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import { motion } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Metrics {
  totalVolume: number;
  invoicesPaid: number;
  activeSubscriptions: number;
  recurringRevenue: number;
  totalInvoices: number;
  totalSubscriptions: number;
  incomeSum: number;
  expenseSum: number;
}

export default function Page() {
  const { notify } = useNotify();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/analytics", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setGraphData(data.graphData || []);
      } else {
        notify(data.error || "Failed to load revenue metrics");
      }
    } catch (err: any) {
      notify("Analytics network query error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
        <p className="text-sm font-black uppercase tracking-widest">Hydrating intelligence dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12 relative">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-secondary font-black text-[10px] uppercase tracking-[0.4em] mb-3">Revenue Intelligence</p>
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none">
            Financial & <span className="text-primary italic">Analytics</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg font-medium opacity-80 max-w-xl">Deep analysis of settlement volumes, active subscriptions, and cashflow dynamics.</p>
        </div>
        <div>
          <Button 
            onClick={fetchAnalyticsData}
            variant="outline"
            className="h-11 px-5 rounded-xl border-border bg-card shadow-soft hover:bg-muted font-bold flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh Intelligence
          </Button>
        </div>
      </div>

      {/* Main Aggregates Grid */}
      <div className="grid gap-6 md:grid-cols-4">
        {/* Total Volume */}
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardContent className="p-6 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Settlement Volume</p>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">${metrics?.totalVolume.toLocaleString()} USDC</h3>
            <p className="text-[10px] text-emerald-600 font-black flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> +14.2% from last week
            </p>
          </CardContent>
        </Card>

        {/* Paid Invoices */}
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardContent className="p-6 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Invoices Settled</p>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Receipt className="h-4.5 w-4.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">{metrics?.invoicesPaid} / {metrics?.totalInvoices}</h3>
            <p className="text-[10px] text-muted-foreground/60 font-bold">Active collection logs</p>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardContent className="p-6 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recurring Revenue (MRR)</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Repeat className="h-4.5 w-4.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">${metrics?.recurringRevenue.toLocaleString()} USDC</h3>
            <p className="text-[10px] text-emerald-600 font-black flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Monthly auto-billed cashflow
            </p>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardContent className="p-6 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Subscriptions</p>
              <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                <Repeat className="h-4.5 w-4.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">{metrics?.activeSubscriptions || 0}</h3>
            <p className="text-[10px] text-muted-foreground/60 font-bold">Active recurring billing rules</p>
          </CardContent>
        </Card>
      </div>

      {/* Recharts Area Chart Panel */}
      <Card className="border-none shadow-premium bg-card p-8 overflow-hidden">
        <CardHeader className="p-0 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tight">Payment Settlement Activity</CardTitle>
            <CardDescription className="text-xs font-bold text-muted-foreground/60">Live ledger transaction volumes in USD stablecoin (USDC)</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-primary opacity-80"></span>
              <span className="text-muted-foreground uppercase">Received:</span>
              <span className="text-foreground">${metrics?.incomeSum?.toLocaleString() || "0"} USDC</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-secondary opacity-80"></span>
              <span className="text-muted-foreground uppercase">Sent:</span>
              <span className="text-foreground">${metrics?.expenseSum?.toLocaleString() || "0"} USDC</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={graphData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.4)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: "rgba(148, 163, 184, 0.8)" }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: "rgba(148, 163, 184, 0.8)" }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "rgba(10, 10, 22, 0.95)", 
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: "12px", 
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "bold"
                }} 
              />
              <Area type="monotone" dataKey="income" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" />
              <Area type="monotone" dataKey="expense" stroke="var(--secondary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpense)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
