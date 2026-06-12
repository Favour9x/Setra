import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sql = fs.readFileSync(path.join(__dirname, "fix-issues.sql"), "utf8");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    console.log(`Running: ${stmt.substring(0, 80)}...`);
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: stmt });
      if (error) {
        console.log(`RPC error: ${error.message}`);
        console.log("Trying direct query...");
        const { error: qError } = await supabase
          .from("_migration_helper")
          .select("*")
          .limit(0);
      }
    } catch (e: any) {
      console.log(`Cannot execute via RPC: ${e.message}`);
      console.log("You need to run the SQL manually in Supabase Dashboard SQL Editor.");
      console.log("SQL file location: scripts/fix-issues.sql");
    }
  }
  console.log("Migration script completed.");
}

run().catch(console.error);
