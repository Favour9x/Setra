import pg from "pg";

const host = "2a05:d018:5b7:f202:9ca:678b:7217:2db8";
const port = 5432;
const user = "postgres"; // Direct connection username is just postgres
const database = "postgres";
const password = process.argv[2] || "setra123";

async function main() {
  console.log(`🔑 Testing password ${password} on direct IPv6 host ${host}...`);
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
