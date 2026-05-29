import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { BLOCKCHAINS } from "@/lib/circle/client";
import { calculateLocalBalance } from "@/lib/services/ledger";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch local ledger balance as fallback
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    let localBalance = 0;
    try {
      localBalance = await calculateLocalBalance(adminSupabase, userId);
    } catch (err) {
      console.warn("Failed to fetch local ledger balance:", err);
    }

    const { listUserWallets, getWalletBalance } = await import("@/lib/circle/client");
    const wallets = await listUserWallets(userId);

    const result = await Promise.all(
      wallets.map(async (w) => {
        const chainInfo = BLOCKCHAINS.find((c) => c.id === w.blockchain);
        try {
          const balances = await getWalletBalance(w.walletId);
          const usdc = balances.find((b) => b.symbol === "USDC");
          const circleBalance = usdc ? parseFloat(usdc.amount) : 0;
          // If Circle returns 0, fall back to the local ledger total
          // (the user's overall USDC is available, just not tracked per-chain by Circle)
          return {
            blockchain: w.blockchain,
            chainName: chainInfo?.name || w.blockchain,
            isTestnet: chainInfo?.isTestnet ?? true,
            walletId: w.walletId,
            walletAddress: w.walletAddress,
            usdcBalance: circleBalance > 0 ? circleBalance : localBalance,
            source: circleBalance > 0 ? "circle" : "ledger",
          };
        } catch (err) {
          console.error(`Chain balance error for ${w.blockchain}:`, err);
          return {
            blockchain: w.blockchain,
            chainName: chainInfo?.name || w.blockchain,
            isTestnet: chainInfo?.isTestnet ?? true,
            walletId: w.walletId,
            walletAddress: w.walletAddress,
            usdcBalance: localBalance,
            source: "ledger",
          };
        }
      })
    );

    return NextResponse.json({ chains: result });
  } catch (error: any) {
    console.error("Chain balances error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chain balances" },
      { status: 500 }
    );
  }
}
