import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

const BLOCKCHAIN_TO_CIRCLE: Record<string, string> = {
  Ethereum_Sepolia: "ETH-SEPOLIA",
  Arbitrum_Sepolia: "ARB-SEPOLIA",
  Base_Sepolia: "BASE-SEPOLIA",
  Polygon_Amoy_Testnet: "MATIC-AMOY",
  Arc_Testnet: "ARC-TESTNET",
};

export async function POST(request: NextRequest) {
  try {
    const { fromChain, toChain, amount, recipientAddress } = await request.json();

    if (!fromChain || !toChain || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: fromChain, toChain, amount" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const circleBlockchain = BLOCKCHAIN_TO_CIRCLE[fromChain] || "ARC-TESTNET";
    const destAddress = recipientAddress || session.user.email;

    const { executeBridge, sendToBridgeEOA, getBridgeAddress } = await import("@/lib/bridge/service");
    const { listUserWallets } = await import("@/lib/circle/client");

    const userWallets = await listUserWallets(userId);
    const sourceWallet = userWallets.find((w) => w.blockchain === circleBlockchain);

    if (!sourceWallet) {
      return NextResponse.json(
        { error: `No wallet found on ${fromChain}. Create one first.` },
        { status: 400 }
      );
    }

    const bridgeEOA = getBridgeAddress();

    const sendResult = await sendToBridgeEOA(sourceWallet.walletId, amount, circleBlockchain);

    const bridgeResult = await executeBridge({
      fromChain,
      toChain,
      amount,
      recipientAddress: destAddress,
    });

    return NextResponse.json({
      success: true,
      depositTransaction: { transactionId: sendResult.transactionId, txHash: sendResult.txHash },
      bridgeTransaction: bridgeResult,
    });
  } catch (error: any) {
    console.error("Bridge execute error:", error);
    return NextResponse.json(
      { error: error.message || "Bridge execution failed" },
      { status: 500 }
    );
  }
}
