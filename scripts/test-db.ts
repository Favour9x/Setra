import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local in the workspace root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase URL or Service Role Key in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log("🔍 Checking Supabase profiles table...");
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("*").limit(1);
  if (profileError) {
    console.error("❌ profiles table error:", profileError.message, profileError);
  } else {
    console.log("✅ profiles table exists! Row count returned:", profiles?.length);
    console.log("📄 Row content keys:", profiles && profiles.length > 0 ? Object.keys(profiles[0]) : "No rows found");
    console.log("📄 Raw row data:", JSON.stringify(profiles, null, 2));
  }
}

test();
