import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { BLOCKCHAINS } from "@/lib/circle/client";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { listUserWallets, getWalletBalance } = await import("@/lib/circle/client");
    const wallets = await listUserWallets(userId);

    const result = await Promise.all(
      wallets.map(async (w) => {
        const chainInfo = BLOCKCHAINS.find((c) => c.id === w.blockchain);
        try {
          const balances = await getWalletBalance(w.walletId);
          const usdc = balances.find((b) => b.symbol === "USDC");
          return {
            blockchain: w.blockchain,
            chainName: chainInfo?.name || w.blockchain,
            isTestnet: chainInfo?.isTestnet ?? true,
            walletId: w.walletId,
            walletAddress: w.walletAddress,
            usdcBalance: usdc ? parseFloat(usdc.amount) : 0,
            rawBalances: balances,
          };
        } catch {
          return {
            blockchain: w.blockchain,
            chainName: chainInfo?.name || w.blockchain,
            isTestnet: chainInfo?.isTestnet ?? true,
            walletId: w.walletId,
            walletAddress: w.walletAddress,
            usdcBalance: 0,
            rawBalances: [],
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
