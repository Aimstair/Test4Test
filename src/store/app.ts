import { create } from 'zustand';

export type User = {
  karma: number;
  tokens: number;
  escrow: number;
  device: string;
  os: string;
  country: string;
  onboarded: boolean;
  subscriptionTier: 'Basic' | 'Pro' | 'Pro+';
};

export type ContractStatus = 'future' | 'partial' | 'done' | 'missed' | 'rejected';

export type ContractDay = {
  dayNumber: number; // 1 to 14
  status: ContractStatus;
  dateStr: string; // ISO date string of the specific day
};

export type Contract = {
  id: string;
  appId: string;
  startDate: string;
  days: ContractDay[];
  status: 'active' | 'completed' | 'forfeited';
};

export type AppListing = {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  bounty: number;
  tier: 'Basic' | 'Pro' | 'Pro+';
  ownerId: string;
  ownerName: string;
  ownerKarma: number;
  testerLimit: number;
  geoTargets: string[];
  osRequirements: string[];
  status: 'Live' | 'Delisted' | 'Paused';
  internalTestUrl: string;
};

export type TransactionType = 'token_gain' | 'token_lose' | 'karma_gain' | 'karma_lose';

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  dateStr: string;
  description: string;
};

export type ProofItem = {
  id: string;
  appId: string;
  appName: string;
  testerName: string;
  testerInitials: string;
  duration: number;
  timeStr: string;
  deviceStr: string;
  locationStr: string;
};

interface AppState {
  user: User;
  contracts: Contract[];
  catalog: AppListing[];
  ownedAppIds: string[];
  transactions: Transaction[];
  proofQueue: ProofItem[];
  appearance: 'dark' | 'light';
  notificationsEnabled: boolean;

  // Actions
  setOnboarded: (onboarded: boolean) => void;
  setAppearance: (appearance: 'dark' | 'light') => void;
  toggleNotifications: () => void;
  buyTokens: (amount: number, cost: number) => void;
  createListing: (listing: Omit<AppListing, 'id' | 'ownerId' | 'ownerName' | 'ownerKarma' | 'status'>) => void;
  commitToTest: (appId: string) => void;
  launchApp: (contractId: string, dayNumber: number) => void;
  uploadProof: (contractId: string, dayNumber: number, proofUrl: string) => void;
  claimReward: (contractId: string, dayNumber: number) => void;
  approveProof: (proofId: string) => void;
  rejectProof: (proofId: string) => void;
}

// Mock Data
const MOCK_CATALOG: AppListing[] = [
  {
    id: 'app-1',
    name: 'HabitTracker Pro',
    icon: '🎯',
    blurb: 'A new way to build habits with friends.',
    bounty: 50,
    tier: 'Pro',
    ownerId: 'user-2',
    ownerName: 'Alex.Dev',
    ownerKarma: 92,
    testerLimit: 10,
    geoTargets: ['US', 'UK', 'CA'],
    osRequirements: ['iOS', 'Android'],
    status: 'Live',
    internalTestUrl: 'https://testflight.apple.com/join/habittracker',
  },
  {
    id: 'app-2',
    name: 'Zenith Weather',
    icon: '☁️',
    blurb: 'Hyper-local weather with gorgeous minimalist UI.',
    bounty: 120,
    tier: 'Pro+',
    ownerId: 'user-3',
    ownerName: 'CloudNine',
    ownerKarma: 98,
    testerLimit: 5,
    geoTargets: ['Global'],
    osRequirements: ['iOS'],
    status: 'Live',
    internalTestUrl: 'https://testflight.apple.com/join/zenith',
  },
  {
    id: 'app-3',
    name: 'Focus Flow',
    icon: '⏳',
    blurb: 'Pomodoro timer for ADHD.',
    bounty: 30,
    tier: 'Basic',
    ownerId: 'user-4',
    ownerName: 'NeuroTech',
    ownerKarma: 75,
    testerLimit: 20,
    geoTargets: ['US'],
    osRequirements: ['Android'],
    status: 'Live',
    internalTestUrl: 'https://play.google.com/apps/testing/com.focusflow',
  },
];

export const useAppStore = create<AppState>((set) => ({
  user: {
    karma: 42.5,
    tokens: 280,
    escrow: 50,
    device: 'Pixel 7',
    os: 'Android 14',
    country: 'US',
    onboarded: true,
    subscriptionTier: 'Basic',
  },
  contracts: [],
  catalog: MOCK_CATALOG,
  ownedAppIds: [],
  transactions: [],
  proofQueue: [
    {
      id: 'proof-1',
      appId: 'app-1',
      appName: 'HabitTracker Pro',
      testerName: 'Alex',
      testerInitials: 'AX',
      duration: 65,
      timeStr: '11:42 PM UTC',
      deviceStr: 'Pixel 8 Pro',
      locationStr: 'London, UK',
    },
    {
      id: 'proof-2',
      appId: 'app-2',
      appName: 'Zenith Weather',
      testerName: 'Sarah',
      testerInitials: 'SR',
      duration: 82,
      timeStr: '09:15 AM UTC',
      deviceStr: 'Samsung S24',
      locationStr: 'Toronto, CA',
    }
  ],
  appearance: 'light',
  notificationsEnabled: true,

  setOnboarded: (onboarded) =>
    set((state) => ({ user: { ...state.user, onboarded } })),

  setAppearance: (appearance) => set({ appearance }),
  
  toggleNotifications: () =>
    set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

  buyTokens: (amount, cost) =>
    set((state) => {
      const newTokens = state.user.tokens + amount;
      const tx: Transaction = {
        id: Math.random().toString(),
        type: 'token_gain',
        amount,
        dateStr: new Date().toISOString(),
        description: `Purchased ${amount} tokens`,
      };
      return {
        user: { ...state.user, tokens: newTokens },
        transactions: [tx, ...state.transactions],
      };
    }),

  createListing: (listing) =>
    set((state) => {
      // Deduct bounty * 14 from tokens
      const totalCost = listing.bounty * 14;
      if (state.user.tokens < totalCost) return state; // Or handle error

      const newListing: AppListing = {
        ...listing,
        id: `app-${Math.random().toString()}`,
        ownerId: 'me',
        ownerName: 'You',
        ownerKarma: state.user.karma,
        status: 'Live',
      };

      const tx: Transaction = {
        id: Math.random().toString(),
        type: 'token_lose',
        amount: totalCost,
        dateStr: new Date().toISOString(),
        description: `Funded contract for ${newListing.name}`,
      };

      return {
        user: { ...state.user, tokens: state.user.tokens - totalCost },
        catalog: [...state.catalog, newListing],
        ownedAppIds: [...state.ownedAppIds, newListing.id],
        transactions: [tx, ...state.transactions],
      };
    }),

  commitToTest: (appId) =>
    set((state) => {
      const app = state.catalog.find((a) => a.id === appId);
      if (!app) return state;

      const days: ContractDay[] = Array.from({ length: 14 }).map((_, i) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + i);
        return {
          dayNumber: i + 1,
          status: 'future',
          dateStr: date.toISOString(),
        };
      });

      // Today's day is day 1, make it partial for testing or keep future
      // Actually let's make day 1 'future' until launched

      const newContract: Contract = {
        id: `contract-${Math.random().toString()}`,
        appId,
        startDate: new Date().toISOString(),
        days,
        status: 'active',
      };

      // Add to escrow (we earn this over time)
      // Actually we don't pay tokens to test, we EARN them.
      // Wait, "commitToTest CTA -> locks tokens into escrow, creates a fresh 14-day contract".
      // Wait, "Tokens - Spent to list your app, earned by testing others' apps. Escrow - tokens locked while a contract is active, released as you complete days."
      // Ah, the DEVELOPER locks tokens in escrow? Or does the TESTER lock tokens as a stake?
      // "commitToTest CTA -> locks tokens into escrow" 
      // If tester locks tokens, it's a stake. Let's assume the tester stakes 0 tokens, and the reward goes into escrow and is released daily.
      // Or maybe the tester stakes some tokens. Let's just track the total reward in escrow.
      const totalReward = app.bounty * 14;

      return {
        user: { ...state.user, escrow: state.user.escrow + totalReward },
        contracts: [...state.contracts, newContract],
      };
    }),

  launchApp: (contractId, dayNumber) =>
    set((state) => {
      const contracts = state.contracts.map((c) => {
        if (c.id !== contractId) return c;
        const days = c.days.map((d) => {
          if (d.dayNumber === dayNumber && d.status === 'future') {
            return { ...d, status: 'partial' as ContractStatus };
          }
          return d;
        });
        return { ...c, days };
      });
      return { contracts };
    }),

  uploadProof: (contractId, dayNumber, proofUrl) =>
    set((state) => {
      const contracts = state.contracts.map((c) => {
        if (c.id !== contractId) return c;
        const days = c.days.map((d) => {
          if (d.dayNumber === dayNumber && d.status === 'partial') {
            return { ...d, status: 'done' as ContractStatus };
          }
          return d;
        });
        return { ...c, days };
      });
      return { contracts };
    }),

  claimReward: (contractId, dayNumber) =>
    set((state) => {
      const contract = state.contracts.find((c) => c.id === contractId);
      const app = state.catalog.find((a) => a.id === contract?.appId);
      if (!contract || !app) return state;

      const reward = app.bounty;
      
      const tx: Transaction = {
        id: Math.random().toString(),
        type: 'token_gain',
        amount: reward,
        dateStr: new Date().toISOString(),
        description: `Daily reward for testing ${app.name} (Day ${dayNumber})`,
      };

      return {
        user: { 
          ...state.user, 
          tokens: state.user.tokens + reward,
          escrow: Math.max(0, state.user.escrow - reward)
        },
        transactions: [tx, ...state.transactions],
      };
    }),

  approveProof: (proofId) =>
    set((state) => ({
      proofQueue: state.proofQueue.filter((p) => p.id !== proofId),
    })),

  rejectProof: (proofId) =>
    set((state) => ({
      proofQueue: state.proofQueue.filter((p) => p.id !== proofId),
    })),
}));
