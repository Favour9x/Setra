import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/services/notification";

export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Checking recent inbound tips transactions...");

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: paymentLinks } = await adminSupabase
      .from("payment_links")
      .select("id, user_id, recipient_address, title, amount")
      .eq("active", true);

    if (!paymentLinks || paymentLinks.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const userIds = [...new Set(paymentLinks.map(link => link.user_id))];

    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id, wallet_address")
      .in("id", userIds);

    if (!profiles) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let processedCount = 0;

    for (const profile of profiles) {
      if (!profile.wallet_address) continue;

      const recentCutoff = new Date(Date.now() - 300000).toISOString();

      const { data: recentTx } = await adminSupabase
        .from("transactions")
        .select("tx_hash, amount, metadata")
        .eq("user_id", profile.id)
        .eq("type", "income")
        .eq("status", "success")
        .gte("created_at", recentCutoff);

      if (!recentTx || recentTx.length === 0) continue;

      for (const tx of recentTx) {
        const amount = parseFloat(tx.amount || "0");
        if (amount <= 0) continue;

        const txHash = tx.tx_hash;
        if (!txHash) continue;

        const { data: existingNotif } = await adminSupabase
          .from("notifications")
          .select("id")
          .eq("user_id", profile.id)
          .eq("metadata->>tx_hash", txHash)
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          await createNotification(
            profile.id,
            "payment_received",
            "Payment Received",
            `You received ${amount} USDC via Tips`,
            { amount, tx_hash: txHash, link: "/transactions" }
          );
          processedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, processed: processedCount });
  } catch (error: any) {
    console.error("❌ Tips check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
