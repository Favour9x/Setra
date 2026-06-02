-- Create beneficiaries table for saved recipients
-- Copy and run this script inside your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/jdoagvioqvypiyvmgjwn/editor

CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_tag TEXT,
  recipient_address TEXT NOT NULL,
  recipient_avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO service_role;

CREATE POLICY "Users can view their own beneficiaries" ON public.beneficiaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own beneficiaries" ON public.beneficiaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own beneficiaries" ON public.beneficiaries FOR DELETE USING (auth.uid() = user_id);
