ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recipient_address TEXT;

-- Backfill recipient_address from metadata for existing rows
UPDATE public.transactions
SET recipient_address = metadata->>'recipient_address'
WHERE recipient_address IS NULL
  AND metadata IS NOT NULL
  AND metadata->>'recipient_address' IS NOT NULL;
