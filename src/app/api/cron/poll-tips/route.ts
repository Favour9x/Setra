import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "setra-cron-secret-2024";
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call the tips polling endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/tips/poll-incoming`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: data,
    });
  } catch (error: any) {
    console.error("Cron poll error:", error);
    return NextResponse.json(
      { error: error.message || "Cron job failed" },
      { status: 500 }
    );
  }
}
