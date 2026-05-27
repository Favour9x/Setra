import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Initialize environment variables first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function runTests() {
  console.log("🚀 STARTING INTEGRATION TESTS & VERIFICATION\n");

  // Dynamically import dependencies after dotenv config
  const { resolveRecipientAddress } = await import("../src/lib/resolve-username");
  const { getWalletBalance } = await import("../src/lib/circle/client");
  const { createNotification, getUserHandle } = await import("../src/lib/services/notification");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials in process env.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // TEST 1: Database and profiles retrieval
  console.log("--- TEST 1: Fetching Profiles & Username Status ---");
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, username, wallet_id, wallet_address");

  if (profileErr) {
    console.error("❌ Failed to fetch profiles:", profileErr.message);
    process.exit(1);
  }

  console.log(`✅ Profiles fetched: ${profiles.length}`);
  profiles.forEach((p, index) => {
    console.log(`  [${index + 1}] ID: ${p.id}`);
    console.log(`      Email: ${p.email}`);
    console.log(`      Username: ${p.username || "<NONE>"}`);
    console.log(`      Wallet ID: ${p.wallet_id || "<NONE>"}`);
    console.log(`      Wallet Address: ${p.wallet_address || "<NONE>"}`);
  });
  console.log("");

  // Find or provision a test user with username for Test 2
  const userWithWallet = profiles.find((p) => p.wallet_id && p.wallet_address);
  if (!userWithWallet) {
    console.error("❌ No user with a wallet found. Cannot run further tests.");
    process.exit(1);
  }

  let testUsername = userWithWallet.username;
  if (!testUsername) {
    testUsername = "test_resolve_user";
    console.log(`⚠️ User ${userWithWallet.email} has no username. Setting temporary username to '@${testUsername}'...`);
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ username: testUsername })
      .eq("id", userWithWallet.id);
    if (updateErr) {
      console.error("❌ Failed to set temporary username:", updateErr.message);
    } else {
      console.log("✅ Temporary username set successfully.");
    }
  } else {
    console.log(`ℹ️ Using existing username '@${testUsername}' for user ${userWithWallet.email}`);
  }

  // TEST 2: Username Wallet Resolution
  console.log("\n--- TEST 2: Testing Username & Wallet Address Resolution ---");
  try {
    // Test resolving direct wallet address
    console.log(`🔍 Resolving direct address: ${userWithWallet.wallet_address}`);
    const resolvedDirect = await resolveRecipientAddress(userWithWallet.wallet_address!);
    console.log(`✅ Resolved direct: ${resolvedDirect}`);
    if (resolvedDirect.toLowerCase() !== userWithWallet.wallet_address!.toLowerCase()) {
      throw new Error(`Expected resolved address to match original: ${userWithWallet.wallet_address}`);
    }

    // Test resolving username (with @)
    console.log(`🔍 Resolving username with @ prefix: @${testUsername}`);
    const resolvedUsernameWithAt = await resolveRecipientAddress(`@${testUsername}`);
    console.log(`✅ Resolved @${testUsername}: ${resolvedUsernameWithAt}`);
    if (resolvedUsernameWithAt.toLowerCase() !== userWithWallet.wallet_address!.toLowerCase()) {
      throw new Error("Resolved address does not match test user's wallet address");
    }

    // Test resolving username (without @)
    console.log(`🔍 Resolving username without @ prefix: ${testUsername}`);
    const resolvedUsernameNoAt = await resolveRecipientAddress(testUsername);
    console.log(`✅ Resolved ${testUsername}: ${resolvedUsernameNoAt}`);
    if (resolvedUsernameNoAt.toLowerCase() !== userWithWallet.wallet_address!.toLowerCase()) {
      throw new Error("Resolved address does not match test user's wallet address");
    }

    // Test resolving invalid address/username
    console.log("🔍 Resolving non-existent username: @nonexistent_user_12345");
    try {
      await resolveRecipientAddress("@nonexistent_user_12345");
      console.error("❌ Expected resolveRecipientAddress to fail for non-existent username");
    } catch (e: any) {
      console.log(`✅ Correctly threw error for non-existent username: ${e.message}`);
    }
  } catch (err: any) {
    console.error("❌ Resolution test failed:", err.message);
  }

  // TEST 3: Circle API Connectivity & Balance Fetching
  console.log("\n--- TEST 3: Circle Wallet API Integration ---");
  try {
    console.log(`🔍 Querying balance for wallet ID: ${userWithWallet.wallet_id}`);
    const balances = await getWalletBalance(userWithWallet.wallet_id!);
    console.log("✅ Circle balance query successful!");
    console.log("📄 Balances retrieved:", JSON.stringify(balances, null, 2));
  } catch (err: any) {
    console.error("❌ Circle balance query failed:", err.message);
  }

  // TEST 4: Notification Engine
  console.log("\n--- TEST 4: Notification Creation & Handles ---");
  try {
    console.log(`🔍 Fetching user handle for ID: ${userWithWallet.id}`);
    const handle = await getUserHandle(userWithWallet.id);
    console.log(`✅ Retrieved handle: ${handle}`);

    console.log(`🔍 Creating dummy payment_request notification for ID: ${userWithWallet.id}`);
    const notification = await createNotification(
      userWithWallet.id,
      "payment_request",
      "Test Notification",
      "This is an integration test verification notification.",
      { test: true }
    );
    if (notification) {
      console.log("✅ Notification created successfully:");
      console.log(`  ID: ${notification.id}`);
      console.log(`  Title: ${notification.title}`);
      console.log(`  Message: ${notification.message}`);
      
      // Clean up test notification
      const { error: deleteErr } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notification.id);
      if (deleteErr) {
        console.error("⚠️ Failed to clean up test notification:", deleteErr.message);
      } else {
        console.log("🧹 Test notification cleaned up.");
      }
    } else {
      console.error("❌ Notification creation failed.");
    }
  } catch (err: any) {
    console.error("❌ Notification test failed:", err.message);
  }

  console.log("\n🏁 INTEGRATION TESTING COMPLETE!");
}

runTests();
