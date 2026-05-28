import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", session.user.id)
      .single();

    if (!profile?.wallet_address) {
      return NextResponse.json({ error: "Wallet address not found" }, { status: 400 });
    }

    const { executeBridge } = await import("@/lib/bridge/service");
    const result = await executeBridge({
      fromChain,
      toChain,
      amount,
      fromAddress: profile.wallet_address,
      recipientAddress: recipientAddress || undefined,
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("Bridge execute error:", error);
    return NextResponse.json(
      { error: error.message || "Bridge execution failed" },
      { status: 500 }
    );
  }
}
