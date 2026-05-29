import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const body = await request.json();
    const { amount, frequency, senderAddress, senderUsername } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!["weekly", "monthly"].includes(frequency)) {
      return NextResponse.json({ error: "Frequency must be weekly or monthly" }, { status: 400 });
    }

    const client = adminClient();

    const { data: creatorProfile } = await client
      .from("profiles")
      .select("id, wallet_address")
      .eq("username", username.toLowerCase())
      .single();

    if (!creatorProfile) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    const { data: tipsPage } = await client
      .from("payment_links")
      .select("id, title")
      .eq("creator_username", username.toLowerCase())
      .eq("is_tips_page", true)
      .single();

    const nextBilling = new Date();
    if (frequency === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);
    else nextBilling.setMonth(nextBilling.getMonth() + 1);

    const { data: subscription, error } = await client
      .from("subscriptions")
      .insert({
        user_id: creatorProfile.id,
        name: `Recurring Tip for @${username}`,
        amount: Number(amount),
        currency: "USDC",
        recipient_address: creatorProfile.wallet_address,
        frequency,
        status: "active",
        next_billing_date: nextBilling.toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (tipsPage) {
      await client.from("tip_messages").insert({
        payment_link_id: tipsPage.id,
        sender_address: senderAddress || "anonymous",
        sender_username: senderUsername || null,
        amount: Number(amount),
        message: `Recurring ${frequency} tip started`,
        is_recurring: true,
        recurring_frequency: frequency,
        subscription_id: subscription.id,
      });
    }

    return NextResponse.json({ success: true, subscription });
  } catch (error: any) {
    console.error("Recurring tip error:", error);
    return NextResponse.json({ error: error.message || "Failed to setup recurring tip" }, { status: 500 });
  }
}
