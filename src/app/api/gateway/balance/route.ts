import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", userId)
      .single();

    // Try Gateway API first for unified balance
    let gatewayTotal: number | null = null;
    let gatewayBalances: any[] = [];
    let source = "chain-wallets";

    if (profile?.wallet_address) {
      try {
        const { getUnifiedBalances, getTotalUnifiedBalance } = await import("@/lib/gateway");
        gatewayBalances = await getUnifiedBalances(profile.wallet_address);
        gatewayTotal = await getTotalUnifiedBalance(profile.wallet_address);
      } catch (err) {
        console.warn("Gateway API failed, falling back to chain wallets:", err);
      }
    }

    if (gatewayTotal && gatewayTotal > 0) {
      source = "gateway";
      return NextResponse.json({ success: true, balances: gatewayBalances, total: gatewayTotal, source });
    }

    // Fallback: sum all chain wallet balances
    const { listUserWallets, getWalletBalance } = await import("@/lib/circle/client");
    const wallets = await listUserWallets(userId);
    let totalFromChains = 0;
    const chainBalances: { blockchain: string; chainName: string; balance: number }[] = [];

    for (const w of wallets) {
      try {
        const balances = await getWalletBalance(w.walletId);
        const usdc = balances.find((b: any) => b.symbol === "USDC");
        const amount = usdc ? parseFloat(usdc.amount) : 0;
        if (amount > 0) totalFromChains += amount;
        chainBalances.push({ blockchain: w.blockchain, chainName: w.blockchain.replace(/-/g, " "), balance: amount });
      } catch {
        chainBalances.push({ blockchain: w.blockchain, chainName: w.blockchain.replace(/-/g, " "), balance: 0 });
      }
    }

    return NextResponse.json({ success: true, balances: chainBalances, total: totalFromChains, source });
  } catch (error: any) {
    console.error("Gateway balance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch Gateway balance" },
      { status: 500 }
    );
  }
}
