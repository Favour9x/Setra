import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/services/ledger";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminSupabase();

    const now = new Date();

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dow = now.getDay();
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const { data: txns, error } = await adminClient
      .from("transactions")
      .select("amount, created_at, metadata, category")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Volume API query error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let dailyVolume = 0;
    let weeklyVolume = 0;
    let monthlyVolume = 0;
    let yearlyVolume = 0;

    for (const tx of txns || []) {
      let meta: any = tx.metadata;
      if (typeof meta === "string") {
        try { meta = JSON.parse(meta); } catch { meta = null; }
      }
      if (!meta || typeof meta !== "object") continue;

      const hasSubscriptionId = "subscriptionId" in meta;
      const isSubscriptionCat = String(tx.category ?? "") === "Subscription";
      if (!hasSubscriptionId && !isSubscriptionCat) continue;

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
