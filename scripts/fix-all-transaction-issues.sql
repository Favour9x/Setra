-- FIX ALL TRANSACTION ISSUES IN SUPABASE

-- 1. Add missing category column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'category'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN category TEXT DEFAULT 'General';
    END IF;
END $$;

-- 2. Ensure tx_hash column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'tx_hash'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN tx_hash TEXT;
    END IF;
END $$;

-- 3. Grant service_role permissions to bypass RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balances TO service_role;

-- 4. Create index for tx_hash lookups
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON public.transactions(tx_hash);

-- 5. Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- 6. Create index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- 7. Ensure balances table has unique constraint on user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'balances_user_id_key'
    ) THEN
        ALTER TABLE public.balances ADD CONSTRAINT balances_user_id_key UNIQUE (user_id);
    END IF;
END $$;
