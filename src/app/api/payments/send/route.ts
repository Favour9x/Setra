import { NextRequest, NextResponse } from "next/server";
import { executePayment } from "@/lib/payments";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

import { resolveRecipientAddress } from "@/lib/resolve-username";
import { createNotification, getUserHandle } from "@/lib/services/notification";
import { sendTransactionReceiptEmail } from "@/lib/services/email";
import { insertLedgerTransaction } from "@/lib/services/ledger";

export async function POST(request: NextRequest) {
  try {
    const { walletId, toAddress, amount, userId, category } = await request.json();

    if (!walletId || !toAddress || !amount || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let resolvedToAddress;
    try {
      resolvedToAddress = await resolveRecipientAddress(toAddress);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Recipient not found on Setra" },
        { status: 400 }
      );
    }

    // Authenticate the user using cookies
    const supabaseUserClient = await createServerSupabase();

    const {
      data: { user },
    } = await supabaseUserClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // Verify user ID matches request userId
    if (user.id !== userId) {
      return NextResponse.json(
        { error: "Wrong user" },
        { status: 403 }
      );
    }

    // Fetch the user's profile and check wallet ownership
    const { data: profile, error: profileError } = await supabaseUserClient
      .from("profiles")
      .select("wallet_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to verify wallet ownership" },
        { status: 500 }
      );
    }

    if (profile.wallet_id !== walletId) {
      return NextResponse.json(
        { error: "Wrong user" },
        { status: 403 }
      );
    }

    // Execute payment via Circle (fire-and-forget — no polling)
    const result = await executePayment({
      fromWalletId: walletId,
      toAddress: resolvedToAddress,
      amount,
      type: "USDC",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Payment failed" },
        { status: 500 }
      );
    }

    console.log("✅ Circle payment submitted:", { 
      transactionId: result.transactionId, 
      amount,
      recipient: resolvedToAddress
    });

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const recipientUsername = toAddress.startsWith("@") ? toAddress.substring(1) : null;

    // Insert as "processing" — webhook will confirm it
    await insertLedgerTransaction(adminSupabase, {
      userId: user.id,
      amount: parseFloat(amount),
      recipientAddress: resolvedToAddress,
      displayRecipient: toAddress,
      recipientUsername: recipientUsername,
      txHash: null,
      status: "processing",
      type: "sent",
      category: category || "Transfer",
      metadata: {
        transactionId: result.transactionId,
      },
    });

    // Notify and email in background
    try {
      const { data: recipientProfile } = await adminSupabase
        .from("profiles")
        .select("id, username, email")
        .eq("wallet_address", resolvedToAddress)
        .maybeSingle();

      const senderHandle = await getUserHandle(userId);

      let recipientHandle = `@${recipientProfile?.username}`;
      if (!recipientProfile?.username) {
        recipientHandle = `${resolvedToAddress.substring(0, 6)}...${resolvedToAddress.substring(resolvedToAddress.length - 4)}`;
      }

      await createNotification(
        userId,
        "payment_sent",
        "Payment Submitted",
        `Payment of $${amount} sent to ${recipientHandle} — awaiting confirmation`,
        { amount, recipient: resolvedToAddress, transactionId: result.transactionId, link: "/transactions" }
      );

      if (recipientProfile?.id) {
        await createNotification(
          recipientProfile.id,
          "payment_received",
          "Payment Pending",
          `$${amount} incoming from ${senderHandle} — confirming on-chain`,
          { amount, sender: userId, transactionId: result.transactionId, link: "/transactions" }
        );
      }

      if (user.email) {
        await sendTransactionReceiptEmail(user.email, {
          type: "payment_sent",
          amount: parseFloat(amount),
          currency: "USDC",
          recipientOrSender: recipientHandle,
          txHash: undefined,
          category: category || "Transfer"
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error("⚠️ Failed to trigger notifications:", notifErr);
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      txHash: undefined,
      status: "processing",
    });
  } catch (error: any) {
    console.error("Payment error:", error);
    return NextResponse.json(
      { error: error.message || "Payment failed" },
      { status: 500 }
    );
  }
}
