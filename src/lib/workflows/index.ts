import { createClient } from "@supabase/supabase-js";
import { executePayment } from "@/lib/payments";
import { PaymentExecutorAgent, RevenueSplitAgent, getOrCreateAgentWallet } from "../agents/circle-agent";
import { createNotification } from "@/lib/services/notification";
import { insertRecipientReceivedTransaction } from "@/lib/services/ledger";

export interface WorkflowRule {
  id: string;
  user_id: string;
  name: string;
  trigger_type: "revenue_received" | "scheduled" | "payroll";
  action_type: "split_revenue" | "automated_payout" | "creator_payroll";
  config: {
    splits?: Array<{ address: string; percentage: number; name?: string }>;
    members?: Array<{ address: string; amount: number; name?: string }>;
    amount?: number;
    recipient_address?: string;
    recipient_name?: string;
    frequency?: string;
    description?: string;
    next_execution?: string;
  };
  active: boolean;
  created_at: string;
}

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function createWorkflow(
  userId: string,
  data: Omit<WorkflowRule, "id" | "user_id" | "created_at" | "active">,
  supabase?: any
): Promise<WorkflowRule> {
  const client = supabase || getAdminClient();

  const { data: inserted, error } = await client
    .from("workflows")
    .insert({
      user_id: userId,
      name: data.name,
      trigger_type: data.trigger_type,
      action_type: data.action_type,
      config: data.config,
      active: true
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Supabase error inserting workflow:", error.message);
    throw error;
  }

  return inserted as WorkflowRule;
}

export async function fetchWorkflows(userId: string, supabase?: any): Promise<WorkflowRule[]> {
  const client = supabase || getAdminClient();

  const { data, error } = await client
    .from("workflows")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Supabase error loading workflows:", error.message);
    throw error;
  }

  return data as WorkflowRule[];
}

export async function updateWorkflowStatus(id: string, active: boolean, supabase?: any): Promise<boolean> {
  const client = supabase || getAdminClient();

  const { error } = await client
    .from("workflows")
    .update({ active })
    .eq("id", id);

  if (error) {
    console.error(`❌ Supabase error updating workflow status for id ${id}:`, error.message);
    throw error;
  }
  return true;
}

/**
 * Split Revenue helper to split incoming funds dynamically
 */
export async function splitRevenue(
  sourceWalletId: string,
  amount: number,
  splits: Array<{ address: string; percentage: number; name?: string }>,
  userId: string,
  workflowId?: string,
  workflowName?: string
): Promise<{ success: boolean; results: any[]; error?: string }> {
  console.log(`🌀 Splitting revenue of $${amount} across ${splits.length} addresses using RevenueSplitAgent...`);
  
  const agent = new RevenueSplitAgent(userId);
  const result = await agent.splitRevenue(sourceWalletId, amount, splits);

  const supabase = getAdminClient();

  if (result.success && result.details) {
    for (const splitDetail of result.details) {
      if (splitDetail.success && splitDetail.txHash) {
        try {
          // Check for duplicate before inserting
          const { data: existing } = await supabase
            .from("transactions")
            .select("id")
            .eq("tx_hash", splitDetail.txHash)
            .maybeSingle();
          
          if (existing) {
            console.log(`⚠️ Transaction ${splitDetail.txHash} already recorded, skipping duplicate`);
            continue;
          }
          
          await supabase.from("transactions").insert({
            user_id: userId,
            recipient: splitDetail.address,
            recipient_address: splitDetail.address,
            amount: splitDetail.amount,
            type: "expense",
            category: "Workflow",
            currency: "USDC",
            status: "success",
            tx_hash: splitDetail.txHash,
            metadata: {
              workflowId: workflowId || undefined,
              workflowName: workflowName || undefined,
              splitPercentage: splits.find(s => s.address === splitDetail.address)?.percentage,
              splitName: splitDetail.name,
              blockchain: "ARC-TESTNET"
            },
            created_at: new Date().toISOString()
          });

          // Insert recipient's received transaction record for this split
          await insertRecipientReceivedTransaction(supabase, {
            destinationAddress: splitDetail.address,
            amount: splitDetail.amount,
            txHash: splitDetail.txHash,
            category: "Workflow",
            metadata: {
              workflowId: workflowId || undefined,
              workflowName: workflowName || undefined,
              splitPercentage: splits.find(s => s.address === splitDetail.address)?.percentage,
              splitName: splitDetail.name,
            }
          });
        } catch (dbErr) {
          console.error("⚠️ Failed to log split transaction in DB:", dbErr);
        }
      }
    }
  }

  const results = splits.map(split => {
    const detail = result.details?.find(d => d.address === split.address);
    return {
      name: split.name,
      address: split.address,
      amount: (amount * split.percentage) / 100,
      success: detail ? detail.success : result.success
    };
  });

  return { success: result.success, results };
}

/**
 * Execute automated payments (such as payrolls)
 */
export async function executeAutomatedPayment(
  fromWalletId: string,
  toAddress: string,
  amount: number,
  userId: string,
  category: string = "Infrastructure",
  description: string = "Automated Payment Payout",
  supabase?: any,
  workflowId?: string,
  workflowName?: string,
  token: string = "USDC"
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log(`🤖 Executing automated payment of ${amount} ${token} to ${toAddress}...`);
  
  try {
    const client = supabase || getAdminClient();
    
    const agentWallet = await getOrCreateAgentWallet();
    const sourceWallet = fromWalletId || agentWallet.walletId;

    console.log(`🤖 [Circle Agent Stack]: Executing payout from source wallet: ${sourceWallet}`);

    const agent = new PaymentExecutorAgent(userId);
    const paymentResult = await agent.executePayment(
      sourceWallet,
      toAddress,
      amount,
      description,
      token
    );

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
        return { success: true, txHash: paymentResult.txHash };
      }
    }

    // Save sender's transaction
    await client.from("transactions").insert({
      user_id: userId,
      recipient: toAddress,
      recipient_address: toAddress,
      amount,
      type: "expense",
      category,
      currency: token,
      status: "success",
      tx_hash: paymentResult.txHash,
      metadata: {
        workflowId: workflowId || undefined,
        workflowName: workflowName || undefined,
        automationDescription: description,
        blockchain: "ARC-TESTNET",
        executedByAgentWallet: agentWallet.walletAddress,
        sourceWalletId: sourceWallet
      },
      created_at: new Date().toISOString()
    });

    // Insert recipient's received transaction record
    await insertRecipientReceivedTransaction(client, {
      destinationAddress: toAddress,
      amount,
      txHash: paymentResult.txHash,
      category,
      metadata: {
        workflowId: workflowId || undefined,
        workflowName: workflowName || undefined,
        automationDescription: description,
      }
    });

    return { success: true, txHash: paymentResult.txHash };
  } catch (error: any) {
    return { success: false, error: error.message || "Automation failed" };
  }
}

/**
 * Trigger Workflow Engine
 * Scans active workflow rules, matches triggerType, and executes splits or payouts.
 */
export async function triggerWorkflow(
  userId: string,
  triggerType: "revenue_received" | "scheduled" | "payroll",
  payload: {
    walletId: string;
    amount: number;
    category?: string;
  },
  supabase?: any
): Promise<{ triggered: number; executions: any[] }> {
  console.log(`⚡ Triggering AI Workflow Engine for user ${userId} (trigger: ${triggerType})...`);
  const client = supabase || getAdminClient();
  const activeWorkflows = await fetchWorkflows(userId, client);
  const matchedRules = activeWorkflows.filter(wf => wf.active && wf.trigger_type === triggerType);

  console.log(`Found ${matchedRules.length} matching active workflow rule(s)`);
  const executions = [];

  for (const rule of matchedRules) {
    console.log(`🚀 Executing Workflow Rule: "${rule.name}"...`);
    
    if (rule.action_type === "split_revenue" && rule.config.splits) {
      const splitRes = await splitRevenue(payload.walletId, payload.amount, rule.config.splits, userId, rule.id, rule.name);
      executions.push({
        ruleId: rule.id,
        ruleName: rule.name,
        type: "split_revenue",
        results: splitRes
      });

      // Trigger "Workflow Executed" notification
      try {
        await createNotification(
          userId,
          "workflow_executed",
          "Workflow Executed",
          `Automation rule "${rule.name}" executed successfully`,
          { workflow_id: rule.id, workflow_name: rule.name, action_type: "split_revenue" }
        );
      } catch (notifErr) {
        console.error("⚠️ Failed to trigger workflow executed notification:", notifErr);
      }
    } 
    
    else if (rule.action_type === "creator_payroll" && rule.config.amount && rule.config.recipient_address) {
      const payoutRes = await executeAutomatedPayment(
        payload.walletId,
        rule.config.recipient_address,
        rule.config.amount,
        userId,
        "Infrastructure",
        rule.config.description || `Creator Payroll payout from workflow "${rule.name}"`,
        client,
        rule.id,
        rule.name
      );
      executions.push({
        ruleId: rule.id,
        ruleName: rule.name,
        type: "creator_payroll",
        results: payoutRes
      });

      // Trigger "Workflow Executed" notification
      try {
        await createNotification(
          userId,
          "workflow_executed",
          "Workflow Executed",
          `Automation rule "${rule.name}" executed successfully`,
          { workflow_id: rule.id, workflow_name: rule.name, action_type: "creator_payroll" }
        );
      } catch (notifErr) {
        console.error("⚠️ Failed to trigger workflow executed notification:", notifErr);
      }
    }
  }

  return { triggered: matchedRules.length, executions };
}
