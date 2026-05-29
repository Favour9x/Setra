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

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const localBalance = await calculateLocalBalance(adminSupabase, userId);

    const { listUserWallets, getWalletBalance } = await import("@/lib/circle/client");
    const wallets = await listUserWallets(userId);

    let totalCircleBalance = 0;

    const rawResults = await Promise.all(
      wallets.map(async (w) => {
        const chainInfo = BLOCKCHAINS.find((c) => c.id === w.blockchain);
        try {
          const balances = await getWalletBalance(w.walletId);
          const usdc = balances.find((b) => b.symbol === "USDC");
          const circleBalance = usdc ? parseFloat(usdc.amount) : 0;
          totalCircleBalance += circleBalance;
          return {
            blockchain: w.blockchain,
            chainName: chainInfo?.name || w.blockchain,
            isTestnet: chainInfo?.isTestnet ?? true,
            walletId: w.walletId,
            walletAddress: w.walletAddress,
            circleBalance,
            source: "circle",
          };
        } catch (err) {
          console.error(`Chain balance error for ${w.blockchain}:`, err);
          return {
            blockchain: w.blockchain,
            chainName: chainInfo?.name || w.blockchain,
            isTestnet: chainInfo?.isTestnet ?? true,
            walletId: w.walletId,
            walletAddress: w.walletAddress,
            circleBalance: 0,
            source: "error",
          };
        }
      })
    );

    const hasOnchainUSDC = totalCircleBalance > 0;

    const result = rawResults.map((r) => ({
      blockchain: r.blockchain,
      chainName: r.chainName,
      isTestnet: r.isTestnet,
      walletId: r.walletId,
      walletAddress: r.walletAddress,
      usdcBalance: hasOnchainUSDC ? r.circleBalance : localBalance,
      source: hasOnchainUSDC ? r.source : "ledger",
    }));

    return NextResponse.json({ chains: result });
  } catch (error: any) {
    console.error("Chain balances error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chain balances" },
      { status: 500 }
    );
  }
}
