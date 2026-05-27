import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executePayment } from "@/lib/payments";
import { createNotification } from "@/lib/services/notification";
import { insertRecipientReceivedTransaction } from "@/lib/services/ledger";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Processing subscription billing cycle...");
    
    // Fetch all active subscriptions where next_billing_date <= now
    const now = new Date().toISOString();
    const { data: dueSubscriptions, error: fetchError } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .lte("next_billing_date", now);

    if (fetchError) {
      console.error("❌ Failed to fetch due subscriptions:", fetchError);
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    if (!dueSubscriptions || dueSubscriptions.length === 0) {
      console.log("✅ No subscriptions due for billing");
      return NextResponse.json({ success: true, processed: 0, message: "No subscriptions due" });
    }

    console.log(`📋 Found ${dueSubscriptions.length} subscriptions due for billing`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const subscription of dueSubscriptions) {
      try {
        console.log(`💳 Processing subscription: ${subscription.name} ($${subscription.amount} USDC)`);

        // Get user's wallet_id
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("wallet_id")
          .eq("id", subscription.user_id)
          .maybeSingle();

        if (!profile?.wallet_id) {
          console.error(`❌ No wallet found for user ${subscription.user_id}`);
          failCount++;
          results.push({ id: subscription.id, success: false, error: "No wallet found" });
          continue;
        }

        // Execute Circle payment
        const paymentResult = await executePayment({
          fromWalletId: profile.wallet_id,
          toAddress: subscription.recipient_address,
          amount: String(subscription.amount),
          type: "USDC"
        });

        if (!paymentResult.success) {
          console.error(`❌ Payment failed for subscription ${subscription.id}:`, paymentResult.error);
          failCount++;
          results.push({ id: subscription.id, success: false, error: paymentResult.error });
          continue;
        }

        console.log(`✅ Payment successful: ${paymentResult.txHash}`);

        // Calculate next billing date
        const nextBilling = new Date(subscription.next_billing_date);
        if (subscription.frequency === "weekly") {
          nextBilling.setDate(nextBilling.getDate() + 7);
        } else if (subscription.frequency === "yearly") {
          nextBilling.setDate(nextBilling.getDate() + 365);
        } else {
          nextBilling.setDate(nextBilling.getDate() + 30);
        }

        // Update subscription next_billing_date
        await supabaseAdmin
          .from("subscriptions")
          .update({ next_billing_date: nextBilling.toISOString() })
          .eq("id", subscription.id);

        // Check for duplicate before inserting
        if (paymentResult.txHash) {
          const { data: existing } = await supabaseAdmin
            .from("transactions")
            .select("id")
            .eq("tx_hash", paymentResult.txHash)
            .maybeSingle();
          
          if (!existing) {
            // Save sender's transaction only if not duplicate
            await supabaseAdmin.from("transactions").insert({
              user_id: subscription.user_id,
              recipient: subscription.recipient_address,
              amount: subscription.amount,
              type: "expense",
              category: "Subscription",
              currency: "USDC",
              status: "success",
              tx_hash: paymentResult.txHash,
              metadata: {
                subscriptionId: subscription.id,
                subscriptionName: subscription.name,
                blockchain: "ARC-TESTNET",
                transactionId: paymentResult.transactionId
              },
              created_at: new Date().toISOString()
            });

            // Insert recipient's received transaction record
            await insertRecipientReceivedTransaction(supabaseAdmin, {
              destinationAddress: subscription.recipient_address,
              amount: subscription.amount,
              txHash: paymentResult.txHash,
              category: "Subscription",
              metadata: {
                subscriptionId: subscription.id,
                subscriptionName: subscription.name,
              }
            });
          } else {
            console.log(`⚠️ Transaction ${paymentResult.txHash} already recorded, skipping duplicate`);
          }
        }

        // Send notification
        await createNotification(
          subscription.user_id,
          "subscription_renewed",
          "Subscription Payment Processed",
          `Subscription "${subscription.name}" payment of ${subscription.amount} USDC processed successfully`,
          { 
            subscription_id: subscription.id, 
            amount: subscription.amount,
            tx_hash: paymentResult.txHash
          }
        );

        successCount++;
        results.push({ 
          id: subscription.id, 
          success: true, 
          txHash: paymentResult.txHash,
          nextBilling: nextBilling.toISOString()
        });

        console.log(`✅ Subscription ${subscription.name} processed successfully`);
      } catch (error: any) {
        console.error(`❌ Error processing subscription ${subscription.id}:`, error);
        failCount++;
        results.push({ id: subscription.id, success: false, error: error.message });
      }
    }

    console.log(`🎯 Billing cycle complete: ${successCount} successful, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      processed: dueSubscriptions.length,
      successful: successCount,
      failed: failCount,
      results
    });
  } catch (error: any) {
    console.error("❌ Subscription processing error:", error);
    return NextResponse.json({ error: error.message || "Processing failed" }, { status: 500 });
  }
}
