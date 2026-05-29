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

    if (!profile?.wallet_address) {
      return NextResponse.json({ success: true, balances: [], total: 0, source: "no-wallet" });
    }

    const { listUserWallets, getWalletBalance } = await import("@/lib/circle/client");
    const wallets = await listUserWallets(userId);
    let total = 0;
    const balances: { blockchain: string; chainName: string; balance: number }[] = [];

    for (const w of wallets) {
      try {
        const result = await getWalletBalance(w.walletId);
        const usdc = result.find((b: any) => b.symbol === "USDC");
        const amount = usdc ? parseFloat(usdc.amount) : 0;
        total += amount;
        balances.push({ blockchain: w.blockchain, chainName: "Arc Testnet", balance: amount });
      } catch {
        balances.push({ blockchain: w.blockchain, chainName: "Arc Testnet", balance: 0 });
      }
    }

    return NextResponse.json({ success: true, balances, total, source: "chain-wallet" });
  } catch (error: any) {
    console.error("Gateway balance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch Gateway balance" },
      { status: 500 }
    );
  }
}
