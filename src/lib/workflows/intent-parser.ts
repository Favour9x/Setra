/**
 * Intent Parser - Converts natural language intents into structured workflow configs
 * Converts common payment, schedule, threshold, sweep, payroll, and split intents.
 */

import { WorkflowType, WorkflowConfig, TriggerType, FrequencyType, WorkflowSchedule } from "./types";

export interface ParsedIntent {
  workflow_type: WorkflowType;
  name: string;
  config: WorkflowConfig;
  confidence: number;
  plain_english: string;
}

/**
 * Parse natural language intent into structured workflow configuration
 */
export function parseIntent(intent: string): ParsedIntent {
  const lowerIntent = intent.toLowerCase().trim();

  // Subscription payments should stay distinct from generic recurring payments.
  if (matchesSubscriptionPayment(lowerIntent)) {
    return parseSubscriptionPayment(intent, lowerIntent);
  }

  // Payroll can include recurring words like monthly, so classify it before generic recurrence.
  if (matchesPayroll(lowerIntent)) {
    return parsePayroll(intent, lowerIntent);
  }
  
  // Recurring payment patterns
  if (matchesRecurringPayment(lowerIntent)) {
    return parseRecurringPayment(intent, lowerIntent);
  }

  // Scheduled payment patterns
  if (matchesScheduledPayment(lowerIntent)) {
    return parseScheduledPayment(intent, lowerIntent);
  }
  
  // Revenue split patterns
  if (matchesRevenueSplit(lowerIntent)) {
    return parseRevenueSplit(intent, lowerIntent);
  }
  
  // Savings sweep patterns
  if (matchesSavingsSweep(lowerIntent)) {
    return parseSavingsSweep(intent, lowerIntent);
  }
  
  // Threshold transfer patterns
  if (matchesThresholdTransfer(lowerIntent)) {
    return parseThresholdTransfer(intent, lowerIntent);
  }
  
  // Direct payment intents without a date/time are immediate one-time payments.
  if (matchesDirectPayment(lowerIntent)) {
    return parseScheduledPayment(intent, lowerIntent);
  }
  
  // Default: custom intent
  return {
    workflow_type: "custom_intent",
    name: intent.substring(0, 50),
    config: {
      description: intent,
      plain_english: `Run this custom payment automation: ${intent}`,
      metadata: { raw_intent: intent }
    },
    confidence: 0.3,
    plain_english: `Run this custom payment automation: ${intent}`
  };
}

// Pattern matchers
function matchesScheduledPayment(intent: string): boolean {
  return /pay.*by|pay.*on|send.*by|send.*on|transfer.*by|transfer.*on|today|tomorrow/.test(intent);
}

function matchesRecurringPayment(intent: string): boolean {
  return /every|repeat|recurring|monthly|weekly|daily|yearly/.test(intent);
}

function matchesSubscriptionPayment(intent: string): boolean {
  return /subscription|subscribe|membership/.test(intent);
}

function matchesDirectPayment(intent: string): boolean {
  return /\b(pay|send|transfer)\b/.test(intent) && extractPayment(intent).amount > 0;
}

function matchesRevenueSplit(intent: string): boolean {
  return /split|divide|distribute.*revenue|share.*revenue/.test(intent);
}

function matchesSavingsSweep(intent: string): boolean {
  return /save|savings|move.*%|transfer.*%|sweep/.test(intent);
}

function matchesThresholdTransfer(intent: string): boolean {
  return /when.*balance|if.*balance|threshold|exceeds|above|below/.test(intent);
}

function matchesPayroll(intent: string): boolean {
  return /payroll|pay.*team|pay.*members|pay.*employees/.test(intent);
}

// Parsers
function parseScheduledPayment(original: string, intent: string): ParsedIntent {
  const payment = extractPayment(original);
  const schedule = parseSchedule(original, "one_time");
  const recipient = payment.recipient || "";
  const token = payment.token || "USDC";
  
  const config: WorkflowConfig = {
    amount: payment.amount,
    token,
    recipient_address: recipient,
    recipient_name: recipient,
    description: original,
    plain_english: describePayment(payment.amount, token, recipient, schedule),
    schedule: {
      ...schedule,
      frequency: "one_time" as FrequencyType
    },
    trigger: {
      trigger_type: "on_date_time" as TriggerType
    }
  };
  
  return {
    workflow_type: "scheduled_payment",
    name: `Pay ${recipient || "recipient"} ${payment.amount} ${token}`,
    config,
    confidence: 0.85,
    plain_english: config.plain_english || original
  };
}

function parseRecurringPayment(original: string, intent: string): ParsedIntent {
  const payment = extractPayment(original);
  const schedule = parseSchedule(original);
  const recipient = payment.recipient || "";
  const token = payment.token || "USDC";
  
  const config: WorkflowConfig = {
    amount: payment.amount,
    token,
    recipient_address: recipient,
    recipient_name: recipient,
    description: original,
    plain_english: describePayment(payment.amount, token, recipient, schedule),
    schedule: {
      ...schedule
    },
    trigger: {
      trigger_type: "on_schedule" as TriggerType
    }
  };
  
  return {
    workflow_type: "recurring_payment",
    name: `${schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} payment to ${recipient || "recipient"}`,
    config,
    confidence: 0.9,
    plain_english: config.plain_english || original
  };
}

function parseSubscriptionPayment(original: string, intent: string): ParsedIntent {
  const payment = extractPayment(original);
  const schedule = parseSchedule(original, "monthly");
  const recipient = payment.recipient || "";
  const token = payment.token || "USDC";

  const config: WorkflowConfig = {
    amount: payment.amount,
    token,
    recipient_address: recipient,
    recipient_name: recipient,
    description: original,
    plain_english: describePayment(payment.amount, token, recipient, schedule),
    schedule,
    trigger: {
      trigger_type: "on_schedule" as TriggerType
    }
  };

  return {
    workflow_type: "subscription_payment",
    name: `Subscription payment to ${recipient || "recipient"}`,
    config,
    confidence: 0.9,
    plain_english: config.plain_english || original
  };
}

function parseRevenueSplit(original: string, intent: string): ParsedIntent {
  const percentageMatches = intent.match(/(\d+)%/g);
  const recipientMatches = original.match(/@(\w+)/g);
  
  const splits = [];
  if (percentageMatches && recipientMatches) {
    for (let i = 0; i < Math.min(percentageMatches.length, recipientMatches.length); i++) {
      splits.push({
        address: recipientMatches[i].substring(1),
        percentage: parseInt(percentageMatches[i]),
        name: recipientMatches[i].substring(1)
      });
    }
  }
  
  const config: WorkflowConfig = {
    splits,
    description: original,
    trigger: {
      trigger_type: "on_funds_received" as TriggerType
    }
  };
  
  return {
    workflow_type: "split_revenue",
    name: "Revenue Split",
    config,
    confidence: 0.85,
    plain_english: `Split incoming revenue across ${splits.length} recipient${splits.length === 1 ? "" : "s"}.`
  };
}

function parseSavingsSweep(original: string, intent: string): ParsedIntent {
  const percentageMatch = intent.match(/(\d+)%/);
  const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 15;
  
  const recipientMatch = original.match(/@(\w+)/);
  const recipient = recipientMatch ? recipientMatch[1] : "";
  
  const config: WorkflowConfig = {
    percentage,
    recipient_address: recipient,
    description: original,
    trigger: {
      trigger_type: "on_funds_received" as TriggerType
    }
  };
  
  return {
    workflow_type: "savings_sweep",
    name: `Save ${percentage}% of incoming payments`,
    config,
    confidence: 0.88,
    plain_english: `Move ${percentage}% of each incoming payment to ${recipient || "the configured savings wallet"}.`
  };
}

function parseThresholdTransfer(original: string, intent: string): ParsedIntent {
  const payment = extractPayment(original);
  const thresholdMatch = intent.match(/(?:exceeds|above|over|greater than|below|under|less than)\s+(\d+(?:\.\d+)?)\s*([a-z]{3,5})?/i);
  const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 100;
  const recipient = payment.recipient || "";
  const token = payment.token || thresholdMatch?.[2]?.toUpperCase() || "USDC";
  
  const comparison = /above|exceeds|greater/.test(intent) ? "greater_than" : "less_than";
  
  const config: WorkflowConfig = {
    amount: payment.amount,
    token,
    recipient_address: recipient,
    recipient_name: recipient,
    threshold_value: threshold,
    description: original,
    plain_english: `Send ${payment.amount} ${token} to ${recipient || "the recipient"} when balance ${comparison === "greater_than" ? "exceeds" : "falls below"} ${threshold} ${token}.`,
    trigger: {
      trigger_type: "on_balance_threshold" as TriggerType,
      conditions: {
        threshold_value: threshold,
        comparison
      }
    }
  };
  
  return {
    workflow_type: "threshold_transfer",
    name: `Transfer when balance ${comparison === "greater_than" ? "exceeds" : "below"} ${threshold} USDC`,
    config,
    confidence: 0.82,
    plain_english: config.plain_english || original
  };
}

function parsePayroll(original: string, intent: string): ParsedIntent {
  const recipientMatches = Array.from(original.matchAll(/(@[a-zA-Z0-9_-]+|0x[a-fA-F0-9]{40})\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]{3,5})?/g));
  const fallbackAmount = extractPayment(original).amount;
  const fallbackToken = extractPayment(original).token || "USDC";
  const recipients = recipientMatches.map(match => ({
    address: match[1],
    amount: parseFloat(match[2]) || fallbackAmount,
    name: match[1].replace(/^@/, "")
  }));
  const token = recipientMatches[0]?.[3]?.toUpperCase() || fallbackToken;
  
  let frequency: FrequencyType = "weekly";
  if (/daily/.test(intent)) frequency = "daily";
  else if (/weekly/.test(intent)) frequency = "weekly";
  else if (/monthly/.test(intent)) frequency = "monthly";
  
  const config: WorkflowConfig = {
    token,
    recipients,
    description: original,
    schedule: {
      frequency,
      next_execution_at: new Date().toISOString()
    },
    trigger: {
      trigger_type: "on_schedule" as TriggerType
    }
  };
  
  return {
    workflow_type: "payroll_automation",
    name: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} team payroll`,
    config,
    confidence: 0.87,
    plain_english: `Run ${frequency} payroll for ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`
  };
}

function extractPayment(text: string): { amount: number; token: string; recipient: string } {
  const amountMatch = text.match(/(?:pay|send|transfer)?\s*(?:@[a-zA-Z0-9_-]+|0x[a-fA-F0-9]{40})?\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]{3,5})/i)
    || text.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]{3,5})/i);
  const recipientMatch = text.match(/(@[a-zA-Z0-9_-]+|0x[a-fA-F0-9]{40})/);

  return {
    amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
    token: amountMatch?.[2]?.toUpperCase() || "USDC",
    recipient: recipientMatch ? recipientMatch[0] : ""
  };
}

function parseSchedule(text: string, defaultFrequency: FrequencyType = "monthly"): WorkflowSchedule {
  const normalized = text.toLowerCase();
  let frequency: FrequencyType = defaultFrequency;
  if (/daily|every day/.test(normalized)) frequency = "daily";
  else if (/weekly|every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/.test(normalized)) frequency = "weekly";
  else if (/monthly|repeat monthly/.test(normalized)) frequency = "monthly";
  else if (/yearly|annually/.test(normalized)) frequency = "yearly";

  const explicitDate = parseExplicitDate(text);
  const time = extractTime(text);
  const dayOfWeek = extractDayOfWeek(normalized);
  const next_execution_at = explicitDate || nextDateForFrequency(frequency, dayOfWeek, time);

  return {
    frequency,
    interval: 1,
    next_execution_at,
    time_of_day: time,
    day_of_week: dayOfWeek
  };
}

function parseExplicitDate(text: string): string | undefined {
  try {
    const normalized = text.toLowerCase();
    const now = new Date();

    if (/\b(now|immediately|right away)\b/.test(normalized)) return applyTime(now, extractTime(text)).toISOString();
    if (/today/.test(normalized)) return applyTime(now, extractTime(text)).toISOString();
    if (/tomorrow/.test(normalized)) {
      now.setDate(now.getDate() + 1);
      return applyTime(now, extractTime(text)).toISOString();
    }

    const monthPattern = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?/i;
    const match = text.match(monthPattern);
    if (match) {
      const month = monthIndex(match[1]);
      const day = parseInt(match[2], 10);
      const year = match[3] ? parseInt(match[3], 10) : now.getFullYear();
      return applyTime(new Date(year, month, day), extractTime(text)).toISOString();
    }

    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return applyTime(parsed, extractTime(text)).toISOString();
  } catch {
    return undefined;
  }
}

function extractTime(text: string): string | undefined {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return undefined;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function extractDayOfWeek(text: string): number | undefined {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const index = days.findIndex(day => text.includes(day));
  return index >= 0 ? index : undefined;
}

function nextDateForFrequency(frequency: FrequencyType, dayOfWeek?: number, time?: string): string {
  const next = new Date();
  if (frequency === "weekly" && dayOfWeek !== undefined) {
    const daysUntil = (dayOfWeek + 7 - next.getDay()) % 7 || 7;
    next.setDate(next.getDate() + daysUntil);
  } else if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  }
  return applyTime(next, time).toISOString();
}

function applyTime(date: Date, time?: string): Date {
  const copy = new Date(date);
  if (time) {
    const [hour, minute] = time.split(":").map(Number);
    copy.setHours(hour, minute, 0, 0);
  }
  return copy;
}

function monthIndex(value: string): number {
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    .findIndex(month => value.toLowerCase().startsWith(month));
}

function describePayment(amount: number, token: string, recipient: string, schedule?: WorkflowConfig["schedule"]): string {
  const target = recipient || "the recipient";
  if (!schedule) return `Send ${amount} ${token} to ${target}.`;
  const dateText = schedule.next_execution_at ? new Date(schedule.next_execution_at).toLocaleString() : "the scheduled time";
  if (schedule.frequency === "one_time") return `Send ${amount} ${token} to ${target} on ${dateText}.`;
  return `Send ${amount} ${token} to ${target} ${schedule.frequency}, starting ${dateText}.`;
}

/**
 * Validate parsed intent configuration
 */
export function validateIntentConfig(workflow_type: WorkflowType, config: WorkflowConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  switch (workflow_type) {
    case "scheduled_payment":
    case "recurring_payment":
      if (!config.amount || config.amount <= 0) {
        errors.push("Amount must be greater than 0");
      }
      if (!config.recipient_address) {
        errors.push("Recipient address is required");
      }
      if (!config.token) {
        errors.push("Token type is required");
      }
      break;
      
    case "split_revenue":
      if (!config.splits || config.splits.length === 0) {
        errors.push("At least one revenue split is required");
      }
      const totalPercentage = config.splits?.reduce((sum, s) => sum + s.percentage, 0) || 0;
      if (totalPercentage > 100) {
        errors.push("Total split percentage cannot exceed 100%");
      }
      break;
      
    case "savings_sweep":
      if (!config.percentage || config.percentage <= 0 || config.percentage > 100) {
        errors.push("Percentage must be between 1 and 100");
      }
      if (!config.recipient_address) {
        errors.push("Savings recipient address is required");
      }
      break;
      
    case "threshold_transfer":
      if (!config.threshold_value || config.threshold_value <= 0) {
        errors.push("Threshold value must be greater than 0");
      }
      if (!config.amount || config.amount <= 0) {
        errors.push("Transfer amount must be greater than 0");
      }
      if (!config.recipient_address) {
        errors.push("Recipient address is required");
      }
      if (!config.token) {
        errors.push("Token type is required");
      }
      break;
      
    case "payroll_automation":
      if (!config.recipients || config.recipients.length === 0) {
        errors.push("At least one payroll recipient is required");
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
