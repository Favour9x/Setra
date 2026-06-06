import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/services/notification";
import { evaluateUserThresholdWorkflows } from "@/lib/services/threshold";
import { triggerIntentWorkflows } from "@/lib/workflows/intent-engine";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

interface CircleNotification {
  subscriptionId: string;
  notificationId: string;
  notificationType: string;
  notification: {
    id: string;
    state: string;
    amounts?: string[];
    blockchain?: string;
    createDate?: string;
    destinationAddress?: string;
    sourceAddress?: string;
    transactionHash?: string;
    walletId?: string;
    tokenId?: string;
  };
  timestamp: string;
  version: number;
}

export async function handleCircleWebhook(payload: CircleNotification) {
  const { notificationType, notification } = payload;
  const { id: circleTxId, state, amounts, destinationAddress, sourceAddress, transactionHash, walletId } = notification;

  console.log(`🔔 Webhook received: ${notificationType} state=${state} tx=${circleTxId}`);

  const terminalStates = ["COMPLETE", "COMPLETED", "FAILED"];
  if (!terminalStates.includes(state)) {
    console.log(`⏭️ Skipping non-terminal state: ${state}`);
    return;
  }

  const supabase = getAdminClient();
  const amount = amounts?.[0] ? parseFloat(amounts[0]) : 0;

  if (notificationType === "transactions.outbound") {
    await handleOutboundTransaction(supabase, circleTxId, state, transactionHash, amount, destinationAddress, walletId);
  } else if (notificationType === "transactions.inbound") {
    await handleInboundTransaction(supabase, circleTxId, state, transactionHash, amount, sourceAddress, destinationAddress, walletId);
  }
}

async function handleOutboundTransaction(
  supabase: any,
  circleTxId: string,
  state: string,
  txHash: string | undefined,
  amount: number,
  destinationAddress: string | undefined,
  walletId: string | undefined
) {
  const isComplete = state === "COMPLETED" || state === "COMPLETE";

  const { data: existing } = await supabase
    .from("transactions")
    .select("id, user_id, status, metadata")
    .filter("metadata->>transactionId", "eq", circleTxId)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    // Race condition: webhook arrived before API route finished DB insert.
    // Recover by looking up user from walletId.
    if (!walletId) {
      console.log(`⏭️ No walletId in webhook, cannot recover outbound tx ${circleTxId}`);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("wallet_id", walletId)
      .maybeSingle();
    if (!profile) {
      console.log(`⏭️ No profile for wallet ${walletId}, cannot recover outbound tx ${circleTxId}`);
      return;
    }
    await supabase.from("transactions").insert({
      user_id: profile.id,
      recipient: destinationAddress || "Unknown",
      amount,
      type: "expense",
      category: "Transfer",
      currency: "USDC",
      status: isComplete ? "confirmed" : "failed",
      tx_hash: txHash || null,
      metadata: {
        transactionId: circleTxId,
        blockchain: "ARC-TESTNET",
        recipient_address: destinationAddress || "",
      },
      created_at: new Date().toISOString(),
    });
    console.log(`✅ Webhook recovered missing outbound transaction record for ${circleTxId}`);

    if (isComplete && walletId) {
      await evaluateUserThresholdWorkflows(supabase, profile.id, walletId);
    }
    return;
  }

  await supabase
    .from("transactions")
    .update({
      status: isComplete ? "confirmed" : "failed",
      tx_hash: txHash || existing.tx_hash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (isComplete) {
    await createNotification(
      existing.user_id,
      "payment_sent",
      "Payment Confirmed",
      `Payment of $${amount} USDC confirmed on-chain`,
      { tx_hash: txHash, circle_transaction_id: circleTxId, link: "/transactions" }
    );
  }

  await tryAutoSplitInbound(supabase, destinationAddress, amount, txHash);

  if (isComplete && existing?.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_id")
      .eq("id", existing.user_id)
      .maybeSingle();
    if (profile?.wallet_id) {
      await evaluateUserThresholdWorkflows(supabase, existing.user_id, profile.wallet_id);
      // Also fire on_funds_received workflows for outbound tx recipients
    }
  }
}

async function handleInboundTransaction(
  supabase: any,
  circleTxId: string,
  state: string,
  txHash: string | undefined,
  amount: number,
  sourceAddress: string | undefined,
  destinationAddress: string | undefined,
  walletId: string | undefined
) {
  if (!txHash) {
    console.log(`⏭️ Skipping inbound tx ${circleTxId} without txHash`);
    return;
  }

  const isComplete = state === "COMPLETED" || state === "COMPLETE";

  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("tx_hash", txHash)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`⏭️ Inbound tx ${txHash} already recorded`);
    return;
  }

  if (!isComplete) {
    console.log(`⏭️ Inbound tx ${circleTxId} not complete: ${state}`);
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, wallet_id")
    .eq("wallet_address", destinationAddress)
    .maybeSingle();

  if (!profile) {
    console.log(`⏭️ Destination wallet ${destinationAddress} not a Setra user`);
    return;
  }

  await supabase.from("transactions").insert({
    user_id: profile.id,
    recipient: sourceAddress || "Unknown",
    amount,
    type: "income",
    category: "Payment Received",
    currency: "USDC",
    status: "success",
    tx_hash: txHash,
    metadata: {
      blockchain: "ARC-TESTNET",
      circle_transaction_id: circleTxId,
      sourceAddress,
      transactionType: "INBOUND",
    },
    created_at: new Date().toISOString(),
  });

  await createNotification(
    profile.id,
    "payment_received",
    "Payment Received",
    `You received $${amount} USDC`,
    { amount, tx_hash: txHash, link: "/transactions" }
  );

  // Trigger auto-save rules (percentage of incoming)
  try {
    const { data: savingsRules } = await supabase
      .from("savings_auto_rules")
      .select("*, savings_goals!inner(id, saved_amount, target_amount, user_id)")
      .eq("user_id", profile.id)
      .eq("rule_type", "percentage")
      .eq("active", true);

    for (const rule of savingsRules || []) {
      const pct = Number(rule.percentage) / 100;
      const saveAmt = Math.round(amount * pct * 100) / 100;
      if (saveAmt <= 0) continue;
      const goal = rule.savings_goals;
      if (!goal) continue;
      const newSaved = Number(goal.saved_amount) + saveAmt;
      await supabase.from("savings_goals").update({ saved_amount: newSaved, updated_at: new Date().toISOString() }).eq("id", rule.goal_id);
      await supabase.from("savings_transactions").insert({ goal_id: rule.goal_id, user_id: profile.id, type: "deposit", amount: saveAmt });
      if (newSaved >= Number(goal.target_amount)) {
        await createNotification(profile.id, "savings_goal_reached", "Savings Goal Reached", `You reached your savings goal: ${goal.name}`, { goal_id: rule.goal_id });
      }
    }
  } catch (e) {
    console.error("Auto-save trigger error:", e);
  }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, title, amount, status, user_id")
    .eq("recipient_address", destinationAddress)
    .eq("status", "pending");

  if (invoices) {
    for (const invoice of invoices) {
      if (Math.abs(invoice.amount - amount) < 0.01) {
        await supabase
          .from("invoices")
          .update({ status: "paid", payer_address: sourceAddress })
          .eq("id", invoice.id);

        await supabase
          .from("invoices")
          .update({ status: "paid", payer_address: sourceAddress })
          .eq("title", invoice.title)
          .eq("amount", invoice.amount)
          .eq("type", "received");

        const { data: payer } = await supabase
          .from("profiles")
          .select("username")
          .eq("wallet_address", sourceAddress)
          .maybeSingle();

        const payerDisplay = payer?.username ? `@${payer.username}` : "Someone";

        await createNotification(
          invoice.user_id,
          "invoice_paid",
          "Invoice Paid",
          `${payerDisplay} has paid your invoice of ${amount} USDC`,
          { invoice_id: invoice.id, amount, payer_address: sourceAddress, tx_hash: txHash, link: `/invoices/${invoice.id}` }
        );
      }
    }
  }

  await tryAutoSplitInbound(supabase, destinationAddress, amount, txHash);

  if (profile?.id) {
    const effectiveWalletId = walletId || profile.wallet_id;
    if (effectiveWalletId) {
      await evaluateUserThresholdWorkflows(supabase, profile.id, effectiveWalletId);
    }
    // Fire on_funds_received workflows (split_revenue, savings_sweep, auto_invoice_pay, conditional_transfer)
    await triggerIntentWorkflows(profile.id, "on_funds_received", {
      amount,
      walletId: effectiveWalletId || undefined,
    });
  }
}

async function tryAutoSplitInbound(
  supabase: any,
  destinationAddress: string | undefined,
  amount: number,
  txHash: string | undefined
) {
  if (!destinationAddress || amount <= 0) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("wallet_address", destinationAddress)
    .maybeSingle();

  if (!profile) return;

  const { data: workflows } = await supabase
    .from("automation_workflows")
    .select("id, config")
    .eq("user_id", profile.id)
    .eq("active", true)
    .eq("workflow_type", "split_revenue");

  const fallbackWorkflows = !workflows || workflows.length === 0
    ? await supabase
        .from("workflows")
        .select("id, config")
        .eq("user_id", profile.id)
        .eq("active", true)
        .eq("action_type", "split_revenue")
    : { data: [] };

  const allWorkflows = [...(workflows || []), ...(fallbackWorkflows.data || [])];

  for (const wf of allWorkflows) {
    const splits = wf.config?.splits || wf.config?.config?.splits || [];
    if (splits.length === 0) continue;

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("wallet_id")
      .eq("id", profile.id)
      .maybeSingle();

    if (!senderProfile?.wallet_id) continue;

    const { PaymentExecutorAgent } = await import("@/lib/agents/circle-agent");
    const executor = new PaymentExecutorAgent(profile.id);

    for (const split of splits) {
      const splitAmount = (amount * split.percentage) / 100;
      if (splitAmount <= 0) continue;

      const result = await executor.executePayment(
        senderProfile.wallet_id,
        split.address,
        splitAmount,
        `Auto-split: ${split.percentage}% to ${split.name || split.address}`
      );

      if (result.success) {
        console.log(`✅ Auto-split executed: $${splitAmount} to ${split.name || split.address}`);
      }
    }
  }
}
