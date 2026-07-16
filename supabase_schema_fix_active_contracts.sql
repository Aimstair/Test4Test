-- Fix contracts that are stuck on 'active' but have all their days completed.
-- A contract is considered complete if there are no 'pending' or 'verified' days remaining AND the contract has reached its final day.
-- We can safely just mark them as completed if they have no incomplete days left in the past.

UPDATE public.contracts c
SET status = 'completed'
WHERE c.status = 'active'
AND (
  -- Check if all contract_days are resolved (done, missed, rejected) and their date is <= today
  NOT EXISTS (
    SELECT 1 FROM public.contract_days cd 
    WHERE cd.contract_id = c.id 
    AND (
      cd.status IN ('pending', 'verified') 
      OR cd.date > CURRENT_DATE
    )
  )
)
AND (
  -- Ensure it actually has contract_days generated
  SELECT count(*) FROM public.contract_days cd WHERE cd.contract_id = c.id
) > 0;
