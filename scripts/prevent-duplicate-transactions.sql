-- Prevent duplicate transaction records
-- This ensures the same transaction hash can't be recorded twice for the same user

-- First, remove any existing duplicates (keep the oldest record)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY user_id, tx_hash, type 
           ORDER BY created_at ASC
         ) as row_num
  FROM transactions
  WHERE tx_hash IS NOT NULL
)
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Create a unique index to prevent future duplicates
-- A user can't have the same tx_hash + type combination more than once
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_tx_hash_type 
ON transactions (user_id, tx_hash, type)
WHERE tx_hash IS NOT NULL;

-- Also create an index on circle_transaction_id in metadata
-- This prevents Circle webhook retries from creating duplicates
CREATE INDEX IF NOT EXISTS idx_transactions_circle_id 
ON transactions ((metadata->>'circle_transaction_id'))
WHERE metadata->>'circle_transaction_id' IS NOT NULL;

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_unique_user_tx_hash_type IS 
'Prevents duplicate transaction records: same user cannot have multiple records with the same tx_hash and type';
