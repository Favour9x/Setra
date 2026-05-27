-- ========================================================
-- FIX PROFILES TABLE AND NOTIFICATIONS
-- ========================================================
-- Run this in your Supabase SQL Editor
-- ========================================================

-- PART 1: Fix handle_new_user trigger (creates profile on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (new.id, new.email, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PART 2: Backfill existing users who have no profile
INSERT INTO public.profiles (id, email, created_at)
SELECT id, email, created_at FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- PART 3: Delete all mock notifications
DELETE FROM public.notifications;

-- PART 4: Add RLS policy to allow users to delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- PART 5: Ensure wallet_id and wallet_address columns exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_id TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Verify
SELECT 'Profiles count:' as info, COUNT(*) as count FROM public.profiles
UNION ALL
SELECT 'Auth users count:' as info, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Notifications count:' as info, COUNT(*) as count FROM public.notifications;
