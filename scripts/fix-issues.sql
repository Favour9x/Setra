-- ISSUE 3: Add missing invoice columns for sent/received logic
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS sender_address text;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- ISSUE 4: Clean up duplicate transactions - keep only first occurrence per tx_hash
DELETE FROM public.transactions
WHERE id NOT IN (
  SELECT MIN(id) FROM public.transactions
  WHERE tx_hash IS NOT NULL AND tx_hash != ''
  GROUP BY tx_hash
)
AND tx_hash IS NOT NULL AND tx_hash != '';

-- Add unique constraint on tx_hash to prevent future duplicates
-- First remove any existing constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS unique_tx_hash;
-- Then add the constraint (only for non-null, non-empty tx_hash)
-- Using a partial unique index is more flexible
DROP INDEX IF EXISTS idx_transactions_unique_tx_hash;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_tx_hash
  ON public.transactions (tx_hash)
  WHERE tx_hash IS NOT NULL AND tx_hash != '';

-- ISSUE 1: Clean up duplicate tips notifications
DELETE FROM public.notifications
WHERE id NOT IN (
  SELECT MIN(id) FROM public.notifications
  WHERE metadata->>'tx_hash' IS NOT NULL AND metadata->>'tx_hash' != ''
  GROUP BY metadata->>'tx_hash'
)
AND metadata->>'tx_hash' IS NOT NULL AND metadata->>'tx_hash' != '';

NOTIFY pgrst, 'reload schema';
