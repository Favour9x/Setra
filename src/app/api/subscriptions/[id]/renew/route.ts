import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { processRenewal } from "@/lib/services/subscription";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subscriptionId } = await params;
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Get user profile wallet_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.wallet_id) {
      return NextResponse.json({ error: "Paying wallet not found" }, { status: 400 });
    }

    const renewResult = await processRenewal(
      subscriptionId,
      profile.wallet_id,
      user.id
    );

    if (!renewResult.success) {
      return NextResponse.json({ error: renewResult.error || "Renewal failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, txHash: renewResult.txHash });
  } catch (error: any) {
    console.error("Subscription renewal API error:", error);
    return NextResponse.json({ error: error.message || "Failed to renew subscription" }, { status: 500 });
  }
}
