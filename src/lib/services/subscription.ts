import { createClient } from "@supabase/supabase-js";
import { executePayment } from "@/lib/payments";
import { insertRecipientReceivedTransaction } from "@/lib/services/ledger";

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  recipient_address: string;
  frequency: "weekly" | "monthly" | "yearly";
  status: "active" | "paused" | "cancelled";
  next_billing_date: string;
  created_at: string;
}

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function createSubscription(
  userId: string,
  data: Omit<Subscription, "id" | "user_id" | "created_at" | "status" | "next_billing_date">,
  supabase?: any
): Promise<Subscription> {
  const client = supabase || getAdminClient();
  
  // Calculate next billing date based on current time
  const nextBilling = new Date();
  if (data.frequency === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);
  else if (data.frequency === "yearly") nextBilling.setDate(nextBilling.getDate() + 365);
  else nextBilling.setDate(nextBilling.getDate() + 30); // Monthly DEFAULT (30 days)

  const { data: inserted, error } = await client
    .from("subscriptions")
    .insert({
      user_id: userId,
      name: data.name,
      amount: Number(data.amount),
      currency: data.currency || "USDC",
      recipient_address: data.recipient_address,
      frequency: data.frequency || "monthly",
      status: "active",
      next_billing_date: nextBilling.toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Supabase error inserting subscription:", error.message);
    throw error;
  }

  return inserted as Subscription;
}

export async function fetchSubscriptions(userId: string, supabase?: any): Promise<Subscription[]> {
  const client = supabase || getAdminClient();

  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Supabase error loading subscriptions:", error.message);
    throw error;
  }

  return data as Subscription[];
}

export async function updateSubscriptionStatus(
  id: string, 
  status: "active" | "paused" | "cancelled",
  supabase?: any
): Promise<boolean> {
  const client = supabase || getAdminClient();

  const { error } = await client
    .from("subscriptions")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error(`❌ Supabase error updating subscription status for id ${id}:`, error.message);
    throw error;
  }
  return true;
}

export async function processRenewal(
  subscriptionId: string, 
  payingWalletId: string, 
  payingUserId: string,
  supabase?: any
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  const client = supabase || getAdminClient();

  try {
    // Find subscription
    const { data: subscriptionData, error: fetchError } = await client
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .single();

    if (fetchError || !subscriptionData) {
      return { success: false, error: "Subscription not found" };
    }

    const subscription = subscriptionData as Subscription;

    if (subscription.status !== "active") {
      return { success: false, error: "Subscription is not active" };
    }

    console.log(`🔄 Renewing subscription ${subscription.name} ($${subscription.amount} USDC)...`);

    // Execute standard Circle USDC payment
    const paymentResult = await executePayment({
      fromWalletId: payingWalletId,
      toAddress: subscription.recipient_address,
      amount: String(subscription.amount),
      type: "USDC"
    });

    if (!paymentResult.success) {
      return { success: false, error: paymentResult.error || "Circle payment failed" };
    }

    // Check for duplicate before inserting
    if (paymentResult.txHash) {
      const { data: existing } = await client
        .from("transactions")
        .select("id")
        .eq("tx_hash", paymentResult.txHash)
        .maybeSingle();
      
      if (existing) {
        console.log(`⚠️ Transaction ${paymentResult.txHash} already recorded, skipping duplicate`);
        // Still update subscription billing date
        const nextBilling = new Date(subscription.next_billing_date);
        if (subscription.frequency === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);
        else if (subscription.frequency === "yearly") nextBilling.setDate(nextBilling.getDate() + 365);
        else nextBilling.setDate(nextBilling.getDate() + 30);
        
        await client
          .from("subscriptions")
          .update({ next_billing_date: nextBilling.toISOString() })
          .eq("id", subscriptionId);
        
        return { success: true, txHash: paymentResult.txHash };
      }
    }

    // Calculate new next_billing_date
    const nextBilling = new Date(subscription.next_billing_date);
    if (subscription.frequency === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);
    else if (subscription.frequency === "yearly") nextBilling.setDate(nextBilling.getDate() + 365);
    else nextBilling.setDate(nextBilling.getDate() + 30); // monthly (30 days)

    // Update next_billing_date in Supabase
    const { error: updateError } = await client
      .from("subscriptions")
      .update({ next_billing_date: nextBilling.toISOString() })
      .eq("id", subscriptionId);

    if (updateError) {
      console.error("❌ Failed to update subscription billing date in Supabase:", updateError.message);
      throw updateError;
    }

    // Create dynamic transaction log for sender
    const { error: txError } = await client.from("transactions").insert({
      user_id: payingUserId,
      recipient: subscription.recipient_address,
      amount: subscription.amount,
      type: "expense",
      category: "Subscription",
      currency: "USDC",
      status: "success",
      tx_hash: paymentResult.txHash,
      metadata: {
        subscriptionId: subscriptionId,
        subscriptionName: subscription.name,
        blockchain: "ARC-TESTNET",
        transactionId: paymentResult.transactionId
      }
    });

    if (txError) {
      console.warn("⚠️ Failed to write transaction log for subscription renewal:", txError.message);
    }

    // Insert recipient's received transaction record
    await insertRecipientReceivedTransaction(client, {
      destinationAddress: subscription.recipient_address,
      amount: subscription.amount,
      txHash: paymentResult.txHash,
      category: "Subscription",
      metadata: {
        subscriptionId: subscriptionId,
        subscriptionName: subscription.name,
      }
    });

    return { 
      success: true, 
      txHash: paymentResult.txHash 
    };
  } catch (error: any) {
    console.error("❌ Error processing subscription renewal:", error);
    return { success: false, error: error.message || "Renewal execution failed" };
  }
}
