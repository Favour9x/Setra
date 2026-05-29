import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { updateSubscriptionStatus } from "@/lib/services/subscription";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subscriptionId } = await params;
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status, cancel_at_period_end } = body;

    if (status && !["active", "paused", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Verify ownership
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (!subscription || subscription.user_id !== session.user.id) {
      return NextResponse.json({ error: "Subscription not found or unauthorized" }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (status) updateData.status = status;
    if (cancel_at_period_end !== undefined) updateData.cancel_at_period_end = cancel_at_period_end;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update(updateData)
      .eq("id", subscriptionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update subscription status error:", error);
    return NextResponse.json({ error: error.message || "Failed to update status" }, { status: 500 });
  }
}
