import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: rules, error: rulesError } = await supabase
      .from("savings_auto_rules")
      .select("*, savings_goals!inner(id, saved_amount, target_amount, user_id)")
      .eq("rule_type", "fixed")
      .eq("active", true);

    if (rulesError) throw rulesError;

    const now = new Date();
    const results: any[] = [];

    for (const rule of rules || []) {
      const goal = rule.savings_goals;
      if (!goal) continue;

      const { data: lastTx } = await supabase
        .from("savings_transactions")
        .select("created_at")
        .eq("goal_id", rule.goal_id)
        .eq("type", "deposit")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const lastRun = lastTx ? new Date(lastTx.created_at) : new Date(0);
      const hoursSince = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
      let shouldRun = false;

      switch (rule.frequency) {
        case "daily":
          shouldRun = hoursSince >= 24;
          break;
        case "weekly":
          shouldRun = hoursSince >= 168;
          break;
        case "monthly":
          shouldRun = hoursSince >= 720;
          break;
      }

      if (!shouldRun) continue;

      const { data: balance } = await supabase
        .from("balances")
        .select("balance")
        .eq("user_id", goal.user_id)
        .single();

      const currentBalance = Number(balance?.balance || 0);
      const saveAmount = Math.min(Number(rule.amount), currentBalance);

      if (saveAmount <= 0) continue;

      const newSavedAmount = Number(goal.saved_amount) + saveAmount;

      const { error: updateBalError } = await supabase
        .from("balances")
        .update({ balance: currentBalance - saveAmount, updated_at: now.toISOString() })
        .eq("user_id", goal.user_id);

      if (updateBalError) continue;

      await supabase
        .from("savings_goals")
        .update({ saved_amount: newSavedAmount, updated_at: now.toISOString() })
        .eq("id", rule.goal_id);

      await supabase.from("savings_transactions").insert({
        goal_id: rule.goal_id,
        user_id: goal.user_id,
        type: "deposit",
        amount: saveAmount,
      });

      results.push({
        goal_id: rule.goal_id,
        goal_name: goal.name,
        amount: saveAmount,
        frequency: rule.frequency,
        goalReached: newSavedAmount >= Number(goal.target_amount),
      });
    }

    return NextResponse.json({ success: true, executed: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}