import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { fetchSubscriptions, createSubscription } from "@/lib/services/subscription";
import { resolveRecipientAddress } from "@/lib/resolve-username";

// GET - List active subscriptions for user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const subscriptions = await fetchSubscriptions(user.id, supabase);
    return NextResponse.json({ success: true, subscriptions });
  } catch (error: any) {
    console.error("Fetch subscriptions API error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch subscriptions" }, { status: 500 });
  }
}

// POST - Setup new subscription
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const body = await request.json();
    const { name, amount, currency, recipient_address, frequency, cancel_at_period_end, start_date } = body;
    const requestUserId = body.userId || body.user_id;

    if (requestUserId && requestUserId !== user.id) {
      return NextResponse.json({ error: "Wrong user" }, { status: 403 });
    }

    if (!name || !amount || !recipient_address || !frequency) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let resolvedRecipientAddress;
    try {
      resolvedRecipientAddress = await resolveRecipientAddress(recipient_address);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Recipient not found on Setra" }, { status: 400 });
    }

    const subscription = await createSubscription(user.id, {
      name,
      amount: Number(amount),
      currency: currency || "USDC",
      recipient_address: resolvedRecipientAddress,
      frequency,
      cancel_at_period_end: cancel_at_period_end === true,
      start_date: start_date || undefined
    }, supabase);

    return NextResponse.json({ success: true, subscription });
  } catch (error: any) {
    console.error("Create subscription API error:", error);
    return NextResponse.json({ error: error.message || "Failed to create subscription" }, { status: 500 });
  }
}
