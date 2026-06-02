ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payer_wallet_id TEXT;
