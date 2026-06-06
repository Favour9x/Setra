CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id_created_at ON public.invoices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id_status ON public.invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_created_at ON public.subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON public.profiles(wallet_address);

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'payment_links') THEN
    CREATE INDEX IF NOT EXISTS idx_payment_links_creator_username ON public.payment_links(creator_username) WHERE is_tips_page = true;
    CREATE INDEX IF NOT EXISTS idx_payment_links_user_id ON public.payment_links(user_id);
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tip_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_tip_messages_link_id_created_at ON public.tip_messages(payment_link_id, created_at DESC);
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'beneficiaries') THEN
    CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id ON public.beneficiaries(user_id);
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'automation_workflows') THEN
    CREATE INDEX IF NOT EXISTS idx_automation_workflows_user_id ON public.automation_workflows(user_id);
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') THEN
    CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id, created_at DESC);
  END IF;
END $$;
