import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

// Polling flag to prevent overlapping executions
let isPolling = false;

export async function POST(request: NextRequest) {
  // Prevent overlapping polls
  if (isPolling) {
    console.log("⏭️ Poll already in progress, skipping...");
    return NextResponse.json({ success: true, processed: 0, skipped: true });
  }

  isPolling = true;

  try {
    console.log("🔄 Starting Tips incoming payment poll...");

    // Initialize Circle SDK client
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
      return NextResponse.json(
        { error: "Circle API credentials not configured" },
        { status: 500 }
      );
    }

    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    // Initialize Supabase admin client
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all active payment links (Tips)
    const { data: paymentLinks, error: linksError } = await adminSupabase
      .from("payment_links")
      .select("id, user_id, recipient_address, title, amount")
      .eq("active", true);

    if (linksError) {
      console.error("❌ Failed to fetch payment links:", linksError);
      return NextResponse.json(
        { error: "Failed to fetch payment links" },
        { status: 500 }
      );
    }

    if (!paymentLinks || paymentLinks.length === 0) {
      console.log("ℹ️ No active payment links found");
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`📋 Found ${paymentLinks.length} active payment links`);

    // Get unique wallet IDs for all Tips link owners
    const userIds = [...new Set(paymentLinks.map(link => link.user_id))];
    
    const { data: profiles, error: profilesError } = await adminSupabase
      .from("profiles")
      .select("id, wallet_id, wallet_address")
      .in("id", userIds);

    if (profilesError || !profiles) {
      console.error("❌ Failed to fetch profiles:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch user profiles" },
        { status: 500 }
      );
    }

    // Create a map of user_id to wallet_id
    const userWalletMap = new Map(
      profiles.map(p => [p.id, { walletId: p.wallet_id, walletAddress: p.wallet_address }])
    );

    let processedCount = 0;

    // Poll Circle for inbound transactions for each wallet
    for (const profile of profiles) {
      if (!profile.wallet_id) continue;

      try {
        console.log(`🔍 Checking wallet ${profile.wallet_id} for inbound transactions...`);

        // List inbound transactions per Circle docs
        const txListResponse = await client.listTransactions({
          walletIds: [profile.wallet_id],
          txType: "INBOUND" as any,
        });

        const transactions = txListResponse.data?.transactions || [];
        console.log(`📥 Found ${transactions.length} inbound transactions for wallet ${profile.wallet_id}`);

        for (const tx of transactions) {
          // Only process COMPLETE transactions
          if (tx.state !== "COMPLETE") {
            console.log(`⏭️ Skipping transaction ${tx.id} - state: ${tx.state}`);
            continue;
          }

          const txHash = tx.txHash;
          if (!txHash) {
            console.log(`⏭️ Skipping transaction ${tx.id} - no txHash`);
            continue;
          }

          // CRITICAL: Check if transaction already exists to prevent duplicates
          const { data: existingTx, error: checkError } = await adminSupabase
            .from("transactions")
            .select("id")
            .eq("tx_hash", txHash)
            .limit(1)
            .maybeSingle();

          if (checkError || existingTx) {
            if (checkError) {
              console.log(`⏭️ Transaction ${txHash} already exists (multiple entries) - skipping duplicate`);
            } else {
              console.log(`⏭️ Transaction ${txHash} already recorded - skipping duplicate`);
            }
            continue;
          }

          // Extract amount from Circle response - ONLY use real amounts
          const amount = parseFloat(tx.amounts?.[0] || "0");
          if (amount <= 0) {
            console.log(`⏭️ Skipping transaction ${txHash} - invalid amount`);
            continue;
          }

          console.log(`💰 New inbound transaction detected:`, {
            txHash,
            amount,
            destinationAddress: tx.destinationAddress,
            sourceAddress: tx.sourceAddress,
            userId: profile.id
          });

          // Insert transaction into database
          // Build minimal transaction data that works with any schema
          const minimalData = {
            user_id: profile.id,
            recipient: tx.destinationAddress || profile.wallet_address,
            amount: amount,
          };

          // Try to add optional columns if they exist
          const fullData: any = {
            ...minimalData,
            type: "income",
            currency: "USDC",
            status: "success",
            tx_hash: txHash,
            created_at: tx.createDate || new Date().toISOString(),
          };

          // Add category if schema supports it
          fullData.category = "Tips";

          // Add metadata with all transaction details
          fullData.metadata = {
            blockchain: "ARC-TESTNET",
            transactionId: tx.id,
            sourceAddress: tx.sourceAddress,
            transactionType: "INBOUND",
            createDate: tx.createDate,
            category: "Tips",
            type: "income",
            currency: "USDC",
            status: "success",
          };

          console.log("📝 Inserting transaction:", JSON.stringify(fullData, null, 2));

          // Try full insert first
          let { data: insertedTx, error: txInsertError } = await adminSupabase
            .from("transactions")
            .insert(fullData)
            .select();

          // If any column is missing, try with minimal data
          if (txInsertError && txInsertError.code === "PGRST204") {
            console.log("⚠️ Some columns not found, retrying with minimal schema...");
            
            const retry = await adminSupabase
              .from("transactions")
              .insert(minimalData)
              .select();
            
            insertedTx = retry.data;
            txInsertError = retry.error;
          }

          if (txInsertError) {
            console.error("❌ Failed to insert transaction:", {
              error: txInsertError,
              message: txInsertError.message,
              details: txInsertError.details,
              hint: txInsertError.hint,
              code: txInsertError.code
            });
            console.error("\n⚠️ DATABASE SCHEMA IS OUT OF SYNC!");
            console.error("   Run this SQL in Supabase Dashboard:");
            console.error("   scripts/fix-transactions-schema.sql");
            continue;
          }

          console.log("✅ Transaction inserted:", insertedTx);

          // Check if notification already exists for this tx_hash
          const { data: existingNotif } = await adminSupabase
            .from("notifications")
            .select("id")
            .eq("user_id", profile.id)
            .eq("metadata->>tx_hash", txHash)
            .limit(1)
            .maybeSingle();

          if (!existingNotif) {
            const notificationData = {
              user_id: profile.id,
              type: "payment_received",
              title: "Payment Received",
              message: `You received ${amount} USDC via Tips`,
              read: false,
              metadata: {
                amount,
                tx_hash: txHash,
                link: "/transactions"
              },
              created_at: new Date().toISOString()
            };

            console.log("🔔 Creating notification:", notificationData);

            const { error: notifError } = await adminSupabase
              .from("notifications")
              .insert(notificationData);

            if (notifError) {
              console.error("❌ Failed to create notification:", notifError);
            } else {
              console.log("✅ Notification created");
            }
          } else {
            console.log(`⏭️ Notification for tx ${txHash} already exists, skipping`);
          }

          processedCount++;
        }
      } catch (walletError: any) {
        console.error(`❌ Error processing wallet ${profile.wallet_id}:`, walletError.message);
        continue;
      }
    }

    console.log(`✅ Tips poll complete. Processed ${processedCount} new transactions`);

    return NextResponse.json({
      success: true,
      processed: processedCount
    });
  } catch (error: any) {
    console.error("❌ Tips polling error:", error);
    return NextResponse.json(
      { error: error.message || "Tips polling failed" },
      { status: 500 }
    );
  } finally {
    isPolling = false;
  }
}
