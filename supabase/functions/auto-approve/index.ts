// supabase/functions/auto-approve/index.ts
// Approves pending proofs for developers with auto_approve_enabled = true.
// Triggered by a cron job via the Supabase Dashboard (Functions tab)
// or called via pg_net from a SQL cron job at 23:55 UTC daily.
//
// Deploy with: npx supabase functions deploy auto-approve

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get developers with auto_approve_enabled
    const { data: developers, error: devError } = await supabase
      .from('users')
      .select('id')
      .eq('auto_approve_enabled', true);
      
    if (devError) throw devError;
    if (!developers || developers.length === 0) {
      return new Response(JSON.stringify({ message: "No auto-approve developers found", approved: 0 }), { headers: { "Content-Type": "application/json" } });
    }
    
    const developerIds = developers.map((d: any) => d.id);
    
    // 2. Get apps for these developers
    const { data: apps, error: aError } = await supabase
      .from('apps')
      .select('id, owner_id, name, app_type')
      .in('owner_id', developerIds);

    if (aError) throw aError;
    if (!apps || apps.length === 0) {
      return new Response(JSON.stringify({ message: "No apps for auto-approve developers", approved: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    const appIds = apps.map((a: any) => a.id);
    const appMap = apps.reduce((acc: any, a: any) => {
      acc[a.id] = a;
      return acc;
    }, {});

    // 2.5 Get active contracts for these apps
    const { data: contracts, error: cError } = await supabase
      .from('contracts')
      .select('id, tester_id, app_id')
      .in('app_id', appIds)
      .in('status', ['active']);
      
    if (cError) throw cError;
    
    // DEBUG DUMP: Let's fetch ALL proof days to see their statuses
    const { data: allProofDays } = await supabase.from('contract_days').select('status, proof_image_url').not('proof_image_url', 'is', null);
    
    if (!contracts || contracts.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No active contracts for auto-approve developers", 
        approved: 0,
        debug_global_proofs: allProofDays
      }), { headers: { "Content-Type": "application/json" } });
    }
    
    const contractIds = contracts.map((c: any) => c.id);
    const contractMap = contracts.reduce((acc: any, c: any) => {
      acc[c.id] = c;
      return acc;
    }, {});
    
    // 3. Get pending proofs for these contracts
    const { data: pendingDays, error: pdError } = await supabase
      .from('contract_days')
      .select('*')
      .in('contract_id', contractIds)
      .eq('status', 'verified')
      .not('proof_image_url', 'is', null);
      
    if (pdError) throw pdError;
    
    if (!pendingDays || pendingDays.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No pending proofs to auto-approve", 
        approved: 0,
        debug_global_proofs: allProofDays
      }), { headers: { "Content-Type": "application/json" } });
    }
    
    let approvedCount = 0;
    
    // 4. Process each proof
    for (const day of pendingDays) {
      const contract = contractMap[day.contract_id];
      if (!contract) continue;
      
      const app = appMap[contract.app_id];
      const developerId = app.owner_id;
      const testerId = contract.tester_id;
      
      // Update status to done
      await supabase.from('contract_days').update({ status: 'done' }).eq('id', day.id);
      
      // Fetch Karma for both
      const { data: devUser } = await supabase.from('users').select('karma').eq('id', developerId).single();
      const { data: testerUser } = await supabase.from('users').select('karma').eq('id', testerId).single();
      
      // Reward Developer (+0.5)
      if (devUser) {
        await supabase.from('users').update({ karma: (devUser.karma || 0) + 0.5 }).eq('id', developerId);
        await supabase.from('transactions').insert([{
          user_id: developerId,
          type: 'karma_gain',
          currency: 'karma',
          amount: 0.5,
          description: 'Auto-approved daily proof'
        }]);
      }
      
      // Reward Tester (+1)
      if (testerUser) {
        await supabase.from('users').update({ karma: (testerUser.karma || 0) + 1 }).eq('id', testerId);
        await supabase.from('transactions').insert([{
          user_id: testerId,
          type: 'karma_gain',
          currency: 'karma',
          amount: 1,
          description: 'Proof Auto-Approved'
        }]);
      }
      
      // Insert silent notification (no push to avoid waking them up)
      await supabase.from('notifications').insert([{
        user_id: testerId,
        title: 'Proof Auto-Approved',
        body: '⭐ Proof auto-approved! You earned +1 Karma.',
        type: 'new_proof'
      }]);
      
      // If final day
      const numDays = app?.app_type === 'Production' ? 7 : 14;
      if (day.day_number === numDays) {
        await supabase.from('notifications').insert([{
          user_id: testerId,
          title: 'Contract Complete',
          body: `🎉 You successfully tested ${app?.name || 'the app'}. Claim your tokens now!`,
          type: 'testing_finished'
        }]);
      }
      
      approvedCount++;
    }
    
    if (approvedCount === 0) {
      return new Response(JSON.stringify({ 
        message: "No pending proofs to auto-approve", 
        approved: 0,
        debug_global_proofs: allProofDays
      }), { headers: { "Content-Type": "application/json" } });
    }
    
    return new Response(JSON.stringify({ message: "Success", approved: approvedCount }), { headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
