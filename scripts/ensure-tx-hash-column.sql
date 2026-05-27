-- Ensure tx_hash column exists in transactions table
-- This column may be missing if the table was created before it was added to the schema

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
        RAISE NOTICE 'Added tx_hash column to transactions table';
    ELSE
        RAISE NOTICE 'tx_hash column already exists in transactions table';
    END IF;
END $$;

-- Create index for faster tx_hash lookups
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON public.transactions(tx_hash);
