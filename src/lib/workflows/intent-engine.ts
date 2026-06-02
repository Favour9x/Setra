import { createClient } from "@supabase/supabase-js";
import { 
  fetchIntentWorkflows, 
  logExecutionAttempt, 
  IntentWorkflow 
} from "../services/intent-workflow-db";
import { 
  executeAutomatedPayment, 
  splitRevenue 
} from "./index";
import { getOrCreateAgentWallet } from "../agents/circle-agent";
import { WorkflowType, TriggerType } from "./types";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

/**
 * Trigger matching intent workflows based on system events
 */
export async function triggerIntentWorkflows(
  userId: string,
  eventType: TriggerType,
  payload: {
    amount?: number;
    currentBalance?: number;
    walletId?: string;
  }
): Promise<{ triggeredCount: number; results: any[] }> {
  console.log(`⚡ Intent Engine: Trigger check for user ${userId} (event: ${eventType})`);
  
  const workflows = await fetchIntentWorkflows(userId);
  const activeMatching = workflows.filter(
    (w) => w.active && w.status === "active" && w.config?.trigger?.trigger_type === eventType
  );

  console.log(`Intent Engine: Found ${activeMatching.length} matching active workflows.`);
  const results = [];

  for (const wf of activeMatching) {
    try {
      const execResult = await executeIntentWorkflow(wf, eventType, payload);
      results.push({ workflowId: wf.id, success: true, ...execResult });
    } catch (error: any) {
      console.error(`❌ Error executing intent workflow ${wf.id}:`, error);
      results.push({ workflowId: wf.id, success: false, error: error.message });
    }
  }

  return { triggeredCount: activeMatching.length, results };
}

/**
 * Execute a single intent-based financial workflow
 */
export async function executeIntentWorkflow(
  workflow: IntentWorkflow,
  triggeredBy: string,
  payload: {
    amount?: number;
    currentBalance?: number;
    walletId?: string;
    tipperAddress?: string;
  }
): Promise<any> {
  console.log(`🚀 Intent Engine: Running workflow "${workflow.name}" of type ${workflow.workflow_type}`);

  const adminClient = getAdminClient();
  const userId = workflow.user_id;
  const config = workflow.config || {};

  // 1. Get Agent Wallet or default source wallet
  const agentWallet = await getOrCreateAgentWallet();
  const sourceWalletId = payload.walletId || agentWallet.walletId;

  // Log execution start state
  const executionId = await logExecutionAttempt(
    workflow.id,
    "running",
    undefined,
    undefined,
    { triggeredBy, payload }
  );

  try {
    let txHash = "";
    let status: "success" | "failed" = "success";
    let errorMsg = "";

    // Route based on workflow type
    const workflowType = workflow.workflow_type as WorkflowType;

    switch (workflowType) {
      case "scheduled_payment":
        txHash = await executeScheduledPayment(workflow, sourceWalletId, userId, adminClient);
        break;

      case "recurring_payment":
        txHash = await executeRecurringPayment(workflow, sourceWalletId, userId, adminClient);
        break;

      case "savings_sweep":
        txHash = await executeSavingsSweep(workflow, sourceWalletId, userId, payload, adminClient);
        break;

      case "threshold_transfer":
        const thresholdResult = await executeThresholdTransfer(workflow, sourceWalletId, userId, payload, adminClient);
        txHash = thresholdResult.txHash;
        if (!thresholdResult.success) {
          status = "failed";
          errorMsg = thresholdResult.error || "Threshold check failed";
        }
        break;

      case "auto_invoice_pay":
        txHash = await executeAutoInvoicePay(workflow, sourceWalletId, userId, adminClient);
        break;

      case "split_revenue":
        txHash = await executeSplitRevenue(workflow, sourceWalletId, userId, payload, adminClient);
        break;

      case "payroll_automation":
        txHash = await executePayrollAutomation(workflow, sourceWalletId, userId, adminClient);
        break;

      case "subscription_payment":
        txHash = await executeSubscriptionPayment(workflow, sourceWalletId, userId, adminClient);
        break;

      case "conditional_transfer":
        txHash = await executeConditionalTransfer(workflow, sourceWalletId, userId, payload, adminClient);
        break;

      case "custom_intent":
        txHash = await executeScheduledPayment(workflow, sourceWalletId, userId, adminClient);
        break;

      default:
        throw new Error(`Unsupported workflow type: ${workflow.workflow_type}`);
    }

    // Handle one-time completion
    if (config.schedule?.frequency === "one_time") {
      await markWorkflowCompleted(workflow.id, adminClient);
    } else if (config.schedule) {
      await updateNextExecution(workflow.id, config.schedule, adminClient);
    }

    // Finalize execution log as successful
    await updateExecutionStatus(workflow.id, executionId, status, txHash, errorMsg, { completed_at: new Date().toISOString() });
    return { success: status === "success", txHash };
  } catch (error: any) {
    console.error(`❌ Intent execution failure for workflow ${workflow.id}:`, error.message);
    await updateExecutionStatus(workflow.id, executionId, "failed", undefined, error.message, { completed_at: new Date().toISOString() });
    throw error;
  }
}

/**
 * Updates status of a running workflow execution
 */
async function updateExecutionStatus(
  workflowId: string,
  executionId: string,
  status: "success" | "failed",
  txHash?: string,
  errorMsg?: string,
  metadata?: any
) {
  const client = getAdminClient();
  const fallback = await import("../services/intent-workflow-db").then(m => m.shouldRunFallback(client));

  if (fallback) {
    const { data: current } = await client.from("workflows").select("config").eq("id", workflowId).single();
    if (!current) return;

    const config = current.config || {};
    const executions = config.executions || [];
    const execIndex = executions.findIndex((e: any) => e.id === executionId);

    if (execIndex !== -1) {
      executions[execIndex] = {
        ...executions[execIndex],
        status,
        tx_hash: txHash || null,
        error: errorMsg || null,
        completed_at: new Date().toISOString(),
        metadata: { ...(executions[execIndex].metadata || {}), ...metadata }
      };
    }

    if (!config.logs) config.logs = [];
    config.logs.unshift({
      created_at: new Date().toISOString(),
      log_level: status === "failed" ? "error" : "info",
      message: `Execution resolved: [${status.toUpperCase()}] ${errorMsg || "Transaction completed successfully"}`
    });

    await client.from("workflows").update({ config }).eq("id", workflowId);
  } else {
    await client
      .from("workflow_executions")
      .update({
        status,
        tx_hash: txHash || null,
        error: errorMsg || null,
        completed_at: new Date().toISOString()
      })
      .eq("id", executionId);

    await client.from("workflow_logs").insert({
      workflow_id: workflowId,
      execution_id: executionId,
      log_level: status === "failed" ? "error" : "info",
      message: `Execution resolved: [${status.toUpperCase()}] ${errorMsg || "Transaction completed successfully"}`
    });
  }
}


// Workflow Execution Handlers

async function executeScheduledPayment(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  adminClient: any
): Promise<string> {
  const config = workflow.config;
  const amount = config.amount || 0;
  const recipientAddress = config.recipient_address;

  if (!recipientAddress) {
    throw new Error("No recipient address configured.");
  }

  console.log(`Intent Exec: Scheduled payment of ${amount} USDC to ${recipientAddress}`);
  const payRes = await executeAutomatedPayment(
    sourceWalletId,
    recipientAddress,
    amount,
    userId,
    "Workflow",
    config.description || `Scheduled payment of ${amount} USDC`,
    adminClient,
    workflow.id,
    workflow.name,
    config.token || "USDC"
  );

  if (!payRes.success) {
    throw new Error(payRes.error || "Scheduled payment failed");
  }

  return payRes.txHash || "";
}

async function executeRecurringPayment(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  adminClient: any
): Promise<string> {
  const config = workflow.config;
  const amount = config.amount || 0;
  const recipientAddress = config.recipient_address;

  if (!recipientAddress) {
    throw new Error("No recipient address configured.");
  }

  console.log(`Intent Exec: Recurring payment of ${amount} ${config.token || "USDC"} to ${recipientAddress}`);
  const payRes = await executeAutomatedPayment(
    sourceWalletId,
    recipientAddress,
    amount,
    userId,
    "Recurring",
    config.description || `Recurring payment of ${amount} ${config.token || "USDC"}`,
    adminClient,
    workflow.id,
    workflow.name,
    config.token || "USDC"
  );

  if (!payRes.success) {
    throw new Error(payRes.error || "Recurring payment failed");
  }

  return payRes.txHash || "";
}

async function executeSavingsSweep(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  payload: any,
  adminClient: any
): Promise<string> {
  const config = workflow.config;
  const incomingAmount = payload.amount || 0;
  
  if (incomingAmount <= 0) {
    throw new Error("Incoming amount must be greater than zero for savings sweep.");
  }

  const percentage = config.percentage || 15;
  const sweepAmount = Number(((incomingAmount * percentage) / 100).toFixed(2));
  const recipientAddress = config.recipient_address;

  if (!recipientAddress) {
    throw new Error("No savings recipient address configured.");
  }

  console.log(`Intent Exec: Savings Sweep transferring ${sweepAmount} USDC to ${recipientAddress}`);
  const payRes = await executeAutomatedPayment(
    sourceWalletId,
    recipientAddress,
    sweepAmount,
    userId,
    "Savings",
    `Savings sweep (${percentage}%) of incoming payment`,
    adminClient,
    workflow.id,
    workflow.name,
    config.token || "USDC"
  );

  if (!payRes.success) {
    throw new Error(payRes.error || "Savings sweep transfer failed");
  }

  return payRes.txHash || "";
}

async function executeThresholdTransfer(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  payload: any,
  adminClient: any
): Promise<{ success: boolean; txHash: string; error?: string }> {
  const config = workflow.config;
  const amount = config.amount || 0;
  const thresholdLimit = config.trigger?.conditions?.threshold_value || 0;
  const recipientAddress = config.recipient_address;
  const comparison = config.trigger?.conditions?.comparison || "greater_than";

  if (!recipientAddress) {
    throw new Error("No recipient address configured.");
  }

  const balance = payload.currentBalance !== undefined ? payload.currentBalance : 0;

  let shouldTransfer = false;
  if (comparison === "greater_than" && balance >= thresholdLimit) {
    shouldTransfer = true;
  } else if (comparison === "less_than" && balance < thresholdLimit) {
    shouldTransfer = true;
  } else if (comparison === "equals" && balance === thresholdLimit) {
    shouldTransfer = true;
  }

  if (!shouldTransfer) {
    return {
      success: false,
      txHash: "",
      error: `Balance (${balance} USDC) does not meet threshold condition (${comparison} ${thresholdLimit} USDC)`
    };
  }

  console.log(`Intent Exec: Threshold passed. Transferring ${amount} USDC to ${recipientAddress}`);
  const payRes = await executeAutomatedPayment(
    sourceWalletId,
    recipientAddress,
    amount,
    userId,
    "Workflow",
    `Threshold-triggered transfer of ${amount} USDC`,
    adminClient,
    workflow.id,
    workflow.name,
    config.token || "USDC"
  );

  if (!payRes.success) {
    throw new Error(payRes.error || "Threshold payment failed");
  }

  return { success: true, txHash: payRes.txHash || "" };
}

async function executeAutoInvoicePay(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  adminClient: any
): Promise<string> {
  const config = workflow.config;
  
  const { data: unpaidInvoices } = await adminClient
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(3);

  if (!unpaidInvoices || unpaidInvoices.length === 0) {
    console.log("No pending invoices found to pay.");
    return "";
  }

  const paidResults = [];
  for (const invoice of unpaidInvoices) {
    const maxLimit = config.max_amount_per_invoice || 1000;
    if (invoice.amount <= maxLimit) {
      console.log(`Intent Exec: Auto paying invoice ${invoice.id} for ${invoice.amount} USDC`);
      
      const { data: profile } = await adminClient
        .from("profiles")
        .select("wallet_address")
        .eq("id", invoice.recipient_id || invoice.user_id)
        .single();

      const destAddress = profile?.wallet_address || invoice.wallet_address;
      
      if (destAddress) {
        const payRes = await executeAutomatedPayment(
          sourceWalletId,
          destAddress,
          invoice.amount,
          userId,
          "Invoices",
          `Auto invoice payment for Invoice #${invoice.invoice_number}`,
          adminClient,
          workflow.id,
          workflow.name,
          invoice.currency || config.token || "USDC"
        );

        if (payRes.success) {
          await adminClient
            .from("invoices")
            .update({ status: "paid" })
            .eq("id", invoice.id);

          paidResults.push({ id: invoice.id, success: true, txHash: payRes.txHash });
        } else {
          paidResults.push({ id: invoice.id, success: false, error: payRes.error });
        }
      }
    }
  }

  return paidResults.map(r => r.txHash).filter(Boolean).join(",");
}

async function executeSplitRevenue(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  payload: any,
  adminClient: any
): Promise<string> {
  const config = workflow.config;
  const incomingAmount = payload.amount || 0;
  
  if (incomingAmount <= 0) {
    throw new Error("Incoming amount must be greater than zero for revenue splitting.");
  }
  
  const splits = config.splits || [];
  if (splits.length === 0) {
    throw new Error("No revenue splits configured.");
  }

  console.log(`Intent Exec: Splitting ${incomingAmount} USDC across splits`);
  const splitRes = await splitRevenue(
    sourceWalletId,
    incomingAmount,
    splits,
    userId,
    workflow.id,
    workflow.name
  );

  if (!splitRes.success) {
    throw new Error(splitRes.error || "Revenue splitting execution failed");
  }

  return splitRes.results?.map(r => r.txHash).filter(Boolean).join(",") || "split_completed";
}

async function executePayrollAutomation(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  adminClient: any
): Promise<string> {
  const config = workflow.config;
  const recipients = config.recipients || [];

  if (recipients.length === 0) {
    throw new Error("No payroll recipients configured.");
  }

  console.log(`Intent Exec: Processing payroll for ${recipients.length} recipients`);
  const txHashes = [];

  for (const recipient of recipients) {
    const payRes = await executeAutomatedPayment(
      sourceWalletId,
      recipient.address,
      recipient.amount,
      userId,
      "Payroll",
      `Payroll payment to ${recipient.name || recipient.address}`,
      adminClient,
      workflow.id,
      workflow.name,
      config.token || "USDC"
    );

    if (payRes.success && payRes.txHash) {
      txHashes.push(payRes.txHash);
    }
  }

  return txHashes.join(",");
}

async function executeSubscriptionPayment(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  adminClient: any
): Promise<string> {
  const config = workflow.config;
  const amount = config.amount || 0;
  const recipientAddress = config.recipient_address;

  if (!recipientAddress) {
    throw new Error("No recipient address configured.");
  }

  console.log(`Intent Exec: Subscription payment of ${amount} USDC to ${recipientAddress}`);
  const payRes = await executeAutomatedPayment(
    sourceWalletId,
    recipientAddress,
    amount,
    userId,
    "Subscription",
    config.description || `Subscription payment of ${amount} USDC`,
    adminClient,
    workflow.id,
    workflow.name,
    config.token || "USDC"
  );

  if (!payRes.success) {
    throw new Error(payRes.error || "Subscription payment failed");
  }

  return payRes.txHash || "";
}

async function executeConditionalTransfer(
  workflow: IntentWorkflow,
  sourceWalletId: string,
  userId: string,
  payload: any,
  adminClient: any
): Promise<string> {
  const config = workflow.config;
  const amount = config.amount || 0;
  const recipientAddress = config.recipient_address;

  if (!recipientAddress) {
    throw new Error("No recipient address configured.");
  }

  // Evaluate conditions (simplified - can be enhanced)
  const conditions = config.trigger?.conditions || {};
  let conditionMet = true;

  if (conditions.amount_min && payload.amount < conditions.amount_min) {
    conditionMet = false;
  }
  if (conditions.amount_max && payload.amount > conditions.amount_max) {
    conditionMet = false;
  }

  if (!conditionMet) {
    throw new Error("Conditional transfer conditions not met");
  }

  console.log(`Intent Exec: Conditional transfer of ${amount} USDC to ${recipientAddress}`);
  const payRes = await executeAutomatedPayment(
    sourceWalletId,
    recipientAddress,
    amount,
    userId,
    "Workflow",
    config.description || `Conditional transfer of ${amount} USDC`,
    adminClient,
    workflow.id,
    workflow.name,
    config.token || "USDC"
  );

  if (!payRes.success) {
    throw new Error(payRes.error || "Conditional transfer failed");
  }

  return payRes.txHash || "";
}

// Helper functions

async function markWorkflowCompleted(workflowId: string, adminClient: any): Promise<void> {
  const fallback = await import("../services/intent-workflow-db").then(m => m.shouldRunFallback(adminClient));
  
  if (fallback) {
    const { data: current } = await adminClient.from("workflows").select("config").eq("id", workflowId).single();
    const currentConfig = current?.config || {};
    currentConfig.status = "completed";
    await adminClient.from("workflows").update({ active: false, config: currentConfig }).eq("id", workflowId);
  } else {
    await adminClient.from("automation_workflows").update({ active: false, status: "completed" }).eq("id", workflowId);
  }
}

async function updateNextExecution(workflowId: string, schedule: any, adminClient: any): Promise<void> {
  const nextDate = new Date();
  
  if (schedule.frequency === "daily") {
    nextDate.setDate(nextDate.getDate() + (schedule.interval || 1));
  } else if (schedule.frequency === "weekly") {
    nextDate.setDate(nextDate.getDate() + (7 * (schedule.interval || 1)));
  } else if (schedule.frequency === "monthly") {
    nextDate.setMonth(nextDate.getMonth() + (schedule.interval || 1));
  } else if (schedule.frequency === "yearly") {
    nextDate.setFullYear(nextDate.getFullYear() + (schedule.interval || 1));
  }
  
  const fallback = await import("../services/intent-workflow-db").then(m => m.shouldRunFallback(adminClient));
  
  if (fallback) {
    const { data: current } = await adminClient.from("workflows").select("config").eq("id", workflowId).single();
    const config = current?.config || {};
    config.schedule = { ...schedule, next_execution_at: nextDate.toISOString() };
    config.next_execution = nextDate.toISOString();
    await adminClient.from("workflows").update({ config }).eq("id", workflowId);
  } else {
    const config = { schedule: { ...schedule, next_execution_at: nextDate.toISOString() } };
    await adminClient.from("automation_workflows").update({ config }).eq("id", workflowId);
    await adminClient
      .from("workflow_schedules")
      .update({ 
        next_execution_at: nextDate.toISOString(), 
        last_execution_at: new Date().toISOString() 
      })
      .eq("workflow_id", workflowId);
  }
}
