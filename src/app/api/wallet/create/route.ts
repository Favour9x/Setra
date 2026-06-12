import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Internal Supabase configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "public" },
    });

    const authSupabase = await createServerSupabase();
    const {
      data: { session },
    } = await authSupabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if profile already has a wallet — NEVER overwrite
    let profile = null;
    let fetchError = null;

    const serviceRoleRes = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address")
      .eq("id", userId)
      .maybeSingle();

    if (serviceRoleRes.error) {
      const authRes = await authSupabase
        .from("profiles")
        .select("wallet_id, wallet_address")
        .eq("id", userId)
        .maybeSingle();
      profile = authRes.data;
      fetchError = authRes.error;
    } else {
      profile = serviceRoleRes.data;
    }

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to check profile" },
        { status: 500 }
      );
    }

    // Wallet already linked — return it idempotently
    if (profile?.wallet_id) {
      return NextResponse.json({
        success: true,
        existing: true,
        wallets: [{
          id: profile.wallet_id,
          address: profile.wallet_address,
          walletId: profile.wallet_id,
          walletAddress: profile.wallet_address,
        }],
      });
    }

    const { createWalletsForUser } = await import("@/lib/circle/client");
    const wallets = await createWalletsForUser(userId);

    if (wallets.length === 0) {
      return NextResponse.json(
        { error: "Failed to create wallets on any blockchain" },
        { status: 500 }
      );
    }

    const primaryWallet = wallets[0];

    let updateError = null;
    const serviceRoleUpdate = await supabase
      .from("profiles")
      .update({
        wallet_id: primaryWallet.walletId,
        wallet_address: primaryWallet.walletAddress,
      })
      .eq("id", userId);

    if (serviceRoleUpdate.error) {
      const authUpdate = await authSupabase
        .from("profiles")
        .update({
          wallet_id: primaryWallet.walletId,
          wallet_address: primaryWallet.walletAddress,
        })
        .eq("id", userId);
      updateError = authUpdate.error;
    }

    if (updateError) {
      console.error("Failed to save primary wallet to Supabase:", updateError);
    }

    return NextResponse.json({
      success: true,
      existing: false,
      wallets: wallets.map((w) => ({
        id: w.walletId,
        address: w.walletAddress,
        walletId: w.walletId,
        walletAddress: w.walletAddress,
        blockchain: w.blockchain,
      })),
    });
  } catch (error: any) {
    console.error("Wallet creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create wallets" },
      { status: 500 }
    );
  }
}
