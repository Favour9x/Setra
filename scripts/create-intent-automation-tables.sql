-- Generalized Intent-Driven Financial Automation Schema

-- 1. Create automation_workflows table
CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  intent_prompt TEXT NOT NULL,
  workflow_type TEXT NOT NULL DEFAULT 'intent', -- 'scheduled_payment', 'recurring_payment', 'split_revenue', 'savings_sweep', 'threshold_transfer', 'auto_invoice_pay', 'conditional_transfer', 'subscription_payment'
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Store parsed targets, schedules, conditions, amounts, recipients
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and Grant Permissions
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_workflows TO service_role;

CREATE POLICY "Users can view their own automation workflows" 
  ON public.automation_workflows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own automation workflows" 
  ON public.automation_workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own automation workflows" 
  ON public.automation_workflows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own automation workflows" 
  ON public.automation_workflows FOR DELETE USING (auth.uid() = user_id);

-- 2. Create workflow_schedules table
CREATE TABLE IF NOT EXISTS public.workflow_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('one_time', 'daily', 'weekly', 'monthly', 'yearly', 'custom')),
  interval INTEGER DEFAULT 1 NOT NULL,
  next_execution_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_execution_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_schedules TO service_role;

CREATE POLICY "Users can view schedules of their own workflows" 
  ON public.workflow_schedules FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can insert schedules for their own workflows" 
  ON public.workflow_schedules FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can update schedules of their own workflows" 
  ON public.workflow_schedules FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can delete schedules of their own workflows" 
  ON public.workflow_schedules FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));

-- 3. Create workflow_triggers table
CREATE TABLE IF NOT EXISTS public.workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('on_funds_received', 'on_balance_threshold', 'on_date_time')),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_triggers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_triggers TO service_role;

CREATE POLICY "Users can view triggers of their own workflows" 
  ON public.workflow_triggers FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can insert triggers for their own workflows" 
  ON public.workflow_triggers FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can update triggers of their own workflows" 
  ON public.workflow_triggers FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can delete triggers of their own workflows" 
  ON public.workflow_triggers FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));

-- 4. Create workflow_executions table
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')) NOT NULL,
  tx_hash TEXT,
  error TEXT,
  execution_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_executions TO service_role;

CREATE POLICY "Users can view executions of their own workflows" 
  ON public.workflow_executions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can insert executions for their own workflows" 
  ON public.workflow_executions FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can update executions of their own workflows" 
  ON public.workflow_executions FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));

-- 5. Create workflow_logs table
CREATE TABLE IF NOT EXISTS public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
  execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE SET NULL,
  log_level TEXT DEFAULT 'info' CHECK (log_level IN ('info', 'warn', 'error')) NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_logs TO service_role;

CREATE POLICY "Users can view logs of their own workflows" 
  ON public.workflow_logs FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can insert logs for their own workflows" 
  ON public.workflow_logs FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.automation_workflows 
    WHERE id = workflow_id AND user_id = auth.uid()
  ));
