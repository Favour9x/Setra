import { NextRequest, NextResponse } from "next/server";
import { executePayment } from "@/lib/payments";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

import { resolveRecipientAddress } from "@/lib/resolve-username";
import { createNotification, getUserHandle } from "@/lib/services/notification";
import { sendTransactionReceiptEmail } from "@/lib/services/email";
import { insertLedgerTransaction, insertRecipientReceivedTransaction, creditUserBalance } from "@/lib/services/ledger";

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

    const txHash = result.txHash || null;

    console.log("✅ Circle payment confirmed:", { 
      transactionId: result.transactionId,
      txHash,
      amount,
      recipient: resolvedToAddress
    });

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const recipientUsername = toAddress.startsWith("@") ? toAddress.substring(1) : null;

    await insertLedgerTransaction(adminSupabase, {
      userId: user.id,
      amount: parseFloat(amount),
      recipientAddress: resolvedToAddress,
      displayRecipient: toAddress,
      recipientUsername: recipientUsername,
      txHash,
      status: "confirmed",
      type: "sent",
      category: category || "Transfer",
      metadata: {
        transactionId: result.transactionId,
      },
    });

    // Create received transaction record for the recipient
    await insertRecipientReceivedTransaction(adminSupabase, {
      destinationAddress: resolvedToAddress,
      amount: parseFloat(amount),
      txHash,
      displaySender: toAddress,
      category: category || "Transfer",
      metadata: {
        transactionId: result.transactionId,
      },
    });

    // Notify and email
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

      // Credit recipient's balance in the balances table
      if (recipientProfile?.id) {
        await creditUserBalance(adminSupabase, recipientProfile.id, parseFloat(amount));
        console.log(`✅ Recipient ${recipientProfile.id} balance credited with ${amount} USDC`);

        await createNotification(
          recipientProfile.id,
          "payment_received",
          "Payment Received",
          `$${amount} USDC received from ${senderHandle}`,
          { amount, sender: userId, tx_hash: txHash, link: "/transactions" }
        );
      }

      await createNotification(
        userId,
        "payment_sent",
        "Payment Confirmed",
        `Payment of $${amount} USDC sent to ${recipientHandle}`,
        { amount, recipient: resolvedToAddress, tx_hash: txHash, link: "/transactions" }
      );

      if (user.email) {
        await sendTransactionReceiptEmail(user.email, {
          type: "payment_sent",
          amount: parseFloat(amount),
          currency: "USDC",
          recipientOrSender: recipientHandle,
          txHash: txHash || undefined,
          category: category || "Transfer"
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error("⚠️ Failed to trigger notifications:", notifErr);
    }

    // Fetch sender's new balance for the response
    let newCircleBalance = 0;
    try {
      const { getBalance } = await import("@/lib/payments");
      const balances = await getBalance(walletId);
      const usdcBal = balances.find((b: any) => b.symbol?.toUpperCase() === "USDC");
      if (usdcBal) newCircleBalance = parseFloat(usdcBal.amount);
    } catch (balErr) {
      console.error("⚠️ Failed to fetch new balance for response:", balErr);
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      txHash,
      status: "confirmed",
      newBalance: newCircleBalance,
    });
  } catch (error: any) {
    console.error("Payment error:", error);
    return NextResponse.json(
      { error: error.message || "Payment failed" },
      { status: 500 }
    );
  }
}
