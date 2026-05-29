import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { BLOCKCHAINS } from "@/lib/circle/client";

export async function POST(request: NextRequest) {
  try {
    const { walletId } = await request.json();

    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to verify wallet ownership" },
        { status: 500 }
      );
    }

    const { getWalletById, createWalletsForUser, getWalletBalanceForBlockchain, requestFaucetFunds, syncInboundTransactions } = await import("@/lib/circle/client");

    let effectiveWalletId = profile.wallet_id || walletId || null;
    let walletExists = false;
    let effectiveWalletAddress = profile.wallet_address || null;

    // Verify the wallet exists on Circle
    try {
      const walletResponse = await getWalletById(effectiveWalletId);
      walletExists = !!walletResponse.data?.wallet?.id;
      if (walletExists && walletResponse.data?.wallet?.address) {
        effectiveWalletAddress = walletResponse.data.wallet.address;
      }
    } catch {
      walletExists = false;
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!walletExists) {
      console.log(`Balance: wallet ${effectiveWalletId} not found on Circle for user ${user.id}. Creating...`);
      const newWallets = await createWalletsForUser(user.id);
      if (newWallets.length === 0) {
        return NextResponse.json(
          { error: "Failed to create wallet. Please try again." },
          { status: 500 }
        );
      }
      effectiveWalletId = newWallets[0].walletId;
      effectiveWalletAddress = newWallets[0].walletAddress;
      await adminSupabase
        .from("profiles")
        .update({
          wallet_id: effectiveWalletId,
          wallet_address: effectiveWalletAddress,
        })
        .eq("id", user.id);
      console.log(`Balance: created wallet ${effectiveWalletId} and updated profile.`);
    } else {
      // Fix stale wallet_address in profile if it differs from Circle
      if (effectiveWalletAddress && effectiveWalletAddress !== profile.wallet_address) {
        await adminSupabase
          .from("profiles")
          .update({ wallet_address: effectiveWalletAddress })
          .eq("id", user.id);
        console.log(`Balance: fixed wallet_address mismatch (${profile.wallet_address} -> ${effectiveWalletAddress})`);
      }
      // Fix stale wallet_id in profile if it differs from the passed value
      if (effectiveWalletId !== walletId && profile.wallet_id !== walletId) {
        await adminSupabase
          .from("profiles")
          .update({ wallet_id: effectiveWalletId })
          .eq("id", user.id);
      }
    }

    // Fetch fresh balance from Circle API
    const balances = await getWalletBalanceForBlockchain(effectiveWalletId);
    const usdcBalance = balances.find((b: any) => b.symbol?.toUpperCase() === "USDC");
    const balance = usdcBalance ? parseFloat(usdcBalance.amount) : 0;

    // Sync inbound transactions from Circle into local transactions table
    if (effectiveWalletId && effectiveWalletAddress) {
      try {
        await syncInboundTransactions(adminSupabase, effectiveWalletId, effectiveWalletAddress, user.id);
      } catch (syncError: any) {
        console.warn("Inbound transaction sync failed:", syncError.message);
      }
    }

    // If wallet exists but has 0 USDC, request faucet funds
    if (walletExists && balance === 0 && effectiveWalletAddress) {
      const chain = BLOCKCHAINS[0];
      try {
        await requestFaucetFunds(effectiveWalletAddress, chain.id);
        console.log(`Faucet requested for ${effectiveWalletAddress} on ${chain.id}`);
      } catch (faucetError: any) {
        console.warn(`Faucet request failed:`, faucetError.message);
      }
    }

    return NextResponse.json({
      success: true,
      balance,
      source: "circle",
      walletId: effectiveWalletId,
      walletAddress: effectiveWalletAddress,
    });
  } catch (error: any) {
    console.error("Balance fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
