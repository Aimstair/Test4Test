// supabase/functions/cleanup-penalties/index.ts
// Penalizes testers who missed daily proofs and developers who missed reviewing proofs.
// Triggered by a cron job at 00:05 UTC daily.
//
// Deploy with: npx supabase functions deploy cleanup-penalties

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get today's UTC date string (e.g., '2026-07-12')
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // We consider anything strictly before today as "past"
    // e.g. date < todayStr

    let testersPenalized = 0;
    let developersPenalized = 0;

    // =========================================================================
    // 1. PENALIZE TESTERS (Missed Proofs)
    // Find contract_days that are 'pending' and date < todayStr
    // =========================================================================
    const { data: pendingDays, error: pError } = await supabase
      .from('contract_days')
      .select('id, contract_id, contracts(tester_id)')
      .eq('status', 'pending')
      .lt('date', todayStr);

    if (pError) throw pError;

    if (pendingDays && pendingDays.length > 0) {
      for (const day of pendingDays) {
        const testerId = (day.contracts as any)?.tester_id;

        // 1. Mark day as missed
        await supabase.from('contract_days').update({ status: 'missed' }).eq('id', day.id);

        if (testerId) {
          // 2. Deduct Karma
          const { data: testerUser } = await supabase.from('users').select('karma').eq('id', testerId).single();
          if (testerUser) {
            await supabase.from('users').update({ karma: (testerUser.karma || 0) - 2 }).eq('id', testerId);
            await supabase.from('transactions').insert([{
              user_id: testerId,
              type: 'karma_loss',
              currency: 'karma',
              amount: -2,
              description: 'Missed daily proof submission'
            }]);
          }

          // 3. Send Notification
          await supabase.from('notifications').insert([{
            user_id: testerId,
            title: 'Missed Proof',
            body: 'You missed your daily check-in and lost 2 Karma.',
            type: 'warning'
          }]);

          testersPenalized++;
        }
      }
    }

    // =========================================================================
    // 2. PENALIZE DEVELOPERS (Missed Reviews)
    // Find contract_days that are 'verified' (waiting for dev review) 
    // and created > 24 hours ago (or scheduled date < todayStr)
    // We'll use date < todayStr to be consistent with End-Of-Day cron jobs.
    // =========================================================================
    const { data: verifiedDays, error: vError } = await supabase
      .from('contract_days')
      .select('id, contract_id, contracts(tester_id, app_id, apps(owner_id, name, app_type))')
      .eq('status', 'verified')
      .lt('date', todayStr);

    if (vError) throw vError;

    if (verifiedDays && verifiedDays.length > 0) {
      for (const day of verifiedDays) {
        const contract = day.contracts as any;
        const testerId = contract?.tester_id;
        const app = contract?.apps;
        const developerId = app?.owner_id;

        // 1. Auto-approve for the tester (so they aren't blocked)
        await supabase.from('contract_days').update({ status: 'done' }).eq('id', day.id);

        // Reward Tester (+1 Karma) for an approved proof
        if (testerId) {
          const { data: testerUser } = await supabase.from('users').select('karma').eq('id', testerId).single();
          if (testerUser) {
            await supabase.from('users').update({ karma: (testerUser.karma || 0) + 1 }).eq('id', testerId);
            await supabase.from('transactions').insert([{
              user_id: testerId,
              type: 'karma_gain',
              currency: 'karma',
              amount: 1,
              description: 'Proof Auto-Approved (Dev timeout)'
            }]);
          }
          await supabase.from('notifications').insert([{
            user_id: testerId,
            title: 'Proof Auto-Approved',
            body: '⭐ Your proof was automatically approved! You earned +1 Karma.',
            type: 'new_proof'
          }]);
        }

        // 2. Penalize the Developer (-1 Karma)
        if (developerId) {
          const { data: devUser } = await supabase.from('users').select('karma').eq('id', developerId).single();
          if (devUser) {
            await supabase.from('users').update({ karma: (devUser.karma || 0) - 1 }).eq('id', developerId);
            await supabase.from('transactions').insert([{
              user_id: developerId,
              type: 'karma_loss',
              currency: 'karma',
              amount: -1,
              description: 'Failed to review proof on time'
            }]);
          }
          await supabase.from('notifications').insert([{
            user_id: developerId,
            title: 'Missed Review',
            body: `You failed to review a proof for ${app?.name || 'your app'} in time. It was auto-approved and you lost 1 Karma.`,
            type: 'warning'
          }]);

          developersPenalized++;
        }
      }
    }

    return new Response(JSON.stringify({
      message: "Success",
      testersPenalized,
      developersPenalized
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
