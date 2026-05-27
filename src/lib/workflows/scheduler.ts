/**
 * Workflow Scheduler Service
 * Handles scheduled and recurring workflow execution
 */

import { createClient } from "@supabase/supabase-js";
import { fetchIntentWorkflows, shouldRunFallback } from "../services/intent-workflow-db";
import { executeIntentWorkflow } from "./intent-engine";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

/**
 * Check and execute due scheduled workflows
 * Should be called by a cron job or background worker
 */
export async function processScheduledWorkflows(): Promise<{
  processed: number;
  successful: number;
  failed: number;
  results: any[];
}> {
  console.log("🕐 Workflow Scheduler: Checking for due workflows...");
  
  const adminClient = getAdminClient();
  const now = new Date();
  
  try {
    const fallback = await shouldRunFallback(adminClient);
    let workflows: any[] = [];
    let error: any = null;

    if (fallback) {
      const result = await adminClient
        .from("workflows")
        .select("*")
        .eq("active", true);

      error = result.error;
      workflows = (result.data || []).map((w: any) => ({
        ...w,
        intent_prompt: w.config?.intent_prompt || w.name,
        workflow_type: w.config?.workflow_type || "scheduled_payment",
        status: w.config?.status || "active",
        schedules: w.config?.schedule ? [w.config.schedule] : []
      }));
    } else {
      const result = await adminClient
        .from("automation_workflows")
        .select(`
          *,
          schedules:workflow_schedules(*),
          triggers:workflow_triggers(*)
        `)
        .eq("active", true)
        .eq("status", "active");

      error = result.error;
      workflows = result.data || [];
    }

    if (error) {
      console.error("Error fetching scheduled workflows:", error);
      return { processed: 0, successful: 0, failed: 0, results: [] };
    }

    if (!workflows || workflows.length === 0) {
      console.log("No active workflows found.");
      return { processed: 0, successful: 0, failed: 0, results: [] };
    }

    // Filter workflows that are due for execution
    const dueWorkflows = workflows.filter(wf => {
      if (!wf.schedules || wf.schedules.length === 0) return false;
      
      const schedule = wf.schedules[0];
      const nextExecution = new Date(schedule.next_execution_at);
      
      return nextExecution <= now;
    });

    console.log(`Found ${dueWorkflows.length} workflows due for execution.`);

    const results = [];
    let successful = 0;
    let failed = 0;

    for (const workflow of dueWorkflows) {
      try {
        console.log(`Executing scheduled workflow: ${workflow.name}`);
        
        const result = await executeIntentWorkflow(
          workflow,
          "on_schedule",
          { walletId: undefined }
        );

        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: true,
          ...result
        });
        successful++;
      } catch (error: any) {
        console.error(`Failed to execute workflow ${workflow.id}:`, error);
        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: false,
          error: error.message
        });
        failed++;
      }
    }

    return {
      processed: dueWorkflows.length,
      successful,
      failed,
      results
    };
  } catch (error: any) {
    console.error("Scheduler error:", error);
    return { processed: 0, successful: 0, failed: 0, results: [] };
  }
}

/**
 * Get upcoming scheduled workflows for a user
 */
export async function getUpcomingWorkflows(
  userId: string,
  limit: number = 10
): Promise<any[]> {
  const adminClient = getAdminClient();
  
  const { data: workflows, error } = await adminClient
    .from("automation_workflows")
    .select(`
      *,
      schedules:workflow_schedules(*)
    `)
    .eq("user_id", userId)
    .eq("active", true)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching upcoming workflows:", error);
    return [];
  }

  return (workflows || [])
    .filter(wf => wf.schedules && wf.schedules.length > 0)
    .map(wf => ({
      ...wf,
      next_execution: wf.schedules[0]?.next_execution_at
    }))
    .sort((a, b) => {
      const dateA = new Date(a.next_execution);
      const dateB = new Date(b.next_execution);
      return dateA.getTime() - dateB.getTime();
    });
}

/**
 * Manually trigger a workflow execution
 */
export async function manuallyTriggerWorkflow(
  userId: string,
  workflowId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const adminClient = getAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("wallet_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile?.wallet_id) {
      return { success: false, error: "No wallet found for user" };
    }

    const workflows = await fetchIntentWorkflows(userId);
    const workflow = workflows.find(w => w.id === workflowId);

    if (!workflow) {
      return { success: false, error: "Workflow not found" };
    }

    if (!workflow.active || workflow.status !== "active") {
      return { success: false, error: "Workflow is not active" };
    }

    const result = await executeIntentWorkflow(
      workflow,
      "manual",
      { walletId: profile.wallet_id }
    );

    return { success: true, result };
  } catch (error: any) {
    console.error("Manual trigger error:", error);
    return { success: false, error: error.message };
  }
}
