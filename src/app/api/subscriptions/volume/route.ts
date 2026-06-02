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

    // Start of today (UTC midnight)
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStartStr = todayStart.toISOString();

    // Start of current week (Monday UTC midnight)
    const dow = now.getUTCDay();
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - daysFromMonday);
    const weekStartStr = weekStart.toISOString();

    // Start of current month (UTC midnight 1st)
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthStartStr = monthStart.toISOString();

    // Start of current year (UTC midnight Jan 1)
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const yearStartStr = yearStart.toISOString();

    // Fetch ALL subscription transactions for this user (no date filter — filter in code)
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("user_id", user.id)
      .eq("category", "Subscription")
      .eq("type", "expense")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let dailyVolume = 0;
    let weeklyVolume = 0;
    let monthlyVolume = 0;
    let yearlyVolume = 0;

    for (const tx of txns || []) {
      const created = String(tx.created_at);
      const amount = parseFloat(String(tx.amount || "0"));

      // Compare using ISO strings directly (reliable string comparison for UTC ISO dates)
      if (created >= yearStartStr) {
        yearlyVolume += amount;
        if (created >= monthStartStr) {
          monthlyVolume += amount;
          if (created >= weekStartStr) {
            weeklyVolume += amount;
            if (created >= todayStartStr) {
              dailyVolume += amount;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      volumes: {
        daily: dailyVolume,
        weekly: weeklyVolume,
        monthly: monthlyVolume,
        yearly: yearlyVolume,
      },
    });
  } catch (error: any) {
    console.error("Volume API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
