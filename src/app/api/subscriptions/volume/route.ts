import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/services/ledger";

const DAYS_IN_MONTH = 30;
const DAYS_IN_YEAR = 365;
const WEEKS_IN_YEAR = 52;
const MONTHS_IN_YEAR = 12;

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminSupabase();

    const { data: subscriptions, error } = await adminClient
      .from("subscriptions")
      .select("amount, frequency, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) {
      console.error("Volume API query error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let dailyVolume = 0;
    let weeklyVolume = 0;
    let monthlyVolume = 0;
    let yearlyVolume = 0;

    for (const sub of subscriptions || []) {
      const amount = Number(sub.amount) || 0;
      if (amount <= 0) continue;

      switch (sub.frequency) {
        case "daily":
          dailyVolume += amount;
          weeklyVolume += amount * 7;
          monthlyVolume += amount * DAYS_IN_MONTH;
          yearlyVolume += amount * DAYS_IN_YEAR;
          break;
        case "weekly":
          dailyVolume += amount / 7;
          weeklyVolume += amount;
          monthlyVolume += (amount * WEEKS_IN_YEAR) / MONTHS_IN_YEAR;
          yearlyVolume += amount * WEEKS_IN_YEAR;
          break;
        case "monthly":
          dailyVolume += amount / DAYS_IN_MONTH;
          weeklyVolume += (amount * MONTHS_IN_YEAR) / WEEKS_IN_YEAR;
          monthlyVolume += amount;
          yearlyVolume += amount * MONTHS_IN_YEAR;
          break;
        case "yearly":
          dailyVolume += amount / DAYS_IN_YEAR;
          weeklyVolume += amount / WEEKS_IN_YEAR;
          monthlyVolume += amount / MONTHS_IN_YEAR;
          yearlyVolume += amount;
          break;
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
