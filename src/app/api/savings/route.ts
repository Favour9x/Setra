import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: goals, error: goalsError } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (goalsError) throw goalsError;

    const goalIds = goals?.map(g => g.id) || [];

    let activity: any[] = [];
    if (goalIds.length > 0) {
      const { data: txs, error: txsError } = await supabase
        .from("savings_transactions")
        .select("*, savings_goals(name)")
        .in("goal_id", goalIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (txsError) throw txsError;
      activity = txs || [];
    }

    const totalSaved = goals?.reduce((sum, g) => sum + Number(g.saved_amount), 0) || 0;
    const totalTarget = goals?.reduce((sum, g) => sum + Number(g.target_amount), 0) || 0;
    const completedGoals = goals?.filter(g => Number(g.saved_amount) >= Number(g.target_amount)).length || 0;

    const { data: rules, error: rulesError } = await supabase
      .from("savings_auto_rules")
      .select("*, savings_goals(name)")
      .eq("user_id", user.id)
      .eq("active", true);

    if (rulesError) throw rulesError;

    return NextResponse.json({
      success: true,
      goals,
      activity,
      rules: rules || [],
      summary: {
        totalSaved,
        totalTarget,
        goalCount: goals?.length || 0,
        completedGoals,
        remainingToTarget: Math.max(0, totalTarget - totalSaved),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, target_amount, vault_type, target_date, locked_until_amount } = body;

    if (!name || !target_amount) {
      return NextResponse.json({ success: false, error: "name and target_amount are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("savings_goals")
      .insert({
        user_id: user.id,
        name,
        target_amount,
        vault_type: vault_type || "flexible",
        target_date: target_date || null,
        locked_until_amount: locked_until_amount || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, goal: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}