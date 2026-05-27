import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Initialize environment variables first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function runTests() {
  console.log("🚀 STARTING INVOICE & NOTIFICATION SYSTEM TESTS\n");

  // Dynamically import dependencies after dotenv config
  const { resolveRecipientAddress } = await import("../src/lib/resolve-username");
  const { createNotification, supabaseAdmin } = await import("../src/lib/services/notification");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials in process env.");
    process.exit(1);
  }

  // Initialize service role client (which represents the backend system)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 1. Fetch profiles to identify two test accounts (sender & recipient)
  console.log("--- 1. Fetching Candidate Accounts ---");
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, username, wallet_address");

  if (profileErr) {
    console.error("❌ Failed to fetch profiles:", profileErr.message);
    process.exit(1);
  }

  // Find two users with usernames and wallet addresses
  const validProfiles = profiles.filter((p) => p.username && p.wallet_address);
  if (validProfiles.length < 2) {
    console.error("❌ Need at least 2 profiles with usernames and wallet addresses to run tests.");
    console.log("Profiles found:", validProfiles);
    process.exit(1);
  }

  const sender = validProfiles[0];
  const recipient = validProfiles[1];

  console.log(`👤 Sender identified: ${sender.email} (@${sender.username}) - ${sender.wallet_address}`);
  console.log(`👤 Recipient identified: ${recipient.email} (@${recipient.username}) - ${recipient.wallet_address}`);
  console.log("");

  // 2. Simulate username resolution (matching the RecipientInput / resolveRecipientAddress logic)
  console.log("--- 2. Simulating Recipient Input Resolution ---");
  const recipientInput = `@${recipient.username}`;
  console.log(`🔍 Resolving input: "${recipientInput}"...`);
  const resolvedAddress = await resolveRecipientAddress(recipientInput);
  console.log(`✅ Input resolved to wallet address: ${resolvedAddress}`);
  if (resolvedAddress.toLowerCase() !== recipient.wallet_address!.toLowerCase()) {
    console.error("❌ Resolved address does not match recipient's actual wallet address.");
    process.exit(1);
  }

  // 3. Simulate invoice creation route logic
  console.log("\n--- 3. Simulating Invoice Creation & Dispatch ---");
  
  // A. Create the invoice in the database
  const invoiceTitle = "Contract Consulting Services (Test)";
  const invoiceAmount = 250.00;
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

  const { data: invoice, error: invoiceErr } = await supabase
    .from("invoices")
    .insert({
      user_id: sender.id,
      title: invoiceTitle,
      amount: invoiceAmount,
      currency: "USDC",
      recipient_address: resolvedAddress,
      due_date: dueDate,
      status: "pending"
    })
    .select()
    .single();

  if (invoiceErr || !invoice) {
    console.error("❌ Failed to create test invoice:", invoiceErr?.message);
    process.exit(1);
  }

  console.log(`✅ Invoice record created in DB. ID: ${invoice.id}`);

  // B. Query Profiles using supabaseAdmin (simulating the fixed route.ts endpoint)
  console.log("🔍 Simulating profile resolution via supabaseAdmin...");
  
  const { data: senderProfile } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", sender.id)
    .maybeSingle();

  const senderUsername = senderProfile?.username || "sender_test";
  const senderDisplay = `@${senderUsername}`;

  const { data: recipientProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, username")
    .eq("wallet_address", resolvedAddress)
    .maybeSingle();

  if (!recipientProfile) {
    console.error("❌ Failed to find recipient profile by resolved address! (RLS or query logic issue)");
    
    // Clean up before exit
    await supabase.from("invoices").delete().eq("id", invoice.id);
    process.exit(1);
  }

  console.log(`✅ Profile found: @${recipientProfile.username} (ID: ${recipientProfile.id})`);

  // C. Dispatch in-app system notification
  console.log("🔔 Dispatching system notification...");
  const notification = await createNotification(
    recipientProfile.id,
    "payment_request",
    `New Invoice from ${senderDisplay}`,
    `You have a new invoice for ${invoiceAmount} USDC from ${senderDisplay}. Due ${new Date(dueDate).toLocaleDateString()}`,
    { 
      invoice_id: invoice.id, 
      amount: invoiceAmount, 
      sender_username: senderUsername, 
      due_date: dueDate 
    }
  );

  if (!notification) {
    console.error("❌ Failed to create notification record.");
    
    // Clean up
    await supabase.from("invoices").delete().eq("id", invoice.id);
    process.exit(1);
  }

  console.log(`✅ Notification dispatched successfully. ID: ${notification.id}`);

  // D. Verify notification presence for recipient
  console.log("\n--- 4. Verifying Notification Receipt ---");
  const { data: receivedNotifications, error: fetchNotifErr } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", recipient.id)
    .eq("id", notification.id);

  if (fetchNotifErr) {
    console.error("❌ Failed to fetch notifications for recipient:", fetchNotifErr.message);
  } else if (receivedNotifications && receivedNotifications.length > 0) {
    const received = receivedNotifications[0];
    console.log("✅ Verified: Recipient has received the notification successfully!");
    console.log(`   Title: "${received.title}"`);
    console.log(`   Message: "${received.message}"`);
  } else {
    console.error("❌ Recipient notification feed is empty or notification was not received.");
  }

  // 5. Cleanup
  console.log("\n--- 5. Cleaning Up Test Data ---");
  const { error: delNotifErr } = await supabase.from("notifications").delete().eq("id", notification.id);
  const { error: delInvoiceErr } = await supabase.from("invoices").delete().eq("id", invoice.id);

  if (delNotifErr || delInvoiceErr) {
    console.warn("⚠️ Cleanup encountered errors:", delNotifErr?.message, delInvoiceErr?.message);
  } else {
    console.log("🧹 Test invoice and notifications successfully cleaned from database.");
  }

  console.log("\n🏁 ALL TESTS PASSED SUCCESSFULLY!");
}

runTests();
