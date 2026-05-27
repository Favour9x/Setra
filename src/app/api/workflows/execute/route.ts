import { NextRequest, NextResponse } from "next/server";
import { fetchIntentWorkflows } from "@/lib/services/intent-workflow-db";
import { executeIntentWorkflow } from "@/lib/workflows/intent-engine";
import { createClient } from "@supabase/supabase-js";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

export async function POST(request: NextRequest) {
  try {
    console.log("⚡ Executing intent workflow execution engine...");
    
    const body = await request.json();
    const { userId, triggerType, amount, workflowId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Fetch user profile to get wallet
    const { data: profile } = await adminClient
      .from("profiles")
      .select("wallet_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.wallet_id) {
      return NextResponse.json({ error: "No wallet found for user" }, { status: 400 });
    }

    // Fetch intent workflows for this user
    let workflows = await fetchIntentWorkflows(userId, adminClient);

    // Filter by specific workflowId if requested
    if (workflowId) {
      workflows = workflows.filter(w => w.id === workflowId);
    } else if (triggerType) {
      // Filter by matching trigger condition type
      workflows = workflows.filter(w => w.config?.trigger?.trigger_type === triggerType);
    }

    // Only run active workflows
    workflows = workflows.filter(w => w.active && w.status === "active");

    if (workflows.length === 0) {
      console.log("✅ No matching active intent workflows found");
      return NextResponse.json({ success: true, executed: 0, message: "No active workflows found" });
    }

    console.log(`📋 Running ${workflows.length} intent workflows...`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const workflow of workflows) {
      try {
        console.log(`🔄 Processing intent workflow: ${workflow.name} (${workflow.workflow_type})`);
        
        const res = await executeIntentWorkflow(workflow, triggerType || "manual", {
          amount: amount || 100,
          walletId: profile.wallet_id
        });

        if (res.success) {
          successCount++;
          results.push({ id: workflow.id, success: true, txHash: res.txHash });
        } else {
          failCount++;
          results.push({ id: workflow.id, success: false, error: res.error || "Execution failed" });
        }
      } catch (err: any) {
        console.error(`❌ Execution failed for workflow ${workflow.id}:`, err);
        failCount++;
        results.push({ id: workflow.id, success: false, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      executed: workflows.length,
      successful: successCount,
      failed: failCount,
      results
    });
  } catch (error: any) {
    console.error("❌ Workflow execution api error:", error);
    return NextResponse.json({ error: error.message || "Execution api failed" }, { status: 500 });
  }
}
