import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Start of today (UTC)
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Start of current week (Monday UTC)
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);

    // Start of current month (UTC)
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("user_id", user.id)
      .eq("category", "Subscription")
      .gte("created_at", monthStart.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let dailyVolume = 0;
    let weeklyVolume = 0;
    let monthlyVolume = 0;

    for (const tx of transactions || []) {
      const txDate = new Date(tx.created_at);
      const amount = Number(tx.amount || 0);

      if (txDate >= todayStart) {
        dailyVolume += amount;
      }
      if (txDate >= weekStart) {
        weeklyVolume += amount;
      }
      if (txDate >= monthStart) {
        monthlyVolume += amount;
      }
    }

    return NextResponse.json({
      success: true,
      volumes: {
        daily: dailyVolume,
        weekly: weeklyVolume,
        monthly: monthlyVolume,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
