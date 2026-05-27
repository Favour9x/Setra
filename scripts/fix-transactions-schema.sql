-- ========================================================
-- FIX TRANSACTIONS TABLE SCHEMA - COMPLETE MIGRATION
-- ========================================================
-- This script adds ALL missing columns to the transactions table
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/editor
-- ========================================================

-- Add all missing columns if they don't exist
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

-- Ensure created_at exists with proper default
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Verify all columns were added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
ORDER BY ordinal_position;

-- Grant permissions to service_role (bypass RLS for system operations)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO service_role;

-- Ensure RLS is enabled
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies if they don't exist
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions" 
ON public.transactions FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
CREATE POLICY "Users can insert their own transactions" 
ON public.transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Transactions table schema updated successfully!';
END $$;
