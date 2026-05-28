"use client";

import { useState, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { useNotify } from "@/components/ui/notification";
import { ArrowLeft, Loader2, ArrowRightLeft, CheckCircle2, AlertCircle, RefreshCw, Info } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

const CHAIN_COLORS: Record<string, string> = {
  evm: "bg-indigo-500",
  solana: "bg-orange-500",
  aptos: "bg-cyan-500",
};

function getChainColor(type: string): string {
  return CHAIN_COLORS[type] || "bg-gray-500";
}

function formatChainId(chain: string): string {
  if (chain.startsWith("Ethereum_")) return "Eth";
  if (chain.startsWith("Arbitrum_")) return "Arb";
  if (chain.startsWith("Avalanche_")) return "Avax";
  if (chain.startsWith("Base_")) return "Base";
  if (chain.startsWith("Optimism_")) return "OP";
  if (chain.startsWith("Polygon_")) return "Poly";
  if (chain.startsWith("Unichain_")) return "Uni";
  if (chain.startsWith("Solana")) return "Sol";
  if (chain.startsWith("Aptos")) return "Apt";
  return chain.slice(0, 4);
}

interface ChainInfo {
  chain: string;
  name: string;
  title: string;
  isTestnet: boolean;
  type: string;
}

function BridgePageContent() {
  const { notify } = useNotify();
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [chainsLoading, setChainsLoading] = useState(true);
  const [bridgeAddress, setBridgeAddress] = useState<string | null>(null);
  const [sourceChain, setSourceChain] = useState("");
  const [destChain, setDestChain] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const [estimateError, setEstimateError] = useState("");
  const [bridging, setBridging] = useState(false);
  const [bridgeResult, setBridgeResult] = useState<any>(null);
  const [bridgeError, setBridgeError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [chainsRes, addrRes] = await Promise.all([
          fetch("/api/bridge/supported-chains"),
          fetch("/api/bridge/address"),
        ]);
        const chainsData = await chainsRes.json();
        setChains(chainsData.chains || []);
        if (addrRes.ok) {
          const addrData = await addrRes.json();
          setBridgeAddress(addrData.address);
        }
      } catch {
        notify("Failed to load supported chains");
      } finally {
        setChainsLoading(false);
      }
    })();
  }, [notify]);

  useEffect(() => {
    setEstimate(null);
    setEstimateError("");
    setBridgeResult(null);
    setBridgeError("");
  }, [sourceChain, destChain, amount]);

  const mainnetChains = chains.filter((c) => !c.isTestnet);
  const testnetChains = chains.filter((c) => c.isTestnet);

  const sourceObj = chains.find((c) => c.chain === sourceChain);
  const destObj = chains.find((c) => c.chain === destChain);

  const getChainNode = (c: ChainInfo) => (
    <span className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${getChainColor(c.type)}`} />
      {c.name}
      {c.isTestnet && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-auto">Testnet</span>}
    </span>
  );

  const renderChainOptions = (excludeChain: string) =>
    chains
      .filter((c) => c.chain !== excludeChain)
      .map((c) => (
        <SelectItem key={c.chain} value={c.chain}>
          {getChainNode(c)}
        </SelectItem>
      ));

  const renderGroupedChainOptions = (excludeChain: string) => {
    const mainnets = chains.filter((c) => !c.isTestnet && c.chain !== excludeChain);
    const testnets = chains.filter((c) => c.isTestnet && c.chain !== excludeChain);
    const items: React.ReactNode[] = [];

    if (mainnets.length > 0) {
      items.push(<SelectGroup key="mainnet-group">
        <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Mainnets</SelectLabel>
        {mainnets.map((c) => (
          <SelectItem key={c.chain} value={c.chain}>{getChainNode(c)}</SelectItem>
        ))}
      </SelectGroup>);
    }

    if (mainnets.length > 0 && testnets.length > 0) {
      items.push(<SelectSeparator key="sep" />);
    }

    if (testnets.length > 0) {
      items.push(<SelectGroup key="testnet-group">
        <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Testnets</SelectLabel>
        {testnets.map((c) => (
          <SelectItem key={c.chain} value={c.chain}>{getChainNode(c)}</SelectItem>
        ))}
      </SelectGroup>);
    }

    return items;
  };

  const handleEstimate = async () => {
    if (!sourceChain || !destChain || !amount) return;
    if (sourceChain === destChain) {
      notify("Source and destination chains must be different");
      return;
    }
    setEstimating(true);
    setEstimateError("");
    setEstimate(null);
    try {
      const res = await fetch("/api/bridge/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromChain: sourceChain, toChain: destChain, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Estimation failed");
      setEstimate(data.estimate);
    } catch (err: any) {
      setEstimateError(err.message);
    } finally {
      setEstimating(false);
    }
  };

  const handleBridge = async () => {
    if (!sourceChain || !destChain || !amount) return;
    if (sourceChain === destChain) {
      notify("Source and destination chains must be different");
      return;
    }
    setBridging(true);
    setBridgeError("");
    setBridgeResult(null);
    try {
      const res = await fetch("/api/bridge/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromChain: sourceChain,
          toChain: destChain,
          amount,
          recipientAddress: recipient || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bridge execution failed");
      setBridgeResult(data.result);
      notify("Bridge transaction submitted successfully");
    } catch (err: any) {
      setBridgeError(err.message);
    } finally {
      setBridging(false);
    }
  };

  const hasEstimate = estimate !== null;
  const isValid = sourceChain && destChain && sourceChain !== destChain && amount && parseFloat(amount) > 0;

  return (
    <div className="space-y-8 pb-12 px-4 md:px-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground text-pretty">Bridge</h1>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-8">
          {bridgeAddress && (
            <Card className="border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
              <CardContent className="p-4 flex items-start gap-3 text-sm">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Bridge Wallet Address</p>
                  <p className="text-amber-700 dark:text-amber-400 font-mono text-xs break-all">{bridgeAddress}</p>
                  <p className="text-amber-600 dark:text-amber-500 mt-1 text-xs">
                    Fund this wallet with USDC on the source chain before bridging. The bridge wallet is separate from your Circle wallet.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Cross-Chain Transfer
              </CardTitle>
              <CardDescription>Bridge USDC from one chain to another using CCTPv2</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              {bridgeResult ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground">Bridge Submitted!</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm">
                    Your bridge transaction has been submitted. It may take a few minutes to complete.
                  </p>
                  <div className="mt-6 p-4 bg-muted/50 rounded-xl text-left w-full max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">From</span>
                      <span className="font-medium">{sourceObj?.name || sourceChain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">To</span>
                      <span className="font-medium">{destObj?.name || destChain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">${parseFloat(amount).toLocaleString()} USDC</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBridgeResult(null);
                      setEstimate(null);
                      setAmount("");
                      setRecipient("");
                    }}
                    className="mt-8 h-11 rounded-xl font-bold w-full md:w-auto"
                  >
                    Bridge Another
                  </Button>
                </motion.div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleBridge();
                  }}
                  className="space-y-6 mt-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                        Source Chain
                      </Label>
                      <Select
                        value={sourceChain}
                        onValueChange={setSourceChain}
                        disabled={chainsLoading || bridging}
                      >
                        <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20">
                          {chainsLoading ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : sourceObj ? (
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${getChainColor(sourceObj.type)}`} />
                              {sourceObj.name}
                            </span>
                          ) : (
                            <SelectValue placeholder="Select source" />
                          )}
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-800 border border-border shadow-xl rounded-xl">
                          {chains.length === 0 && !chainsLoading && (
                            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                              No chains available
                            </div>
                          )}
                          {renderGroupedChainOptions(destChain)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                        Destination Chain
                      </Label>
                      <Select
                        value={destChain}
                        onValueChange={setDestChain}
                        disabled={chainsLoading || bridging}
                      >
                        <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20">
                          {chainsLoading ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : destObj ? (
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${getChainColor(destObj.type)}`} />
                              {destObj.name}
                            </span>
                          ) : (
                            <SelectValue placeholder="Select destination" />
                          )}
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-800 border border-border shadow-xl rounded-xl">
                          {chains.length === 0 && !chainsLoading && (
                            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                              No chains available
                            </div>
                          )}
                          {renderGroupedChainOptions(sourceChain)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                      Amount (USDC)
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="h-12 bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-bold"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={bridging}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipient" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                      Recipient Address <span className="font-normal normal-case tracking-normal text-muted-foreground/60">(optional — defaults to your wallet on destination)</span>
                    </Label>
                    <Input
                      id="recipient"
                      type="text"
                      placeholder="0x... or wallet address on destination chain"
                      className="h-12 bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-mono text-sm"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      disabled={bridging}
                    />
                  </div>

                  {estimateError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{estimateError}</span>
                    </div>
                  )}

                  {bridgeError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{bridgeError}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 px-6 rounded-xl font-bold flex items-center justify-center gap-2"
                      onClick={handleEstimate}
                      disabled={!isValid || estimating || bridging}
                    >
                      {estimating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Estimating...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4" /> {hasEstimate ? "Re-estimate" : "Get Estimate"}</>
                      )}
                    </Button>
                    <Button
                      type="submit"
                      className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 flex-1"
                      disabled={!isValid || bridging}
                    >
                      {bridging ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Bridging...</>
                      ) : (
                        <><ArrowRightLeft className="h-4 w-4" /> Execute Bridge</>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-8">
          {estimate && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-none shadow-premium bg-card overflow-hidden">
                <CardHeader className="p-6 pb-3">
                  <CardTitle className="text-lg">Fee Estimate</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-medium flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${sourceObj ? getChainColor(sourceObj.type) : "bg-gray-500"}`} />
                      {sourceObj ? formatChainId(sourceObj.chain) : sourceChain}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Destination</span>
                    <span className="font-medium flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${destObj ? getChainColor(destObj.type) : "bg-gray-500"}`} />
                      {destObj ? formatChainId(destObj.chain) : destChain}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{parseFloat(amount).toLocaleString()} USDC</span>
                  </div>

                  {estimate.gasFees?.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Gas Fees</p>
                      {estimate.gasFees.map((gf: any, i: number) => (
                        <div key={i} className="flex justify-between items-center py-1.5">
                          <span className="text-muted-foreground">{gf.name}</span>
                          <span className="font-medium">
                            {gf.fees ? `${parseFloat(gf.fees.fee).toFixed(6)} ${gf.token}` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {estimate.fees?.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Protocol Fees</p>
                      {estimate.fees.map((f: any, i: number) => (
                        <div key={i} className="flex justify-between items-center py-1.5">
                          <span className="capitalize text-muted-foreground">{f.type}</span>
                          <span className={`font-semibold ${f.amount ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {f.amount ? `${f.amount} ${f.token}` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardHeader className="p-6 pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                About Bridging
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                Bridge USDC between blockchains using Circle&apos;s Cross-Chain Transfer Protocol (CCTPv2). USDC is burned on the source chain and minted 1:1 on the destination chain.
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>No liquidity pools or slippage</li>
                <li>1:1 conversion rate — always</li>
                <li>Gas fees paid in native token on source chain</li>
                <li>Typically completes in minutes</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <BridgePageContent />
    </Suspense>
  );
}
