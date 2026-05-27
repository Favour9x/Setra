import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createTipsPage } from "@/lib/services/tips";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { title, goal_title, goal_amount, bronze_amount, silver_amount, gold_amount } = body;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, wallet_address")
      .eq("id", session.user.id)
      .single();

    if (!profile?.username) return NextResponse.json({ error: "You need a username first" }, { status: 400 });
    if (!profile?.wallet_address) return NextResponse.json({ error: "No wallet found" }, { status: 400 });

    const page = await createTipsPage(
      session.user.id,
      title || "Tips",
      profile.username,
      profile.wallet_address,
      goal_title,
      goal_amount ? Number(goal_amount) : undefined,
      bronze_amount ? Number(bronze_amount) : undefined,
      silver_amount ? Number(silver_amount) : undefined,
      gold_amount ? Number(gold_amount) : undefined
    );

    return NextResponse.json({ success: true, page, shareableUrl: `/pay/${profile.username}` });
  } catch (error: any) {
    console.error("Create tips page error:", error);
    return NextResponse.json({ error: error.message || "Failed to create tips page" }, { status: 500 });
  }
}
