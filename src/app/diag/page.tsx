"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useFinancial } from "@/context/FinancialContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Shield, User, Wallet, RefreshCw, AlertCircle } from "lucide-react";

export default function DiagPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { balance, walletAddress, walletId, username, isLoaded, refreshData } = useFinancial();
  const [mounted, setMounted] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-mono">
        Loading Diagnostic Component...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex items-center justify-center font-sans">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-red-500 animate-pulse" />
          <h1 className="text-2xl font-black tracking-tight uppercase">Setra Fintech Diagnostics</h1>
        </div>

        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              Auth Context State
            </CardTitle>
            <CardDescription className="text-slate-400">
              State values retrieved from AuthProvider
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 font-mono text-sm">
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
              <span className="text-slate-400 font-semibold">authLoading:</span>
              <span className={`col-span-2 font-bold ${authLoading ? "text-amber-500" : "text-emerald-500"}`}>
                {authLoading ? "true (loading...)" : "false (ready)"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
              <span className="text-slate-400 font-semibold">User Object:</span>
              <span className="col-span-2 font-bold">
                {user ? "Authenticated" : "Null / Anonymous"}
              </span>
            </div>
            {user && (
              <>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
                  <span className="text-slate-400 font-semibold">User Email:</span>
                  <span className="col-span-2 text-blue-400">{user.email}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
                  <span className="text-slate-400 font-semibold">User ID:</span>
                  <span className="col-span-2 text-slate-300 text-xs">{user.id}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" />
              Financial Context State
            </CardTitle>
            <CardDescription className="text-slate-400">
              State values retrieved from FinancialProvider
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 font-mono text-sm">
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
              <span className="text-slate-400 font-semibold">isLoaded:</span>
              <span className={`col-span-2 font-bold ${isLoaded ? "text-emerald-500" : "text-amber-500"}`}>
                {isLoaded ? "true (ready)" : "false (fetching...)"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
              <span className="text-slate-400 font-semibold">username:</span>
              <span className={`col-span-2 font-bold ${username ? "text-purple-400" : "text-rose-400"}`}>
                {username ? `@${username}` : "Null / Undefined"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
              <span className="text-slate-400 font-semibold">walletId:</span>
              <span className="col-span-2 text-slate-300 text-xs">
                {walletId || "Null / Undefined"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
              <span className="text-slate-400 font-semibold">walletAddress:</span>
              <span className="col-span-2 text-slate-300 text-xs">
                {walletAddress || "Null / Undefined"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
              <span className="text-slate-400 font-semibold">balance:</span>
              <span className="col-span-2 text-emerald-400 font-bold">
                {balance !== null ? `$${balance.toLocaleString()}` : "Null / Loading"} USDC
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Evaluation Logic
            </CardTitle>
            <CardDescription className="text-slate-400">
              Calculated conditions for route guarding
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 font-mono text-sm">
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-800/40">
              <span className="text-slate-400 font-semibold">Stuck Check:</span>
              <span className={`col-span-2 font-bold ${
                (user && !username && isLoaded) ? "text-rose-500" : "text-emerald-500"
              }`}>
                {(user && !username && isLoaded) 
                  ? "TRUE (Will trigger redirect / stuck loading page)" 
                  : "FALSE (Normal behavior)"}
              </span>
            </div>
            <p className="text-xs text-slate-400 italic">
              * Note: If Stuck Check is TRUE, LayoutWrapper will show 'Initializing Pulse' on protected pages and attempt to redirect to /setup-username.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Force Context Refresh
          </Button>

          {user && (
            <Button 
              onClick={signOut}
              variant="destructive"
              className="px-6 font-bold"
            >
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
