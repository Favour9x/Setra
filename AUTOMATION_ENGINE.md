# Setra Financial Automation Engine

## Overview

Setra's automation engine is a generalized intent-driven financial automation system that enables users to create programmable money operations using natural language.

## Architecture

### Core Components

1. **Intent Parser** (`src/lib/workflows/intent-parser.ts`)
   - Converts natural language intents into structured workflow configurations
   - Supports pattern matching for common automation types
   - Validates workflow configurations

2. **Execution Engine** (`src/lib/workflows/intent-engine.ts`)
   - Executes workflows based on triggers
   - Handles all workflow types
   - Manages execution state and logging

3. **Scheduler** (`src/lib/workflows/scheduler.ts`)
   - Processes scheduled and recurring workflows
   - Manages execution timing
   - Supports manual workflow triggering

4. **Database Layer** (`src/lib/services/intent-workflow-db.ts`)
   - Manages workflow persistence
   - Handles execution logging
   - Supports both new and legacy table structures

### Workflow Types

- **scheduled_payment**: One-time scheduled payments
- **recurring_payment**: Subscription-style recurring payments
- **split_revenue**: Split incoming payments across wallets
- **savings_sweep**: Move percentage of incoming funds to savings
- **threshold_transfer**: Transfer when balance exceeds threshold
- **auto_invoice_pay**: Automatically pay pending invoices
- **conditional_transfer**: Transfer based on custom conditions
- **subscription_payment**: Recurring subscription payments
- **payroll_automation**: Automated team payroll
- **custom_intent**: Open-ended custom automation

### Trigger Types

- **on_funds_received**: Triggered when funds are received
- **on_balance_threshold**: Triggered when balance crosses threshold
- **on_date_time**: Triggered at specific date/time
- **on_schedule**: Triggered on recurring schedule
- **manual**: Manually triggered by user

## Database Schema

### Tables

1. **automation_workflows**
   - Stores workflow metadata and configuration
   - Fields: id, user_id, name, intent_prompt, workflow_type, status, config, active

2. **workflow_schedules**
   - Stores scheduling information
   - Fields: id, workflow_id, frequency, interval, next_execution_at, last_execution_at

3. **workflow_triggers**
   - Stores trigger conditions
   - Fields: id, workflow_id, trigger_type, conditions, active

4. **workflow_executions**
   - Stores execution history
   - Fields: id, workflow_id, status, tx_hash, error, execution_metadata

5. **workflow_logs**
   - Stores execution logs
   - Fields: id, workflow_id, execution_id, log_level, message, details

## API Endpoints

### Workflow Management

- `GET /api/workflows` - Fetch user workflows
- `POST /api/workflows` - Create new workflow
- `PATCH /api/workflows` - Update workflow status
- `DELETE /api/workflows` - Delete workflow

### Workflow Operations

- `POST /api/workflows/parse` - Parse natural language intent
- `POST /api/workflows/trigger` - Manually trigger workflow
- `GET /api/workflows/schedule` - Get upcoming scheduled workflows
- `GET /api/workflows/cron` - Cron endpoint for scheduled execution

## Usage Examples

### Creating Workflows

```typescript
// Using natural language
const intent = "Pay @favour11 5 USDC every Friday";

// Parse intent
const response = await fetch("/api/workflows/parse", {
  method: "POST",
  body: JSON.stringify({ intent }),
});

// Create workflow
await fetch("/api/workflows", {
  method: "POST",
  body: JSON.stringify({
    name: "Weekly payment to favour11",
    intent_prompt: intent,
    workflow_type: "recurring_payment",
    config: {
      amount: 5,
      recipient_address: "@favour11",
      schedule: {
        frequency: "weekly",
        next_execution_at: new Date().toISOString(),
      },
    },
  }),
});
```

### Triggering Workflows

```typescript
// Manual trigger
await fetch("/api/workflows/trigger", {
  method: "POST",
  body: JSON.stringify({ workflowId: "workflow-id" }),
});

// Automatic trigger (on funds received)
await triggerIntentWorkflows(userId, "on_funds_received", {
  amount: 100,
  walletId: "wallet-id",
});
```

## Scheduled Execution

Workflows are executed automatically via cron job:

- **Frequency**: Every 5 minutes
- **Endpoint**: `/api/workflows/cron`
- **Configuration**: `vercel.json`

### Setting Up Cron

1. Add `CRON_SECRET` to environment variables
2. Configure cron service to call `/api/workflows/cron`
3. Include authorization header: `Bearer ${CRON_SECRET}`

## Frontend Components

### WorkflowList
Main component displaying all user workflows

### CreateWorkflowDialog
Dialog for creating new workflows with intent parsing

### WorkflowCard
Card component displaying individual workflow details

### WorkflowExecutionHistory
Component showing execution history and logs

## Security

- All workflows are user-scoped (RLS policies)
- Wallet ownership validation on execution
- Payment intent verification
- Authorization required for cron endpoint

## Integration with Circle

All workflow executions use:
- Circle programmable wallets
- Circle transfers API
- Circle Agent Stack architecture

Circle remains the source of truth for:
- Wallet balances
- Payment execution
- Transaction history

## Future Enhancements

- AI-powered intent parsing
- Complex conditional logic
- Multi-step workflows
- Workflow templates
- Workflow marketplace
- Advanced scheduling (specific times, days)
- Workflow analytics and insights
- Webhook integrations
- API-triggered workflows
