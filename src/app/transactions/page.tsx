import React from "react";
import { ExternalLink, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { formatAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type FilterKey = "ALL" | "INCOME" | "EXPENSE" | "SUCCESS" | "PROCESSING" | "FAILED";

type LedgerRow = {
  id: string;
  amount: number;
  recipientAddress: string;
  status: "confirmed" | "pending" | "failed";
  type: "received" | "sent";
  txHash?: string | null;
  createdAt: string;
};

const filters: FilterKey[] = ["ALL", "INCOME", "EXPENSE", "SUCCESS", "PROCESSING", "FAILED"];

function normalizeTransaction(row: any): LedgerRow {
  const rawType = String(row.type || "").toLowerCase();
  const rawStatus = String(row.status || "").toLowerCase();

  return {
    id: row.id,
    amount: Number(row.amount || 0),
    recipientAddress: row.recipient || row.metadata?.recipient_address || "",
    status: rawStatus === "success" || rawStatus === "confirmed"
      ? "confirmed"
      : rawStatus === "failed"
        ? "failed"
        : "pending",
    type: rawType === "income" || rawType === "received" ? "received" : "sent",
    txHash: row.tx_hash,
    createdAt: row.created_at,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const filter = (resolvedSearchParams.filter || "ALL") as FilterKey;
  const search = resolvedSearchParams.search || "";

  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Fetch transactions from the transactions table using authenticated user session
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load transactions:", error.message);
  }

  const transactions = (data || []).map(normalizeTransaction);

  const filtered = transactions.filter((tx) => {
    const matchesFilter =
      filter === "ALL" ||
      (filter === "INCOME" && tx.type === "received") ||
      (filter === "EXPENSE" && tx.type === "sent") ||
      (filter === "SUCCESS" && tx.status === "confirmed") ||
      (filter === "PROCESSING" && tx.status === "pending") ||
      (filter === "FAILED" && tx.status === "failed");

    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      tx.id.toLowerCase().includes(q) ||
      tx.recipientAddress.toLowerCase().includes(q) ||
      (tx.txHash || "").toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">Your confirmed and pending USDC activity on Arc Testnet.</p>
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg">Ledger</CardTitle>
            <form method="GET" action="" className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {filter !== "ALL" && <input type="hidden" name="filter" value={filter} />}
              <Input
                name="search"
                defaultValue={search}
                placeholder="Search address or hash"
                className="pl-9"
              />
            </form>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((key) => (
              <Link key={key} href={`/transactions?filter=${key}${search ? `&search=${encodeURIComponent(search)}` : ""}`}>
                <Button
                  variant={filter === key ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                >
                  {key}
                </Button>
              </Link>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {transactions.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your USDC transfers on Arc Testnet will show up here.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No transactions match this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[600px] divide-y divide-border/60">
                {filtered.map((tx) => (
                  <div key={tx.id} className="grid gap-3 py-4 grid-cols-[1fr_auto_auto_auto] items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {tx.type === "received" ? "Received" : "Sent"} {tx.amount.toLocaleString()} USDC
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          tx.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : tx.status === "failed"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-amber-500/10 text-amber-600"
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Recipient: {formatAddress(tx.recipientAddress)}</p>
                    </div>

                    <div className="text-xs text-muted-foreground px-4">
                      {new Date(tx.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </div>

                    <div className={`text-sm font-bold px-4 ${tx.type === "received" ? "text-emerald-600" : "text-foreground"}`}>
                      {tx.type === "received" ? "+" : "-"}{tx.amount.toLocaleString()} USDC
                    </div>

                    <div className="pl-4">
                      {tx.txHash ? (
                        <a
                          href={`https://testnet.arcscan.app/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          Explorer <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No hash</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
