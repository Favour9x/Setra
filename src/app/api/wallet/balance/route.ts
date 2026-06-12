import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

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

    // Use profile's wallet_id as the single source of truth
    const effectiveWalletId = profile.wallet_id || walletId || null;
    const effectiveWalletAddress = profile.wallet_address || null;

    if (!effectiveWalletId) {
      return NextResponse.json({
        success: true,
        balance: 0,
        source: "none",
        walletId: null,
        walletAddress: null,
        walletExists: false,
      });
    }

    const { getWalletById, getWalletBalanceForBlockchain, syncInboundTransactions } = await import("@/lib/circle/client");

    // Verify the wallet exists on Circle (read-only)
    let walletExists = false;
    let resolvedWalletAddress = effectiveWalletAddress;
    try {
      const walletResponse = await getWalletById(effectiveWalletId);
      walletExists = !!walletResponse.data?.wallet?.id;
      if (walletExists && walletResponse.data?.wallet?.address) {
        resolvedWalletAddress = walletResponse.data.wallet.address;
      }
    } catch {
      walletExists = false;
    }

    if (!walletExists) {
      console.warn(`Balance: wallet ${effectiveWalletId} not found on Circle for user ${user.id}. Returning 0 — wallet_id preserved.`);
      return NextResponse.json({
        success: true,
        balance: 0,
        source: "none",
        walletId: effectiveWalletId,
        walletAddress: resolvedWalletAddress,
        walletExists: false,
      });
    }

    // Fetch fresh balance from Circle API
    const balances = await getWalletBalanceForBlockchain(effectiveWalletId);
    const usdcBalance = balances.find((b: any) => b.symbol?.toUpperCase() === "USDC");
    const balance = usdcBalance ? parseFloat(usdcBalance.amount) : 0;

    // Sync inbound transactions from Circle into local transactions table
    if (effectiveWalletId && resolvedWalletAddress) {
      try {
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await syncInboundTransactions(adminSupabase, effectiveWalletId, resolvedWalletAddress, user.id);
      } catch (syncError: any) {
        console.warn("Inbound transaction sync failed:", syncError.message);
      }
    }

    return NextResponse.json({
      success: true,
      balance,
      source: "circle",
      walletId: effectiveWalletId,
      walletAddress: resolvedWalletAddress,
      walletExists: true,
    });
  } catch (error: any) {
    console.error("Balance fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
