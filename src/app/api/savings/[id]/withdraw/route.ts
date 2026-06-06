import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Valid amount is required" }, { status: 400 });
    }

    const { data: goal, error: goalError } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (goalError || !goal) {
      return NextResponse.json({ success: false, error: "Goal not found" }, { status: 404 });
    }

    if (goal.vault_type === "locked") {
      if (goal.locked_until_amount && Number(goal.saved_amount) < Number(goal.locked_until_amount)) {
        return NextResponse.json({
          success: false,
          error: `This locked vault requires at least ${goal.locked_until_amount} USDC saved before withdrawals. Currently saved: ${goal.saved_amount} USDC`,
        }, { status: 400 });
      }
      if (goal.target_date && new Date(goal.target_date) > new Date()) {
        return NextResponse.json({
          success: false,
          error: `This locked vault cannot be withdrawn from until ${new Date(goal.target_date).toLocaleDateString()}`,
        }, { status: 400 });
      }
    }

    if (Number(goal.saved_amount) < amount) {
      return NextResponse.json({ success: false, error: "Insufficient savings balance" }, { status: 400 });
    }

    const newSavedAmount = Number(goal.saved_amount) - amount;

    const { data: balance } = await supabase
      .from("balances")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    const currentBalance = Number(balance?.balance || 0);
    const newBalance = currentBalance + amount;

    const { error: updateBalError } = await supabase
      .from("balances")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (updateBalError) throw updateBalError;

    const { error: updateGoalError } = await supabase
      .from("savings_goals")
      .update({ saved_amount: newSavedAmount, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateGoalError) throw updateGoalError;

    const { error: txError } = await supabase
      .from("savings_transactions")
      .insert({
        goal_id: id,
        user_id: user.id,
        type: "withdrawal",
        amount,
      });

    if (txError) throw txError;

    return NextResponse.json({
      success: true,
      goal: { ...goal, saved_amount: newSavedAmount },
      newBalance,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}