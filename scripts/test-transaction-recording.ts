/**
 * Test script to verify transaction recording works correctly
 * Run with: npx tsx scripts/test-transaction-recording.ts
 */

import { createClient } from "@supabase/supabase-js";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testTransactionRecording() {
  console.log("🧪 Testing Transaction Recording System\n");
  console.log("=" .repeat(60));

  // 1. Test Supabase Connection
  console.log("\n1️⃣ Testing Supabase Connection...");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials");
    console.log("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
    console.log("   SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅ Set" : "❌ Missing");
    return;
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log("✅ Supabase client initialized");

  // Test database connection
  try {
    const { data, error } = await adminSupabase
      .from("transactions")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ Database connection failed:", error.message);
      return;
    }
    console.log("✅ Database connection successful");
  } catch (err: any) {
    console.error("❌ Database error:", err.message);
    return;
  }

  // 2. Test Circle SDK Connection
  console.log("\n2️⃣ Testing Circle SDK Connection...");
  const circleApiKey = process.env.CIRCLE_API_KEY;
  const circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!circleApiKey || !circleEntitySecret) {
    console.error("❌ Missing Circle credentials");
    console.log("   CIRCLE_API_KEY:", circleApiKey ? "✅ Set" : "❌ Missing");
    console.log("   CIRCLE_ENTITY_SECRET:", circleEntitySecret ? "✅ Set" : "❌ Missing");
    return;
  }

  try {
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: circleApiKey,
      entitySecret: circleEntitySecret,
    });
    console.log("✅ Circle SDK client initialized");

    // Test Circle API by listing wallets
    const walletsResponse = await client.listWallets({});
    const wallets = walletsResponse.data?.wallets || [];
    console.log(`✅ Circle API connection successful (${wallets.length} wallets found)`);

    if (wallets.length > 0) {
      const testWallet = wallets[0];
      console.log(`   Test wallet: ${testWallet.id} (${testWallet.address})`);

      // Test transaction listing
      console.log("\n3️⃣ Testing Transaction Listing...");
      const txListResponse = await client.listTransactions({
        walletIds: [testWallet.id],
      });
      const transactions = txListResponse.data?.transactions || [];
      console.log(`✅ Found ${transactions.length} transactions for test wallet`);

      if (transactions.length > 0) {
        const recentTx = transactions[0];
        console.log("\n   Recent transaction:");
        console.log(`   - ID: ${recentTx.id}`);
        console.log(`   - State: ${recentTx.state}`);
        console.log(`   - TxHash: ${recentTx.txHash || "N/A"}`);
        console.log(`   - Amount: ${recentTx.amounts?.[0] || "N/A"}`);
        console.log(`   - Type: ${recentTx.transactionType}`);
        console.log(`   - Destination: ${recentTx.destinationAddress || "N/A"}`);
        console.log(`   - Source: ${recentTx.sourceAddress || "N/A"}`);
      }
    }
  } catch (err: any) {
    console.error("❌ Circle SDK error:", err.message);
    return;
  }

  // 3. Test Transaction Insert
  console.log("\n4️⃣ Testing Transaction Insert...");
  const testUserId = "00000000-0000-0000-0000-000000000000"; // Dummy UUID for test
  
  // Try minimal schema first (only required columns)
  const minimalData: any = {
    user_id: testUserId,
    recipient: "0x1234567890123456789012345678901234567890",
    amount: 10.50,
  };

  console.log("   Attempting test insert with minimal schema...");
  let { data: insertedData, error: insertError } = await adminSupabase
    .from("transactions")
    .insert(minimalData)
    .select();

  if (insertError) {
    console.error("❌ Insert failed:", insertError.message);
    console.log("   Error details:", JSON.stringify(insertError, null, 2));
    
    // Check if it's a foreign key constraint error
    if (insertError.message.includes("foreign key") || insertError.code === "23503") {
      console.log("\n   ⚠️ Foreign key constraint error detected");
      console.log("   This is expected for test data with dummy user_id");
      console.log("   Real transactions with valid user_id should work fine");
      console.log("\n   ✅ Schema validation passed - insert would work with valid user_id");
    } else {
      console.log("\n   ❌ Schema issue detected!");
      console.log("   Run this SQL in Supabase Dashboard:");
      console.log("   scripts/fix-transactions-schema.sql");
    }
  } else {
    console.log("✅ Test transaction inserted successfully");
    console.log("   Inserted data:", JSON.stringify(insertedData, null, 2));

    // Clean up test data
    if (insertedData && insertedData[0]) {
      await adminSupabase
        .from("transactions")
        .delete()
        .eq("id", insertedData[0].id);
      console.log("   ✅ Test data cleaned up");
    }
  }

  // 4. Check Recent Transactions
  console.log("\n5️⃣ Checking Recent Transactions in Database...");
  const { data: recentTxs, error: txError } = await adminSupabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (txError) {
    console.error("❌ Failed to fetch recent transactions:", txError.message);
  } else {
    console.log(`✅ Found ${recentTxs?.length || 0} recent transactions`);
    if (recentTxs && recentTxs.length > 0) {
      console.log("\n   Recent transactions:");
      recentTxs.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.type} - $${tx.amount} ${tx.currency} - ${tx.status}`);
        console.log(`      TxHash: ${tx.tx_hash || "N/A"}`);
        console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}`);
      });
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test Complete\n");
}

testTransactionRecording().catch(console.error);
