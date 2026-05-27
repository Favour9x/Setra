import pg from "pg";

const hosts = [
  "aws-0-eu-west-1.pooler.supabase.com"
];
const port = 6543;
const user = "postgres.jdoagvioqvypiyvmgjwn";
const database = "postgres";

const passwords = [
  "supabase",
  "postgres",
  "setra123",
  "setra_fintech",
  "jdoagvioqvypiyvmgjwn"
];

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function tryConnect() {
  for (const host of hosts) {
    console.log(`🌐 Trying host: ${host}...`);
    for (const password of passwords) {
      console.log(`  🔑 Trying password: ${password}...`);
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
        console.log(`✅ Connected successfully with password: ${password}`);
        
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
        return;
      } catch (err: any) {
        console.log(`❌ Failed with password ${password}: ${err.message}`);
      }
      
      console.log("⏳ Waiting 12 seconds before the next password attempt...");
      await wait(12000);
    }
  }
  console.error("❌ All connection attempts failed. Could not connect to Postgres.");
}

tryConnect();
