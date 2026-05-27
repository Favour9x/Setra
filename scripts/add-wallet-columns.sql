-- Migration: Add wallet columns to profiles table
-- Run this in your Supabase SQL Editor if the columns don't exist yet

-- Check if columns exist and add them if they don't
DO $$ 
BEGIN
  -- Add wallet_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'wallet_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN wallet_id TEXT;
    RAISE NOTICE 'Added wallet_id column to profiles table';
  ELSE
    RAISE NOTICE 'wallet_id column already exists';
  END IF;

  -- Add wallet_address column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'wallet_address'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN wallet_address TEXT;
    RAISE NOTICE 'Added wallet_address column to profiles table';
  ELSE
    RAISE NOTICE 'wallet_address column already exists';
  END IF;
END $$;

-- Add RLS policy for updating profiles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" 
    ON public.profiles 
    FOR UPDATE 
    USING (auth.uid() = id);
    RAISE NOTICE 'Added RLS policy for profile updates';
  ELSE
    RAISE NOTICE 'RLS policy for profile updates already exists';
  END IF;
END $$;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('wallet_id', 'wallet_address')
ORDER BY column_name;
