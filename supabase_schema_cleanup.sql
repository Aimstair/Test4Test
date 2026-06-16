-- Supabase schema extension for Storage Cleanup

-- Create the storage cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_proofs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  proof RECORD;
  file_name TEXT;
BEGIN
  -- Iterate through all processed contract days that are older than today and have an image
  FOR proof IN 
    SELECT id, proof_image_url
    FROM public.contract_days
    WHERE status IN ('done', 'rejected', 'flagged')
      AND proof_image_url IS NOT NULL
      AND date < CURRENT_DATE
  LOOP
    -- Extract the file name from the public URL
    -- Assumes the URL format ends with /public/proofs/<filename>
    file_name := split_part(proof.proof_image_url, 'public/proofs/', 2);
    
    IF file_name IS NOT NULL AND file_name != '' THEN
      -- Delete the object from Supabase Storage metadata table
      -- Supabase automatically listens to deletes on this table and removes the physical file in the background
      DELETE FROM storage.objects 
      WHERE bucket_id = 'proofs' AND name = file_name;
    END IF;

    -- Nullify the URL in the database to prevent broken image links in the UI
    UPDATE public.contract_days
    SET proof_image_url = NULL
    WHERE id = proof.id;
  END LOOP;
END;
$$;

-- Schedule the job to run every day at 01:00 UTC (shortly after the auto-approve job at 23:59 UTC)
SELECT cron.schedule(
  'cleanup_old_proofs_job',
  '0 1 * * *',
  'SELECT cleanup_old_proofs()'
);
