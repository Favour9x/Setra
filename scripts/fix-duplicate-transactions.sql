-- Fix duplicate transactions in the database
-- This script removes duplicate transactions keeping only the first one

-- Step 1: Identify and delete duplicate transactions (keep the oldest one)
DELETE FROM transactions a
USING transactions b
WHERE a.tx_hash = b.tx_hash
  AND a.id > b.id
  AND a.tx_hash IS NOT NULL;

-- Step 2: Add unique constraint on tx_hash to prevent future duplicates
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_tx_hash_unique;

ALTER TABLE transactions
ADD CONSTRAINT transactions_tx_hash_unique UNIQUE (tx_hash);

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);

-- Verify the fix
SELECT tx_hash, COUNT(*) as count
FROM transactions
WHERE tx_hash IS NOT NULL
GROUP BY tx_hash
HAVING COUNT(*) > 1;
