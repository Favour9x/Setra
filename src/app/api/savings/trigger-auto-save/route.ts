import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { user_id, received_amount } = body;

    if (!user_id || !received_amount) {
      return NextResponse.json({ success: false, error: "user_id and received_amount required" }, { status: 400 });
    }

    const { data: rules, error: rulesError } = await supabase
      .from("savings_auto_rules")
      .select("*, savings_goals!inner(id, saved_amount, target_amount, user_id)")
      .eq("user_id", user_id)
      .eq("rule_type", "percentage")
      .eq("active", true);

    if (rulesError) throw rulesError;

    const results: any[] = [];

    for (const rule of rules || []) {
      const percentage = Number(rule.percentage) / 100;
      const saveAmount = Math.round(received_amount * percentage * 100) / 100;

      if (saveAmount <= 0) continue;

      const goal = rule.savings_goals;
      if (!goal) continue;

      const newSavedAmount = Number(goal.saved_amount) + saveAmount;

      const { error: updateError } = await supabase
        .from("savings_goals")
        .update({ saved_amount: newSavedAmount, updated_at: new Date().toISOString() })
        .eq("id", rule.goal_id);

      if (updateError) continue;

      await supabase.from("savings_transactions").insert({
        goal_id: rule.goal_id,
        user_id,
        type: "deposit",
        amount: saveAmount,
      });

      results.push({
        goal_id: rule.goal_id,
        goal_name: goal.name,
        amount: saveAmount,
        goalReached: newSavedAmount >= Number(goal.target_amount),
      });
    }

    return NextResponse.json({ success: true, autoSaves: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}