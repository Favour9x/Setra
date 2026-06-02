import { createClient } from "@supabase/supabase-js";
import { executePayment, getUSDCBalance } from "@/lib/payments";
import { insertRecipientReceivedTransaction } from "@/lib/services/ledger";
import { createNotification } from "@/lib/services/notification";

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  recipient_address: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  status: "active" | "paused" | "cancelled";
  cancel_at_period_end: boolean;
  retry_count: number;
  start_date: string | null;
  next_billing_date: string;
  created_at: string;
  payer_wallet_id?: string | null;
}

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function createSubscription(
  userId: string,
  data: Omit<Subscription, "id" | "user_id" | "created_at" | "status" | "next_billing_date" | "cancel_at_period_end" | "retry_count" | "start_date"> & { cancel_at_period_end?: boolean; start_date?: string },
  supabase?: any
): Promise<Subscription> {
  const client = supabase || getAdminClient();

  let nextBilling: Date;
  let startDate: string | null = null;

  if (data.start_date) {
    nextBilling = new Date(data.start_date);
    startDate = nextBilling.toISOString();
  } else {
    nextBilling = new Date();
    if (data.frequency === "daily") nextBilling.setDate(nextBilling.getDate() + 1);
    else if (data.frequency === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);
    else if (data.frequency === "yearly") nextBilling.setDate(nextBilling.getDate() + 365);
    else nextBilling.setMonth(nextBilling.getMonth() + 1);
  }

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
      cancel_at_period_end: data.cancel_at_period_end || false,
      retry_count: 0,
      start_date: startDate,
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

export interface ProcessResult {
  success: boolean;
  id: string;
  error?: string;
  txHash?: string;
  retry_count?: number;
}

export async function processDueSubscriptions(
  client: any
): Promise<{ processed: number; successful: number; failed: number; results: ProcessResult[] }> {
  const now = new Date().toISOString();
  const { data: dueSubscriptions, error: fetchError } = await client
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lte("next_billing_date", now);

  if (fetchError) {
    console.error("Failed to fetch due subscriptions:", fetchError);
    throw fetchError;
  }

  if (!dueSubscriptions || dueSubscriptions.length === 0) {
    return { processed: 0, successful: 0, failed: 0, results: [] };
  }

  const results: ProcessResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const subscription of dueSubscriptions) {
    try {
      let fromWalletId = subscription.payer_wallet_id;
      if (!fromWalletId) {
        const { data: profile } = await client
          .from("profiles")
          .select("wallet_id")
          .eq("id", subscription.user_id)
          .maybeSingle();

        if (!profile?.wallet_id) {
          failCount++;
          results.push({ id: subscription.id, success: false, error: "No wallet found" });
          continue;
        }
        fromWalletId = profile.wallet_id;
      }

      const balanceStr = await getUSDCBalance(fromWalletId).catch(() => "0");
      const balance = parseFloat(balanceStr);
      if (balance < subscription.amount) {
        const newRetryCount = (subscription.retry_count || 0) + 1;
        if (newRetryCount >= 3) {
          await client
            .from("subscriptions")
            .update({ status: "paused", retry_count: newRetryCount })
            .eq("id", subscription.id);
          await createNotification(
            subscription.user_id,
            "subscription_paused",
            "Subscription Auto-Paused",
            `Subscription "${subscription.name}" was paused after ${newRetryCount} failed payment attempts (insufficient balance: ${balance} USDC)`,
            { subscription_id: subscription.id, retry_count: newRetryCount, reason: "insufficient_balance", balance }
          );
        } else {
          await client
            .from("subscriptions")
            .update({ retry_count: newRetryCount })
            .eq("id", subscription.id);
          await createNotification(
            subscription.user_id,
            "subscription_renewal_failed",
            "Insufficient Balance",
            `Subscription "${subscription.name}" payment of ${subscription.amount} USDC failed — wallet has only ${balance} USDC (attempt ${newRetryCount})`,
            { subscription_id: subscription.id, retry_count: newRetryCount, reason: "insufficient_balance", balance }
          );
        }
        failCount++;
        results.push({ id: subscription.id, success: false, error: "Insufficient balance", retry_count: newRetryCount });
        continue;
      }

      const paymentResult = await executePayment({
        fromWalletId,
        toAddress: subscription.recipient_address,
        amount: String(subscription.amount),
        type: "USDC"
      });

      if (!paymentResult.success) {
        const newRetryCount = (subscription.retry_count || 0) + 1;
        if (newRetryCount >= 3) {
          await client
            .from("subscriptions")
            .update({ status: "paused", retry_count: newRetryCount })
            .eq("id", subscription.id);
          await createNotification(
            subscription.user_id,
            "subscription_paused",
            "Subscription Auto-Paused",
            `Subscription "${subscription.name}" was paused after ${newRetryCount} failed payment attempts`,
            { subscription_id: subscription.id, retry_count: newRetryCount }
          );
        } else {
          await client
            .from("subscriptions")
            .update({ retry_count: newRetryCount })
            .eq("id", subscription.id);
          await createNotification(
            subscription.user_id,
            "subscription_renewal_failed",
            "Subscription Payment Failed",
            `Subscription "${subscription.name}" payment failed (attempt ${newRetryCount}). Next retry will be on the next billing cycle.`,
            { subscription_id: subscription.id, retry_count: newRetryCount }
          );
        }
        failCount++;
        results.push({ id: subscription.id, success: false, error: paymentResult.error, retry_count: newRetryCount });
        continue;
      }

      await client
        .from("subscriptions")
        .update({ retry_count: 0 })
        .eq("id", subscription.id);

      const nextBilling = new Date(subscription.next_billing_date);
      if (subscription.frequency === "daily") nextBilling.setDate(nextBilling.getDate() + 1);
      else if (subscription.frequency === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);
      else if (subscription.frequency === "yearly") nextBilling.setDate(nextBilling.getDate() + 365);
      else nextBilling.setMonth(nextBilling.getMonth() + 1);

      await client
        .from("subscriptions")
        .update({ next_billing_date: nextBilling.toISOString() })
        .eq("id", subscription.id);

      if (paymentResult.txHash) {
        const { data: existing } = await client
          .from("transactions")
          .select("id")
          .eq("tx_hash", paymentResult.txHash)
          .maybeSingle();

        if (!existing) {
          await client.from("transactions").insert({
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

          await insertRecipientReceivedTransaction(client, {
            destinationAddress: subscription.recipient_address,
            amount: subscription.amount,
            txHash: paymentResult.txHash,
            category: "Subscription",
            metadata: {
              subscriptionId: subscription.id,
              subscriptionName: subscription.name,
            }
          });
        }
      }

      await createNotification(
        subscription.user_id,
        "subscription_renewed",
        "Subscription Payment Processed",
        `Subscription "${subscription.name}" payment of ${subscription.amount} USDC processed successfully`,
        { subscription_id: subscription.id, amount: subscription.amount, tx_hash: paymentResult.txHash }
      );

      successCount++;
      results.push({ id: subscription.id, success: true, txHash: paymentResult.txHash, retry_count: 0 });
    } catch (error: any) {
      failCount++;
      results.push({ id: subscription.id, success: false, error: error.message });
    }
  }

  return { processed: dueSubscriptions.length, successful: successCount, failed: failCount, results };
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
        if (subscription.frequency === "daily") nextBilling.setDate(nextBilling.getDate() + 1);
        else if (subscription.frequency === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);
        else if (subscription.frequency === "yearly") nextBilling.setDate(nextBilling.getDate() + 365);
        else nextBilling.setMonth(nextBilling.getMonth() + 1);
        
        await client
          .from("subscriptions")
          .update({ next_billing_date: nextBilling.toISOString() })
          .eq("id", subscriptionId);
        
        return { success: true, txHash: paymentResult.txHash };
      }
    }

    // Calculate new next_billing_date
    const nextBilling = new Date(subscription.next_billing_date);
    if (subscription.frequency === "daily") nextBilling.setDate(nextBilling.getDate() + 1);
    else if (subscription.frequency === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);
    else if (subscription.frequency === "yearly") nextBilling.setDate(nextBilling.getDate() + 365);
    else nextBilling.setMonth(nextBilling.getMonth() + 1); // monthly (30 days)

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
      },
      created_at: new Date().toISOString()
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
