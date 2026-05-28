import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { sourceChain, destChain, amount, recipientAddress, enableForwarder, useDirectMint } = await request.json();

    if (!sourceChain || !destChain || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: sourceChain, destChain, amount" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address")
      .eq("id", userId)
      .single();

    if (!profile?.wallet_address) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }

    const destAddress = recipientAddress || profile.wallet_address;
    const { initiateDeveloperControlledWalletsClient } = await import("@circle-fin/developer-controlled-wallets");
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });

    const {
      buildTypedData,
      submitTransfer,
      createBurnIntent,
      GATEWAY_MINTER_ADDRESS,
      waitForTxCompletion,
    } = await import("@/lib/gateway");

    const burnIntent = await createBurnIntent({
      sourceChain,
      destChain,
      amount,
      depositorAddress: profile.wallet_address,
      recipientAddress: destAddress,
    });

    const typedData = buildTypedData(burnIntent);

    const sigResp = await client.signTypedData({
      walletAddress: profile.wallet_address,
      blockchain: sourceChain as any,
      data: JSON.stringify(typedData, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      ),
    });

    const signature = sigResp.data?.signature;
    if (!signature) throw new Error("Failed to sign burn intent");

    const requests = [{ burnIntent: typedData.message, signature }];

    if (useDirectMint) {
      const result = await submitTransfer(requests, false);

      if (!result.attestation || !result.signature) {
        throw new Error("Invalid Gateway API response for direct mint");
      }

      const mintTx = await client.createContractExecutionTransaction({
        walletAddress: destAddress,
        blockchain: destChain as any,
        contractAddress: GATEWAY_MINTER_ADDRESS,
        abiFunctionSignature: "gatewayMint(bytes,bytes)",
        abiParameters: [result.attestation, result.signature],
        fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      });

      const mintTxId = mintTx.data?.id;

      return NextResponse.json({
        success: true,
        method: "direct_mint",
        attestation: result.attestation,
        mintTransactionId: mintTxId,
      });
    } else {
      const result = await submitTransfer(requests, true);

      return NextResponse.json({
        success: true,
        method: "forwarding_service",
        transferId: result.transferId,
        message: "Transfer submitted to forwarding service. Poll /api/gateway/transfer/status to check progress.",
      });
    }
  } catch (error: any) {
    console.error("Gateway transfer error:", error);
    return NextResponse.json(
      { error: error.message || "Gateway transfer failed" },
      { status: 500 }
    );
  }
}
