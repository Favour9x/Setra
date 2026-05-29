import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/payments";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { walletId } = await request.json();

    if (!walletId) {
      return NextResponse.json(
        { error: "Wallet ID is required" },
        { status: 400 }
      );
    }

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

    // Fetch fresh balance from Circle API only (no local ledger mixing)
    const balances = await getBalance(walletId);
    const circleUsdc = balances.find((b: any) => b.symbol?.toUpperCase() === "USDC");
    const balance = circleUsdc ? parseFloat(circleUsdc.amount) : 0;

    return NextResponse.json({
      success: true,
      balance,
      source: "circle",
    });
  } catch (error: any) {
    console.error("Balance fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
