# Design Document: Intent-Driven Financial Automation Engine

## Overview

This design transforms Setra's automation workflow system from a limited revenue-splitting tool into a generalized, open-ended intent-driven financial automation engine. Users can create any type of payment automation intent using natural language expressions like "Pay @favour11 5 USDC by 5PM on May 19th 2026" or "Move 15% of every payment into savings". The system supports scheduled payments, recurring workflows, conditional triggers, threshold-based transfers, and dynamic payment orchestration—all executed through Circle's programmable wallets with full audit trails and execution history.

## Main Algorithm/Workflow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant WorkflowAPI
    participant IntentParser
    participant ExecutionEngine
    participant TriggerEvaluator
    participant CircleWallet
    participant Database
    
    User->>Frontend: Create automation intent
    Frontend->>WorkflowAPI: POST /api/workflows/create
    WorkflowAPI->>IntentParser: parseIntent(intentPrompt)
    IntentParser-->>WorkflowAPI: ParsedWorkflowConfig
    WorkflowAPI->>Database: Insert automation_workflow
    Database-->>WorkflowAPI: workflow_id
    WorkflowAPI->>Database: Insert workflow_schedule/triggers
    WorkflowAPI-->>Frontend: Workflow created
    
    loop Execution Cycle
        ExecutionEngine->>Database: Fetch due workflows
        ExecutionEngine->>TriggerEvaluator: evaluateTriggers(workflow)
        TriggerEvaluator-->>ExecutionEngine: shouldExecute: true
        ExecutionEngine->>Database: Create workflow_execution (pending)
        ExecutionEngine->>CircleWallet: executeTransfer(config)
        CircleWallet-->>ExecutionEngine: txHash
        ExecutionEngine->>Database: Update execution (success)
        ExecutionEngine->>Database: Insert workflow_log
        ExecutionEngine->>Database: Update next_execution_at
    end
