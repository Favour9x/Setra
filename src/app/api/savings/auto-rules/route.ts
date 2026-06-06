import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("savings_auto_rules")
      .select("*, savings_goals(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, rules: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { goal_id, rule_type, amount, percentage, frequency } = body;

    if (!goal_id || !rule_type) {
      return NextResponse.json({ success: false, error: "goal_id and rule_type are required" }, { status: 400 });
    }

    if (rule_type === "fixed" && (!amount || !frequency)) {
      return NextResponse.json({ success: false, error: "amount and frequency required for fixed rules" }, { status: 400 });
    }

    if (rule_type === "percentage" && !percentage) {
      return NextResponse.json({ success: false, error: "percentage required for percentage rules" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("savings_auto_rules")
      .insert({
        user_id: user.id,
        goal_id,
        rule_type,
        amount: rule_type === "fixed" ? amount : null,
        percentage: rule_type === "percentage" ? percentage : null,
        frequency: rule_type === "fixed" ? frequency : null,
      })
      .select("*, savings_goals(name)")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, rule: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}