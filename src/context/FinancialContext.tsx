"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { FinancialState, Transaction, Activity, UserSettings, TransactionStatus, UserProfile } from "@/types";
import { createClient } from "@/lib/supabase-client";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useNotify } from "@/components/ui/notification";
import { formatAddress } from "@/lib/utils";

interface FinancialContextType extends FinancialState {
  isLoaded: boolean;
  isSettingsOpen: boolean;
  walletAddress: string | null;
  walletId: string | null;
  username: string | null;
  usernameChangedAt: string | null;
  setUsername: (username: string | null) => void;
  setUsernameChangedAt: (changedAt: string | null) => void;
  setSettingsOpen: (open: boolean) => void;
  sendPayment: (recipient: string, amount: number, category: string) => Promise<void>;
  updateTransactionStatus: (id: string, status: TransactionStatus, message?: string) => void;
  addInvoice: () => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  refreshData: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  statusCounts: Record<TransactionStatus, number>;
}

const STORAGE_KEY_SETTINGS = "setra_user_settings";
const STORAGE_KEY_PROFILE = "setra_user_profile";
const STORAGE_KEY_STATE = "setra_financial_state_snapshot";

const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  notificationsEnabled: true,
  currency: "USD",
  biometricEnabled: true,
  autoArchive: false,
  highContrastMode: false,
  multiRegion: true
};

const DEFAULT_PROFILE: UserProfile = {
  firstName: "",
  lastName: "",
  email: ""
};

const INITIAL_STATE: FinancialState = {
  balance: null,
  transactions: [],
  activities: [],
  invoiceCount: 0,
  invoices: [],
  settings: DEFAULT_SETTINGS,
  profile: DEFAULT_PROFILE
};

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

function hydrateStateFromCache(): FinancialState {
  if (typeof window === "undefined") return INITIAL_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    if (!raw) return INITIAL_STATE;
    const cached = JSON.parse(raw);
    if (!cached.timestamp) return INITIAL_STATE;
    if (Date.now() - cached.timestamp > 5 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY_STATE);
      return INITIAL_STATE;
    }
    return {
      balance: cached.balance ?? INITIAL_STATE.balance,
      transactions: cached.transactions ?? INITIAL_STATE.transactions,
      activities: cached.activities ?? INITIAL_STATE.activities,
      invoiceCount: cached.invoiceCount ?? INITIAL_STATE.invoiceCount,
      invoices: cached.invoices ?? INITIAL_STATE.invoices,
      settings: cached.settings ?? INITIAL_STATE.settings,
      profile: cached.profile ?? INITIAL_STATE.profile,
    };
  } catch {
    return INITIAL_STATE;
  }
}

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinancialState>(hydrateStateFromCache);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [usernameChangedAt, setUsernameChangedAt] = useState<string | null>(null);
  const initialFetchDone = useRef<string | null>(null);
  const { user } = useAuth();
  const { notify } = useNotify();
  const { setThemeMode } = useTheme();

  const WALLET_CACHE_KEY = "setra_wallet_cache";

  // Persist state snapshot to localStorage after meaningful data arrives
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!state.balance && state.transactions.length === 0) return;
    try {
      localStorage.setItem(
        STORAGE_KEY_STATE,
        JSON.stringify({
          balance: state.balance,
          transactions: state.transactions.slice(0, 50),
          activities: state.activities.slice(0, 50),
          invoiceCount: state.invoiceCount,
          settings: state.settings,
          profile: state.profile,
          timestamp: Date.now(),
        })
      );
    } catch {}
  }, [state.balance, state.transactions, state.activities, state.invoiceCount, state.settings, state.profile]);
  
  // Safe Supabase client creation with error handling - useMemo to prevent re-creation
  const supabase = React.useMemo(() => {
    try {
      return createClient();
    } catch (err: any) {
      console.error('Failed to create Supabase client in FinancialProvider:', err);
      // Continue without Supabase - use local state only
      return null;
    }
  }, []);

  // Load settings & profile from localStorage on mount
  useEffect(() => {
    if (!user) {
      // For non-authenticated users, just set loaded to true
      setIsLoaded(true);
      return;
    }
    
    const savedSettings = localStorage.getItem(`${STORAGE_KEY_SETTINGS}_${user.id}`);
    const savedProfile = localStorage.getItem(`${STORAGE_KEY_PROFILE}_${user.id}`);
    
    let themeFromStorage: string | null = null;
    setState(prev => {
      let nextSettings = prev.settings;
      let nextProfile = prev.profile;

      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          nextSettings = { ...prev.settings, ...parsed };
          themeFromStorage = parsed.theme || null;
        } catch (e) {}
      } else {
        nextSettings = DEFAULT_SETTINGS;
      }
      if (savedProfile) {
        try { nextProfile = { ...prev.profile, ...JSON.parse(savedProfile) }; } catch (e) {}
      } else {
        nextProfile = { ...DEFAULT_PROFILE, email: user.email || "user@example.com" };
      }

      return { ...prev, settings: nextSettings, profile: nextProfile };
    });
    // Sync theme from local settings to ThemeContext immediately
    if (themeFromStorage) {
      setThemeMode(themeFromStorage as any);
    }
  }, [user, setThemeMode]);

  function loadCachedWallet() {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(WALLET_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (cached.userId === user?.id) return cached;
    } catch {}
    return null;
  }

  function saveCachedWallet(wId: string, wAddr: string | null) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        WALLET_CACHE_KEY,
        JSON.stringify({ userId: user?.id, walletId: wId, walletAddress: wAddr })
      );
    } catch {}
  }

  // Handle data fetching and wallet creation
  const fetchData = useCallback(async (showLoading = true) => {
    if (!user?.id) {
      console.log('📊 FinancialContext: No user, skipping data fetch');
      setIsLoaded(true);
      return;
    }
    
    console.log('📊 FinancialContext: Starting data fetch for user:', user.id);
    
    // If Supabase client is not available, skip data fetching
    if (!supabase) {
      console.warn('⚠️ FinancialContext: Supabase client not available');
      setIsLoaded(true);
      return;
    }
    
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.warn("⚠️ Data fetch timeout - forcing completion");
    }, 10000);
    
    try {
      // 1. Check Supabase profiles table (source of truth) for wallet and username
      console.log('🔍 FinancialContext: Querying Supabase profiles table for wallet and username...');
      let currentWalletId = null;
      let currentWalletAddress = null;
      let currentUsername = null;
      let currentUsernameChangedAt = null;

      // Check localStorage cache first for instant wallet data
      const cachedWallet = loadCachedWallet();
      if (cachedWallet) {
        currentWalletId = cachedWallet.walletId;
        currentWalletAddress = cachedWallet.walletAddress;
        setWalletId(currentWalletId);
        if (currentWalletAddress) setWalletAddress(currentWalletAddress);
        console.log('📦 FinancialContext: Loaded wallet from cache:', currentWalletId);
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_id, wallet_address, username, username_changed_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('⚠️ FinancialContext: Supabase profile fetch error:', profileError.message);
      } else if (profileData) {
        console.log('📊 FinancialContext: Supabase profile result:', profileData);
        currentWalletId = profileData.wallet_id;
        currentWalletAddress = profileData.wallet_address;
        currentUsername = profileData.username;
        currentUsernameChangedAt = profileData.username_changed_at;
      }

      // 2. Only call /api/wallet/create if wallet_id is NULL
      if (!currentWalletId) {
        console.log('🆕 FinancialContext: No wallet found in Supabase profiles. Calling /api/wallet/create...');
        try {
          const createResponse = await fetch('/api/wallet/create', {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, email: user.email }),
          });

          if (createResponse.ok) {
            const createData = await createResponse.json();
            const primaryWallet = createData.wallets?.[0] || createData.wallet;
            currentWalletId = primaryWallet?.walletId || primaryWallet?.id;
            currentWalletAddress = primaryWallet?.walletAddress || primaryWallet?.address;
            console.log('✅ FinancialContext: Wallet created/retrieved via API:', { walletId: currentWalletId, address: currentWalletAddress, wallets: createData.wallets?.length });
          } else {
            const errorData = await createResponse.json();
            console.error('❌ FinancialContext: Failed to create/verify wallet via API:', errorData);
          }
        } catch (walletError) {
          console.error('❌ FinancialContext: Wallet API request failed:', walletError);
        }
      }

      // Cache wallet info to skip profile query on subsequent navigations
      if (currentWalletId) {
        saveCachedWallet(currentWalletId, currentWalletAddress);
      }

      // Now fetch all data in parallel (including Circle balance)
      console.log('📥 FinancialContext: Fetching transactions, settings, profile, and balance in parallel...');
      
      const balancePromise = currentWalletId
        ? Promise.race([
            fetch('/api/wallet/balance', {
              credentials: 'include',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletId: currentWalletId }),
            })
              .then(res => res.ok ? res.json() : null)
              .catch(() => null),
            new Promise((resolve) => setTimeout(() => {
              console.warn('⏱️ Balance fetch timeout after 5 seconds');
              resolve(null);
            }, 5000)) // 5 second timeout for balance fetch
          ])
        : Promise.resolve(null);

      const [transRes, settingsRes, profileRes, balanceData] = await Promise.all([
        supabase
          .from('transactions')
          .select('id,type,status,amount,created_at,recipient,recipient_username,recipient_address,category,metadata,tx_hash')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        balancePromise
      ]);

      let finalBalance: number | null = null;
      let rawTransactions: any[] = [];
      let dbSettings: any = null;
      let dbProfile: any = null;

      // Get wallet ID and address - set state immediately
      if (currentWalletId) {
        let resolvedWalletId = currentWalletId;
        let resolvedWalletAddress = currentWalletAddress;

        // If the balance response returned a corrected walletId, use that
        if (balanceData && balanceData.success && balanceData.walletId && balanceData.walletId !== currentWalletId) {
          resolvedWalletId = balanceData.walletId;
          if (balanceData.walletAddress) {
            resolvedWalletAddress = balanceData.walletAddress;
          }
          console.log('💰 FinancialContext: Corrected walletId from balance API:', { oldId: currentWalletId, newId: resolvedWalletId });
        }

        console.log('💰 FinancialContext: Setting wallet state:', { walletId: resolvedWalletId, address: resolvedWalletAddress });
        setWalletId(resolvedWalletId);
        
        if (resolvedWalletAddress) {
          setWalletAddress(resolvedWalletAddress);
        }
        
        if (balanceData && balanceData.success && typeof balanceData.balance === 'number') {
          finalBalance = balanceData.balance;
          console.log('💵 FinancialContext: Balance from Circle API:', finalBalance);
        } else {
          console.warn('❌ FinancialContext: Circle balance fetch failed or was skipped');
        }
      } else {
        console.log('⚠️ FinancialContext: No wallet ID available, skipping balance fetch');
      }

      if (transRes.error) {
        if (!transRes.error.message.includes("permission denied")) {
          console.error("❌ Transactions fetch error:", transRes.error.message);
        }
      } else if (transRes.data) {
        rawTransactions = transRes.data;
        console.log('📜 Transactions fetched:', rawTransactions.length);
      }

      if (settingsRes.data) {
        dbSettings = settingsRes.data;
      }

      if (profileRes.data) {
        dbProfile = profileRes.data;
      }

      // Fetch profile and name details for recipient addresses in a batch query to avoid N+1 issues
      const uniqueAddresses = Array.from(new Set(rawTransactions.map((t: any) => t.recipient_address || t.metadata?.recipient_address || t.recipient).filter(Boolean)));
      const addressProfileMap: Record<string, { username: string; firstName: string; lastName: string; avatar: string }> = {};

      if (uniqueAddresses.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, wallet_address')
            .in('wallet_address', uniqueAddresses);

          if (profiles && profiles.length > 0) {
            const profileIds = profiles.map((p: any) => p.id);
            const { data: userProfiles } = await supabase
              .from('user_profiles')
              .select('user_id, first_name, last_name, avatar')
              .in('user_id', profileIds);

            profiles.forEach((p: any) => {
              const up = userProfiles?.find((u: any) => u.user_id === p.id);
              if (p.wallet_address) {
                addressProfileMap[p.wallet_address.toLowerCase()] = {
                  username: p.username || "",
                  firstName: up?.first_name || "",
                  lastName: up?.last_name || "",
                  avatar: up?.avatar || ""
                };
              }
            });
          }
        } catch (err) {
          console.error("❌ Failed to batch fetch transaction profiles:", err);
        }
      }

      const mappedTransactions: Transaction[] = rawTransactions.map((t: any) => {
        const recipientAddress = t.recipient_address || t.metadata?.recipient_address || t.recipient;
        const normalizedType = t.type === "received" ? "income" : t.type === "sent" ? "expense" : (t.type || "expense");
        const normalizedStatus = t.status === "confirmed" ? "success" : t.status === "processing" ? "pending" : (t.status || "success");
        const addressKey = recipientAddress ? recipientAddress.toLowerCase() : "";
        const matched = addressProfileMap[addressKey];
        
        let txName = t.recipient || "Unknown";
        let txAvatar = (t.recipient || "??").substring(0, 2).toUpperCase();
        let recipientUsername = undefined;

        // Priority 1: Use recipient_username from database if available (payment sent to @username)
        if (t.recipient_username) {
          recipientUsername = t.recipient_username;
          txName = `@${t.recipient_username}`;
          txAvatar = t.recipient_username.substring(0, 2).toUpperCase();
        }
        // Priority 2: Use matched profile data from address lookup
        else if (matched) {
          recipientUsername = matched.username;
          if (matched.firstName || matched.lastName) {
            txName = `${matched.firstName} ${matched.lastName}`.trim();
          } else if (matched.username) {
            txName = `@${matched.username}`;
          }
          if (matched.avatar) {
            txAvatar = matched.avatar;
          } else if (matched.firstName || matched.lastName) {
            txAvatar = `${matched.firstName[0] || ""}${matched.lastName[0] || ""}`.toUpperCase();
          } else if (matched.username) {
            txAvatar = matched.username.substring(0, 2).toUpperCase();
          }
        }
        // Priority 3: If no username, show truncated address
        else if (recipientAddress && recipientAddress.startsWith("0x")) {
          txName = `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}`;
        }

        return {
          id: t.id,
          referenceId: t.id,
          name: txName,
          amount: Number(t.amount || 0),
          status: normalizedStatus as TransactionStatus,
          type: normalizedType as any,
          timestamp: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
          avatar: txAvatar,
          category: t.category || "Payment",
          recipientAddress: recipientAddress || undefined,
          recipientUsername: recipientUsername,
          metadata: t.metadata || undefined,
          statusHistory: [
            { status: normalizedStatus as TransactionStatus, timestamp: t.created_at ? new Date(t.created_at).getTime() : Date.now() }
          ]
        };
      });

      console.log('🎯 Setting state with:', {
        balance: finalBalance,
        transactions: mappedTransactions.length,
        walletId: currentWalletId,
        walletAddress: currentWalletAddress,
        username: currentUsername
      });

      setUsername(currentUsername);
      setUsernameChangedAt(currentUsernameChangedAt);

      const dbTheme = dbSettings?.theme || 'system';

      setState(prev => {
        let nextSettings = prev.settings;
        let nextProfile = prev.profile;

        if (dbSettings) {
          nextSettings = {
            theme: dbTheme,
            notificationsEnabled: dbSettings.notifications_enabled ?? true,
            currency: dbSettings.currency || 'USD',
            biometricEnabled: dbSettings.biometric_enabled ?? true,
            autoArchive: dbSettings.auto_archive ?? false,
            highContrastMode: dbSettings.high_contrast_mode ?? false,
            multiRegion: dbSettings.multi_region ?? true
          };
        }

        if (dbProfile) {
          nextProfile = {
            firstName: dbProfile.first_name || '',
            lastName: dbProfile.last_name || '',
            email: dbProfile.email || user.email || '',
            avatar: dbProfile.avatar
          };
        }

        return {
          ...prev,
          balance: finalBalance,
          transactions: mappedTransactions,
          activities: mappedTransactions.map(t => ({
            id: `act-${t.id}`,
            title: t.type === 'income' ? "Payment Received" : "Payment Sent",
            description: `${t.type === 'income' ? 'Received' : 'Sent'} $${t.amount.toLocaleString()} ${t.type === 'income' ? 'from' : 'to'} ${t.name}`,
            timestamp: t.timestamp,
            type: t.type === 'income' ? "payment_received" : "payment_sent"
          })),
          settings: nextSettings,
          profile: nextProfile
        };
      });
      
      setThemeMode(dbTheme as any);
      console.log('✅ FinancialContext: Data fetch complete');
    } catch (e: any) {
      console.error("❌ FinancialContext: Sync error:", e);
      notify(`Sync error: ${e.message}`);
    } finally {
      clearTimeout(timeout);
      setIsLoaded(true);
      console.log('✅ FinancialContext: isLoaded set to true');
    }
  }, [user?.id, user?.email, supabase, notify]);

  const prevUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const uid = user?.id;

    if (!uid) {
      if (prevUserId.current) {
        prevUserId.current = null;
        setState(INITIAL_STATE);
        setWalletId(null);
        setWalletAddress(null);
        setUsername(null);
        setUsernameChangedAt(null);
        initialFetchDone.current = null;
        setIsLoaded(true);
      }
      return;
    }

    prevUserId.current = uid;

    if (initialFetchDone.current !== uid) {
      console.log("🚀 FinancialContext - Triggering initial data fetch for user:", uid);
      fetchData().then(() => {
        initialFetchDone.current = uid;
      }).catch(() => {
        console.warn("⚠️ Initial fetch failed, will retry on re-render");
      });
    }
  }, [user?.id, fetchData]);

  // Dedicated balance refresh function with retry mechanism
  // Fully self-healing: does NOT require walletId - the server looks it up or creates it
  const refreshBalance = useCallback(async () => {
    console.log('🔄 Refreshing balance with retry mechanism...');
    
    const fetchBalanceWithRetry = async (attempt: number = 1, maxAttempts: number = 3): Promise<number> => {
      try {
        console.log(`💰 Balance fetch attempt ${attempt}/${maxAttempts}...`);
        
        const balanceResponse = await fetch('/api/wallet/balance', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletId: walletId || '' }),
        });
        
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          if (typeof balanceData.balance === 'number') {
            console.log(`✅ Balance from Circle API: $${balanceData.balance}`);
            // If the server corrected or created our walletId, update state
            if (balanceData.walletId && balanceData.walletId !== walletId) {
              setWalletId(balanceData.walletId);
              if (balanceData.walletAddress) {
                setWalletAddress(balanceData.walletAddress);
              }
              console.log('💰 refreshBalance: Corrected walletId:', { old: walletId, new: balanceData.walletId });
            }
            return balanceData.balance;
          }
        }
        
        // If we didn't get a balance and have retries left, try again
        if (attempt < maxAttempts) {
          const delay = attempt * 1000; // 1s, 2s, 3s delays
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchBalanceWithRetry(attempt + 1, maxAttempts);
        }
        
        console.warn('⚠️ No USDC balance found after all attempts');
        return 0;
      } catch (error) {
        console.error(`❌ Balance fetch attempt ${attempt} failed:`, error);
        
        // Retry if we have attempts left
        if (attempt < maxAttempts) {
          const delay = attempt * 1000;
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchBalanceWithRetry(attempt + 1, maxAttempts);
        }
        
        return 0;
      }
    };

    const newBalance = await fetchBalanceWithRetry();
    
    // Update state with exact Circle API balance - never add or subtract locally
    setState(prev => {
      console.log(`🎯 Setting balance to Circle API value: $${newBalance} (was $${prev.balance})`);
      return { ...prev, balance: newBalance };
    });
  }, [walletId]);

  // Auto-fetch balance on mount and whenever user changes
  // refreshBalance is self-healing - handles wallet creation/lookup on the server
  useEffect(() => {
    if (user) {
      console.log('💰 Auto-fetching balance');
      refreshBalance();
    }
  }, [user, refreshBalance]);

  // Set up realtime listener for transactions and auto-refresh balance
  useEffect(() => {
    if (!user?.id || !supabase || !walletId) return;

    console.log('🔔 Setting up realtime transaction listener for user:', user.id);

    // Subscribe to transaction changes
    const channel = supabase
      .channel(`transactions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 Transaction change detected:', payload);
          
          // Fetch fresh balance from Circle API - DO NOT add amounts locally
          if (!walletId) return;
          
          try {
            const balanceResponse = await fetch('/api/wallet/balance', {
              credentials: 'include',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletId }),
            });
            
            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json();
              if (typeof balanceData.balance === 'number' && balanceData.balance >= 0) {
                console.log(`💰 Realtime: Balance from Circle API: $${balanceData.balance}`);
                setState(prev => ({ ...prev, balance: balanceData.balance }));
              }
              if (balanceData.walletId && balanceData.walletId !== walletId) {
                setWalletId(balanceData.walletId);
                if (balanceData.walletAddress) {
                  setWalletAddress(balanceData.walletAddress);
                }
              }
            }
          } catch (error) {
            console.error('❌ Realtime balance fetch failed:', error);
          }
          
          // Update transactions list
          if (payload.eventType === 'INSERT') {
            const newTx = payload.new;
            const normalizedType = newTx.type === "received" ? "income" : newTx.type === "sent" ? "expense" : (newTx.type || "expense");
            const normalizedStatus = newTx.status === "confirmed" ? "success" : newTx.status === "processing" ? "pending" : (newTx.status || "success");
            
            // Determine display name and avatar
            let displayName = newTx.recipient || "Unknown";
            let displayAvatar = (newTx.recipient || "??").substring(0, 2).toUpperCase();
            
            // If recipient_username exists, show @username as primary
            if (newTx.recipient_username) {
              displayName = `@${newTx.recipient_username}`;
              displayAvatar = newTx.recipient_username.substring(0, 2).toUpperCase();
            }
            // If no username but has address, show truncated address
            else if (newTx.recipient_address && newTx.recipient_address.startsWith("0x")) {
              displayName = `${newTx.recipient_address.substring(0, 6)}...${newTx.recipient_address.substring(newTx.recipient_address.length - 4)}`;
            }
            
            setState(prev => ({
              ...prev,
              transactions: [{
                id: newTx.id,
                referenceId: newTx.id,
                name: displayName,
                amount: Number(newTx.amount || 0),
                status: normalizedStatus as TransactionStatus,
                type: normalizedType as any,
                timestamp: newTx.created_at ? new Date(newTx.created_at).getTime() : Date.now(),
                avatar: displayAvatar,
                category: newTx.category || "Payment",
                recipientAddress: newTx.recipient_address || undefined,
                recipientUsername: newTx.recipient_username || undefined,
                metadata: newTx.metadata || undefined,
                statusHistory: [
                  { status: normalizedStatus as TransactionStatus, timestamp: newTx.created_at ? new Date(newTx.created_at).getTime() : Date.now() }
                ]
              }, ...prev.transactions]
            }));
          } else if (payload.eventType === 'UPDATE') {
            const updatedTx = payload.new;
            const normalizedStatus = updatedTx.status === "confirmed" ? "success" : updatedTx.status === "processing" ? "pending" : (updatedTx.status || "success");

            setState(prev => ({
              ...prev,
              transactions: prev.transactions.map(t => {
                if (t.id === updatedTx.id) {
                  return {
                    ...t,
                    amount: Number(updatedTx.amount || t.amount),
                    status: normalizedStatus as TransactionStatus,
                    category: updatedTx.category || t.category,
                    metadata: updatedTx.metadata || t.metadata,
                    statusHistory: [
                      ...(t.statusHistory || []),
                      { status: normalizedStatus as TransactionStatus, timestamp: Date.now() }
                    ]
                  };
                }
                return t;
              })
            }));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 Cleaning up realtime listener');
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, walletId]);

  // Periodic polling as fallback for Realtime (every 30s)
  // Self-healing: calls balance endpoint which handles wallet creation if needed
  useEffect(() => {
    if (!user) return;

    console.log('⏰ Setting up periodic balance poll (30s interval)');
    const interval = setInterval(async () => {
      console.log('⏰ Periodic poll: refreshing balance');
      try {
        const balanceResponse = await fetch('/api/wallet/balance', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletId: walletId || '' }),
        });
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          if (typeof balanceData.balance === 'number' && balanceData.balance >= 0) {
            setState(prev => {
              if (prev.balance !== balanceData.balance) {
                console.log(`⏰ Periodic poll: balance updated from $${prev.balance} to $${balanceData.balance}`);
              }
              return { ...prev, balance: balanceData.balance };
            });
          }
          if (balanceData.walletId && balanceData.walletId !== walletId) {
            setWalletId(balanceData.walletId);
            if (balanceData.walletAddress) {
              setWalletAddress(balanceData.walletAddress);
            }
          }
        }
      } catch (error) {
        console.error('⏰ Periodic poll error:', error);
      }
    }, 30000);

    return () => {
      console.log('⏰ Cleaning up periodic poll');
      clearInterval(interval);
    };
  }, [user]);

  const updateTransactionStatus = useCallback((id: string, status: TransactionStatus, message?: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => 
        t.id === id ? { 
          ...t, 
          status, 
          statusHistory: [...(t.statusHistory || []), { status, timestamp: Date.now(), message }]
        } : t
      )
    }));
  }, []);

  const sendPayment = useCallback(async (recipient: string, amount: number, category: string) => {
    if (!user || isProcessingLocal) return;
    setIsProcessingLocal(true);

    const refId = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const txId = `tx-${Math.random().toString(36).substring(2, 9)}`;
    
    const newTransaction: Transaction = {
      id: txId,
      referenceId: refId,
      name: recipient,
      amount,
      status: "pending",
      type: "expense",
      timestamp: Date.now(),
      avatar: recipient.substring(0, 2).toUpperCase(),
      category,
      statusHistory: [{ status: "pending", timestamp: Date.now(), message: "Transaction initialized" }]
    };

    setState(prev => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions],
      activities: [{
        id: `act-${txId}`,
        title: "Processing Payment",
        description: `Sending $${amount.toLocaleString()} to ${formatAddress(recipient)}`,
        timestamp: Date.now(),
        type: "payment_sent"
      }, ...prev.activities]
    }));

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      updateTransactionStatus(txId, "processing", "Transaction routing through Circle network");
      
      // Get user's wallet ID
      if (!supabase) {
        throw new Error('Supabase not available');
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_id')
        .eq('id', user.id)
        .single();
      
      if (!profile?.wallet_id) {
        throw new Error('Wallet not found');
      }

      // Execute real Circle payment via API route
      const response = await fetch('/api/payments/send', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: profile.wallet_id,
          toAddress: recipient,
          amount: amount.toString(),
          userId: user.id,
          category: category,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const txRef = result.txHash || result.transactionId || "pending";
        const refDisplay = txRef.length > 10 ? `${txRef.substring(0, 10)}...` : txRef;
        updateTransactionStatus(txId, "processing", `Transaction submitted. Ref: ${refDisplay}`);
        notify(`Payment of $${amount.toLocaleString()} to ${formatAddress(recipient)} submitted, confirming on-chain`);
        
        await fetchData(false);
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error: any) {
      console.error("Transaction failed:", error);
      updateTransactionStatus(txId, "failed", error.message || "Network error or insufficient funds");
      notify(`Payment failed: ${error.message || "Please check your account"}`);
      // Refresh balance from Circle API - never calculate locally
      await refreshBalance();
    } finally {
      setIsProcessingLocal(false);
    }
  }, [user, isProcessingLocal, updateTransactionStatus, notify, supabase, fetchData, refreshBalance]);

  const addInvoice = useCallback(() => {
    const id = Math.random().toString(36).substring(2, 9);
    setState(prev => ({
      ...prev,
      activities: [{
        id: `act-${id}`,
        title: "Invoice Draft Created",
        description: `Reference #${id.toUpperCase()}`,
        timestamp: Date.now(),
        type: "invoice_created"
      }, ...prev.activities],
      invoiceCount: prev.invoiceCount + 1,
      invoices: [{
        id: id.toUpperCase(),
        client: "New Client",
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        amount: 0,
        status: "draft"
      }, ...(prev.invoices || [])]
    }));
    notify("Invoice draft created successfully");
  }, [notify]);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    setState(prev => {
      const updated = { ...prev.settings, ...newSettings };
      localStorage.setItem(`${STORAGE_KEY_SETTINGS}_${user.id}`, JSON.stringify(updated));
      return { ...prev, settings: updated };
    });
    // Sync theme to ThemeContext's storage for cross-session persistence
    if (newSettings.theme) {
      try { localStorage.setItem("setra_theme", newSettings.theme); } catch {}
      setThemeMode(newSettings.theme);
    }

    if (!supabase) {
      console.warn('Supabase not available - settings saved locally only');
      return;
    }

    try {
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        theme: newSettings.theme,
        notifications_enabled: newSettings.notificationsEnabled,
        currency: newSettings.currency,
        biometric_enabled: newSettings.biometricEnabled,
        auto_archive: newSettings.autoArchive,
        high_contrast_mode: newSettings.highContrastMode,
        multi_region: newSettings.multiRegion,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error("Failed to sync settings to Supabase:", e);
    }
  }, [user, supabase]);

  const updateProfile = useCallback(async (newProfile: Partial<UserProfile>) => {
    if (!user) return;
    setState(prev => {
      const updated = { ...prev.profile, ...newProfile };
      localStorage.setItem(`${STORAGE_KEY_PROFILE}_${user.id}`, JSON.stringify(updated));
      return { ...prev, profile: updated };
    });

    if (!supabase) {
      console.warn('Supabase not available - profile saved locally only');
      return;
    }

    try {
      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        first_name: newProfile.firstName,
        last_name: newProfile.lastName,
        email: newProfile.email,
        avatar: newProfile.avatar,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error("Failed to sync profile to Supabase:", e);
    }
  }, [user, supabase]);

  const statusCounts = useMemo(() => {
    const counts: Record<TransactionStatus, number> = {
      pending: 0,
      processing: 0,
      success: 0,
      failed: 0
    };
    state.transactions.forEach(t => { counts[t.status]++; });
    return counts;
  }, [state.transactions]);

  const contextValue = useMemo(() => ({
    ...state,
    isLoaded,
    isSettingsOpen,
    walletAddress,
    walletId,
    username,
    usernameChangedAt,
    setUsername,
    setUsernameChangedAt,
    setSettingsOpen,
    sendPayment,
    updateTransactionStatus,
    addInvoice,
    updateSettings,
    updateProfile,
    refreshData: () => fetchData(false),
    refreshBalance,
    statusCounts
  }), [state, isLoaded, isSettingsOpen, walletAddress, walletId, username, usernameChangedAt, setUsername, setUsernameChangedAt, sendPayment, updateTransactionStatus, addInvoice, updateSettings, updateProfile, fetchData, refreshBalance, statusCounts]);

  return (
    <FinancialContext.Provider value={contextValue}>
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancial() {
  const context = useContext(FinancialContext);
  if (context === undefined) {
    throw new Error("useFinancial must be used within a FinancialProvider");
  }
  return context;
}
