import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { blockchain, amount } = await request.json();

    if (!blockchain || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: blockchain, amount" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address")
      .eq("id", session.user.id)
      .single();

    if (!profile?.wallet_id || !profile?.wallet_address) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }

    const { initiateDeveloperControlledWalletsClient } = await import("@circle-fin/developer-controlled-wallets");
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });

    const { GATEWAY_WALLET_ADDRESS, getUSDCAddress, parseBalance } = await import("@/lib/gateway");

    const parsedAmount = parseBalance(amount).toString();
    const usdcAddress = getUSDCAddress(blockchain);

    const approveTx = await client.createContractExecutionTransaction({
      walletAddress: profile.wallet_address,
      blockchain: blockchain as any,
      contractAddress: usdcAddress,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [GATEWAY_WALLET_ADDRESS, parsedAmount],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const approveTxId = approveTx.data?.id;
    if (!approveTxId) throw new Error("Failed to create approve transaction");

    const { waitForTxCompletion } = await import("@/lib/gateway");

    await waitForTxCompletion(client, approveTxId, "USDC approve");

    const depositTx = await client.createContractExecutionTransaction({
      walletAddress: profile.wallet_address,
      blockchain: blockchain as any,
      contractAddress: GATEWAY_WALLET_ADDRESS,
      abiFunctionSignature: "deposit(address,uint256)",
      abiParameters: [usdcAddress, parsedAmount],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const depositTxId = depositTx.data?.id;
    if (!depositTxId) throw new Error("Failed to create deposit transaction");

    await waitForTxCompletion(client, depositTxId, "Gateway deposit");

    return NextResponse.json({
      success: true,
      approveTransactionId: approveTxId,
      depositTransactionId: depositTxId,
      message: "Gateway deposit complete. Check balance at /api/gateway/balance.",
    });
  } catch (error: any) {
    console.error("Gateway deposit error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to deposit to Gateway" },
      { status: 500 }
    );
  }
}
