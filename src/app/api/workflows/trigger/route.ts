import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { manuallyTriggerWorkflow } from "@/lib/workflows/scheduler";

// POST - Manually trigger a workflow execution
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    const body = await request.json();
    const { workflowId } = body;

    if (!workflowId) {
      return NextResponse.json({ error: "Missing workflowId" }, { status: 400 });
    }

    const result = await manuallyTriggerWorkflow(user.id, workflowId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, result: result.result });
  } catch (error: any) {
    console.error("Manual trigger error:", error);
    return NextResponse.json({ error: error.message || "Failed to trigger workflow" }, { status: 500 });
  }
}
