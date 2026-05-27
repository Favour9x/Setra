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

    // Execute payment via Circle
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

    console.log("✅ Circle payment COMPLETE:", { 
      transactionId: result.transactionId, 
      txHash: result.txHash,
      amount,
      recipient: resolvedToAddress
    });

    // IMMEDIATELY save transaction to Supabase using service role key
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log("📝 Checking for duplicate transaction...");
    
    // Check if transaction with this tx_hash already exists
    const txHashToCheck = result.txHash || result.transactionId;
    if (txHashToCheck) {
      const { data: existing } = await adminSupabase
        .from("transactions")
        .select("id")
        .eq("tx_hash", txHashToCheck)
        .maybeSingle();
      
      if (existing) {
        console.log("⚠️ Transaction already recorded, skipping duplicate insert");
        return NextResponse.json({
          success: true,
          transactionId: result.transactionId,
          txHash: result.txHash,
        });
      }
    }

    console.log("📝 Inserting transaction to Supabase...");
    
    // Resolve username if toAddress is a username (starts with @)
    let recipientUsername: string | null = null;
    if (toAddress.startsWith("@")) {
      recipientUsername = toAddress.substring(1);
    }

    // Insert transaction ONCE using ledger service
    await insertLedgerTransaction(adminSupabase, {
      userId: user.id,
      amount: parseFloat(amount),
      recipientAddress: resolvedToAddress,
      displayRecipient: toAddress,
      recipientUsername: recipientUsername,
      txHash: result.txHash || result.transactionId || null,
      status: "confirmed",
      type: "sent",
      category: category || "Transfer",
      metadata: {
        transactionId: result.transactionId,
      },
    });

    /*
    let insertError = null;

    // First attempt: try inserting with all fields requested by user (including recipient_address and blockchain columns)
    const firstInsert = await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      amount: parseFloat(amount),
      recipient_address: resolvedToAddress,
      recipient: toAddress,
      tx_hash: result.txHash,
      type: "sent",
      category: category || "Transfer",
      status: "confirmed",
      created_at: new Date().toISOString(),
      blockchain: "ARC-TESTNET",
      metadata: {
        transactionId: result.transactionId,
        blockchain: "ARC-TESTNET",
      },
    });

    if (firstInsert.error) {
      console.warn("⚠️ First insert failed (likely due to schema columns), trying with default schema fields:", firstInsert.error.message);

      // Second attempt: Fallback to columns defined in standard schema file
      const fallbackInsert = await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        recipient: toAddress,
        amount: parseFloat(amount),
        type: "expense",
        category: category || "Transfer",
        currency: "USDC",
        status: "success",
        tx_hash: result.txHash,
        metadata: {
          transactionId: result.transactionId,
          blockchain: "ARC-TESTNET",
        },
        created_at: new Date().toISOString(),
      });

      if (fallbackInsert.error) {
        console.error("❌ Fallback insert failed too:", fallbackInsert.error.message);
        insertError = fallbackInsert.error;
      }
    }
    */

    // Trigger system notifications and emails in the background
    try {
      // 1. Get recipient profile if they exist in Setra
      const { data: recipientProfile } = await adminSupabase
        .from("profiles")
        .select("id, username, email")
        .eq("wallet_address", resolvedToAddress)
        .maybeSingle();

      // Get sender handle
      const senderHandle = await getUserHandle(userId);

      // Format recipient handle
      let recipientHandle = `@${recipientProfile?.username}`;
      if (!recipientProfile?.username) {
        recipientHandle = `${resolvedToAddress.substring(0, 6)}...${resolvedToAddress.substring(resolvedToAddress.length - 4)}`;
      }

      // Notify sender: "Payment of $X sent to @recipient"
      await createNotification(
        userId,
        "payment_sent",
        "Payment Sent Successfully",
        `Payment of $${amount} sent to ${recipientHandle}`,
        { amount, recipient: resolvedToAddress, tx_hash: result.txHash, link: "/transactions" }
      );

      // Notify recipient: "You received $X from @sender"
      if (recipientProfile?.id) {
        await createNotification(
          recipientProfile.id,
          "payment_received",
          "Payment Received",
          `You received $${amount} from ${senderHandle}`,
          { amount, sender: userId, tx_hash: result.txHash, link: "/transactions" }
        );

        await insertLedgerTransaction(adminSupabase, {
          userId: recipientProfile.id,
          amount: parseFloat(amount),
          recipientAddress: resolvedToAddress,
          displayRecipient: senderHandle || "Sender",
          recipientUsername: null, // Recipient sees sender, not their own username
          txHash: result.txHash || result.transactionId || null,
          status: "confirmed",
          type: "received",
          category: category || "Transfer",
          metadata: {
            transactionId: result.transactionId,
            senderUserId: userId,
          },
        });

        /*
        // Insert income transaction log for recipient
        try {
          await supabaseAdmin.from("transactions").insert({
            user_id: recipientProfile.id,
            amount: parseFloat(amount),
            recipient_address: resolvedToAddress,
            recipient: senderHandle || "Sender",
            tx_hash: result.txHash,
            type: "income",
            category: category || "Transfer",
            status: "success",
            created_at: new Date().toISOString(),
            blockchain: "ARC-TESTNET",
            metadata: {
              transactionId: result.transactionId,
              blockchain: "ARC-TESTNET",
              senderUserId: userId,
            },
          });
        } catch (incomeErr: any) {
          console.warn("⚠️ Failed to write income log for recipient (first insert):", incomeErr.message);
          try {
            await supabaseAdmin.from("transactions").insert({
              user_id: recipientProfile.id,
              recipient: senderHandle || "Sender",
              amount: parseFloat(amount),
              type: "income",
              category: category || "Transfer",
              currency: "USDC",
              status: "success",
              tx_hash: result.txHash,
              metadata: {
                transactionId: result.transactionId,
                blockchain: "ARC-TESTNET",
                senderUserId: userId,
              },
              created_at: new Date().toISOString(),
            });
          } catch (fallbackIncomeErr: any) {
            console.error("❌ Fallback income insert failed too:", fallbackIncomeErr.message);
          }
        }
        */
      }

      // Send transaction receipt email to sender (user.email)
      if (user.email) {
        try {
          await sendTransactionReceiptEmail(user.email, {
            type: "payment_sent",
            amount: parseFloat(amount),
            currency: "USDC",
            recipientOrSender: recipientHandle,
            txHash: result.txHash,
            category: category || "Transfer"
          });
        } catch (emailErr) {
          console.error("⚠️ Failed to send payment receipt email to sender:", emailErr);
        }
      }

      // Send transaction receipt email to recipient if they have an email registered
      if (recipientProfile?.email) {
        try {
          await sendTransactionReceiptEmail(recipientProfile.email, {
            type: "payment_received",
            amount: parseFloat(amount),
            currency: "USDC",
            recipientOrSender: senderHandle,
            txHash: result.txHash,
            category: category || "Transfer"
          });
        } catch (emailErr) {
          console.error("⚠️ Failed to send payment receipt email to recipient:", emailErr);
        }
      }
    } catch (notifErr) {
      console.error("⚠️ Failed to trigger payment notifications and emails:", notifErr);
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      txHash: result.txHash,
    });
  } catch (error: any) {
    console.error("Payment error:", error);
    return NextResponse.json(
      { error: error.message || "Payment failed" },
      { status: 500 }
    );
  }
}
