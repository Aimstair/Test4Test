import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { sendNotification, notifyAdmins } from '../utils/notifications';

export const useAdminSettings = () => {
  return useQuery({
    queryKey: ['admin_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is row not found
        console.warn('Failed to fetch admin_settings:', error.message);
      }
      
      // Return defaults if table is empty or missing
      return data || { default_bounty: 10, boost_bounty_bonus: 5 };
    },
  });
};

export const useUpdateAdminSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ default_bounty, boost_bounty_bonus }: { default_bounty: number, boost_bounty_bonus: number }) => {
      const { data, error } = await supabase
        .from('admin_settings')
        .update({ default_bounty, boost_bounty_bonus })
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_settings'] });
    },
  });
};

// Global Events
export const useActiveEvent = () => {
  return useQuery({
    queryKey: ['global_events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_events')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });
};

export const useUpdateActiveEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: any) => {
      const { data, error } = await supabase
        .from('global_events')
        .update(updates)
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global_events'] });
    },
  });
};

export const useEventClaims = () => {
  return useQuery({
    queryKey: ['event_claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_claims')
        .select(`
          id,
          milestone_id,
          reward_title,
          created_at,
          user_id,
          users (
            name,
            id
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) {
        console.error('Error fetching event_claims:', error);
        throw error;
      }
      return data;
    },
  });
};

export const useEventProgress = (userId?: string, eventStartDate?: string) => {
  return useQuery({
    queryKey: ['event_progress', userId, eventStartDate],
    queryFn: async () => {
      if (!userId || !eventStartDate) return { count: 0 };
      
      const { count, error } = await supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('tester_id', userId)
        .gte('created_at', eventStartDate);
        
      if (error) throw error;
      return { count: count || 0 };
    },
    enabled: !!userId && !!eventStartDate,
  });
};

export const useClaimEventReward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, milestoneId, rewardType, rewardAmount, rewardTitle, rewardTier }: { userId: string, milestoneId: string, rewardType: 'tokens'|'membership', rewardAmount: number, rewardTitle: string, rewardTier?: string }) => {
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('claimed_event_milestones, tokens, subscription_expires_at, subscription_tier')
        .eq('id', userId)
        .single();
        
      if (fetchError) throw fetchError;
      
      const claimedList = Array.isArray(user.claimed_event_milestones) ? user.claimed_event_milestones : [];
      if (claimedList.includes(milestoneId)) {
        throw new Error('You have already claimed this milestone!');
      }
      
      const updates: any = {
        claimed_event_milestones: [...claimedList, milestoneId]
      };
      
      if (rewardType === 'tokens') {
        updates.tokens = (user.tokens || 0) + rewardAmount;
      } else if (rewardType === 'membership') {
        const now = new Date();
        const currentEnd = user.subscription_expires_at ? new Date(user.subscription_expires_at) : now;
        
        // If currently subscribed, extend it. If not, start exactly from now.
        const baseDate = currentEnd > now ? currentEnd : now;
        baseDate.setDate(baseDate.getDate() + rewardAmount);
        updates.subscription_expires_at = baseDate.toISOString();

        
        const tierToGrant = rewardTier || 'Pro';
        const currentTier = user.subscription_tier || 'Basic';
        if (currentTier === 'Basic' || (currentTier === 'Pro' && tierToGrant === 'Pro+')) {
          updates.subscription_tier = tierToGrant;
        }
      }
      
      const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId);
        
      if (updateError) throw updateError;
      
      if (rewardType === 'tokens') {
         await supabase.from('transactions').insert([{
            user_id: userId,
            type: 'token_gain',
            currency: 'tokens',
            amount: rewardAmount,
            description: `Event Reward: ${milestoneId}`
          }]);
      }
      
      await supabase.from('event_claims').insert([{
        user_id: userId,
        milestone_id: milestoneId,
        reward_title: rewardTitle
      }]);
      
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['event_claims'] });
    },
  });
};


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

export const useClaimReferral = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ newUserId, referralCode }: { newUserId: string; referralCode: string }) => {
      // Find the referrer by their code
      const { data: referrer, error: findError } = await supabase
        .from('users')
        .select('id, tokens')
        .eq('referral_code', referralCode.toUpperCase())
        .single();

      if (findError || !referrer) {
        throw new Error('Invalid referral code.');
      }
      if (referrer.id === newUserId) {
        throw new Error('You cannot use your own referral code.');
      }

      // Check new user hasn't already been rewarded
      const { data: newUser } = await supabase
        .from('users')
        .select('tokens, referral_rewarded')
        .eq('id', newUserId)
        .single();

      if (newUser?.referral_rewarded) {
        return; // Already claimed, silently skip
      }

      const REFERRAL_BONUS = 50;

      // Award referrer +50 tokens
      await supabase.from('users').update({ tokens: (referrer.tokens || 0) + REFERRAL_BONUS }).eq('id', referrer.id);
      await supabase.from('transactions').insert([{
        user_id: referrer.id,
        type: 'token_gain',
        currency: 'tokens',
        amount: REFERRAL_BONUS,
        description: 'Referral bonus — your invitee completed their first test!',
      }]);

      // Award new user +50 tokens and mark as rewarded
      await supabase.from('users').update({
        tokens: (newUser?.tokens || 0) + REFERRAL_BONUS,
        referred_by: referralCode.toUpperCase(),
        referral_rewarded: true,
      }).eq('id', newUserId);
      await supabase.from('transactions').insert([{
        user_id: newUserId,
        type: 'token_gain',
        currency: 'tokens',
        amount: REFERRAL_BONUS,
        description: 'Referral bonus — you were invited by a friend!',
      }]);

      // Notify referrer
      await supabase.from('notifications').insert([{
        user_id: referrer.id,
        title: 'Referral Bonus Earned! 🎉',
        body: `Your invite just paid off! +${REFERRAL_BONUS} tokens added to your balance.`,
        type: 'subscription',
      }]);

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.newUserId] });
    },
  });
};

export const useReferrals = (referralCode?: string) => {
  return useQuery({
    queryKey: ['referrals', referralCode],
    queryFn: async () => {
      if (!referralCode) return [];
      const { data, error } = await supabase
        .from('users')
        .select('id, name, avatar_url, created_at, referral_rewarded')
        .eq('referred_by', referralCode.toUpperCase())
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    },
    enabled: !!referralCode
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
          contracts(
            id, status, tester_id, app_type,
            contract_days(status, date)
          ),
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
      
      // Step 1: get user's apps
      const { data: apps } = await supabase.from('apps').select('id').eq('owner_id', userId);
      const appIds = apps?.map(a => a.id) || [];
      if (appIds.length === 0) return [];

      // Step 2: get contracts for these apps
      const { data: contracts } = await supabase.from('contracts').select('id').in('app_id', appIds);
      const contractIds = contracts?.map(c => c.id) || [];
      if (contractIds.length === 0) return [];

      // Step 3: get contract_days
      const { data, error } = await supabase
        .from('contract_days')
        .select(`
          *,
          contract:contracts!inner(
            tester:users(name, avatar_url),
            app:apps!inner(name, owner_id, app_type),
            contract_days(id)
          )
        `)
        .eq('status', 'verified')
        .in('contract_id', contractIds);
        
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

      const { data: apps } = await supabase.from('apps').select('id').eq('owner_id', userId);
      const appIds = apps?.map(a => a.id) || [];
      if (appIds.length === 0) return 0;

      const { data: contracts } = await supabase.from('contracts').select('id').in('app_id', appIds);
      const contractIds = contracts?.map(c => c.id) || [];
      if (contractIds.length === 0) return 0;

      const { count, error } = await supabase
        .from('contract_days')
        .select(`id`, { count: 'exact', head: true })
        .eq('status', 'done')
        .in('contract_id', contractIds);
        
      if (error) throw error;
      return count || 0;
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
      
      notifyAdmins('New Dispute', 'A tester appealed a rejected proof.', 'new_proof', proofId);

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
        if (testerData) {
          await supabase.from('users').update({ karma: (testerData.karma || 0) + 1 }).eq('id', testerId);
          await supabase.from('transactions').insert([{ user_id: testerId, type: 'karma_gain', currency: 'karma', amount: 1, description: 'Dispute won (admin overturned)' }]);
        }
        
        const { data: devData } = await supabase.from('users').select('karma').eq('id', developerId).single();
        if (devData) {
          await supabase.from('users').update({ karma: (devData.karma || 0) - 5 }).eq('id', developerId);
          await supabase.from('transactions').insert([{ user_id: developerId, type: 'karma_loss', currency: 'karma', amount: -5, description: 'Dispute lost (admin overturned)' }]);
        }

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
        await supabase.from('contract_days').update({ proof_image_url: proofUrl, status: 'verified' }).eq('id', dayId);
      }
      
      // 2. Save feedback to the contract and mark it completed (Bug 1 Fix)
      const { data, error } = await supabase
        .from('contracts')
        .update({ feedback, status: 'completed' })
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

      // Generate a unique listing_id for this new listing cycle
      const listing_id = `${appData.owner_id}_${Date.now()}`;

      // Insert app
      const { data, error } = await supabase.from('apps').insert([{ 
        ...appData, 
        active: true,
        expires_at: expiresAtStr,
        listing_id,
      }]).select().single();
      
      if (error) {
        // Rollback attempt if app insert fails
        if (tokenCost > 0) {
          const { data: u } = await supabase.from('users').select('tokens').eq('id', appData.owner_id).single();
          if (u) {
            await supabase.from('users').update({ tokens: u.tokens + tokenCost }).eq('id', appData.owner_id);
            await supabase.from('transactions').insert([{ user_id: appData.owner_id, type: 'token_gain', currency: 'tokens', amount: tokenCost, description: 'Token refund (App creation failed)' }]);
          }
        }
        throw error;
      }

      if (data && data.tier === 'Pro+') {
        await supabase.functions.invoke('broadcast-push', {
          body: {
            title: '⭐ Premium App Alert',
            body: `${data.name} is looking for testers! Claim your spot now for ${data.bounty} tokens.`,
            excludeUserId: data.owner_id
          }
        }).catch(err => console.error('Failed to send broadcast push', err));
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

      // Generate a FRESH listing_id so previous testers can re-join this new cycle
      const new_listing_id = `${owner_id}_${Date.now()}`;

      const { data, error } = await supabase.from('apps').update({ 
        tier,
        tester_limit,
        bounty,
        active: true,
        expires_at: expiresAtStr,
        app_type: app_type || 'Testing',
        listing_id: new_listing_id,
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

export const useUpgradeAppTier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, tier, tester_limit, tokenCost, owner_id }: { appId: string, tier: string, tester_limit: number, tokenCost: number, owner_id: string }) => {
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
          description: `Upgraded app ${appId} to ${tier} tier`
        }]);
      }

      const { data, error } = await supabase.from('apps').update({ 
        tier,
        tester_limit
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

      await supabase.functions.invoke('broadcast-push', {
        body: {
          title: '🔥 Hot Opportunity',
          body: `${data.name} is looking for testers! Claim your spot now for 20 tokens.`,
          excludeUserId: ownerId
        }
      }).catch(err => console.error('Failed to send broadcast push', err));

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
      // Snapshot app data (needed for listing_id and owner validation)
      const { data: appData } = await supabase.from('apps').select('boost_ends_at, bounty, name, app_type, owner_id, tester_limit, tier, listing_id').eq('id', appId).single();
      
      // Bug 4 Fix: Prevent developers from testing their own apps
      if (appData?.owner_id === testerId) {
        throw new Error('Developers cannot test their own apps.');
      }

      // Prevent duplicate contracts based on the app_type rules.
      const { data: existingContracts } = await supabase
        .from('contracts')
        .select('id, status, app_type')
        .eq('app_id', appId)
        .eq('tester_id', testerId);

      const hasActive = existingContracts?.some(c => c.status === 'active');
      if (hasActive) {
        throw new Error('You already have an active contract for this app.');
      }

      const hasTesting = existingContracts?.some(c => c.app_type === 'Testing');
      const hasProduction = existingContracts?.some(c => c.app_type === 'Production');

      if (appData?.app_type === 'Testing' && hasTesting) {
        throw new Error('You have already tested this app during its Testing phase. Wait for it to be converted to Production.');
      }
      if (appData?.app_type === 'Production' && hasProduction) {
        throw new Error('You have already completed the Production test for this app.');
      }

      // Fetch dynamic admin settings for rewards
      const { data: adminSettings } = await supabase.from('admin_settings').select('*').eq('id', 1).single();
      const defaultBounty = adminSettings?.default_bounty ?? 10;
      const boostBonus = adminSettings?.boost_bounty_bonus ?? 5;

      const isBoosted = appData?.boost_ends_at && new Date(appData.boost_ends_at) > new Date();
      const bonusBounty = isBoosted ? boostBonus : 0;

      // Create contract, storing the listing_id for future scope checks
      const { data: contract, error } = await supabase
        .from('contracts')
        .insert([{ app_id: appId, tester_id: testerId, bonus_bounty: bonusBounty, rate_proof_url: rateProofUrl, listing_id: appData?.listing_id ?? appId, app_type: appData?.app_type || 'Testing' }])
        .select()
        .single();
      
      if (error) throw error;

      // Automatically dismiss (delete) any open reports for this app since a tester has successfully joined
      await supabase.from('reports').delete().eq('app_id', appId);

      // Payout Tokens instantly on "Claim"
      const totalReward = defaultBounty + bonusBounty;
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
      queryClient.invalidateQueries({ queryKey: ['reports', variables.appId] });
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
          proof_image_url: proofUrl,
          reject_reason: null // Clear reason on re-upload (Bug 5 Fix)
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

      // Referral reward: trigger on Day 1 (the first proof submitted by a new user)
      if (dayNumber === 1 && testerId) {
        const { data: testerData } = await supabase
          .from('users')
          .select('referred_by, referral_rewarded, tokens')
          .eq('id', testerId)
          .single();

        if (testerData?.referred_by && !testerData.referral_rewarded) {
          // Find referrer
          const { data: referrer } = await supabase
            .from('users')
            .select('id, tokens')
            .eq('referral_code', testerData.referred_by)
            .single();

          if (referrer) {
            const BONUS = 50;
            // Reward referrer
            await supabase.from('users').update({ tokens: (referrer.tokens || 0) + BONUS }).eq('id', referrer.id);
            await supabase.from('transactions').insert([{ user_id: referrer.id, type: 'token_gain', currency: 'tokens', amount: BONUS, description: 'Referral bonus — your invitee completed their first test!' }]);
            await supabase.from('notifications').insert([{ user_id: referrer.id, title: 'Referral Bonus Earned! 🎉', body: `Your invite just paid off! +${BONUS} tokens added to your balance.`, type: 'subscription' }]);
            // Reward new user + mark rewarded
            await supabase.from('users').update({ tokens: (testerData.tokens || 0) + BONUS, referral_rewarded: true }).eq('id', testerId);
            await supabase.from('transactions').insert([{ user_id: testerId, type: 'token_gain', currency: 'tokens', amount: BONUS, description: 'Referral bonus — you were invited by a friend!' }]);
          }
        }
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
      // Check if user already reported this app
      const { data: existing, error: checkError } = await supabase
        .from('reports')
        .select('id')
        .eq('app_id', reportData.app_id)
        .eq('reporter_id', reportData.reporter_id)
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error('You have already reported this app.');
      }

      const { data, error } = await supabase.from('reports').insert([reportData]).select().single();
      if (error) throw error;

      // Fetch the app to find owner
      const { data: appData } = await supabase.from('apps').select('owner_id, name').eq('id', reportData.app_id).single();
      if (appData) {
        let notificationBody = `Your app "${appData.name}" has been reported by a user.`;
        if (reportData.title === 'Item not Found') {
          notificationBody = `Your app "${appData.name}" was reported as 'Item not Found'. Please ensure you have added the Google Group email to your tester list.`;
        } else if (reportData.title === "Isn't Available in my Country") {
          notificationBody = `Your app "${appData.name}" was reported as 'Isn't Available in my Country'. Please make the app available to all countries in the Play Console.`;
        } else if (reportData.title === "Paid App") {
          notificationBody = `Your app "${appData.name}" was reported as a 'Paid App'. Please provide a discount code or make the app free for testers.`;
        }

        sendNotification(appData.owner_id, 'App Reported', notificationBody, 'report', data.id);
        notifyAdmins('App Reported', `The app "${appData.name}" has been reported and requires moderation.`, 'report', data.id);
      }

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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support_tickets', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
      notifyAdmins('New Support Ticket', `A user opened a new ticket: ${variables.title}`, 'support', data.id);
    },
  });
};

export const useReplyToTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (replyData: { ticket_id: string, sender_id: string, message: string }) => {
      const { data, error } = await supabase.from('ticket_replies').insert([replyData]).select().single();
      if (error) throw error;

      // Fetch ticket to determine who should be notified
      const { data: ticket } = await supabase.from('support_tickets').select('user_id').eq('id', replyData.ticket_id).single();
      if (ticket) {
        if (replyData.sender_id === ticket.user_id) {
          notifyAdmins('Ticket Reply', 'A user replied to their support ticket.', 'support', replyData.ticket_id);
        } else {
          sendNotification(ticket.user_id, 'Ticket Update', 'An admin replied to your support ticket.', 'support', replyData.ticket_id);
        }
      }

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
          owner:users(name, karma, role),
          contracts(id, status)
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

export const useUpdateApp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, updates }: { appId: string, updates: Partial<{ name: string, blurb: string, icon_url: string, geo_targets: string[] }> }) => {
      const { data, error } = await supabase
        .from('apps')
        .update(updates)
        .eq('id', appId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
};
