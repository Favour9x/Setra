import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Testing rpc('exec_sql')...");
  const { data, error } = await supabase.rpc("exec_sql", { sql: "SELECT 1;" });
  if (error) {
    console.error("rpc('exec_sql') failed:", error.message);
  } else {
    console.log("rpc('exec_sql') success! Data:", data);
  }
}

main();
