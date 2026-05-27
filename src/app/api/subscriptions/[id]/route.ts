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

    const { status } = await request.json();

    if (!status || !["active", "paused", "cancelled"].includes(status)) {
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

    await updateSubscriptionStatus(subscriptionId, status, supabase);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update subscription status error:", error);
    return NextResponse.json({ error: error.message || "Failed to update status" }, { status: 500 });
  }
}
