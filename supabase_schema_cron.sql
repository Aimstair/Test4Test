-- Supabase schema extension for Auto-Approve & Karma Deductions

-- Enable pg_cron if not already enabled (Note: in Supabase this is often pre-enabled or requires Dashboard access)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the processing function
CREATE OR REPLACE FUNCTION process_daily_proofs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_proof RECORD;
  owner_tier TEXT;
BEGIN
  -- Iterate through all contract_days that are currently 'pending'
  -- 'pending' implies the proof has been uploaded but not yet verified
  FOR pending_proof IN
    SELECT cd.id, cd.contract_id, c.app_id, a.owner_id
    FROM public.contract_days cd
    JOIN public.contracts c ON cd.contract_id = c.id
    JOIN public.apps a ON c.app_id = a.id
    WHERE cd.status = 'pending'
  LOOP
    -- Get the owner's tier
    SELECT tier INTO owner_tier FROM public.users WHERE id = pending_proof.owner_id;

    -- Enforce logic based on user tier
    IF owner_tier = 'pro' OR owner_tier = 'pro_plus' THEN
      -- Auto-Approve: Update proof status to 'done'
      UPDATE public.contract_days 
      SET status = 'done' 
      WHERE id = pending_proof.id;
    ELSE
      -- Free tier penalty: deduct 1 karma from the unresponsive developer
      -- Status remains 'pending' (or could be 'missed', depending on business logic; here we keep it as pending as requested, just penalize)
      UPDATE public.users 
      SET karma = COALESCE(karma, 0) - 1 
      WHERE id = pending_proof.owner_id;
    END IF;
  END LOOP;
END;
$$;

-- Schedule the job to run every day at 23:59 UTC
-- Note: 'process_daily_proofs_job' is the cron job name
SELECT cron.schedule(
  'process_daily_proofs_job',
  '59 23 * * *',
  'SELECT process_daily_proofs()'
);
