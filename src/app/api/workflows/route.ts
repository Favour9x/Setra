import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { 
  fetchIntentWorkflows, 
  saveIntentWorkflow, 
  updateIntentWorkflowStatus, 
  deleteIntentWorkflow 
} from "@/lib/services/intent-workflow-db";
import { resolveRecipientAddress } from "@/lib/resolve-username";
import { parseIntent, validateIntentConfig } from "@/lib/workflows/intent-parser";

// GET - Fetch workflows
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const workflows = await fetchIntentWorkflows(user.id, supabase);
    return NextResponse.json({ success: true, workflows });
  } catch (error: any) {
    console.error("Fetch workflows API error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch workflows" }, { status: 500 });
  }
}

// POST - Create or update a workflow rule
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
    const { id, active, name, intent_prompt, workflow_type, config, use_parser } = body;

    // Handle legacy toggle update sent via POST
    if (id !== undefined && active !== undefined) {
      const success = await updateIntentWorkflowStatus(user.id, id, active, supabase);
      return NextResponse.json({ success });
    }

    // Parse intent if requested
    let finalWorkflowType = workflow_type;
    let finalName = name;
    let finalConfig = config;

    if (use_parser && intent_prompt) {
      const parsed = parseIntent(intent_prompt);
      
      if (parsed.confidence < 0.5) {
        return NextResponse.json({ 
          error: "Could not parse intent with sufficient confidence. Please provide explicit workflow details.",
          parsed 
        }, { status: 400 });
      }

      finalWorkflowType = parsed.workflow_type;
      finalName = finalName || parsed.name;
      finalConfig = { ...parsed.config, ...config };
    }

    if (!finalName || !intent_prompt || !finalWorkflowType) {
      return NextResponse.json({ error: "Missing required fields (name, intent_prompt, workflow_type)" }, { status: 400 });
    }

    // Validate configuration
    const validation = validateIntentConfig(finalWorkflowType, finalConfig);
    if (!validation.valid) {
      return NextResponse.json({ 
        error: "Invalid workflow configuration", 
        validation_errors: validation.errors 
      }, { status: 400 });
    }

    const resolvedConfig = { ...finalConfig };
    
    // Resolve any usernames in config to real wallet addresses
    if (finalConfig?.recipient_address) {
      try {
        resolvedConfig.recipient_address = await resolveRecipientAddress(finalConfig.recipient_address);
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Recipient not found on Setra" }, { status: 400 });
      }
    }

    if (Array.isArray(finalConfig?.splits)) {
      try {
        const resolvedSplits = [];
        for (const split of finalConfig.splits) {
          const resolvedAddress = await resolveRecipientAddress(split.address);
          resolvedSplits.push({
            ...split,
            address: resolvedAddress
          });
        }
        resolvedConfig.splits = resolvedSplits;
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Recipient not found on Setra" }, { status: 400 });
      }
    }

    if (Array.isArray(finalConfig?.recipients)) {
      try {
        const resolvedRecipients = [];
        for (const recipient of finalConfig.recipients) {
          const resolvedAddress = await resolveRecipientAddress(recipient.address);
          resolvedRecipients.push({
            ...recipient,
            address: resolvedAddress
          });
        }
        resolvedConfig.recipients = resolvedRecipients;
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Recipient not found on Setra" }, { status: 400 });
      }
    }

    const workflow = await saveIntentWorkflow(user.id, {
      name: finalName,
      intent_prompt,
      workflow_type: finalWorkflowType,
      config: resolvedConfig,
      active: true
    }, supabase);

    return NextResponse.json({ success: true, workflow });
  } catch (error: any) {
    console.error("Create workflow API error:", error);
    return NextResponse.json({ error: error.message || "Failed to create workflow" }, { status: 500 });
  }
}

// PATCH - Update workflow status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, active } = body;

    if (!id || active === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const success = await updateIntentWorkflowStatus(session.user.id, id, active, supabase);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error("Update workflow status error:", error);
    return NextResponse.json({ error: error.message || "Failed to update workflow" }, { status: 500 });
  }
}

// DELETE - Remove workflow
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing workflow ID" }, { status: 400 });
    }

    const success = await deleteIntentWorkflow(session.user.id, id, supabase);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error("Delete workflow error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete workflow" }, { status: 500 });
  }
}

