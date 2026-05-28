import { NextRequest, NextResponse } from "next/server";
import { fetchTipsPageByUsername, processTipPayment } from "@/lib/services/tips";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const body = await request.json();
    const { amount, message, senderAddress, senderUsername, payerName, isManualAttempt, walletId } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Invalid username in URL" }, { status: 400 });
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const page = await fetchTipsPageByUsername(username);
    if (!page) return NextResponse.json({ error: "Tips page not found" }, { status: 404 });
    if (!page.active) return NextResponse.json({ error: "Tips page is inactive" }, { status: 400 });

    let effectiveSenderAddress = senderAddress;
    let effectiveSenderUsername = senderUsername;

    if (isManualAttempt) {
      effectiveSenderAddress = senderAddress || payerName || "anonymous";
      effectiveSenderUsername = senderUsername || null;
    }

    const result = await processTipPayment(
      page,
      Number(amount),
      effectiveSenderAddress || "anonymous",
      effectiveSenderUsername || null,
      message || null,
      !!isManualAttempt,
      walletId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Payment failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, txHash: result.txHash });
  } catch (error: any) {
    console.error("Tips payment error:", error);
    return NextResponse.json({ error: error.message || "Payment failed" }, { status: 500 });
  }
}
