import { 
  executeAgentPayment, 
  monitorInvoicesAgent, 
  subscriptionBillingAgent, 
  revenueSplittingAgent, 
  logAgentAction,
  PaymentExecutorAgent,
  InvoiceMonitorAgent,
  SubscriptionBillingAgent,
  RevenueSplitAgent,
  getOrCreateAgentWallet
} from "./circle-agent";
import { triggerWorkflow, executeAutomatedPayment, splitRevenue, createWorkflow } from "../workflows";

/**
 * Re-export the core workflow capabilities as requested
 */
export { 
  triggerWorkflow, 
  executeAutomatedPayment, 
  splitRevenue,
  executeAgentPayment,
  monitorInvoicesAgent,
  subscriptionBillingAgent,
  revenueSplittingAgent,
  logAgentAction,
  PaymentExecutorAgent,
  InvoiceMonitorAgent,
  SubscriptionBillingAgent,
  RevenueSplitAgent,
  getOrCreateAgentWallet
};

import { createClient } from "@supabase/supabase-js";
import { resolveRecipientAddress } from "../resolve-username";
import { saveIntentWorkflow } from "../services/intent-workflow-db";
import { parseIntent } from "../workflows/intent-parser";

// Secure server-side Supabase admin client
const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

export interface AgentActionResult {
  success: boolean;
  actionTaken: "create_split_workflow" | "create_payroll_workflow" | "direct_automated_payment" | "unknown";
  message: string;
  data?: any;
}

/**
 * Parses natural language schedule and dates into execution configs
 */
function parseDateAndSchedule(text: string): { frequency: string; next_execution_at: string; description: string } {
  const now = new Date();
  let frequency = "one_time";
  let next_execution_at = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // Default: in 10 minutes
  let description = "One-time payout";

  const normalized = text.toLowerCase();

  if (normalized.includes("every friday") || normalized.includes("each friday")) {
    frequency = "weekly";
    const resultDate = new Date();
    resultDate.setDate(now.getDate() + (5 + 7 - now.getDay()) % 7);
    resultDate.setHours(17, 0, 0, 0); // 5 PM Friday
    if (resultDate.getTime() <= now.getTime()) {
      resultDate.setDate(resultDate.getDate() + 7);
    }
    next_execution_at = resultDate.toISOString();
    description = "Weekly payout every Friday at 5:00 PM";
  } else if (normalized.includes("every monday") || normalized.includes("each monday")) {
    frequency = "weekly";
    const resultDate = new Date();
    resultDate.setDate(now.getDate() + (1 + 7 - now.getDay()) % 7);
    resultDate.setHours(9, 0, 0, 0); // 9 AM Monday
    if (resultDate.getTime() <= now.getTime()) {
      resultDate.setDate(resultDate.getDate() + 7);
    }
    next_execution_at = resultDate.toISOString();
    description = "Weekly payout every Monday at 9:00 AM";
  } else if (normalized.includes("weekly")) {
    frequency = "weekly";
    const resultDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    next_execution_at = resultDate.toISOString();
    description = "Weekly recurring payout";
  } else if (normalized.includes("monthly") || normalized.includes("repeat monthly")) {
    frequency = "monthly";
    const resultDate = new Date();
    resultDate.setMonth(now.getMonth() + 1);
    next_execution_at = resultDate.toISOString();
    description = "Monthly recurring payout";
  } else if (normalized.includes("daily") || normalized.includes("repeat daily")) {
    frequency = "daily";
    const resultDate = new Date();
    resultDate.setDate(now.getDate() + 1);
    next_execution_at = resultDate.toISOString();
    description = "Daily recurring payout";
  } else {
    // Parse dates like "May 19th 2026" and times like "5PM"
    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];
    const monthShorts = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec"
    ];
    
    let parsedMonth = -1;
    let parsedDay = -1;
    let parsedYear = now.getFullYear();
    let parsedHour = 17; // Default 5 PM
    let parsedMinute = 0;

    for (let i = 0; i < monthNames.length; i++) {
      if (normalized.includes(monthNames[i])) {
        parsedMonth = i;
        break;
      }
    }
    if (parsedMonth === -1) {
      for (let i = 0; i < monthShorts.length; i++) {
        if (normalized.includes(monthShorts[i])) {
          parsedMonth = i;
          break;
        }
      }
    }

    const dayMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (dayMatch) {
      parsedDay = parseInt(dayMatch[1]);
    }

    const yearMatch = text.match(/\b(202\d|203\d)\b/);
    if (yearMatch) {
      parsedYear = parseInt(yearMatch[1]);
    }

    const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3].toLowerCase();

      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;

      parsedHour = hour;
      parsedMinute = minute;
    }

    if (parsedMonth !== -1 && parsedDay !== -1) {
      const d = new Date(parsedYear, parsedMonth, parsedDay, parsedHour, parsedMinute, 0, 0);
      next_execution_at = d.toISOString();
      description = `One-time payout scheduled for ${d.toLocaleString()}`;
    }
  }

  return { frequency, next_execution_at, description };
}

/**
 * Natural Language Parser for Intent-Based Financial Automation
 */
export async function parseAgentPrompt(
  userId: string,
  prompt: string
): Promise<AgentActionResult> {
  const normalized = prompt.toLowerCase();
  console.log(`🤖 AI Intent Agent: Parsing prompt for user ${userId} => "${prompt}"`);

  const resolveIdentifier = async (val: string): Promise<string> => {
    try {
      const cleanVal = val.trim();
      return await resolveRecipientAddress(cleanVal);
    } catch (e) {
      return val.trim();
    }
  };

  // 1. SAVINGS SWEEP INTENT (e.g., "Move 15% of every payment into savings")
  if ((normalized.includes("move") || normalized.includes("sweep") || normalized.includes("send")) && normalized.includes("%") && normalized.includes("savings")) {
    const pctMatch = prompt.match(/(\d+)%/);
    const percentage = pctMatch ? parseInt(pctMatch[1]) : 15;
    
    // Resolve savings destination address (use a demo recipient or user profile address)
    const savingsAddress = "0x4838a147f139cba34393fda3222384a3c2242139"; // Demo savings address
    
    const workflow = await saveIntentWorkflow(userId, {
      name: `Savings Sweep: ${percentage}% of incoming funds`,
      intent_prompt: prompt,
      workflow_type: "savings_sweep",
      config: {
        percentage,
        recipient_address: savingsAddress,
        recipient_name: "Savings Wallet",
        trigger: {
          trigger_type: "on_funds_received",
          conditions: { incoming_funds: true }
        },
        description: `Automatically sweep ${percentage}% of incoming payments to Savings Wallet`
      }
    });

    return {
      success: true,
      actionTaken: "create_split_workflow",
      message: `Successfully configured intent: Sweep ${percentage}% of incoming payments to savings.`,
      data: workflow
    };
  }

  // 2. THRESHOLD-TRIGGERED TRANSFER INTENT
  if (normalized.includes("threshold") || normalized.includes("when balance")) {
    const amountMatch = prompt.match(/\$?(\d+(?:\.\d{1,2})?)/);
    const balanceMatch = prompt.match(/(?:over|above|>|exceeds)\s*(?:\$)?(\d+(?:\.\d{1,2})?)/i);
    const recipientMatch = prompt.match(/(@[a-zA-Z0-9_-]+|0x[a-fA-F0-9]{40})/);

    const amount = amountMatch ? parseFloat(amountMatch[1]) : 50;
    const thresholdVal = balanceMatch ? parseFloat(balanceMatch[1]) : 100;
    if (!recipientMatch) {
      return {
        success: false,
        actionTaken: "unknown",
        message: "Add a recipient username or wallet address to complete this threshold automation."
      };
    }

    const recipient = recipientMatch[0];
    const resolvedAddress = await resolveIdentifier(recipient);

    const workflow = await saveIntentWorkflow(userId, {
      name: `Threshold Automation: Send ${amount} USDC to ${recipient}`,
      intent_prompt: prompt,
      workflow_type: "threshold_transfer",
      config: {
        amount,
        recipient_address: resolvedAddress,
        recipient_name: recipient,
        trigger: {
          trigger_type: "on_balance_threshold",
          conditions: {
            threshold_operator: ">=",
            threshold_value: thresholdVal,
            threshold_currency: "USDC"
          }
        },
        description: `Send ${amount} USDC to ${recipient} when account balance exceeds ${thresholdVal} USDC`
      }
    });

    return {
      success: true,
      actionTaken: "create_payroll_workflow",
      message: `Successfully configured intent: Threshold-triggered transfer when balance > ${thresholdVal} USDC.`,
      data: workflow
    };
  }

  // 3. AUTO INVOICE PAY INTENT
  if (normalized.includes("pay invoices automatically") || normalized.includes("auto pay invoices") || normalized.includes("automatic invoice")) {
    const workflow = await saveIntentWorkflow(userId, {
      name: "Auto-Pay Invoices",
      intent_prompt: prompt,
      workflow_type: "auto_invoice_pay",
      config: {
        auto_pay: true,
        max_amount_per_invoice: 1000,
        trigger: {
          trigger_type: "on_funds_received",
          conditions: { invoice_received: true }
        },
        description: "Automatically pay matching invoices upon receipt using available balances"
      }
    });

    return {
      success: true,
      actionTaken: "create_payroll_workflow",
      message: "Successfully configured intent: Pay invoices automatically.",
      data: workflow
    };
  }

  // 4. REVENUE SPLIT INTENT
  if (normalized.includes("split") || normalized.includes("share") || normalized.includes("divide")) {
    const splitRegex = /(\d+)%\s+(?:to|with|for)\s+(@[a-zA-Z0-9_-]+|0x[a-fA-F0-9]{40})/g;
    const splits: Array<{ name: string; address: string; percentage: number }> = [];
    let match: RegExpExecArray | null;
    let totalPercentage = 0;

    while ((match = splitRegex.exec(prompt)) !== null) {
      const percentage = parseInt(match[1]);
      const recipient = match[2];
      const resolvedAddress = await resolveIdentifier(recipient);
      
      splits.push({
        name: recipient,
        address: resolvedAddress,
        percentage
      });
      totalPercentage += percentage;
    }

    if (splits.length === 0) {
      const recipients = prompt.match(/(@[a-zA-Z0-9_-]+|0x[a-fA-F0-9]{40})/g) || [];
      const percentages = prompt.match(/(\d+)%/g) || [];
      
      const count = Math.min(recipients.length, percentages.length);
      for (let i = 0; i < count; i++) {
        const percentage = parseInt(percentages[i]);
        const recipient = recipients[i];
        const resolvedAddress = await resolveIdentifier(recipient);
        
        splits.push({
          name: recipient,
          address: resolvedAddress,
          percentage
        });
        totalPercentage += percentage;
      }
    }

    if (splits.length > 0) {
      if (totalPercentage > 100) {
        return {
          success: false,
          actionTaken: "create_split_workflow",
          message: `The splits equal ${totalPercentage}%, which exceeds 100%.`
        };
      }

      if (totalPercentage < 100) {
        const supabase = getAdminClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("id", userId)
          .single();

        splits.push({
          name: "Self (Owner Account)",
          address: profile?.wallet_address || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          percentage: 100 - totalPercentage
        });
      }

      const workflow = await saveIntentWorkflow(userId, {
        name: `Revenue Split: ${splits.map(s => `${s.percentage}% to ${s.name}`).join(", ")}`,
        intent_prompt: prompt,
        workflow_type: "split_revenue",
        config: {
          splits,
          trigger: {
            trigger_type: "on_funds_received",
            conditions: { incoming_funds: true }
          },
          description: "Split revenue automatically as soon as payments arrive"
        }
      });

      return {
        success: true,
        actionTaken: "create_split_workflow",
        message: `Successfully configured intent: Revenue split workflow "${workflow.name}".`,
        data: workflow
      };
    }
  }

  // 5. SCHEDULED / RECURRING PAYMENT INTENTS
  const parsedPaymentIntent = parseIntent(prompt);
  const recipientMatch = parsedPaymentIntent.config.recipient_address
    ? [parsedPaymentIntent.config.recipient_address]
    : prompt.match(/(@[a-zA-Z0-9_-]+|0x[a-fA-F0-9]{40})/);

  if (parsedPaymentIntent.config.amount && recipientMatch) {
    const amount = parsedPaymentIntent.config.amount;
    const recipient = recipientMatch[0];
    const resolvedAddress = await resolveIdentifier(recipient);
    const frequency = parsedPaymentIntent.config.schedule?.frequency || "one_time";

    const workflow = await saveIntentWorkflow(userId, {
      name: parsedPaymentIntent.name || `Automated Payment: Send ${amount} ${parsedPaymentIntent.config.token || "USDC"} to ${recipient}`,
      intent_prompt: prompt,
      workflow_type: frequency === "one_time" ? "scheduled_payment" : "recurring_payment",
      config: {
        ...parsedPaymentIntent.config,
        amount,
        recipient_address: resolvedAddress,
        recipient_name: recipient,
        next_execution: parsedPaymentIntent.config.schedule?.next_execution_at,
        trigger: {
          trigger_type: frequency === "one_time" ? "on_date_time" : "on_schedule",
          conditions: { execute_at: parsedPaymentIntent.config.schedule?.next_execution_at }
        }
      }
    });

    return {
      success: true,
      actionTaken: "create_payroll_workflow",
      message: `Successfully configured scheduled intent: "${workflow.name}".`,
      data: workflow
    };
  }

  return {
    success: false,
    actionTaken: "unknown",
    message: "Could not parse the intent. Include a recipient, amount, token, and schedule or trigger."
  };
}
