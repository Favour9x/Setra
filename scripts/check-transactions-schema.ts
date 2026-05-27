/**
 * Check actual transactions table schema
 * Run with: npx tsx scripts/check-transactions-schema.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function checkSchema() {
  console.log("🔍 Checking Transactions Table Schema\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials");
    return;
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

  // Query information_schema to get actual columns
  const { data, error } = await adminSupabase
    .from("transactions")
    .select("*")
    .limit(1);

  if (error) {
    console.error("❌ Error querying transactions:", error.message);
    
    // Try to get schema info directly
    console.log("\n📋 Attempting to fetch schema information...");
    const schemaQuery = `
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transactions'
      ORDER BY ordinal_position;
    `;
    
    console.log("Run this query in Supabase SQL Editor:");
    console.log(schemaQuery);
    return;
  }

  console.log("✅ Successfully queried transactions table");
  console.log("\n📋 Available Columns:");
  
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    columns.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col}`);
    });
  } else {
    console.log("   No data in table, trying to infer from empty result...");
    
    // Try a simple insert to see what columns are expected
    const testData = {
      user_id: "00000000-0000-0000-0000-000000000000",
      recipient: "test",
      amount: 1,
      type: "expense",
      currency: "USDC",
      status: "success",
    };

    const { error: insertError } = await adminSupabase
      .from("transactions")
      .insert(testData);

    if (insertError) {
      console.log("\n❌ Test insert error:", insertError.message);
      console.log("   This helps identify missing required columns");
    }
  }

  console.log("\n📝 Expected columns from schema file:");
  console.log("   1. id");
  console.log("   2. user_id");
  console.log("   3. recipient");
  console.log("   4. amount");
  console.log("   5. type");
  console.log("   6. category");
  console.log("   7. currency");
  console.log("   8. status");
  console.log("   9. tx_hash");
  console.log("   10. metadata");
  console.log("   11. created_at");

  console.log("\n💡 If columns are missing, run the migration SQL:");
  console.log("   scripts/fix-transactions-schema.sql");
}

checkSchema().catch(console.error);
