import { NextRequest, NextResponse } from "next/server";
import { processScheduledWorkflows } from "@/lib/workflows/scheduler";

/**
 * Cron endpoint for processing scheduled workflows
 * Should be called by a cron service (e.g., Vercel Cron, GitHub Actions, external cron)
 * 
 * Security: Add authorization header check in production
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authorization check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🕐 Cron job triggered: Processing scheduled workflows");
    
    const result = await processScheduledWorkflows();
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
