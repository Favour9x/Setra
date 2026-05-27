# ⚠️ CRITICAL: Database Schema Out of Sync

## Issue Found

The Supabase `transactions` table is missing critical columns:
- ❌ `type` column missing
- ❌ `category` column missing  
- ❌ `currency` column missing
- ❌ `status` column missing
- ❌ `tx_hash` column missing
- ❌ `metadata` column missing
- ❌ `created_at` column missing

## Fix Required

**Run this SQL in your Supabase Dashboard SQL Editor:**

```sql
-- Add all missing columns
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense' CHECK (type IN ('income', 'expense'));

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USDC' NOT NULL;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success' NOT NULL;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS tx_hash TEXT;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO service_role;
```

## Code Status

✅ All code is already implemented correctly:
- Send payment transaction recording with Circle SDK polling
- Tips incoming payment detection  
- No mock notifications
- Fallback to minimal schema if columns missing

## After Running SQL

Once you run the SQL migration, transactions will be recorded with full details including:
- Transaction hash
- Type (income/expense)
- Category
- Status
- Metadata

The code will automatically use the full schema once available.
