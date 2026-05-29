import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processDueSubscriptions } from "@/lib/services/subscription";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log("Processing subscription billing cycle...");
    const result = await processDueSubscriptions(supabaseAdmin);
    console.log(`Billing cycle complete: ${result.successful} successful, ${result.failed} failed`);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Subscription processing error:", error);
    return NextResponse.json({ error: error.message || "Processing failed" }, { status: 500 });
  }
}
