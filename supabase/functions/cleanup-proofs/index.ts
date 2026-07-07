// supabase/functions/cleanup-proofs/index.ts
// Deletes processed proof images from Supabase Storage.
// Triggered by a cron job via the Supabase Dashboard (Functions tab)
// or called via pg_net from a SQL cron job.
//
// Deploy with: npx supabase functions deploy cleanup-proofs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STORAGE_BUCKET = 'public-assets';

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all contract_days that have been processed >24h ago and need cleanup
    const { data: rows, error } = await supabase
      .from('contract_days')
      .select('id, proof_image_url')
      .in('status', ['done', 'rejected'])
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .not('proof_image_url', 'is', null)
      .or('storage_cleaned.eq.false,storage_cleaned.is.null')
      .limit(100); // Process in batches to avoid timeout

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ message: 'No proofs to clean up.' }), { status: 200 });
    }

    const successIds: string[] = [];
    const failedIds: string[] = [];

    for (const row of rows) {
      try {
        // Extract the storage path from the full public URL
        // URL format: https://<project>.supabase.co/storage/v1/object/public/public-assets/proofs/filename.jpg
        const url = row.proof_image_url as string;
        const bucketPath = url.split(`${STORAGE_BUCKET}/`)[1];

        if (!bucketPath) {
          // URL doesn't match expected format — mark cleaned to skip in future
          successIds.push(row.id);
          continue;
        }

        const { error: deleteError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([bucketPath]);

        if (deleteError) {
          console.error(`Failed to delete ${bucketPath}:`, deleteError.message);
          failedIds.push(row.id);
          continue;
        }

        successIds.push(row.id);
      } catch (e) {
        console.error(`Error processing row ${row.id}:`, e);
        failedIds.push(row.id);
      }
    }

    // Mark successfully cleaned rows: null out URL and set flag
    if (successIds.length > 0) {
      await supabase
        .from('contract_days')
        .update({ proof_image_url: null, storage_cleaned: true })
        .in('id', successIds);
    }

    return new Response(JSON.stringify({
      cleaned: successIds.length,
      failed: failedIds.length,
    }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
