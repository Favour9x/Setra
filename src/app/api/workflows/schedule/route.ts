import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { getUpcomingWorkflows } from "@/lib/workflows/scheduler";

// GET - Fetch upcoming scheduled workflows
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
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const workflows = await getUpcomingWorkflows(user.id, limit);
    
    return NextResponse.json({ success: true, workflows });
  } catch (error: any) {
    console.error("Fetch scheduled workflows error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch scheduled workflows" }, { status: 500 });
  }
}
