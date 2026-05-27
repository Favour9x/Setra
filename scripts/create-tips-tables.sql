-- Add tips page columns to payment_links
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS is_tips_page BOOLEAN DEFAULT false;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS goal_title TEXT;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS goal_amount NUMERIC;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS raised_amount NUMERIC DEFAULT 0;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS bronze_amount NUMERIC;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS silver_amount NUMERIC;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS gold_amount NUMERIC;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS creator_username TEXT;

-- Create tip_messages table
CREATE TABLE IF NOT EXISTS tip_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id UUID REFERENCES payment_links(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,
  sender_username TEXT,
  amount NUMERIC NOT NULL,
  message TEXT,
  tier_label TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT,
  subscription_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tip_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tip messages" ON tip_messages FOR SELECT USING (true);
CREATE POLICY "Service role can insert tip messages" ON tip_messages FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tip_messages_payment_link_id ON tip_messages(payment_link_id);
CREATE INDEX IF NOT EXISTS idx_tip_messages_created_at ON tip_messages(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE tip_messages;

-- RPC function for top supporters leaderboard
CREATE OR REPLACE FUNCTION get_top_supporters(p_payment_link_id UUID)
RETURNS TABLE(sender_address TEXT, sender_username TEXT, total_amount NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT tm.sender_address, tm.sender_username, SUM(tm.amount)::NUMERIC as total_amount
  FROM tip_messages tm
  WHERE tm.payment_link_id = p_payment_link_id
  GROUP BY tm.sender_address, tm.sender_username
  ORDER BY total_amount DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
