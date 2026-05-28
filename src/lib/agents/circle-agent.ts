import { createClient } from "@supabase/supabase-js";
import { sendToken, getWalletBalance, createEmbeddedWallet } from "../circle/client";
import { createNotification, getUserHandleByWallet } from "../services/notification";

// Secure server-side Supabase admin client
const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

export interface AgentLog {
  id: string;
  userId: string;
  actionType: "payment_execution" | "invoice_monitoring" | "subscription_billing" | "revenue_splitting";
  status: "success" | "failed";
  details: string;
  amount?: number;
  txHash?: string;
  timestamp: string;
}

/**
 * Log Agent actions to Supabase for audit trail.
 * Inserts a log entry into the Supabase transactions table and custom agent_logs table.
 */
export async function logAgentAction(
  userId: string,
  actionType: AgentLog["actionType"],
  status: AgentLog["status"],
  details: string,
  amount?: number,
  txHashOrId?: string
): Promise<void> {
  const supabase = getAdminClient();
  const timestamp = new Date().toISOString();

  console.log(`🤖 [Circle Agent Stack]: Logging action [${actionType}] - Status: ${status} - Details: ${details}`);

  try {
    if (!txHashOrId) {
      console.log('logAgentAction: No txHashOrId, skipping transaction insert');
      return;
    }

    const txIdKey = txHashOrId.startsWith("0x") ? "tx_hash" : "tx_hash";

    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq(txIdKey, txHashOrId)
      .maybeSingle();

    if (existing) {
      console.log(`Transaction ${txHashOrId} already recorded, skipping duplicate`);
      return;
    }

    await supabase.from("transactions").insert({
      user_id: userId,
      recipient: "Circle Agent Wallet",
      amount: amount || 0,
      type: "expense",
      category: "Agent Action",
      currency: "USDC",
      status: status === "success" ? "success" : "failed",
      tx_hash: txHashOrId,
      metadata: {
        agentExecuted: true,
        agentType: "Circle AI Agent",
        actionType,
        details,
        timestamp
      }
    });
  } catch (err) {
    console.error("⚠️ Failed to write agent log to Supabase:", err);
  }
}

/**
 * ============================================================================
 * CIRCLE AGENT STACK INTEGRATION & FALLBACK CONFIGURATION
 * 
 * Future Integration Flag: Circle Agent Stack CLI & programmatic endpoints are
 * currently in Sandbox/Alpha. Under the hood, this agent implementation uses
 * Circle Developer-Controlled Wallets API as a robust, production-ready fallback.
 * 
 * To upgrade when Circle Agent Stack stabilizes, swap the Developer-Controlled
 * wallet calls in the Agent classes below to use 'circle wallet' CLI execution
 * or the official '@circle-fin/agent-sdk' (when released).
 * ============================================================================
 */

/**
 * Helper to fetch or dynamically provision the separate Agent Wallet.
 */
export async function getOrCreateAgentWallet(): Promise<{ walletId: string; walletAddress: string }> {
  const agentWalletId = process.env.CIRCLE_AGENT_WALLET_ID;
  const agentWalletAddress = process.env.CIRCLE_AGENT_WALLET_ADDRESS;

  if (agentWalletId && agentWalletAddress) {
    return { walletId: agentWalletId, walletAddress: agentWalletAddress };
  }

  console.log("🤖 [Circle Agent Stack]: No Agent Wallet configured in .env.local. Provisioning separate Agent Wallet...");
  const supabase = getAdminClient();
  
  // Check if we already created an agent wallet in the database profiles (e.g. for user 'circle-agent-system')
  const { data: agentProfile } = await supabase
    .from("profiles")
    .select("wallet_id, wallet_address")
    .eq("id", "circle-agent-system")
    .maybeSingle();

  if (agentProfile?.wallet_id && agentProfile?.wallet_address) {
    console.log("🤖 [Circle Agent Stack]: Found existing Agent Wallet in database:", agentProfile.wallet_id);
    return { walletId: agentProfile.wallet_id, walletAddress: agentProfile.wallet_address };
  }

  // Otherwise, dynamically create a separate developer-controlled wallet to act as the Agent Wallet
  try {
    const wallet = await createEmbeddedWallet("circle-agent-system");
    
    // Save to profiles database
    await supabase.from("profiles").upsert({
      id: "circle-agent-system",
      email: "agent@setra.fintech",
      wallet_id: wallet.walletId,
      wallet_address: wallet.walletAddress,
    });

    console.log("🤖 [Circle Agent Stack]: Successfully created separate Agent Wallet:", wallet);
    return { walletId: wallet.walletId, walletAddress: wallet.walletAddress };
  } catch (err) {
    console.error("🤖 [Circle Agent Stack]: Failed to create Agent Wallet via Circle SDK, using demo fallback:", err);
    return {
      walletId: "575d1e8b-e4e7-59b4-ae31-7c3a428bfe5a", // Default workspace wallet
      walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    };
  }
}

/**
 * 1. PaymentExecutorAgent - Executes automated USDC transfers.
 */
export class PaymentExecutorAgent {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Executes automated USDC transfers on behalf of the user or system
   */
  async executePayment(
    fromWalletId: string,
    toAddress: string,
    amount: number,
    description: string = "Circle Agent Automated Payment",
    token: string = "USDC"
  ): Promise<{ success: boolean; txHash?: string; transactionId?: string; error?: string }> {
    try {
      console.log(`🤖 [PaymentExecutorAgent]: Executing payment of $${amount} to ${toAddress}...`);
      
      const result = await sendToken(fromWalletId, toAddress, amount.toString(), token);

      await logAgentAction(
        this.userId,
        "payment_execution",
        "success",
        `Automated payment submitted: ${description} (tx: ${result.transactionId})`,
        amount,
        result.transactionId
      );

      return { success: true, txHash: undefined, transactionId: result.transactionId };
    } catch (error: any) {
      const errMsg = error.message || "Circle agent payment execution failed";
      await logAgentAction(
        this.userId,
        "payment_execution",
        "failed",
        `Payment execution failed: ${errMsg}`,
        amount
      );
      return { success: false, error: errMsg };
    }
  }
}

/**
 * 2. InvoiceMonitorAgent - Detects incoming payments and marks invoices paid.
 * Now webhook-driven: checks the database for recently-confirmed inbound
 * transactions and matches them to pending invoices.
 */
export class InvoiceMonitorAgent {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Checks the database for confirmed inbound transactions that can
   * be matched to pending invoices. The webhook handler does the
   * primary matching; this serves as a catch-up for any missed events.
   */
  async monitorInvoices(): Promise<{ checked: number; markedPaid: number }> {
    const supabase = getAdminClient();
    let checked = 0;
    let markedPaid = 0;

    try {
      console.log(`🤖 [InvoiceMonitorAgent]: Checking for unmatched inbound tx for user ${this.userId}...`);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, title, amount, recipient_address, status, user_id")
        .eq("user_id", this.userId)
        .eq("status", "pending");

      if (!invoices || invoices.length === 0) return { checked: 0, markedPaid: 0 };
      checked = invoices.length;

      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", this.userId)
        .single();

      if (!profile?.wallet_address) return { checked, markedPaid };

      const recentTx = await supabase
        .from("transactions")
        .select("amount, metadata")
        .eq("user_id", this.userId)
        .eq("type", "income")
        .eq("status", "success")
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());

      const incomingAmounts = (recentTx.data || []).map((t: any) => parseFloat(t.amount || "0")).filter((a: number) => a > 0);

      for (const invoice of invoices) {
        const match = incomingAmounts.find((amt: number) => Math.abs(amt - invoice.amount) < 0.01);
        if (match !== undefined) {
          await supabase.from("invoices").update({ status: "paid" }).eq("id", invoice.id);
          markedPaid++;

          await logAgentAction(
            this.userId,
            "invoice_monitoring",
            "success",
            `Invoice #${invoice.id} matched to inbound tx via catch-up`,
            parseFloat(invoice.amount)
          );
        }
      }
    } catch (err: any) {
      console.error("🤖 [InvoiceMonitorAgent] exception:", err);
    }

    return { checked, markedPaid };
  }
}

/**
 * 3. SubscriptionBillingAgent - Triggers payments on renewal dates.
 */
export class SubscriptionBillingAgent {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Scans active subscriptions, auto-bills users on renewal dates.
   */
  async processBilling(): Promise<{ billed: number; successes: number }> {
    const supabase = getAdminClient();
    let billed = 0;
    let successes = 0;

    try {
      console.log(`🤖 [SubscriptionBillingAgent]: Scanning subscriptions requiring renewal billing for user ${this.userId}...`);
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      // Fetch active subscriptions requiring billing today
      const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", this.userId)
        .eq("status", "active");

      if (error || !subscriptions) return { billed: 0, successes: 0 };

      const executor = new PaymentExecutorAgent(this.userId);

      for (const sub of subscriptions) {
        const renewalDate = sub.next_billing_date ? sub.next_billing_date.split("T")[0] : "";
        if (renewalDate === today || renewalDate <= today) {
          billed++;
          console.log(`🤖 [SubscriptionBillingAgent]: Subscription renewal trigger: billing $${sub.amount} for sub ${sub.id}`);
          
          // UPGRADE PATH FLAG:
          // Swap with Circle Agent Wallet automated billing policy payouts when fully stable
          const billingRes = await executor.executePayment(
            sub.subscriber_wallet_id || "575d1e8b-e4e7-59b4-ae31-7c3a428bfe5a", // default subscriber wallet
            sub.recipient_address || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            parseFloat(sub.amount || "0"),
            `Subscription auto-billing: ${sub.plan_name || "Premium Plan"}`
          );

          if (billingRes.success) {
            successes++;
            const nextBilling = new Date();
            nextBilling.setDate(nextBilling.getDate() + 30);

            await supabase
              .from("subscriptions")
              .update({ 
                next_billing_date: nextBilling.toISOString(),
                last_payment_date: new Date().toISOString()
              })
              .eq("id", sub.id);

            try {
              await createNotification(
                this.userId,
                "subscription_renewed",
                "Subscription Renewed Successfully",
                `Subscription payment of $${sub.amount} submitted`,
                { subscription_id: sub.id, plan_name: sub.plan_name || sub.name, transactionId: billingRes.transactionId }
              );
            } catch (notifErr) {
              console.error("⚠️ Failed to trigger subscription_renewed notification:", notifErr);
            }

            await logAgentAction(
              this.userId,
              "subscription_billing",
              "success",
              `Billed subscription [${sub.plan_name}] for $${sub.amount} - Next: ${nextBilling.toISOString().split("T")[0]}`,
              parseFloat(sub.amount),
              billingRes.transactionId
            );
          } else {
            await logAgentAction(
              this.userId,
              "subscription_billing",
              "failed",
              `Failed to bill subscription [${sub.plan_name}] for $${sub.amount}: ${billingRes.error}`
            );
          }
        }
      }
    } catch (err: any) {
      console.error("🤖 [SubscriptionBillingAgent] exception:", err);
    }

    return { billed, successes };
  }
}

/**
 * 4. RevenueSplitAgent - Splits incoming payments by configured percentages.
 */
export class RevenueSplitAgent {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Splits incoming payments dynamically.
   */
  async splitRevenue(
    sourceWalletId: string,
    amount: number,
    splits: Array<{ address: string; percentage: number; name?: string }>
  ): Promise<{ success: boolean; executedSplits: number; details: Array<{ address: string; amount: number; name: string; success: boolean; txHash?: string; error?: string }> }> {
    try {
      console.log(`🤖 [RevenueSplitAgent]: Splitting revenue of $${amount} across ${splits.length} partners...`);
      let executedSplits = 0;
      const details = [];

      const executor = new PaymentExecutorAgent(this.userId);

      for (const split of splits) {
        const splitAmount = (amount * split.percentage) / 100;
        if (splitAmount <= 0) continue;

        console.log(`🤖 [RevenueSplitAgent]: Splitting $${splitAmount} (${split.percentage}%) to ${split.name || split.address}`);
        
        const transferRes = await executor.executePayment(
          sourceWalletId,
          split.address,
          splitAmount,
          `Revenue split partner payout: ${split.name || "Partner"}`
        );

        details.push({
          address: split.address,
          amount: splitAmount,
          name: split.name || "Partner",
          success: transferRes.success,
          txHash: transferRes.txHash,
          error: transferRes.error
        });

        if (transferRes.success) {
          executedSplits++;
          await logAgentAction(
            this.userId,
            "revenue_splitting",
            "success",
            `Revenue split of $${splitAmount} successfully routed to partner ${split.name || split.address}`,
            splitAmount,
            transferRes.txHash
          );
        } else {
          await logAgentAction(
            this.userId,
            "revenue_splitting",
            "failed",
            `Revenue split of $${splitAmount} failed for partner ${split.name || split.address}: ${transferRes.error}`,
            splitAmount
          );
        }
      }

      return { success: executedSplits > 0, executedSplits, details };
    } catch (error: any) {
      console.error("🤖 [RevenueSplitAgent] error:", error);
      return { success: false, executedSplits: 0, details: [] };
    }
  }
}

/**
 * ============================================================================
 * BACKWARD-COMPATIBLE FUNCTION EXPORTS
 * ============================================================================
 */

export async function executeAgentPayment(
  userId: string,
  fromWalletId: string,
  toAddress: string,
  amount: number,
  description: string = "Circle Agent Automated Payment",
  token: string = "USDC"
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const agent = new PaymentExecutorAgent(userId);
  return await agent.executePayment(fromWalletId, toAddress, amount, description, token);
}

export async function monitorInvoicesAgent(userId: string): Promise<{ checked: number; markedPaid: number }> {
  const agent = new InvoiceMonitorAgent(userId);
  return await agent.monitorInvoices();
}

export async function subscriptionBillingAgent(userId: string): Promise<{ billed: number; successes: number }> {
  const agent = new SubscriptionBillingAgent(userId);
  return await agent.processBilling();
}

export async function revenueSplittingAgent(
  userId: string,
  sourceWalletId: string,
  amount: number,
  splits: Array<{ address: string; percentage: number; name?: string }>
): Promise<{ success: boolean; executedSplits: number }> {
  const agent = new RevenueSplitAgent(userId);
  return await agent.splitRevenue(sourceWalletId, amount, splits);
}
