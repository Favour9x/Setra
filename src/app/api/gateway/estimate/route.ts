import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { sourceChain, destChain, amount, recipientAddress, enableForwarder } = await request.json();

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", session.user.id)
      .single();

    if (!profile?.wallet_address) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }

    const { estimateTransfer } = await import("@/lib/gateway");
    const estimate = await estimateTransfer({
      sourceChain,
      destChain,
      amount,
      depositorAddress: profile.wallet_address,
      recipientAddress: recipientAddress || profile.wallet_address,
      enableForwarder,
    });

    return NextResponse.json({ success: true, estimate });
  } catch (error: any) {
    console.error("Gateway estimate error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to estimate Gateway transfer" },
      { status: 500 }
    );
  }
}
