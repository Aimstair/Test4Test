// supabase/functions/cleanup-penalties/index.ts
// Penalizes testers who missed daily proofs and developers who missed reviewing proofs.
// Triggered by a cron job at 00:05 UTC daily.
//
// Deploy with: npx supabase functions deploy cleanup-penalties

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function insertTransaction(supabase: any, payload: object): Promise<void> {
  const { error } = await supabase.from('transactions').insert([payload]);
  if (error) {
    console.error('[cleanup-penalties] transaction insert failed:', JSON.stringify(error), 'payload:', JSON.stringify(payload));
  }
}

async function sendPushNotification(pushToken: string, title: string, body: string, type: string): Promise<void> {
  try {
    if (!pushToken || (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken['))) {
      return;
    }
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: { type },
        priority: 'high',
        channelId: 'default',
      }),
    });
    if (!res.ok) {
      const result = await res.text();
      console.error('[cleanup-penalties] push failed:', res.status, result);
    }
  } catch (e: any) {
    console.error('[cleanup-penalties] push error:', e.message);
  }
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get today's UTC date string (e.g., '2026-07-12')
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let testersPenalized = 0;
    let developersPenalized = 0;
    const errors: string[] = [];

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
        const { error: missedErr } = await supabase.from('contract_days').update({ status: 'missed' }).eq('id', day.id);
        if (missedErr) errors.push(`missed update ${day.id}: ${missedErr.message}`);

        if (testerId) {
          // 2. Deduct Karma
          const { data: testerUser } = await supabase.from('users').select('karma, push_token').eq('id', testerId).single();
          if (testerUser) {
            const { error: karmaErr } = await supabase
              .from('users')
              .update({ karma: (testerUser.karma || 0) - 2 })
              .eq('id', testerId);
            if (karmaErr) errors.push(`karma deduct tester ${testerId}: ${karmaErr.message}`);

            await insertTransaction(supabase, {
              user_id: testerId,
              type: 'karma_loss',
              currency: 'karma',
              amount: -2,
              description: 'Missed daily proof submission',
            });
          }

          // 3. Send Notification (DB + Push)
          const { error: notifErr } = await supabase.from('notifications').insert([{
            user_id: testerId,
            title: 'Missed Proof',
            body: 'You missed your daily check-in and lost 2 Karma.',
            type: 'warning',
          }]);
          if (notifErr) errors.push(`notif tester ${testerId}: ${notifErr.message}`);

          // Send push notification
          if (testerUser?.push_token) {
            await sendPushNotification(
              testerUser.push_token,
              'Missed Proof',
              'You missed your daily check-in and lost 2 Karma.',
              'warning'
            );
          }

          testersPenalized++;
        }
      }
    }

    // =========================================================================
    // 2. PENALIZE DEVELOPERS (Missed Reviews)
    // Find contract_days that are 'verified' (waiting for dev review) 
    // and date < todayStr
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
        const { error: doneErr } = await supabase.from('contract_days').update({ status: 'done' }).eq('id', day.id);
        if (doneErr) errors.push(`done update ${day.id}: ${doneErr.message}`);

        // Reward Tester (+1 Karma) for an approved proof
        if (testerId) {
          const { data: testerUser } = await supabase.from('users').select('karma, push_token').eq('id', testerId).single();
          if (testerUser) {
            const { error: karmaErr } = await supabase
              .from('users')
              .update({ karma: (testerUser.karma || 0) + 1 })
              .eq('id', testerId);
            if (karmaErr) errors.push(`karma gain tester ${testerId}: ${karmaErr.message}`);

            await insertTransaction(supabase, {
              user_id: testerId,
              type: 'karma_gain',
              currency: 'karma',
              amount: 1,
              description: 'Proof Auto-Approved (Dev timeout)',
            });
          }

          const { error: notifErr } = await supabase.from('notifications').insert([{
            user_id: testerId,
            title: 'Proof Auto-Approved',
            body: '⭐ Your proof was automatically approved! You earned +1 Karma.',
            type: 'new_proof',
          }]);
          if (notifErr) errors.push(`notif auto-approve tester ${testerId}: ${notifErr.message}`);

          // Send push notification to tester
          if (testerUser?.push_token) {
            await sendPushNotification(
              testerUser.push_token,
              'Proof Auto-Approved',
              '⭐ Your proof was automatically approved! You earned +1 Karma.',
              'new_proof'
            );
          }
        }

        // 2. Penalize the Developer (-1 Karma)
        if (developerId) {
          const { data: devUser } = await supabase.from('users').select('karma, push_token').eq('id', developerId).single();
          if (devUser) {
            const { error: karmaErr } = await supabase
              .from('users')
              .update({ karma: (devUser.karma || 0) - 1 })
              .eq('id', developerId);
            if (karmaErr) errors.push(`karma deduct dev ${developerId}: ${karmaErr.message}`);

            await insertTransaction(supabase, {
              user_id: developerId,
              type: 'karma_loss',
              currency: 'karma',
              amount: -1,
              description: 'Failed to review proof on time',
            });
          }

          const missedReviewBody = `You failed to review a proof for ${app?.name || 'your app'} in time. It was auto-approved and you lost 1 Karma.`;
          const { error: notifErr } = await supabase.from('notifications').insert([{
            user_id: developerId,
            title: 'Missed Review',
            body: missedReviewBody,
            type: 'warning',
          }]);
          if (notifErr) errors.push(`notif dev ${developerId}: ${notifErr.message}`);

          // Send push notification to developer
          if (devUser?.push_token) {
            await sendPushNotification(
              devUser.push_token,
              'Missed Review',
              missedReviewBody,
              'warning'
            );
          }

          developersPenalized++;
        }
      }
    }

    return new Response(JSON.stringify({
      message: 'Success',
      testersPenalized,
      developersPenalized,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[cleanup-penalties] fatal error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
