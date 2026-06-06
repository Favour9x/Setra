import { createClient } from "@supabase/supabase-js";
import { createNotification } from "./notification";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

let useFallbackCache: boolean | null = null;

export async function shouldRunFallback(client: any): Promise<boolean> {
  if (useFallbackCache !== null) {
    return useFallbackCache;
  }
  try {
    const { error } = await client.from("automation_workflows").select("id").limit(1);
    if (error && (
      error.message.includes("does not exist") || 
      error.message.includes("schema cache") ||
      error.code === "P0001" ||
      error.code === "42P01"
    )) {
      console.warn("⚠️ automation_workflows table does not exist. Falling back to workflows table.");
      useFallbackCache = true;
    } else {
      useFallbackCache = false;
    }
  } catch (err) {
    useFallbackCache = true;
  }
  return useFallbackCache;
}

export interface IntentWorkflow {
  id: string;
  user_id: string;
  name: string;
  intent_prompt: string;
  workflow_type: string;
  status: string;
  config: any;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Hydrated fields
  schedules?: any[];
  triggers?: any[];
  executions?: any[];
  logs?: any[];
}

export async function saveIntentWorkflow(
  userId: string,
  workflow: {
    name: string;
    intent_prompt: string;
    workflow_type: string;
    config: any;
    active?: boolean;
    status?: string;
  },
  supabase?: any
): Promise<IntentWorkflow> {
  const client = supabase || getAdminClient();
  const fallback = await shouldRunFallback(client);

  const active = workflow.active !== false;
  const status = workflow.status || "active";

  if (fallback) {
    // Map to old workflows table structure
    const trigger_type = 
      workflow.workflow_type === "split_revenue" ? "revenue_received" :
      workflow.workflow_type === "creator_payroll" ? "payroll" : "scheduled";

    const action_type = 
      workflow.workflow_type === "split_revenue" ? "split_revenue" :
      workflow.workflow_type === "creator_payroll" ? "creator_payroll" : "automated_payout";

    // Embed intent data into config
    const oldConfig = {
      ...workflow.config,
      intent_prompt: workflow.intent_prompt,
      workflow_type: workflow.workflow_type,
      status: status,
      executions: [],
      logs: [{
        created_at: new Date().toISOString(),
        log_level: "info",
        message: `Workflow created from intent: "${workflow.intent_prompt}"`
      }]
    };

    const { data, error } = await client
      .from("workflows")
      .insert({
        user_id: userId,
        name: workflow.name,
        trigger_type,
        action_type,
        config: oldConfig,
        active
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      intent_prompt: workflow.intent_prompt,
      workflow_type: workflow.workflow_type,
      status: status,
      config: oldConfig,
      active: data.active,
      created_at: data.created_at,
      updated_at: data.created_at,
      schedules: [],
      triggers: [],
      executions: [],
      logs: oldConfig.logs
    };
  } else {
    // Insert into new automation_workflows table
    const { data: newWf, error: wfErr } = await client
      .from("automation_workflows")
      .insert({
        user_id: userId,
        name: workflow.name,
        intent_prompt: workflow.intent_prompt,
        workflow_type: workflow.workflow_type,
        status,
        config: workflow.config,
        active
      })
      .select()
      .single();

    if (wfErr) throw wfErr;

    // Create trigger record if configured (non-fatal if table missing)
    if (workflow.config.trigger) {
      try {
        await client.from("workflow_triggers").insert({
          workflow_id: newWf.id,
          trigger_type: workflow.config.trigger.trigger_type,
          conditions: workflow.config.trigger.conditions || {},
          active: true
        });
      } catch (e) {
        console.warn("Could not create trigger record:", e);
      }
    }

    // Create schedule record if scheduled/recurring (non-fatal if table missing)
    if (workflow.config.schedule) {
      try {
        await client.from("workflow_schedules").insert({
          workflow_id: newWf.id,
          frequency: workflow.config.schedule.frequency || "one_time",
          interval: workflow.config.schedule.interval || 1,
          next_execution_at: workflow.config.schedule.next_execution_at || new Date().toISOString()
        });
      } catch (e) {
        console.warn("Could not create schedule record:", e);
      }
    }

    // Create initial log (non-fatal if table missing)
    try {
      await client.from("workflow_logs").insert({
        workflow_id: newWf.id,
        log_level: "info",
        message: `Workflow created from intent: "${workflow.intent_prompt}"`
      });
    } catch (e) {
      console.warn("Could not create workflow log:", e);
    }

    return {
      ...newWf,
      schedules: workflow.config.schedule ? [workflow.config.schedule] : [],
      triggers: workflow.config.trigger ? [workflow.config.trigger] : [],
      executions: [],
      logs: [{ message: `Workflow created from intent: "${workflow.intent_prompt}"`, created_at: new Date().toISOString() }]
    };
  }
}

export async function fetchIntentWorkflows(
  userId: string,
  supabase?: any
): Promise<IntentWorkflow[]> {
  const client = supabase || getAdminClient();
  const fallback = await shouldRunFallback(client);

  if (fallback) {
    const { data, error } = await client
      .from("workflows")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data.map((w: any) => {
      const config = w.config || {};
      const intent_prompt = config.intent_prompt || `Intent: Split/Payout for ${w.name}`;
      const workflow_type = config.workflow_type || (w.action_type === "split_revenue" ? "split_revenue" : w.action_type === "creator_payroll" ? "payroll_automation" : "scheduled_payment");
      const status = config.status || (w.active ? "active" : "paused");

      return {
        id: w.id,
        user_id: w.user_id,
        name: w.name,
        intent_prompt,
        workflow_type,
        status,
        config,
        active: w.active,
        created_at: w.created_at,
        updated_at: w.created_at,
        schedules: config.schedule ? [config.schedule] : [],
        triggers: config.trigger ? [config.trigger] : [],
        executions: config.executions || [],
        logs: config.logs || []
      };
    });
  } else {
    // Fetch from new tables with joins
    const { data: workflows, error: wfErr } = await client
      .from("automation_workflows")
      .select(`
        *,
        schedules:workflow_schedules(*),
        triggers:workflow_triggers(*),
        executions:workflow_executions(*),
        logs:workflow_logs(*)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (wfErr) throw wfErr;

    return (workflows || []).map((w: any) => ({
      ...w,
      executions: (w.executions || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      logs: (w.logs || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }));
  }
}

export async function updateIntentWorkflowStatus(
  userId: string,
  workflowId: string,
  active: boolean,
  supabase?: any
): Promise<boolean> {
  const client = supabase || getAdminClient();
  const fallback = await shouldRunFallback(client);

  const status = active ? "active" : "paused";

  if (fallback) {
    const { data: current } = await client
      .from("workflows")
      .select("config")
      .eq("id", workflowId)
      .single();

    const config = current?.config || {};
    config.status = status;
    if (!config.logs) config.logs = [];
    config.logs.push({
      created_at: new Date().toISOString(),
      log_level: "info",
      message: `Workflow status changed to ${status}`
    });

    const { error } = await client
      .from("workflows")
      .update({ active, config })
      .eq("id", workflowId)
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } else {
    const { error } = await client
      .from("automation_workflows")
      .update({ active, status, updated_at: new Date().toISOString() })
      .eq("id", workflowId)
      .eq("user_id", userId);

    if (error) throw error;

    await client.from("workflow_logs").insert({
      workflow_id: workflowId,
      log_level: "info",
      message: `Workflow status changed to ${status}`
    });

    return true;
  }
}

export async function deleteIntentWorkflow(
  userId: string,
  workflowId: string,
  supabase?: any
): Promise<boolean> {
  const client = supabase || getAdminClient();
  const fallback = await shouldRunFallback(client);

  if (fallback) {
    const { error } = await client
      .from("workflows")
      .delete()
      .eq("id", workflowId)
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } else {
    for (const table of ["workflow_logs", "workflow_executions", "workflow_schedules", "workflow_triggers"]) {
      const { error: childError } = await client
        .from(table)
        .delete()
        .eq("workflow_id", workflowId);

      if (childError) throw childError;
    }

    const { error } = await client
      .from("automation_workflows")
      .delete()
      .eq("id", workflowId)
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  }
}

export const FREE_TIER_MAX_WORKFLOWS = 2;

export async function countActiveWorkflows(
  userId: string,
  supabase?: any
): Promise<number> {
  const client = supabase || getAdminClient();
  const fallback = await shouldRunFallback(client);

  if (fallback) {
    const { data, error } = await client
      .from("workflows")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("active", true);

    if (error) throw error;
    return data?.length || 0;
  } else {
    const { count, error } = await client
      .from("automation_workflows")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("active", true);

    if (error) throw error;
    return count || 0;
  }
}

export async function checkWorkflowLimit(
  userId: string,
  supabase: any
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", userId)
    .maybeSingle();

  const isPro = profile?.is_pro === true;
  if (isPro) return { allowed: true };

  const activeCount = await countActiveWorkflows(userId, supabase);
  if (activeCount >= FREE_TIER_MAX_WORKFLOWS) {
    return {
      allowed: false,
      reason: `Free plan limited to ${FREE_TIER_MAX_WORKFLOWS} active workflows. Upgrade to Pro for unlimited workflows.`
    };
  }

  return { allowed: true };
}

export async function logExecutionAttempt(
  workflowId: string,
  status: "pending" | "running" | "success" | "failed",
  txHash?: string,
  errorMsg?: string,
  metadata?: any,
  supabase?: any
): Promise<string> {
  const client = supabase || getAdminClient();
  const fallback = await shouldRunFallback(client);

  const completed_at = status === "success" || status === "failed" ? new Date().toISOString() : null;

  if (fallback) {
    const { data: current } = await client
      .from("workflows")
      .select("config, user_id")
      .eq("id", workflowId)
      .single();

    if (!current) return "";

    const config = current.config || {};
    if (!config.executions) config.executions = [];
    if (!config.logs) config.logs = [];

    const executionId = Math.random().toString(36).substring(7);
    config.executions.unshift({
      id: executionId,
      status,
      tx_hash: txHash || null,
      error: errorMsg || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      completed_at
    });

    config.logs.unshift({
      created_at: new Date().toISOString(),
      log_level: status === "failed" ? "error" : "info",
      message: `Execution attempt [${status.toUpperCase()}]: ${errorMsg || "Transaction executed successfully"}`
    });

    await client.from("workflows").update({ config }).eq("id", workflowId);

    // Dynamic notification trigger
    if (status === "success" || status === "failed") {
      try {
        await createNotification(
          current.user_id,
          "workflow_executed",
          status === "success" ? "Workflow Executed" : "Workflow Failed",
          `Automation execution ${status}: ${errorMsg || "Transferred funds successfully"}`,
          { workflow_id: workflowId, tx_hash: txHash }
        );
      } catch (err) {
        console.error("Failed to trigger workflow execution notification", err);
      }
    }

    return executionId;
  } else {
    // Insert execution record
    const { data, error } = await client
      .from("workflow_executions")
      .insert({
        workflow_id: workflowId,
        status,
        tx_hash: txHash || null,
        error: errorMsg || null,
        execution_metadata: metadata || {},
        completed_at
      })
      .select()
      .single();

    if (error) throw error;

    // Log the event
    await client.from("workflow_logs").insert({
      workflow_id: workflowId,
      execution_id: data.id,
      log_level: status === "failed" ? "error" : "info",
      message: `Execution attempt ${status}: ${errorMsg || "Success"}`
    });

    // Send notifications if finished
    const { data: wf } = await client
      .from("automation_workflows")
      .select("user_id")
      .eq("id", workflowId)
      .single();

    if (wf && (status === "success" || status === "failed")) {
      try {
        await createNotification(
          wf.user_id,
          "workflow_executed",
          status === "success" ? "Workflow Executed" : "Workflow Failed",
          `Automation execution ${status}: ${errorMsg || "Transferred funds successfully"}`,
          { workflow_id: workflowId, tx_hash: txHash }
        );
      } catch (err) {
        console.error("Failed to trigger notification", err);
      }
    }

    return data.id;
  }
}
