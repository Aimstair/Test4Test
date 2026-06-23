-- 1. Fix Notifications (Add missing INSERT policy)
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
CREATE POLICY "Anyone can insert notifications" 
  ON public.notifications FOR INSERT 
  WITH CHECK (true);

-- 2. Allow Admins to manage Apps (Update and Delete)
DROP POLICY IF EXISTS "Admins can update apps" ON public.apps;
CREATE POLICY "Admins can update apps" 
  ON public.apps FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can delete apps" ON public.apps;
CREATE POLICY "Admins can delete apps" 
  ON public.apps FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 3. Add auto_approve_enabled, notification_prefs to users, and banned to apps
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auto_approve_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"new_tester":true,"new_review":true,"app_expiry":true,"app_full":true,"daily_reports":true,"subscription":true,"new_proof":true,"check_in":true,"testing_finished":true}'::jsonb;
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS boost_ends_at TIMESTAMPTZ;
ALTER TABLE public.contract_days ADD COLUMN IF NOT EXISTS disputed BOOLEAN DEFAULT false;
ALTER TABLE public.contract_days ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS feedback JSONB;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS bonus_bounty INTEGER DEFAULT 0;
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS app_type TEXT DEFAULT 'Testing';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS rate_proof_url TEXT;

-- 3.5 Fix Contracts RLS to allow public read (needed for active tester count)
DROP POLICY IF EXISTS "Users can view their own contracts or contracts for their apps." ON public.contracts;
CREATE POLICY "Contracts are viewable by everyone."
  ON public.contracts FOR SELECT
  USING (true);

-- 4. Create Auto-Approve Job (Runs at 23:55 UTC)
CREATE OR REPLACE FUNCTION process_auto_approvals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_proof RECORD;
BEGIN
  -- Process pending proofs ONLY for developers with auto_approve_enabled = true
  FOR pending_proof IN
    SELECT cd.id, cd.contract_id, c.app_id, c.tester_id, a.owner_id
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    JOIN public.users u ON a.owner_id = u.id
    WHERE cd.status = 'pending' AND u.auto_approve_enabled = true
  LOOP
    -- Auto-Approve: Update proof status to 'done'
    UPDATE public.contract_days SET status = 'done' WHERE id = pending_proof.id;
    
    -- Reward Developer (+0.5 karma) for auto-approving
    UPDATE public.users SET karma = COALESCE(karma, 0) + 0.5 WHERE id = pending_proof.owner_id;
    INSERT INTO public.transactions (user_id, type, currency, amount, description) 
      VALUES (pending_proof.owner_id, 'karma_gain', 'karma', 0.5, 'Auto-approved daily proof');

    -- Reward Tester (+1 karma)
    UPDATE public.users SET karma = COALESCE(karma, 0) + 1 WHERE id = pending_proof.tester_id;
    INSERT INTO public.transactions (user_id, type, currency, amount, description) 
      VALUES (pending_proof.tester_id, 'karma_gain', 'karma', 1, 'Proof auto-approved');
  END LOOP;
END;
$$;

-- Schedule Auto-Approve Job at 23:55 UTC
SELECT cron.schedule(
  'process_auto_approvals_job',
  '55 23 * * *',
  'SELECT process_auto_approvals()'
);

-- 5. Replace process_daily_proofs (Penalty Job, Runs at 00:00 UTC)
CREATE OR REPLACE FUNCTION process_daily_proofs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_proof RECORD;
  missed_proof RECORD;
BEGIN
  -- A. Iterate through REMAINING pending proofs (developer missed them)
  FOR pending_proof IN
    SELECT cd.id, cd.contract_id, c.app_id, c.tester_id, a.owner_id
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    WHERE cd.status = 'pending'
  LOOP
    -- Auto-Approve anyway to protect tester
    UPDATE public.contract_days SET status = 'done' WHERE id = pending_proof.id;
    
    -- Penalty: Deduct 1 karma from the unresponsive developer
    UPDATE public.users SET karma = COALESCE(karma, 0) - 1 WHERE id = pending_proof.owner_id;

    -- Reward Tester (+1 karma)
    UPDATE public.users SET karma = COALESCE(karma, 0) + 1 WHERE id = pending_proof.tester_id;
  END LOOP;

  -- B. Iterate through missed check-ins (testers who didn't upload)
  FOR missed_proof IN
    SELECT cd.id, c.tester_id
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    WHERE cd.status IN ('future', 'partial') AND cd.date < CURRENT_DATE
  LOOP
    -- Mark as missed
    UPDATE public.contract_days SET status = 'missed' WHERE id = missed_proof.id;
    -- Penalize the tester
    UPDATE public.users SET karma = COALESCE(karma, 0) - 1 WHERE id = missed_proof.tester_id;
  END LOOP;
END;
$$;

-- Note: process_daily_proofs_job is already scheduled in Supabase if you ran the previous script. If not, schedule it:
-- SELECT cron.schedule('process_daily_proofs_job', '0 0 * * *', 'SELECT process_daily_proofs()');

-- 6. Create Daily Reminder Job (Runs at 22:00 UTC)
CREATE OR REPLACE FUNCTION process_daily_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tester RECORD;
BEGIN
  -- Find testers who haven't checked in yet today
  FOR tester IN
    SELECT DISTINCT c.tester_id, a.name as app_name
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    WHERE cd.status IN ('future', 'partial') AND cd.date = CURRENT_DATE
  LOOP
    -- Insert notification
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      tester.tester_id,
      'Check-in Reminder',
      '⚠️ 2 hours left to check into ' || tester.app_name || '!',
      'check_in'
    );
  END LOOP;
END;
$$;

-- Schedule Daily Reminder Job at 22:00 UTC
SELECT cron.schedule(
  'process_daily_reminders_job',
  '0 22 * * *',
  'SELECT process_daily_reminders()'
);
