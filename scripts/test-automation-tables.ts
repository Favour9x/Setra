import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Checking if we can fetch from automation_workflows...");
  const { data, error } = await supabase.from("automation_workflows").select("*").limit(1);
  if (error) {
    console.error("Error from automation_workflows:", error.message);
  } else {
    console.log("automation_workflows exists! Data:", data);
  }
}

main();
