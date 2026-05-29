import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processDueSubscriptions } from "@/lib/services/subscription";

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log("Cron: processing due subscriptions...");
    const result = await processDueSubscriptions(supabaseAdmin);
    console.log(`Cron complete: ${result.successful} success, ${result.failed} failed`);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Cron subscription processing error:", error);
    return NextResponse.json({ error: error.message || "Processing failed" }, { status: 500 });
  }
}
