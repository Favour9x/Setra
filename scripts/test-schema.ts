import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase URL or Service Role Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log("🔍 Fetching OpenAPI spec for all tables...");
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        "apikey": supabaseServiceKey || "",
        "Authorization": `Bearer ${supabaseServiceKey || ""}`
      }
    });
    const spec: any = await response.json();
    console.log("--- Definitions ---");
    for (const tableName of Object.keys(spec.definitions || {})) {
      const props = Object.keys(spec.definitions[tableName].properties || {});
      console.log(`📊 Table [${tableName}]:`, props);
    }
    console.log("--- RPC Paths ---");
    const rpcs = Object.keys(spec.paths || {}).filter(p => p.startsWith("/rpc/"));
    console.log("Found RPC endpoints:", rpcs);
  } catch (err: any) {
    console.error("❌ Failed:", err.message);
  }
}

test();

