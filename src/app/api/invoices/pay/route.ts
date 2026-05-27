import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification, getUserHandle } from "@/lib/services/notification";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// 1. GET - Fetch invoice details publicly (no auth required)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing invoice ID" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Fetch sender's username/handle
    const senderHandle = await getUserHandle(invoice.user_id);

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        title: invoice.title,
        amount: invoice.amount,
        currency: invoice.currency,
        recipient_address: invoice.recipient_address,
        due_date: invoice.due_date,
        status: invoice.status,
        recipient_email: invoice.recipient_email,
        payer_address: invoice.payer_address,
        created_at: invoice.created_at,
        sender_handle: senderHandle,
      },
    });
  } catch (error: any) {
    console.error("Public fetch invoice error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// 2. POST - Payer claims "I have sent the payment"
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, payerAddress } = body;

    if (!id || !payerAddress) {
      return NextResponse.json({ error: "Missing required fields (id, payerAddress)" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Check if invoice exists and is eligible for payment
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
    }

    // 2. Update status and record payer address
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "awaiting_confirmation",
        payer_address: payerAddress,
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    // 3. Notify the invoice creator: "Payment claimed for invoice [title] — verifying onchain"
    try {
      await createNotification(
        invoice.user_id,
        "payment_request",
        "Payment Claimed",
        `Payment claimed for invoice "${invoice.title}" — verifying onchain`,
        {
          invoice_id: invoice.id,
          title: invoice.title,
          amount: invoice.amount,
          payer_address: payerAddress,
        }
      );
    } catch (notifErr) {
      console.error("⚠️ Failed to dispatch claim notification:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Payment confirmation recorded. Awaiting blockchain verification.",
    });
  } catch (error: any) {
    console.error("Confirm payment claim error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit payment claim" }, { status: 500 });
  }
}
