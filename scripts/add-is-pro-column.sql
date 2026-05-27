-- Add is_pro column to profiles table for Pro subscription gating
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;

-- Create index for faster Pro user queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro ON profiles(is_pro);
