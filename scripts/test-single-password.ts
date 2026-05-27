import pg from "pg";

const host = "aws-0-eu-west-1.pooler.supabase.com";
const port = 6543;
const user = "postgres.jdoagvioqvypiyvmgjwn";
const database = "postgres";
const password = process.argv[2] || "setra123";

async function main() {
  console.log(`🔑 Testing password: ${password}...`);
  const client = new pg.Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`✅ Connected successfully!`);
    
    const sql = `
      ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type TEXT;
      ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category TEXT;
      ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tx_hash TEXT;
      ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata JSONB;
      ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recipient_address TEXT;
      ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS blockchain TEXT;
      
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;
      
      ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
      ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'sent', 'received'));
    `;
    await client.query(sql);
    console.log("🚀 SQL migration executed successfully!");
    await client.end();
  } catch (err: any) {
    console.log(`❌ Failed: ${err.message}`);
  }
}

main();
