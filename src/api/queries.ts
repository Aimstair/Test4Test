import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../utils/notifications';


export const useUserProfile = (userId?: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useUpdateAutoApprove = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, autoApproveEnabled }: { userId: string, autoApproveEnabled: boolean }) => {
      const { data, error } = await supabase
        .from('users')
        .update({ auto_approve_enabled: autoApproveEnabled })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
    },
  });
};

export const useCatalog = () => {
  return useQuery({
    queryKey: ['apps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select(`
          *,
          contracts(id, status, tester_id),
          owner:users(name, karma, avatar_url, subscription_tier),
          reviews(rating)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Enforce live app limits per owner dynamically
      const ownerLiveCount: Record<string, number> = {};
      
      // Sort apps by priority:
      // 1. Boosted (longer duration first)
      // 2. Created at (older first)
      const sortedApps = [...data].sort((a, b) => {
        const aBoosted = a.boost_ends_at && new Date(a.boost_ends_at) > new Date();
        const bBoosted = b.boost_ends_at && new Date(b.boost_ends_at) > new Date();
        
        if (aBoosted && !bBoosted) return -1;
        if (!aBoosted && bBoosted) return 1;
        
        if (aBoosted && bBoosted) {
          return new Date(b.boost_ends_at).getTime() - new Date(a.boost_ends_at).getTime();
        }
        
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const processedApps = sortedApps.map(app => {
        if (app.active === false) return app;

        const limit = app.owner?.subscription_tier === 'Pro+' ? 10 : app.owner?.subscription_tier === 'Pro' ? 5 : 1;
        
        if (!ownerLiveCount[app.owner_id]) ownerLiveCount[app.owner_id] = 0;
        
        if (ownerLiveCount[app.owner_id] < limit) {
          ownerLiveCount[app.owner_id]++;
          return app;
        } else {
          // Exceeds limit, mark as inactive dynamically
          return { ...app, active: false };
        }
      });
      
      // Restore original created_at descending sort
      processedApps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return processedApps;
    },
  });
};

export const useAppMetrics = (appId?: string) => {
  return useQuery({
    queryKey: ['appMetrics', appId],
    queryFn: async () => {
      if (!appId) throw new Error('No app ID');
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          contract_days(*),
          tester:users(name, avatar_url)
        `)
        .eq('app_id', appId);
      if (error) throw error;
      return data;
    },
    enabled: !!appId,
  });
};

export const useContracts = (userId?: string) => {
  return useQuery({
    queryKey: ['contracts', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      // Fetch contracts for user where they are either tester OR the app owner
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          app:apps(*),
          days:contract_days(*)
        `)
        .eq('tester_id', userId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useNotifications = (userId?: string) => {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useTransactions = (userId?: string) => {
  return useQuery({
    queryKey: ['transactions', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useProofQueue = (userId?: string) => {
  return useQuery({
    queryKey: ['proofQueue', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      const { data, error } = await supabase
        .from('contract_days')
        .select(`
          *,
          contract:contracts!inner(
            tester:users(name),
            app:apps!inner(name, owner_id)
          )
        `)
        .eq('status', 'verified')
        .eq('contract.app.owner_id', userId);
        
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useApprovedProofsCount = (userId?: string) => {
  return useQuery({
    queryKey: ['approvedProofs', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      const { count, error } = await supabase
        .from('contract_days')
        .select(`
          id,
          contract:contracts!inner(
            app:apps!inner(owner_id)
          )
        `, { count: 'exact', head: true })
        .eq('status', 'done')
        .eq('contract.app.owner_id', userId);
        
      if (error) throw error;
      return count;
    },
    enabled: !!userId,
  });
};

export const useReviewProof = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, developerId, reason }: { id: string, status: 'approved' | 'rejected', developerId?: string, reason?: string }) => {
      const dbStatus = status === 'approved' ? 'done' : 'rejected';
      const payload: any = { status: dbStatus };
      if (status === 'rejected' && reason) {
        payload.reject_reason = reason;
      }
      const { data, error } = await supabase
        .from('contract_days')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Get the contract info for notification and karma
      const { data: cData } = await supabase.from('contracts').select('tester_id, apps(name, app_type)').eq('id', data.contract_id).single();
      
      if (status === 'approved') {
        // Award developer karma
        if (developerId) {
          const { data: devData } = await supabase.from('users').select('karma').eq('id', developerId).single();
          if (devData) {
            await supabase.from('users').update({ karma: (devData.karma || 0) + 0.5 }).eq('id', developerId);
            await supabase.from('transactions').insert([{
              user_id: developerId,
              type: 'karma_gain',
              currency: 'karma',
              amount: 0.5,
              description: 'Approved daily proof'
            }]);
          }
        }
        
        // Award tester karma
        if (cData?.tester_id) {
          const { data: testerData } = await supabase.from('users').select('karma').eq('id', cData.tester_id).single();
          if (testerData) {
            await supabase.from('users').update({ karma: (testerData.karma || 0) + 1 }).eq('id', cData.tester_id);
            await supabase.from('transactions').insert([{
              user_id: cData.tester_id,
              type: 'karma_gain',
              currency: 'karma',
              amount: 1,
              description: 'Proof Approved'
            }]);
          }
        }
      }

      if (cData) {
        const notifMsg = status === 'approved' 
          ? '⭐ Proof approved! You earned +1 Karma.' 
          : `🛑 Action Required: Proof rejected${reason ? `: ${reason}` : '. Please upload a clearer image.'}`;

        sendNotification(
          cData.tester_id,
          status === 'approved' ? 'Proof Approved' : 'Proof Rejected',
          notifMsg,
          'new_proof',
          developerId
        );

        if (status === 'approved') {
          const appName = (cData.apps as any)?.name || 'the app';
          const numDays = (cData.apps as any)?.app_type === 'Production' ? 7 : 14;
          if (data.day_number === numDays) {
            sendNotification(
              cData.tester_id,
              'Contract Complete',
              `🎉 You successfully tested ${appName}. Claim your tokens now!`,
              'testing_finished'
            );
          }
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proofQueue'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['approvedProofs'] });
      if (variables.developerId) {
        queryClient.invalidateQueries({ queryKey: ['user', variables.developerId] });
      }
    },
  });
};

export const useDisputeProof = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proofId: string) => {
      const { data, error } = await supabase
        .from('contract_days')
        .update({ disputed: true })
        .eq('id', proofId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['proofQueue'] });
    },
  });
};

export const useAdminDisputes = () => {
  return useQuery({
    queryKey: ['adminDisputes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_days')
        .select(`
          *,
          contract:contracts(
            app:apps(name, owner:users(id, name, avatar_url)),
            tester:users(id, name, avatar_url)
          )
        `)
        .eq('disputed', true)
        .eq('status', 'rejected')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useAdminResolveDispute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ proofId, action, testerId, developerId }: { proofId: string, action: 'uphold' | 'overturn', testerId: string, developerId: string }) => {
      if (action === 'overturn') {
        // Tester wins: Set status to done, give tester +1 karma, penalize developer -5 karma
        await supabase.from('contract_days').update({ status: 'done', disputed: false }).eq('id', proofId);
        
        const { data: testerData } = await supabase.from('users').select('karma').eq('id', testerId).single();
        if (testerData) await supabase.from('users').update({ karma: (testerData.karma || 0) + 1 }).eq('id', testerId);
        
        const { data: devData } = await supabase.from('users').select('karma').eq('id', developerId).single();
        if (devData) await supabase.from('users').update({ karma: (devData.karma || 0) - 5 }).eq('id', developerId);

        sendNotification(testerId, 'Dispute Won', 'Admin overturned the rejection. +1 Karma.', 'new_proof');
        sendNotification(developerId, 'Dispute Lost', 'Admin overturned your rejection. -5 Karma penalty.', 'new_proof');
      } else {
        // Developer wins: Un-dispute it, keep rejected
        await supabase.from('contract_days').update({ disputed: false }).eq('id', proofId);
        sendNotification(testerId, 'Dispute Lost', 'Admin upheld the rejection.', 'new_proof');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDisputes'] });
    },
  });
};

// --- Mutations ---

export const useSubmitFinalSurvey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, dayId, proofUrl, feedback }: { contractId: string, dayId: string, proofUrl?: string, feedback: { rating: number, bugs: string, general: string } }) => {
      // 1. Upload proof for Day 14
      if (proofUrl) {
        await supabase.from('contract_days').update({ proof_image_url: proofUrl, status: 'pending' }).eq('id', dayId);
      }
      
      // 2. Save feedback to the contract
      const { data, error } = await supabase
        .from('contracts')
        .update({ feedback })
        .eq('id', contractId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
};

export const useCreateApp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appData, tokenCost, subscriptionTier }: { appData: any, tokenCost: number, subscriptionTier?: string }) => {
      // Get current user tokens
      if (tokenCost > 0) {
        const { data: user, error: userError } = await supabase.from('users').select('tokens').eq('id', appData.owner_id).single();
        if (userError) throw userError;
        if (!user || user.tokens < tokenCost) {
          throw new Error('Insufficient tokens.');
        }
        
        // Deduct tokens
        const { error: deductError } = await supabase.from('users').update({ tokens: user.tokens - tokenCost }).eq('id', appData.owner_id);
        if (deductError) throw deductError;

        await supabase.from('transactions').insert([{
          user_id: appData.owner_id,
          type: 'token_loss',
          currency: 'token',
          amount: -tokenCost,
          description: `Created app ${appData.name}`
        }]);
      }

      let days = 14;
      if (appData.tier === 'Pro') days = 20;
      if (appData.tier === 'Pro+') days = 30;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      const expiresAtStr = expiresAt.toISOString();

      // Insert app
      const { data, error } = await supabase.from('apps').insert([{ 
        ...appData, 
        active: true,
        expires_at: expiresAtStr
      }]).select().single();
      
      if (error) {
        // Rollback attempt if app insert fails
        if (tokenCost > 0) {
          const { data: u } = await supabase.from('users').select('tokens').eq('id', appData.owner_id).single();
          if (u) {
            await supabase.from('users').update({ tokens: u.tokens + tokenCost }).eq('id', appData.owner_id);
          }
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.appData.owner_id] });
    },
  });
};

export const useRenewApp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, tier, tester_limit, bounty, tokenCost, owner_id, subscriptionTier, app_type }: { appId: string, tier: string, tester_limit: number, bounty: number, tokenCost: number, owner_id: string, subscriptionTier?: string, app_type?: string }) => {
      if (tokenCost > 0) {
        const { data: user, error: userError } = await supabase.from('users').select('tokens').eq('id', owner_id).single();
        if (userError) throw userError;
        if (!user || user.tokens < tokenCost) {
          throw new Error('Insufficient tokens.');
        }
        const { error: deductError } = await supabase.from('users').update({ tokens: user.tokens - tokenCost }).eq('id', owner_id);
        if (deductError) throw deductError;
        
        await supabase.from('transactions').insert([{
          user_id: owner_id,
          type: 'token_loss',
          currency: 'token',
          amount: -tokenCost,
          description: `Renewed app ${appId}`
        }]);
      }

      let days = 14;
      if (tier === 'Pro') days = 20;
      if (tier === 'Pro+') days = 30;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      const expiresAtStr = expiresAt.toISOString();

      const { data, error } = await supabase.from('apps').update({ 
        tier,
        tester_limit,
        bounty,
        active: true,
        expires_at: expiresAtStr,
        app_type: app_type || 'Testing'
      }).eq('id', appId).select().single();
      
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.owner_id] });
    },
  });
};

export const usePurchaseSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, tier }: { userId: string, tier: 'Pro' | 'Pro+' }) => {
      const { data: user, error: userError } = await supabase.from('users').select('karma').eq('id', userId).single();
      if (userError) throw userError;

      let karmaBonus = 0;
      if (tier === 'Pro') karmaBonus = 100;
      if (tier === 'Pro+') karmaBonus = 200;

      const { data, error } = await supabase
        .from('users')
        .update({ 
          subscription_tier: tier,
          karma: (user.karma || 0) + karmaBonus
        })
        .eq('id', userId)
        .select()
        .single();
        
      if (error) throw error;
      
      await supabase.from('transactions').insert([{
        user_id: userId,
        type: 'karma_gain',
        currency: 'karma',
        amount: karmaBonus,
        description: `Subscription Bonus (${tier})`
      }]);

      sendNotification(userId, 'Subscription Active', `You successfully upgraded to ${tier}.`, 'subscription', userId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
    },
  });
};

export const usePurchaseTokens = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, amount }: { userId: string, amount: number }) => {
      const { data: user, error: userError } = await supabase.from('users').select('tokens').eq('id', userId).single();
      if (userError) throw userError;

      const { data, error } = await supabase
        .from('users')
        .update({ 
          tokens: (user.tokens || 0) + amount
        })
        .eq('id', userId)
        .select()
        .single();
        
      if (error) throw error;
      
      await supabase.from('transactions').insert([{
        user_id: userId,
        type: 'token_gain',
        currency: 'token',
        amount: amount,
        description: `Purchased Token Pack`
      }]);

      sendNotification(userId, 'Tokens Purchased', `You successfully purchased ${amount} tokens.`, 'subscription', userId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
    },
  });
};

export const useToggleAppStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, active }: { appId: string, active: boolean }) => {
      const { data, error } = await supabase
        .from('apps')
        .update({ active })
        .eq('id', appId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
};

export const useBoostApp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, ownerId, days }: { appId: string, ownerId: string, days: number }) => {
      const tokenCost = days * 20;
      
      // 1. Get user to check tokens
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('tokens')
        .eq('id', ownerId)
        .single();
        
      if (userError) throw userError;
      if (!user || user.tokens < tokenCost) {
        throw new Error(`Insufficient tokens. You need ${tokenCost} tokens to boost for ${days} days.`);
      }

      // 2. Deduct tokens
      await supabase.from('users').update({ tokens: user.tokens - tokenCost }).eq('id', ownerId);

      // 3. Log transaction
      await supabase.from('transactions').insert([{
        user_id: ownerId,
        type: 'token_spend',
        currency: 'tokens',
        amount: -tokenCost,
        description: `Boosted app for ${days} days`
      }]);

      // 4. Update app's boost_ends_at
      const { data: appData } = await supabase.from('apps').select('boost_ends_at').eq('id', appId).single();
      const currentBoostEnd = appData?.boost_ends_at ? new Date(appData.boost_ends_at) : new Date();
      const baseDate = currentBoostEnd > new Date() ? currentBoostEnd : new Date();
      baseDate.setDate(baseDate.getDate() + days);

      const { data, error } = await supabase
        .from('apps')
        .update({ boost_ends_at: baseDate.toISOString() })
        .eq('id', appId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.ownerId] });
    },
  });
};

export const useStartContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, testerId, proofUrl, rateProofUrl }: { appId: string; testerId: string; proofUrl?: string; rateProofUrl?: string }) => {
      // Prevent duplicate active contracts for the same app+tester
      const { data: existing } = await supabase
        .from('contracts')
        .select('id')
        .eq('app_id', appId)
        .eq('tester_id', testerId)
        .eq('status', 'active')
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error('You already have an active test contract for this app.');
      }

      // Snapshot bonus_bounty if app is currently boosted
      const { data: appData } = await supabase.from('apps').select('boost_ends_at, bounty, name, app_type, owner_id, tester_limit, tier').eq('id', appId).single();
      const isBoosted = appData?.boost_ends_at && new Date(appData.boost_ends_at) > new Date();
      const bonusBounty = isBoosted ? 10 : 0;

      // Create contract (no token escrow — tokens are only earned, never locked)
      const { data: contract, error } = await supabase
        .from('contracts')
        .insert([{ app_id: appId, tester_id: testerId, bonus_bounty: bonusBounty, rate_proof_url: rateProofUrl }])
        .select()
        .single();
      
      if (error) throw error;

      // Payout Tokens instantly on "Claim"
      const totalReward = (appData?.bounty || 0) + bonusBounty;
      if (totalReward > 0) {
        const { data: testerData } = await supabase.from('users').select('tokens').eq('id', testerId).single();
        if (testerData) {
          await supabase.from('users').update({ tokens: (testerData.tokens || 0) + totalReward }).eq('id', testerId);
          await supabase.from('transactions').insert([{
            user_id: testerId,
            type: 'token_gain',
            currency: 'tokens',
            amount: totalReward,
            description: `Testing Onboarding for ${appData?.name || 'app'}`
          }]);
        }
      }

      // Generate contract days (14 for Testing, 7 for Production)
      const numDays = appData?.app_type === 'Production' ? 7 : 14;
      const days = Array.from({ length: numDays }).map((_, i) => ({
        contract_id: contract.id,
        day_number: i + 1,
        date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
        status: i === 0 && proofUrl ? 'verified' : (i === 0 ? 'partial' : 'future'),
        proof_image_url: i === 0 && proofUrl ? proofUrl : null,
      }));

      const { error: daysError } = await supabase.from('contract_days').insert(days);
      if (daysError) throw daysError;

      if (appData) {
        // Notifications
        sendNotification(appData.owner_id, 'New Tester', `A new tester joined ${appData.name}.`, 'new_tester', testerId);
        
        // Check if reached capacity
        const { count } = await supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('app_id', appId).eq('status', 'active');
        if (count && count >= appData.tester_limit) {
          sendNotification(appData.owner_id, 'App Full', `${appData.name} has reached its tester limit.`, 'app_full', testerId);
        }
      }

      return contract;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts', variables.testerId] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.testerId] });
    },
  });
};

export const useUploadProof = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, dayNumber, proofUrl, testerId }: { contractId: string, dayNumber: number, proofUrl: string, testerId?: string }) => {
      const { data, error } = await supabase
        .from('contract_days')
        .update({ 
          status: 'verified', 
          proof_image_url: proofUrl
        })
        .match({ contract_id: contractId, day_number: dayNumber })
        .select()
        .single();
      if (error) throw error;

      // Status updated to verified. Karma will be awarded when approved by developer.

      const { data: contract } = await supabase.from('contracts').select('app_id, apps(owner_id)').eq('id', contractId).single();
      if (contract && (contract.apps as any)?.owner_id) {
        sendNotification((contract.apps as any).owner_id, 'Proof Submitted', 'A tester submitted a proof for review.', 'new_proof', testerId);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      if (variables.testerId) {
        queryClient.invalidateQueries({ queryKey: ['user', variables.testerId] });
      }
    },
  });
};

export const useForfeitContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await supabase
        .from('contracts')
        .update({ status: 'failed' })
        .eq('id', contractId)
        .select('*, apps(name, owner_id)')
        .single();
      if (error) throw error;

      if ((data.apps as any)?.owner_id) {
        sendNotification(
          (data.apps as any).owner_id, 
          'Tester Dropped Off', 
          `Notice: A tester dropped off from ${(data.apps as any).name}.`, 
          'testing_finished'
        );
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', data.user_id] });
    },
  });
};

export const useReviews = (appId?: string) => {
  return useQuery({
    queryKey: ['reviews', appId],
    queryFn: async () => {
      if (!appId) throw new Error('No app ID');
      const { data, error } = await supabase
        .from('reviews')
        .select('*, reviewer:users(id, name, avatar_url)')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!appId,
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reviewData: { app_id: string, reviewer_id: string, rating: number, content: string }) => {
      // Verify reviewer is/was a tester of this app
      const { data: contracts } = await supabase
        .from('contracts')
        .select('id')
        .eq('app_id', reviewData.app_id)
        .eq('tester_id', reviewData.reviewer_id)
        .limit(1);

      if (!contracts || contracts.length === 0) {
        throw new Error('Only testers of this app can leave reviews.');
      }

      // Prevent duplicate reviews (1 review per app per user)
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('app_id', reviewData.app_id)
        .eq('reviewer_id', reviewData.reviewer_id)
        .limit(1);

      if (existingReview && existingReview.length > 0) {
        throw new Error('You have already reviewed this app.');
      }

      const { data, error } = await supabase.from('reviews').insert([reviewData]).select().single();
      if (error) throw error;

      const { data: appData } = await supabase.from('apps').select('owner_id, name').eq('id', reviewData.app_id).single();

      // Award +5 tokens for posting a review
      const { data: userData } = await supabase.from('users').select('tokens').eq('id', reviewData.reviewer_id).single();
      if (userData) {
        await supabase.from('users').update({ tokens: (userData.tokens || 0) + 5 }).eq('id', reviewData.reviewer_id);
        
        await supabase.from('transactions').insert([{
          user_id: reviewData.reviewer_id,
          type: 'token_gain',
          currency: 'token',
          amount: 5,
          description: `Review Bounty for ${appData?.name || 'app'}`
        }]);
      }

      if (appData) {
        sendNotification(appData.owner_id, 'New Review', `A tester left a review on ${appData.name}.`, 'new_review', reviewData.reviewer_id);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', variables.app_id] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.reviewer_id] });
    },
  });
};

export const useReports = (appId?: string) => {
  return useQuery({
    queryKey: ['reports', appId],
    queryFn: async () => {
      if (!appId) throw new Error('No app ID');
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!appId,
  });
};

export const useCreateReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportData: { app_id: string, reporter_id: string, type: string, title: string, description?: string, file_url?: string }) => {
      const { data, error } = await supabase.from('reports').insert([reportData]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reports', variables.app_id] });
    },
  });
};

export const useSupportTickets = (userId?: string, isAdmin?: boolean) => {
  return useQuery({
    queryKey: ['support_tickets', userId, isAdmin],
    queryFn: async () => {
      let query = supabase.from('support_tickets').select('*, user:users(id, name, avatar_url, role)').order('created_at', { ascending: false });
      if (!isAdmin && userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!userId || isAdmin,
  });
};

export const useTicketReplies = (ticketId?: string) => {
  return useQuery({
    queryKey: ['ticket_replies', ticketId],
    queryFn: async () => {
      if (!ticketId) throw new Error('No ticket ID');
      const { data, error } = await supabase
        .from('ticket_replies')
        .select('*, sender:users(id, name, avatar_url, role)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticketData: { user_id: string, category: string, title: string, description: string }) => {
      const { data, error } = await supabase.from('support_tickets').insert([ticketData]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support_tickets', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
    },
  });
};

export const useReplyToTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (replyData: { ticket_id: string, sender_id: string, message: string }) => {
      const { data, error } = await supabase.from('ticket_replies').insert([replyData]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket_replies', variables.ticket_id] });
    },
  });
};

export const useUpdateTicketStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticket_id, status }: { ticket_id: string, status: string }) => {
      const { data, error } = await supabase.from('support_tickets').update({ status }).eq('id', ticket_id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
    },
  });
};

export const useAdminUsers = (isAdmin?: boolean) => {
  return useQuery({
    queryKey: ['admin_users', isAdmin],
    queryFn: async () => {
      if (!isAdmin) throw new Error('Unauthorized');
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });
};

export const useAdminUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, updates }: { user_id: string, updates: any }) => {
      const { data, error } = await supabase.from('users').update(updates).eq('id', user_id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};

export const useUserStats = (userId?: string, karma?: number) => {
  return useQuery({
    queryKey: ['user_stats', userId, karma],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      
      // 1. Get apps count
      const { count: appsCount, error: appsErr } = await supabase
        .from('apps')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', userId);
        
      // 2. Get tested count (unique apps user has contracts for)
      const { data: contracts, error: testedErr } = await supabase
        .from('contracts')
        .select('app_id')
        .eq('tester_id', userId);
        
      const testedCount = contracts ? new Set(contracts.map(c => c.app_id)).size : 0;
      
      // 3. Get rank percentile
      let rankPercentile = 100;
      if (karma !== undefined) {
        const { count: totalCount, error: totalErr } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });
          
        const { count: higherCount, error: higherErr } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gt('karma', karma);
          
        if (totalCount && higherCount !== null) {
          const rank = higherCount + 1;
          rankPercentile = Math.max(1, Math.ceil((rank / totalCount) * 100));
        }
      }
      
      return {
        appsCount: appsCount || 0,
        testedCount,
        rankPercentile
      };
    },
    enabled: !!userId,
  });
};

// --- Admin Queries ---

export const useAdminApps = () => {
  return useQuery({
    queryKey: ['admin_apps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select(`
          *,
          owner:users(name, karma, role)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useAdminToggleAppStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, banned }: { appId: string, banned: boolean }) => {
      // If banning, also set active to false. If unbanning, leave active as is.
      const payload: any = { banned };
      if (banned) payload.active = false;
      
      const { data, error } = await supabase
        .from('apps')
        .update(payload)
        .eq('id', appId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_apps'] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
};

export const useAdminDeleteApp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: string) => {
      const { error } = await supabase
        .from('apps')
        .delete()
        .eq('id', appId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_apps'] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
};
