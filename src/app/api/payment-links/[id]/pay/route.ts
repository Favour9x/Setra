import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { executePaymentLinkPayment, fetchPaymentLinkById } from "@/lib/services/payment-link";
import { createClient } from "@supabase/supabase-js";
import { creditUserBalance, insertLedgerTransaction } from "@/lib/services/ledger";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: linkId } = await params;
    const body = await request.json();
    const { amount, isManualAttempt, payerName } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    // 1. Check if it's an anonymous / manual payment attempt
    if (isManualAttempt) {
      const link = await fetchPaymentLinkById(linkId);
      if (!link) {
        return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
      }

      if (!link.active) {
        return NextResponse.json({ error: "This payment link is no longer active" }, { status: 400 });
      }

      const adminClient = getAdminClient();

      await insertLedgerTransaction(adminClient, {
        userId: link.user_id,
        recipientAddress: link.recipient_address,
        amount: Number(amount),
        type: "received",
        category: "Checkout",
        status: "pending",
        displayRecipient: payerName || "Manual payer",
        metadata: {
          paymentLinkId: linkId,
          paymentLinkTitle: link.title,
          payer_name: payerName || "Anonymous",
          isManualAttempt: true
        }
      });
      await creditUserBalance(adminClient, link.user_id, Number(amount));

      return NextResponse.json({ success: true });

      /*
      const { data: tx, error: txError } = await adminClient.from("transactions").insert({
        user_id: link.user_id, // Map it to the merchant's / owner's dashboard
        recipient: link.recipient_address,
        amount: Number(amount),
        type: "income",
        currency: "USDC",
        status: "success",
        metadata: {
          paymentLinkId: linkId,
          paymentLinkTitle: link.title,
          payer_name: payerName || "Anonymous",
          isManualAttempt: true,
          blockchain: "ARC-TESTNET"
        }
      }).select().single();

      if (txError) {
        console.error("❌ Error inserting manual payment attempt transaction:", txError.message);
        return NextResponse.json({ error: "Failed to log payment attempt: " + txError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, tx });
      */
    }

    // 2. Otherwise, standard logged-in Circle blockchain payment
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Get the payer's wallet details
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.wallet_id) {
      return NextResponse.json({ error: "Paying wallet not found. Please activate your wallet first." }, { status: 400 });
    }

    const payResult = await executePaymentLinkPayment(
      linkId,
      Number(amount),
      profile.wallet_id,
      user.id
    );

    if (!payResult.success) {
      return NextResponse.json({ error: payResult.error || "Payment failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, txHash: payResult.txHash });
  } catch (error: any) {
    console.error("Payment link pay API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process payment" }, { status: 500 });
  }
}
