import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { fetchInvoiceById } from "@/lib/services/invoice";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoice = await fetchInvoiceById(invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Auto-expire if overdue
    if ((invoice.status === "pending" || invoice.status === "awaiting_confirmation") && new Date(invoice.due_date) < new Date()) {
      invoice.status = "expired";
      await supabase
        .from("invoices")
        .update({ status: "expired" })
        .eq("id", invoice.id);
    }

    // Verify ownership: allow creator or recipient
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", session.user.id)
      .maybeSingle();

    const isCreator = invoice.user_id === session.user.id;
    const isRecipient = profile?.wallet_address && profile.wallet_address.toLowerCase() === invoice.recipient_address.toLowerCase();

    if (!isCreator && !isRecipient) {
      return NextResponse.json({ error: "Unauthorized access to invoice" }, { status: 403 });
    }

    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", invoice.user_id)
      .maybeSingle();
      
    const invoiceWithSender = {
      ...invoice,
      sender_username: creatorProfile?.username || "creator",
      type: isRecipient ? "received" : (isCreator ? "sent" : invoice.type)
    };

    return NextResponse.json({ success: true, invoice: invoiceWithSender });
  } catch (error: any) {
    console.error("Fetch invoice by ID error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch invoice" }, { status: 500 });
  }
}
