-- Migration: Enforce that wallet_id is immutable once written (can only be written once per user)
-- Run this in your Supabase SQL Editor to enforce the constraint on your active database.

-- 1. Create or replace the validation function
CREATE OR REPLACE FUNCTION public.check_wallet_id_immutability()
RETURNS trigger AS $$
BEGIN
  -- If old wallet_id is already set, and new wallet_id is different, block the update
  IF OLD.wallet_id IS NOT NULL AND NEW.wallet_id IS DISTINCT FROM OLD.wallet_id THEN
    RAISE EXCEPTION 'wallet_id is immutable once set and cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop the trigger if it already exists to ensure idempotency
DROP TRIGGER IF EXISTS enforce_wallet_id_immutability ON public.profiles;

-- 3. Create the BEFORE UPDATE trigger on public.profiles
CREATE TRIGGER enforce_wallet_id_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_wallet_id_immutability();

RAISE NOTICE 'Wallet ID immutability constraint successfully applied to public.profiles table';
