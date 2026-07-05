-- ============================================================
-- BATCH 3 FIXES — Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Add listing_id to apps (Re-listing support)
--    Each time a developer lists a new round, a new listing_id
--    is assigned. Testers are blocked per listing_id, not app_id,
--    allowing previous testers to re-join a new cycle.
-- ============================================================
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS listing_id TEXT;

-- Backfill existing apps: use their own id as the first listing_id
UPDATE public.apps SET listing_id = id::TEXT WHERE listing_id IS NULL;

-- Make it NOT NULL with a default going forward
ALTER TABLE public.apps ALTER COLUMN listing_id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.apps ALTER COLUMN listing_id SET NOT NULL;

-- Add listing_id to contracts so we can scope duplicate checks
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS listing_id TEXT;

-- Backfill contracts: pull listing_id from their app at time of migration
UPDATE public.contracts c
SET listing_id = a.listing_id
FROM public.apps a
WHERE c.app_id = a.id AND c.listing_id IS NULL;

-- ============================================================
-- 2. FIX process_auto_approvals: Add a second cron pass at 00:05
--    to catch proofs submitted in the 23:55-00:00 timing gap.
-- ============================================================

-- Drop existing and recreate first pass at 23:55
DO $$
BEGIN
  PERFORM cron.unschedule('process_auto_approvals_job');
EXCEPTION WHEN OTHERS THEN END $$;

SELECT cron.schedule(
  'process_auto_approvals_job',
  '55 23 * * *',
  'SELECT process_auto_approvals()'
);

-- Add second pass at 00:05 UTC to catch late-night uploads
DO $$
BEGIN
  PERFORM cron.unschedule('process_auto_approvals_job_late');
EXCEPTION WHEN OTHERS THEN END $$;

SELECT cron.schedule(
  'process_auto_approvals_job_late',
  '5 0 * * *',
  'SELECT process_auto_approvals()'
);

-- ============================================================
-- 3. FIX process_daily_proofs
--    Skip verified proofs belonging to auto-approve developers.
--    Without this, the 00:00 job races the 00:05 auto-approve pass
--    and wrongly penalizes auto-approve devs for unreviewed proofs.
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
  -- A. Auto-approve remaining VERIFIED proofs for devs WITHOUT auto_approve
  FOR pending_proof IN
    SELECT cd.id, cd.contract_id, c.app_id, c.tester_id, a.owner_id, a.name as app_name
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    JOIN public.users u ON a.owner_id = u.id
    WHERE cd.status = 'verified'
      AND u.auto_approve_enabled = false  -- FIX: skip auto-approve developers
  LOOP
    UPDATE public.contract_days SET status = 'done' WHERE id = pending_proof.id;
    
    UPDATE public.users SET karma = COALESCE(karma, 0) - 1 WHERE id = pending_proof.owner_id;
    INSERT INTO public.transactions (user_id, type, currency, amount, description)
      VALUES (pending_proof.owner_id, 'karma_loss', 'karma', -1, 'Missed proof review penalty');

    UPDATE public.users SET karma = COALESCE(karma, 0) + 1 WHERE id = pending_proof.tester_id;
    INSERT INTO public.transactions (user_id, type, currency, amount, description)
      VALUES (pending_proof.tester_id, 'karma_gain', 'karma', 1, 'Proof auto-approved (developer missed review)');

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      pending_proof.owner_id,
      'Missed Review Penalty',
      'You missed reviewing a proof for ' || pending_proof.app_name || '. -1 Karma penalty applied.',
      'new_proof'
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      pending_proof.tester_id,
      'Proof Auto-Approved',
      'Your proof was automatically approved. +1 Karma earned.',
      'new_proof'
    );
  END LOOP;

  -- B. Mark past-due days as 'missed'
  FOR missed_proof IN
    SELECT cd.id, c.tester_id, a.name as app_name
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    WHERE cd.status IN ('future', 'partial') AND cd.date < CURRENT_DATE
  LOOP
    UPDATE public.contract_days SET status = 'missed' WHERE id = missed_proof.id;
    UPDATE public.users SET karma = COALESCE(karma, 0) - 1 WHERE id = missed_proof.tester_id;
    INSERT INTO public.transactions (user_id, type, currency, amount, description)
      VALUES (missed_proof.tester_id, 'karma_loss', 'karma', -1, 'Missed daily check-in');

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      missed_proof.tester_id,
      'Missed Check-In',
      'You missed your daily check-in for ' || missed_proof.app_name || '. -1 Karma.',
      'check_in'
    );
  END LOOP;

  -- C. Finalize completed contracts
  UPDATE public.contracts c
  SET status = CASE 
    WHEN (
      SELECT COUNT(*) FROM public.contract_days cd WHERE cd.contract_id = c.id AND cd.status = 'done'
    )::float / NULLIF((
      SELECT COUNT(*) FROM public.contract_days cd WHERE cd.contract_id = c.id
    )::float, 0) >= 0.7 THEN 'completed'
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

DO $$
BEGIN
  PERFORM cron.unschedule('process_daily_proofs_job');
EXCEPTION WHEN OTHERS THEN END $$;

SELECT cron.schedule(
  'process_daily_proofs_job',
  '0 0 * * *',
  'SELECT process_daily_proofs()'
);

-- ============================================================
-- 4. Storage Cleanup: Flag processed proof images for deletion
--    after 24 hours. The actual file deletion is handled by
--    the cleanup-proofs Edge Function (see supabase/functions/).
-- ============================================================
ALTER TABLE public.contract_days ADD COLUMN IF NOT EXISTS storage_cleaned BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION mark_proofs_for_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset the flag so the Edge Function re-processes these rows
  -- Edge Function queries: storage_cleaned = false AND proof_image_url IS NOT NULL
  UPDATE public.contract_days
  SET storage_cleaned = false
  WHERE status IN ('done', 'rejected')
    AND updated_at < NOW() - INTERVAL '24 hours'
    AND proof_image_url IS NOT NULL
    AND storage_cleaned = false;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup_proofs_job');
EXCEPTION WHEN OTHERS THEN END $$;

SELECT cron.schedule(
  'cleanup_proofs_job',
  '0 1 * * *',
  'SELECT mark_proofs_for_cleanup()'
);
