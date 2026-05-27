import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { updateTipsPage } from "@/lib/services/tips";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { title, goal_title, goal_amount, bronze_amount, silver_amount, gold_amount, active } = body;

    await updateTipsPage(session.user.id, {
      ...(title !== undefined ? { title } : {}),
      ...(goal_title !== undefined ? { goal_title: goal_title || null } : {}),
      ...(goal_amount !== undefined ? { goal_amount: goal_amount ? Number(goal_amount) : null } : {}),
      ...(bronze_amount !== undefined ? { bronze_amount: bronze_amount ? Number(bronze_amount) : null } : {}),
      ...(silver_amount !== undefined ? { silver_amount: silver_amount ? Number(silver_amount) : null } : {}),
      ...(gold_amount !== undefined ? { gold_amount: gold_amount ? Number(gold_amount) : null } : {}),
      ...(active !== undefined ? { active } : {}),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update tips page error:", error);
    return NextResponse.json({ error: error.message || "Failed to update tips page" }, { status: 500 });
  }
}
