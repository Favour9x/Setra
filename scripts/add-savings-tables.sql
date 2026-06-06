-- Setra Savings Feature - Database Migration
-- Run this in your Supabase SQL editor

-- 1. savings_goals
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  saved_amount NUMERIC DEFAULT 0 NOT NULL,
  vault_type TEXT DEFAULT 'flexible' CHECK (vault_type IN ('flexible', 'locked')) NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE,
  locked_until_amount NUMERIC,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. savings_transactions
CREATE TABLE IF NOT EXISTS public.savings_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('deposit', 'withdrawal')) NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. savings_auto_rules
CREATE TABLE IF NOT EXISTS public.savings_auto_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE NOT NULL,
  rule_type TEXT CHECK (rule_type IN ('fixed', 'percentage')) NOT NULL,
  amount NUMERIC,
  percentage NUMERIC,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_auto_rules ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_auto_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_auto_rules TO service_role;

-- RLS Policies: savings_goals
CREATE POLICY "Users can view their own savings goals" ON public.savings_goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own savings goals" ON public.savings_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own savings goals" ON public.savings_goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own savings goals" ON public.savings_goals
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: savings_transactions
CREATE POLICY "Users can view their own savings transactions" ON public.savings_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own savings transactions" ON public.savings_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies: savings_auto_rules
CREATE POLICY "Users can view their own auto-save rules" ON public.savings_auto_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own auto-save rules" ON public.savings_auto_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own auto-save rules" ON public.savings_auto_rules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own auto-save rules" ON public.savings_auto_rules
  FOR DELETE USING (auth.uid() = user_id);
