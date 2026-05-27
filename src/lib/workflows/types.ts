/**
 * Generalized Workflow Type Definitions
 * Supports open-ended intent-based financial automation
 */

export type WorkflowType =
  | "scheduled_payment"      // One-time or recurring scheduled payments
  | "recurring_payment"      // Subscription-style recurring payments
  | "split_revenue"          // Split incoming payments across wallets
  | "savings_sweep"          // Move percentage of incoming funds to savings
  | "threshold_transfer"     // Transfer when balance exceeds threshold
  | "auto_invoice_pay"       // Automatically pay pending invoices
  | "conditional_transfer"   // Transfer based on custom conditions
  | "subscription_payment"   // Recurring subscription payments
  | "payroll_automation"     // Automated team payroll
  | "custom_intent";         // Open-ended custom automation

export type TriggerType =
  | "on_funds_received"      // Triggered when funds are received
  | "on_balance_threshold"   // Triggered when balance crosses threshold
  | "on_date_time"           // Triggered at specific date/time
  | "on_schedule"            // Triggered on recurring schedule
  | "manual";                // Manually triggered

export type FrequencyType =
  | "one_time"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export interface WorkflowTrigger {
  trigger_type: TriggerType;
  conditions?: {
    threshold_value?: number;
    comparison?: "greater_than" | "less_than" | "equals";
    amount_min?: number;
    amount_max?: number;
  };
}

export interface WorkflowSchedule {
  frequency: FrequencyType;
  interval?: number;
  start_date?: string;
  end_date?: string;
  next_execution_at?: string;
  time_of_day?: string; // HH:MM format
  day_of_week?: number; // 0-6 (Sunday-Saturday)
  day_of_month?: number; // 1-31
}

export interface RevenueSplit {
  address: string;
  percentage: number;
  name?: string;
}

export interface PaymentRecipient {
  address: string;
  amount: number;
  name?: string;
}

export interface WorkflowConfig {
  // Payment details
  amount?: number;
  token?: string;
  recipient_address?: string;
  recipient_name?: string;
  description?: string;
  plain_english?: string;
  
  // Revenue splitting
  splits?: RevenueSplit[];
  
  // Payroll
  recipients?: PaymentRecipient[];
  
  // Savings sweep
  percentage?: number;
  
  // Threshold
  threshold_value?: number;
  
  // Invoice automation
  max_amount_per_invoice?: number;
  
  // Scheduling
  schedule?: WorkflowSchedule;
  
  // Triggers
  trigger?: WorkflowTrigger;
  
  // Execution tracking
  next_execution?: string;
  last_execution?: string;
  execution_count?: number;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface AutomationWorkflow {
  id: string;
  user_id: string;
  name: string;
  intent_prompt: string;
  workflow_type: WorkflowType;
  status: "active" | "paused" | "completed" | "cancelled";
  config: WorkflowConfig;
  active: boolean;
  created_at: string;
  updated_at: string;
  
  // Hydrated relations
  schedules?: WorkflowScheduleRecord[];
  triggers?: WorkflowTriggerRecord[];
  executions?: WorkflowExecution[];
  logs?: WorkflowLog[];
}

export interface WorkflowScheduleRecord {
  id: string;
  workflow_id: string;
  frequency: FrequencyType;
  interval: number;
  next_execution_at: string;
  last_execution_at?: string;
  created_at: string;
}

export interface WorkflowTriggerRecord {
  id: string;
  workflow_id: string;
  trigger_type: TriggerType;
  conditions: Record<string, any>;
  active: boolean;
  created_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: "pending" | "running" | "success" | "failed";
  tx_hash?: string;
  error?: string;
  execution_metadata?: Record<string, any>;
  created_at: string;
  completed_at?: string;
}

export interface WorkflowLog {
  id: string;
  workflow_id: string;
  execution_id?: string;
  log_level: "info" | "warn" | "error";
  message: string;
  details?: Record<string, any>;
  created_at: string;
}
