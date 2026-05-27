import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function getProfiles() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Credentials missing in environment variables");
    process.exit(1);
  }

  console.log("🔗 Connecting to Supabase at:", supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, wallet_id, wallet_address, created_at");

  if (error) {
    console.error("❌ Failed to query profiles:", error.message);
    process.exit(1);
  }

  console.log("\n📊 Registered Users & Wallets:");
  console.log("=".repeat(80));
  if (!profiles || profiles.length === 0) {
    console.log("No registered profiles found in the database.");
  } else {
    profiles.forEach((p, idx) => {
      console.log(`${idx + 1}. Email: ${p.email}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Wallet ID: ${p.wallet_id || "None"}`);
      console.log(`   Wallet Address: ${p.wallet_address || "None"}`);
      console.log(`   Created At: ${p.created_at}`);
      console.log("-".repeat(80));
    });
  }
}

getProfiles();
