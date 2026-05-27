-- ========================================================
-- SETRA FINTECH: CONSOLIDATED SCHEMA SETUP
-- ========================================================
-- Copy and run this script inside your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/jdoagvioqvypiyvmgjwn/editor
-- ========================================================

-- 1. USERNAME SYSTEM SCHEMA
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMP WITH TIME ZONE;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- 2. NOTIFICATIONS SYSTEM TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'payment_received', 
    'payment_sent', 
    'invoice_created', 
    'invoice_paid', 
    'subscription_renewed', 
    'workflow_executed', 
    'payment_request'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS & Policies for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications 
  FOR UPDATE USING (auth.uid() = user_id);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- 3. INVOICES EMAIL DELIVERY & MANUAL CHECKOUT SCHEMA
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payer_address TEXT;

-- Drop and rebuild invoice status constraint to accept 'awaiting_confirmation'
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('pending', 'paid', 'expired', 'awaiting_confirmation'));

-- 4. SERVICE ROLE & LOOKUP PERMISSIONS (CRITICAL FOR USERNAME RESOLUTION API)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
GRANT ALL ON public.profiles TO service_role;

-- Allow authenticated users to view profiles for username lookup/resolution
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Allow users to view all profiles for resolution" ON public.profiles
  FOR SELECT TO authenticated USING (true);

