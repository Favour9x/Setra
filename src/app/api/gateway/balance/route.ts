import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", session.user.id)
      .single();

    if (!profile?.wallet_address) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }

    const { getUnifiedBalances, getTotalUnifiedBalance } = await import("@/lib/gateway");
    const balances = await getUnifiedBalances(profile.wallet_address);
    const total = await getTotalUnifiedBalance(profile.wallet_address);

    return NextResponse.json({ success: true, balances, total });
  } catch (error: any) {
    console.error("Gateway balance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch Gateway balance" },
      { status: 500 }
    );
  }
}
