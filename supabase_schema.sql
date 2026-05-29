-- Setra Database Schema

-- 1. profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  wallet_id TEXT,
  wallet_address TEXT,
  username TEXT UNIQUE,
  username_changed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique index for username fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- 2. balances
CREATE TABLE public.balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  balance NUMERIC DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  recipient TEXT NOT NULL,
  recipient_username TEXT,
  amount NUMERIC NOT NULL,
  type TEXT DEFAULT 'expense' CHECK (type IN ('income', 'expense')),
  category TEXT DEFAULT 'General',
  currency TEXT DEFAULT 'USD' NOT NULL,
  status TEXT DEFAULT 'success' NOT NULL,
  tx_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. user_settings
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled BOOLEAN DEFAULT true,
  currency TEXT DEFAULT 'USD',
  biometric_enabled BOOLEAN DEFAULT true,
  auto_archive BOOLEAN DEFAULT false,
  high_contrast_mode BOOLEAN DEFAULT false,
  multi_region BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. user_profiles
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  email TEXT NOT NULL,
  avatar TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- Grant permissions to service_role for transactions (bypass RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO service_role;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view their own balance" ON public.balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own balance" ON public.balances FOR UPDATE USING (auth.uid() = user_id);


CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own user profile" ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own user profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own user profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Profile trigger on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  INSERT INTO public.balances (user_id, balance)
  VALUES (new.id, 128430.00); -- Initial demo balance from original state
  
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  
  INSERT INTO public.user_profiles (user_id, email)
  VALUES (new.id, new.email);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- PHASE 7 ADDITIONS: INVOICES, PAYMENT LINKS, SUBSCRIPTIONS, WORKFLOWS
-- ==========================================

-- 1. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'sent' CHECK (type IN ('sent', 'received')),
  sender_id UUID REFERENCES auth.users(id),
  sender_username TEXT,
  recipient_username TEXT,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USDC' NOT NULL,
  recipient_address TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO service_role;

CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);

-- 2. Payment Links Table
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC, -- NULL allows custom amount input by the sender
  currency TEXT DEFAULT 'USDC' NOT NULL,
  recipient_address TEXT NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO service_role;

CREATE POLICY "Users can view their own payment links" ON public.payment_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own payment links" ON public.payment_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own payment links" ON public.payment_links FOR UPDATE USING (auth.uid() = user_id);

-- 3. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USDC' NOT NULL,
  recipient_address TEXT NOT NULL,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')) NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscriptions" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- 4. Workflows Table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('revenue_received', 'scheduled', 'payroll')),
  action_type TEXT NOT NULL CHECK (action_type IN ('split_revenue', 'automated_payout', 'creator_payroll')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO service_role;

CREATE POLICY "Users can view their own workflows" ON public.workflows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own workflows" ON public.workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own workflows" ON public.workflows FOR UPDATE USING (auth.uid() = user_id);

-- 4b. Intent Automation Tables
-- Open-ended payment intents compiled from natural language and executed by the Circle agent stack.
CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  intent_prompt TEXT NOT NULL,
  workflow_type TEXT NOT NULL CHECK (workflow_type IN (
    'scheduled_payment',
    'recurring_payment',
    'split_revenue',
    'savings_sweep',
    'threshold_transfer',
    'auto_invoice_pay',
    'conditional_transfer',
    'subscription_payment',
    'payroll_automation',
    'custom_intent'
  )),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workflow_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('one_time', 'daily', 'weekly', 'monthly', 'yearly', 'custom')),
  interval INTEGER DEFAULT 1 NOT NULL,
  next_execution_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_execution_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('on_funds_received', 'on_balance_threshold', 'on_date_time', 'on_schedule', 'manual')),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
  tx_hash TEXT,
  error TEXT,
  execution_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
  execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE SET NULL,
  log_level TEXT DEFAULT 'info' CHECK (log_level IN ('info', 'warn', 'error')) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_workflows TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_schedules TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_triggers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_executions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_logs TO authenticated, service_role;

CREATE POLICY "Users can view their own automation intents" ON public.automation_workflows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own automation intents" ON public.automation_workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own automation intents" ON public.automation_workflows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own automation intents" ON public.automation_workflows FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own workflow schedules" ON public.workflow_schedules
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can view their own workflow triggers" ON public.workflow_triggers
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can view their own workflow executions" ON public.workflow_executions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can view their own workflow logs" ON public.workflow_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));

-- Enforce that wallet_id is immutable once written (can only be written once per user)
CREATE OR REPLACE FUNCTION public.check_wallet_id_immutability()
RETURNS trigger AS $$
BEGIN
  IF OLD.wallet_id IS NOT NULL AND NEW.wallet_id IS DISTINCT FROM OLD.wallet_id THEN
    RAISE EXCEPTION 'wallet_id is immutable once set and cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER enforce_wallet_id_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_wallet_id_immutability();
