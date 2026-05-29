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

    const { getWalletById, createWalletsForUser, getWalletBalanceForBlockchain } = await import("@/lib/circle/client");

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

    if (!walletExists) {
      console.log(`Balance: wallet ${effectiveWalletId} not found on Circle for user ${user.id}. Creating...`);
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
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
    } else if (effectiveWalletId !== walletId && profile.wallet_id !== walletId) {
      // Profile had a different wallet_id than what the client sent — update the client's profile
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await adminSupabase
        .from("profiles")
        .update({ wallet_id: effectiveWalletId })
        .eq("id", user.id);
    }

    // Fetch fresh balance from Circle API
    const balances = await getWalletBalanceForBlockchain(effectiveWalletId);
    const usdcBalance = balances.find((b: any) => b.symbol?.toUpperCase() === "USDC");
    const balance = usdcBalance ? parseFloat(usdcBalance.amount) : 0;

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
