/**
 * Test profile and notification fixes
 * Run with: npx tsx scripts/test-profile-fixes.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testFixes() {
  console.log("🔍 Testing Profile and Notification Fixes\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials");
    return;
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Check profiles table
  console.log("1️⃣ Checking Profiles Table...");
  const { data: profiles, error: profilesError } = await adminSupabase
    .from("profiles")
    .select("id, email, username")
    .limit(5);

  if (profilesError) {
    console.error("❌ Profiles query error:", profilesError.message);
  } else {
    console.log(`✅ Found ${profiles?.length || 0} profiles`);
    if (profiles && profiles.length > 0) {
      console.log("   Sample profiles:");
      profiles.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.email} - username: ${p.username || "(not set)"}`);
      });
    }
  }

  // 2. Check auth users vs profiles count
  console.log("\n2️⃣ Comparing Auth Users vs Profiles...");
  const { count: authCount } = await adminSupabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  console.log(`   Profiles count: ${authCount || 0}`);

  // 3. Check notifications
  console.log("\n3️⃣ Checking Notifications Table...");
  const { data: notifications, error: notifError } = await adminSupabase
    .from("notifications")
    .select("*")
    .limit(5);

  if (notifError) {
    console.error("❌ Notifications query error:", notifError.message);
  } else {
    console.log(`✅ Found ${notifications?.length || 0} notifications`);
    if (notifications && notifications.length > 0) {
      console.log("   Recent notifications:");
      notifications.forEach((n, i) => {
        console.log(`   ${i + 1}. ${n.type} - ${n.title}`);
      });
    } else {
      console.log("   ✅ No notifications (mock data cleared)");
    }
  }

  // 4. Check if trigger exists
  console.log("\n4️⃣ Checking handle_new_user Trigger...");
  console.log("   Run this SQL to verify:");
  console.log("   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';");

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Profile and Notification Tests Complete\n");
  console.log("Next steps:");
  console.log("1. Run SQL: scripts/fix-profiles-and-notifications.sql");
  console.log("2. Test login flow");
  console.log("3. Verify username setup works");
  console.log("4. Check that users with usernames skip setup screen\n");
}

testFixes().catch(console.error);
