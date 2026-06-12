DO $$
DECLARE
    duplicate_record RECORD;
    keep_id UUID;
BEGIN
    FOR duplicate_record IN 
        SELECT user_id, tx_hash, type, array_agg(id ORDER BY created_at, id) as ids
        FROM transactions
        WHERE tx_hash IS NOT NULL
        GROUP BY user_id, tx_hash, type
        HAVING COUNT(*) > 1
    LOOP
        keep_id := duplicate_record.ids[1];
        
        DELETE FROM transactions
        WHERE user_id = duplicate_record.user_id
          AND tx_hash = duplicate_record.tx_hash
          AND type = duplicate_record.type
          AND id != keep_id;
        
        RAISE NOTICE 'Removed duplicates for tx_hash %, kept id %', duplicate_record.tx_hash, keep_id;
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_tx_hash_type 
ON transactions (user_id, tx_hash, type)
WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_circle_id 
ON transactions ((metadata->>'circle_transaction_id'))
WHERE metadata->>'circle_transaction_id' IS NOT NULL;
