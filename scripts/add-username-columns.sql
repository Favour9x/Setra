-- Add username column to the Supabase profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMP WITH TIME ZONE;

-- Create a unique index on username for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);
