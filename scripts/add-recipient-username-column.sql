-- Add recipient_username column to transactions table
-- This stores the username when a payment is sent to @username
-- Allows displaying @username as primary label in transaction list

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS recipient_username TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_recipient_username 
ON public.transactions(recipient_username);

-- Add comment
COMMENT ON COLUMN public.transactions.recipient_username IS 
'Username of recipient when payment was sent to @username (without @ prefix)';
