import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processScheduledWorkflows } from "@/lib/workflows/scheduler";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

/**
 * POST /api/automation/check-and-execute
 * Checks for due workflows and executes them automatically
 * Called on page load and every 5 minutes via client polling
 */
export async function POST(req: NextRequest) {
  try {
    const adminClient = getAdminClient();

    // Get the current user from session
    const authHeader = req.headers.get("cookie");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Create a client with the user's session to verify authentication
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            cookie: authHeader
          }
        }
      }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has Pro Business subscription
    const { data: profile } = await adminClient
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    if (!profile || profile.subscription_tier !== "pro_business") {
      return NextResponse.json(
        { 
          success: false, 
          error: "Pro Business subscription required",
          requiresUpgrade: true 
        },
        { status: 403 }
      );
    }

    // Process all due scheduled workflows across all users
    const result = await processScheduledWorkflows();

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} workflows`,
      ...result
    });
  } catch (error: any) {
    console.error("Automation check-and-execute error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to check and execute automations" },
      { status: 500 }
    );
  }
}
