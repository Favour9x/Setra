-- Add missing INSERT RLS policies for workflow-related tables
CREATE POLICY "Users can insert schedules for their own workflows" ON public.workflow_schedules
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));

CREATE POLICY "Users can insert triggers for their own workflows" ON public.workflow_triggers
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));

CREATE POLICY "Users can insert executions for their own workflows" ON public.workflow_executions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));

CREATE POLICY "Users can insert logs for their own workflows" ON public.workflow_logs
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.automation_workflows aw WHERE aw.id = workflow_id AND aw.user_id = auth.uid()));
