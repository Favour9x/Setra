-- Create missing workflow-related tables and RLS policies
-- Only creates tables that don't already exist

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

ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_schedules TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_triggers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_executions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_logs TO authenticated, service_role;

-- SELECT policies
CREATE POLICY "Users can view their own workflow schedules" ON public.workflow_schedules
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can view their own workflow triggers" ON public.workflow_triggers
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can view their own workflow executions" ON public.workflow_executions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can view their own workflow logs" ON public.workflow_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));

-- INSERT policies
CREATE POLICY "Users can insert schedules for their own workflows" ON public.workflow_schedules
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can insert triggers for their own workflows" ON public.workflow_triggers
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can insert executions for their own workflows" ON public.workflow_executions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
CREATE POLICY "Users can insert logs for their own workflows" ON public.workflow_logs
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
