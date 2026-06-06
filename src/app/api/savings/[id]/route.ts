import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: goal } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!goal) {
      return NextResponse.json({ success: false, error: "Goal not found" }, { status: 404 });
    }

    if (Number(goal.saved_amount) > 0) {
      const { data: balance } = await supabase
        .from("balances")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      const newBalance = (balance?.balance || 0) + Number(goal.saved_amount);

      await supabase
        .from("balances")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    const { error } = await supabase
      .from("savings_goals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}