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

    const { data: balance, error: balanceError } = await supabase
      .from("balances")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (balanceError) throw balanceError;

    const currentBalance = Number(balance?.balance || 0);
    if (currentBalance < amount) {
      return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });
    }

    const newBalance = currentBalance - amount;
    const newSavedAmount = Number(goal.saved_amount) + amount;

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
        type: "deposit",
        amount,
      });

    if (txError) throw txError;

    const goalReached = newSavedAmount >= Number(goal.target_amount);

    return NextResponse.json({
      success: true,
      goal: { ...goal, saved_amount: newSavedAmount },
      newBalance,
      goalReached,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}