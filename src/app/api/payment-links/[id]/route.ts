import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { fetchPaymentLinkById } from "@/lib/services/payment-link";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: linkId } = await params;
    
    let supabase: any = null;
    try {
      supabase = await createServerSupabase();
    } catch (e) {
      // Ignore if unauthenticated / no cookie headers
    }

    const link = await fetchPaymentLinkById(linkId);

    if (!link) {
      return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, link });
  } catch (error: any) {
    console.error("Fetch payment link by ID error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch payment link" }, { status: 500 });
  }
}
