-- ============================================================
-- BATCH 2 FIXES — Run in Supabase SQL Editor
-- ============================================================

-- 1. Add subscription_expires_at column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- ============================================================
-- 2. FIX process_auto_approvals
--    BUG: was filtering status = 'pending', but uploaded proofs
--    are set to status = 'verified'. Changed to 'verified'.
-- ============================================================
CREATE OR REPLACE FUNCTION process_auto_approvals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_proof RECORD;
BEGIN
  -- Process verified proofs ONLY for developers with auto_approve_enabled = true
  FOR pending_proof IN
    SELECT cd.id, cd.contract_id, cd.day_number, c.app_id, c.tester_id, a.owner_id, a.name as app_name
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    JOIN public.users u ON a.owner_id = u.id
    WHERE cd.status = 'verified' AND u.auto_approve_enabled = true
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

    -- Notify tester
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      pending_proof.tester_id,
      'Proof Auto-Approved',
      '⭐ Your proof was auto-approved! +1 Karma earned.',
      'new_proof'
    );
  END LOOP;
END;
$$;

-- Reschedule (drop old, create new)
SELECT cron.unschedule('process_auto_approvals_job');
SELECT cron.schedule(
  'process_auto_approvals_job',
  '55 23 * * *',
  'SELECT process_auto_approvals()'
);

-- ============================================================
-- 3. FIX process_daily_proofs
--    BUG: was filtering status = 'pending' for developer-missed
--    proofs, but uploaded proofs are 'verified'. Fixed.
--    Also adds developer notification for karma penalty.
-- ============================================================
CREATE OR REPLACE FUNCTION process_daily_proofs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_proof RECORD;
  missed_proof RECORD;
BEGIN
  -- A. Iterate through REMAINING verified proofs (developer missed reviewing them)
  FOR pending_proof IN
    SELECT cd.id, cd.contract_id, c.app_id, c.tester_id, a.owner_id, a.name as app_name
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    WHERE cd.status = 'verified'
  LOOP
    -- Auto-Approve to protect tester
    UPDATE public.contract_days SET status = 'done' WHERE id = pending_proof.id;
    
    -- Penalty: Deduct 1 karma from the unresponsive developer
    UPDATE public.users SET karma = COALESCE(karma, 0) - 1 WHERE id = pending_proof.owner_id;
    INSERT INTO public.transactions (user_id, type, currency, amount, description)
      VALUES (pending_proof.owner_id, 'karma_loss', 'karma', -1, 'Missed proof review penalty');

    -- Reward Tester (+1 karma)
    UPDATE public.users SET karma = COALESCE(karma, 0) + 1 WHERE id = pending_proof.tester_id;
    INSERT INTO public.transactions (user_id, type, currency, amount, description)
      VALUES (pending_proof.tester_id, 'karma_gain', 'karma', 1, 'Proof auto-approved (developer missed review)');

    -- Notify developer of penalty
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      pending_proof.owner_id,
      'Missed Review Penalty',
      '⚠️ You missed reviewing a proof for ' || pending_proof.app_name || '. -1 Karma penalty applied.',
      'new_proof'
    );

    -- Notify tester
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      pending_proof.tester_id,
      'Proof Auto-Approved',
      '⭐ Your proof was automatically approved. +1 Karma earned.',
      'new_proof'
    );
  END LOOP;

  -- B. Iterate through missed check-ins (testers who didn't upload)
  FOR missed_proof IN
    SELECT cd.id, c.tester_id, a.name as app_name
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    WHERE cd.status IN ('future', 'partial') AND cd.date < CURRENT_DATE
  LOOP
    -- Mark as missed
    UPDATE public.contract_days SET status = 'missed' WHERE id = missed_proof.id;
    -- Penalize the tester
    UPDATE public.users SET karma = COALESCE(karma, 0) - 1 WHERE id = missed_proof.tester_id;
    INSERT INTO public.transactions (user_id, type, currency, amount, description)
      VALUES (missed_proof.tester_id, 'karma_loss', 'karma', -1, 'Missed daily check-in');

    -- Notify tester
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      missed_proof.tester_id,
      'Missed Check-In',
      '❌ You missed your daily check-in for ' || missed_proof.app_name || '. -1 Karma.',
      'check_in'
    );
  END LOOP;

  -- C. Finalize completed contracts (Bug 1 Fix)
  -- Find all 'active' contracts where NO days have status IN ('future', 'partial', 'verified', 'pending')
  -- This means all days are resolved as 'done', 'missed', or 'rejected'
  UPDATE public.contracts c
  SET status = CASE 
    -- Calculate success rate: if done >= 70% of total days, mark completed, else failed
    WHEN (
      SELECT COUNT(*) FROM public.contract_days cd WHERE cd.contract_id = c.id AND cd.status = 'done'
    )::float / (
      SELECT COUNT(*) FROM public.contract_days cd WHERE cd.contract_id = c.id
    )::float >= 0.7 THEN 'completed'
    ELSE 'failed'
  END
  WHERE c.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.contract_days cd 
      WHERE cd.contract_id = c.id 
      AND cd.status IN ('future', 'partial', 'verified', 'pending')
    );
END;
$$;

-- Reschedule daily proofs job
SELECT cron.unschedule('process_daily_proofs_job');
SELECT cron.schedule(
  'process_daily_proofs_job',
  '0 0 * * *',
  'SELECT process_daily_proofs()'
);

-- ============================================================
-- 4. FIX process_daily_reminders
--    Add pending proofs reminder for developers at 22:00 UTC
-- ============================================================
CREATE OR REPLACE FUNCTION process_daily_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tester RECORD;
  developer RECORD;
BEGIN
  -- A. Find testers who haven't checked in yet today
  FOR tester IN
    SELECT DISTINCT c.tester_id, a.name as app_name
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    WHERE cd.status IN ('future', 'partial') AND cd.date = CURRENT_DATE
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      tester.tester_id,
      'Check-in Reminder',
      '⚠️ 2 hours left to check into ' || tester.app_name || '!',
      'check_in'
    );
  END LOOP;

  -- B. Find developers who have verified proofs waiting for review
  FOR developer IN
    SELECT DISTINCT a.owner_id, a.name as app_name, COUNT(*) as proof_count
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    WHERE cd.status = 'verified'
    GROUP BY a.owner_id, a.name
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      developer.owner_id,
      'Proofs Awaiting Review',
      '📋 ' || developer.proof_count || ' proof(s) for ' || developer.app_name || ' need review before midnight UTC.',
      'new_proof'
    );
  END LOOP;
END;
$$;

-- Reschedule daily reminders
SELECT cron.unschedule('process_daily_reminders_job');
SELECT cron.schedule(
  'process_daily_reminders_job',
  '0 22 * * *',
  'SELECT process_daily_reminders()'
);

-- ============================================================
-- 5. Auto-downgrade expired subscriptions at 01:00 UTC
-- ============================================================
CREATE OR REPLACE FUNCTION process_subscription_expiries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_user RECORD;
BEGIN
  FOR expired_user IN
    SELECT id, name, subscription_tier
    FROM public.users
    WHERE subscription_tier != 'Basic'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < NOW()
  LOOP
    -- Downgrade to Basic
    UPDATE public.users
    SET subscription_tier = 'Basic', subscription_expires_at = NULL
    WHERE id = expired_user.id;

    -- Notify user
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      expired_user.id,
      'Subscription Expired',
      '⚠️ Your ' || expired_user.subscription_tier || ' subscription has expired. You have been downgraded to Basic.',
      'subscription'
    );
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'process_subscription_expiries_job',
  '0 1 * * *',
  'SELECT process_subscription_expiries()'
);
