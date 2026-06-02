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

    // Local time boundaries (user's timezone)
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Week start (Monday of current week)
    const dow = now.getDay();
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);

    // Today start
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch ALL expense transactions for this user
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("amount, created_at, metadata")
      .eq("user_id", user.id)
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
      // Only count transactions that have subscriptionId in metadata
      const meta = tx.metadata;
      if (!meta || typeof meta !== "object" || !("subscriptionId" in meta)) continue;

      const created = new Date(tx.created_at);
      if (isNaN(created.getTime())) continue;

      const amount = parseFloat(String(tx.amount ?? "0"));

      if (created >= yearStart) {
        yearlyVolume += amount;
        if (created >= monthStart) {
          monthlyVolume += amount;
          if (created >= weekStart) {
            weeklyVolume += amount;
            if (created >= todayStart) {
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
