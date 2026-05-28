import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/payments";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { calculateLocalBalance } from "@/lib/services/ledger";

export async function POST(request: NextRequest) {
  try {
    const { walletId } = await request.json();

    if (!walletId) {
      return NextResponse.json(
        { error: "Wallet ID is required" },
        { status: 400 }
      );
    }

    // Authenticate the user using cookies
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Fetch the user's profile and check wallet ownership
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to verify wallet ownership" },
        { status: 500 }
      );
    }

    if (profile.wallet_id !== walletId) {
      return NextResponse.json(
        { error: "Wrong user" },
        { status: 403 }
      );
    }

    // Fetch fresh balance from Circle API
    const balances = await getBalance(walletId);
    const circleUsdc = balances.find((b: any) => b.symbol?.toUpperCase() === "USDC");
    const circleAmount = circleUsdc ? parseFloat(circleUsdc.amount) : 0;

    // Calculate local balance as fallback
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const localBalance = await calculateLocalBalance(adminSupabase, user.id);

    // Use Circle balance if it's higher (includes external transfers not tracked locally),
    // otherwise use local balance (faster to update after Setra-to-Setra transfers)
    const displayBalance = circleAmount > localBalance ? circleAmount : localBalance;

    return NextResponse.json({
      success: true,
      balances,
      localBalance,
      displayBalance,
      source: circleAmount > localBalance ? "circle" : "local",
    });
  } catch (error: any) {
    console.error("Balance fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
