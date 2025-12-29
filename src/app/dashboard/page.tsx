'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBiometricWallet } from '@/hooks/useBiometricWallet';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getAllGroupsForUser, getProfileFromSupabase } from '@/lib/supabase-services';
import { ProfileSetupModal } from '@/components/ui/ProfileSetupModal';
import { useToast } from '@/components/ui/Toast';
import { getAvatarUrl, getAvatarById, AVATAR_OPTIONS } from '@/lib/avatars';
import { getUSDCBalance } from '@/lib/indexer';

interface GroupData {
  id: number;
  name: string;
  memberCount: number;
  betCount: number;
}

export default function DashboardPage() {
  const { authenticated, ready } = useAuth();
  const { isRegistered, register, authenticate: biometricAuth, isRegistering, isAuthenticating } = useBiometricWallet();
  const router = useRouter();
  const { wallet, loading: walletLoading, setProfile } = useMoveWallet();
  const { showToast } = useToast();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  // Initialize showProfileSetup based on sessionStorage - check synchronously on mount
  const [showProfileSetup, setShowProfileSetup] = useState(() => {
    // Check sessionStorage immediately - if profile exists, never show modal
    const savedSettings = sessionStorage.getItem('friendfi_user_settings');
    const profileExists = sessionStorage.getItem('friendfi_profile_exists') === 'true';
    
    if (profileExists) {
      console.log('[Dashboard] Initial state: Profile exists in sessionStorage, modal will not show');
      return false;
    }
    
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.username && settings.username.trim()) {
          console.log('[Dashboard] Initial state: Username found in sessionStorage, modal will not show');
          sessionStorage.setItem('friendfi_profile_exists', 'true');
          return false;
        }
      } catch (e) {
        // Invalid JSON, will check later
      }
    }
    
    // Default to false - only show after confirming no profile exists
    return false;
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [userSettings, setUserSettings] = useState<{ username?: string; avatarUrl?: string } | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Track the last checked address to avoid duplicate checks
  const lastCheckedAddressRef = useRef<string | null>(null);
  const checkingRef = useRef(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCheckedRef = useRef(false);

  // Load USDC balance from indexer
  const loadUSDCBalance = useCallback(async () => {
    if (!wallet?.address) return;
    
    setLoadingBalance(true);
    try {
      const balance = await getUSDCBalance(wallet.address);
      setUsdcBalance(balance);
    } catch (error) {
      console.error('Error loading USDC balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  }, [wallet?.address]);

  // Load user settings from session storage and Supabase
  const loadSettings = useCallback(async () => {
    if (!wallet?.address) return;
    
    // First, check session storage for immediate display
    const saved = sessionStorage.getItem('friendfi_user_settings');
    if (saved) {
      setUserSettings(JSON.parse(saved));
    }
    
    // Then load from Supabase (off-chain profiles)
    try {
      const profile = await getProfileFromSupabase(wallet.address);
      if (profile) {
        const avatar = getAvatarById(profile.avatar_id);
        const url = avatar ? getAvatarUrl(avatar.seed, avatar.style) : `https://api.dicebear.com/7.x/adventurer/svg?seed=default&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
        
        const settings = {
          username: profile.username,
          avatarId: profile.avatar_id,
          avatarUrl: url,
        };
        
        // Update session storage
        sessionStorage.setItem('friendfi_user_settings', JSON.stringify(settings));
        setUserSettings(settings);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [wallet?.address]);

  // Load balance and settings when wallet changes
  useEffect(() => {
    if (wallet?.address && authenticated) {
      loadUSDCBalance();
      loadSettings();
    }
  }, [wallet?.address, authenticated, loadUSDCBalance, loadSettings]);

  // Handle biometric login
  const handleLogin = async () => {
    if (isRegistered) {
      await biometricAuth();
    } else {
      await register();
    }
  };
  
  // Check if user has a profile
  useEffect(() => {
    // CRITICAL: Check sessionStorage FIRST - if profile exists there, use it and NEVER show modal
    const savedSettings = sessionStorage.getItem('friendfi_user_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.username && settings.username.trim()) {
          console.log('[Dashboard] Profile found in sessionStorage, hiding modal permanently');
          setShowProfileSetup(false);
          setProfileChecked(true);
          sessionStorage.setItem('friendfi_profile_exists', 'true');
          return; // Don't check if we have it in sessionStorage
        }
      } catch (e) {
        // Invalid JSON, continue to profile check
      }
    }
    
    // CRITICAL: If we already confirmed profile exists in this session, NEVER check again
    const profileExists = sessionStorage.getItem('friendfi_profile_exists') === 'true';
    if (profileExists) {
      console.log('[Dashboard] Profile already confirmed to exist, skipping check');
      setShowProfileSetup(false);
      setProfileChecked(true);
      return;
    }
    
    // Don't check if wallet is still loading
    if (walletLoading) {
      console.log('[Dashboard] Wallet still loading, skipping profile check');
      return;
    }
    
    // Only check once per wallet address
    if (!wallet?.address) {
      // Reset when wallet is cleared
      lastCheckedAddressRef.current = null;
      hasCheckedRef.current = false;
      setProfileChecked(false);
      setShowProfileSetup(false); // Don't show modal if no wallet
      return;
    }
    
    // Skip if we already checked this exact address
    if (lastCheckedAddressRef.current === wallet.address && hasCheckedRef.current) {
      console.log('[Dashboard] Skipping - already checked this address:', wallet.address);
      return;
    }
    
    // Skip if already checking
    if (checkingRef.current) {
      console.log('[Dashboard] Skipping - check already in progress');
      return;
    }
    
    // Clear any pending timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }
    
    async function checkProfile() {
      // Double-check conditions after delay
      if (!wallet?.address || walletLoading) return;
      
      if (lastCheckedAddressRef.current === wallet.address && hasCheckedRef.current) {
        console.log('[Dashboard] Skipping - already checked after delay');
        return;
      }
      
      if (checkingRef.current) {
        console.log('[Dashboard] Skipping - check in progress after delay');
        return;
      }
      
      checkingRef.current = true;
      
      try {
        // Log address format for debugging
        const addressLength = wallet.address.startsWith('0x') 
          ? wallet.address.length - 2 
          : wallet.address.length;
        console.log(
          '[Dashboard] Starting profile check for address:',
          wallet.address,
          `(${addressLength} hex chars${addressLength === 40 ? ' - Ethereum format' : addressLength === 64 ? ' - Aptos format' : ' - Unknown format'})`
        );
        
        // Mark this address as checked IMMEDIATELY to prevent duplicate calls
        lastCheckedAddressRef.current = wallet.address;
        hasCheckedRef.current = true;
        
        // Check if we have a stored actual address from a previous transaction
        const storedActualAddress = sessionStorage.getItem('friendfi_actual_address');
        
        // Use fallback function if address is Ethereum-style
        // This will try derived address first, then padded address
        let profile;
        if (storedActualAddress) {
          // Use the stored actual address (from when profile was created)
          console.log('[Dashboard] Using stored actual address from previous transaction:', storedActualAddress);
          profile = await getProfileFromSupabase(storedActualAddress) || null;
        } else {
          // Regular profile lookup
          profile = await getProfileFromSupabase(wallet.address) || null;
        }
        console.log('[Dashboard] Profile check completed:', profile);
        console.log('[Dashboard] Profile details:', {
          exists: !!profile,
          username: profile?.username,
          usernameTrimmed: profile?.username?.trim(),
          hasUsername: !!(profile && profile.username && profile.username.trim())
        });
        
        // CRITICAL: If profile exists with a username, immediately hide modal and NEVER show it again
        const hasValidUsername = profile && profile.username && typeof profile.username === 'string' && profile.username.trim().length > 0;
        if (hasValidUsername && profile) {
          console.log('[Dashboard] ✅ Profile found with username:', profile.username, '- Hiding modal permanently for this session.');
          setShowProfileSetup(false);
          setProfileChecked(true);
          // Store in sessionStorage to prevent any future checks from showing the modal
          sessionStorage.setItem('friendfi_profile_exists', 'true');
          // Also update user settings in sessionStorage if not already set
          const savedSettings = sessionStorage.getItem('friendfi_user_settings');
          if (!savedSettings || !JSON.parse(savedSettings || '{}').username) {
            sessionStorage.setItem('friendfi_user_settings', JSON.stringify({
              username: profile.username,
              avatarId: profile.avatar_id,
              avatarUrl: getAvatarUrl(AVATAR_OPTIONS[profile.avatar_id]?.seed || '', AVATAR_OPTIONS[profile.avatar_id]?.style || 'adventurer')
            }));
          }
          // Don't check again - we have the profile
          checkingRef.current = false;
          hasCheckedRef.current = true;
          return; // CRITICAL: Exit early - profile exists!
        }
        
        // Only show modal if profile doesn't exist AND we haven't already confirmed it exists
        const profileExists = sessionStorage.getItem('friendfi_profile_exists') === 'true';
        if (!profileExists && (!profile || !profile.username || !profile.username.trim())) {
          // No profile found - only show modal if we've confirmed there's no profile
          console.log('[Dashboard] ❌ No profile found - showing setup modal');
          setShowProfileSetup(true);
        } else {
          // Profile exists or we've already confirmed it exists, don't show modal
          console.log('[Dashboard] ✅ Profile exists or confirmed - not showing modal');
          setShowProfileSetup(false);
        }
        setProfileChecked(true);
        checkingRef.current = false;
      } catch (error) {
        // On error, don't show profile setup - might be a temporary network issue
        console.error('[Dashboard] Error checking profile:', error);
        setShowProfileSetup(false); // Don't show modal on error
        setProfileChecked(true);
      } finally {
        checkingRef.current = false;
      }
    }
    
    // Add a delay to ensure wallet is fully initialized and stable
    // Increase delay if wallet is still loading to give public key time to fetch
    const delay = walletLoading ? 1000 : 500;
    checkTimeoutRef.current = setTimeout(() => {
      checkTimeoutRef.current = null;
      checkProfile();
    }, delay);
    
    // Cleanup function
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
    };
  }, [wallet?.address, walletLoading]); // Include walletLoading in dependencies

  // Handle profile setup completion
  const handleProfileSetup = async (username: string, avatarId: number) => {
    if (!wallet?.address) return;
    
    setSavingProfile(true);
    try {
      const result = await setProfile(username, avatarId);
      
      // If the result includes an address, store it
      // This is the actual on-chain address used, which may differ from the padded address
      if ((result as any).address) {
        const actualAddress = (result as any).address;
        console.log('[Dashboard] Storing actual transaction address:', actualAddress);
        sessionStorage.setItem('friendfi_actual_address', actualAddress);
        // Update the wallet address reference so future queries use the correct address
        lastCheckedAddressRef.current = actualAddress;
        hasCheckedRef.current = false; // Allow re-check with new address
      }
      
      // Save to session storage for immediate UI updates
      const settings = {
        username,
        avatarId,
        avatarUrl: getAvatarUrl(AVATAR_OPTIONS[avatarId].seed, AVATAR_OPTIONS[avatarId].style),
      };
      sessionStorage.setItem('friendfi_user_settings', JSON.stringify(settings));
      sessionStorage.setItem('friendfi_profile_exists', 'true'); // Mark profile as existing
      
      // Dispatch event to trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: settings }));
      
      showToast({
        type: 'success',
        title: 'Profile created!',
        message: 'Welcome to Friend-Fi',
        txHash: result.hash,
      });
      
      setShowProfileSetup(false);
      setProfileChecked(true); // Mark as checked so we don't check again
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to create profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Auth redirect is handled by AuthWrapper - no need here

  // Load user's groups
  useEffect(() => {
    if (!authenticated) {
      setGroups([]);
      setGroupsLoading(false);
      return;
    }

    async function loadGroups() {
      if (!wallet?.address) {
        return;
      }

      setGroupsLoading(true);
      try {
        console.log('[Dashboard] Loading groups from Supabase...');
        
        // Get all groups for this user from Supabase
        const userGroups = await getAllGroupsForUser(wallet.address);
        
        console.log('[Dashboard] Found', userGroups.length, 'groups');
        
        // Map to dashboard format
        const groupData = userGroups.map(group => ({
          id: group.id,
          name: group.name,
          memberCount: group.group_members?.length || 0,
          betCount: 0, // We'll load bets separately when user enters the group
        }));

        setGroups(groupData);
      } catch (error) {
        console.error('[Dashboard] Error loading groups:', error);
      } finally {
        setGroupsLoading(false);
      }
    }

    if (wallet?.address && authenticated) {
      loadGroups();
    }
  }, [wallet?.address, authenticated]);

  const handleGroupClick = (group: GroupData) => {
    // Store group in session for bet creation
    sessionStorage.setItem('friendfi_current_group', JSON.stringify({
      id: group.id,
      name: group.name,
    }));
    router.push(`/groups/${group.id}`);
  };

  // Show loading only initially, not when waiting for auth
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin">
          
          
          
          
        </div>
      </div>
    );
  }

  // Determine if we're in a loading state
  const isLoading = authenticated && (walletLoading || groupsLoading);

  // Preview mode (unauthenticated)
  if (!authenticated) {
    return (
      <>
        <div className="flex min-h-screen bg-background">
          <Sidebar />

          <main className="flex-1 mobile-content lg:p-0 lg:py-16">
            <div className="p-4 sm:p-6 pt-8 pb-12 lg:p-8 lg:pt-8 lg:pb-8">
              {/* Login Banner */}
              <Card className="mb-6 border-4 border-primary bg-primary/10">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-5xl text-text">fingerprint</span>
                  </div>
                  <h2 className="text-text text-2xl font-display font-bold mb-2">
                    Welcome to Friend-Fi
                  </h2>
                  <p className="text-accent font-mono mb-6 max-w-md mx-auto">
                    Secure, gasless social DeFi for your inner circle. Login with biometrics to get started.
                  </p>
                  <Button 
                    onClick={handleLogin} 
                    loading={isRegistering || isAuthenticating}
                    className="mx-auto"
                  >
                    <span className="material-symbols-outlined">fingerprint</span>
                    {isRegistered ? 'Login with Biometric' : 'Create Wallet'}
                  </Button>
                </CardContent>
              </Card>

              {/* Preview Content */}
              <div className="mb-6">
                <h1 className="text-text text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">
                  Your Groups
                </h1>
                <p className="text-accent text-sm sm:text-base font-mono">
                  Create or join groups to get started
                </p>
              </div>

              {/* Preview Cards (blurred/disabled) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 opacity-50 pointer-events-none">
                {/* Example Group Card */}
                <Card>
                  <CardContent className="p-0">
                    <div className="p-4 sm:p-5 border-b-2 border-text">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary border-2 border-text flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-text text-2xl sm:text-3xl">groups</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-text text-base sm:text-lg font-display font-bold">Weekend Trip</h3>
                          <p className="text-accent text-xs sm:text-sm font-mono uppercase tracking-wider">
                            5 members
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 sm:p-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent text-lg sm:text-xl">casino</span>
                        <span className="text-text font-mono font-bold text-sm sm:text-base">3</span>
                        <span className="text-accent text-xs sm:text-sm font-mono">bets</span>
                      </div>
                      <span className="material-symbols-outlined text-accent text-lg sm:text-xl">chevron_right</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Example Group Card 2 */}
                <Card>
                  <CardContent className="p-0">
                    <div className="p-4 sm:p-5 border-b-2 border-text">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary border-2 border-text flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-text text-2xl sm:text-3xl">groups</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-text text-base sm:text-lg font-display font-bold">Housemates</h3>
                          <p className="text-accent text-xs sm:text-sm font-mono uppercase tracking-wider">
                            4 members
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 sm:p-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent text-lg sm:text-xl">receipt_long</span>
                        <span className="text-text font-mono font-bold text-sm sm:text-base">12</span>
                        <span className="text-accent text-xs sm:text-sm font-mono">expenses</span>
                      </div>
                      <span className="material-symbols-outlined text-accent text-lg sm:text-xl">chevron_right</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Add New Group Card */}
                <Card className="border-dashed">
                  <CardContent className="p-4 h-full flex items-center justify-center min-h-[140px]">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-surface border-2 border-text border-dashed flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-accent text-2xl">add</span>
                      </div>
                      <p className="text-accent font-mono text-sm font-bold uppercase tracking-wider">New Group</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Features Preview */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6 text-center">
                    <span className="material-symbols-outlined text-5xl text-primary mb-3">receipt_long</span>
                    <h3 className="text-text text-lg font-display font-bold mb-2">Split Expenses</h3>
                    <p className="text-accent text-sm font-mono">Track and settle shared costs</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <span className="material-symbols-outlined text-5xl text-primary mb-3">casino</span>
                    <h3 className="text-text text-lg font-display font-bold mb-2">Private Bets</h3>
                    <p className="text-accent text-sm font-mono">Make predictions with your friends</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <span className="material-symbols-outlined text-5xl text-primary mb-3">verified</span>
                    <h3 className="text-text text-lg font-display font-bold mb-2">Habit Tracking</h3>
                    <p className="text-accent text-sm font-mono">Hold each other accountable</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  // Authenticated view (existing dashboard)

  return (
    <>
      {/* Only show modal if we've checked and confirmed no profile exists */}
      {profileChecked && showProfileSetup && (
        <ProfileSetupModal 
          isOpen={showProfileSetup}
          onComplete={handleProfileSetup}
          onSaving={savingProfile}
        />
      )}
      
      <div className="flex min-h-screen bg-background">
        <Sidebar />

        <main className="flex-1 mobile-content lg:p-0 lg:py-16">
        <div className="p-4 sm:p-6 pt-8 pb-12 lg:p-8 lg:pt-8 lg:pb-8">
          {/* Profile & Balance Card - Mobile Only */}
          <Card className="mb-6 lg:hidden">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Profile */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {userSettings?.avatarUrl && (
                    <img
                      src={userSettings.avatarUrl}
                      alt={userSettings.username || 'Profile'}
                      className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-text flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h2 className="text-text text-lg sm:text-xl font-display font-bold truncate">
                      {userSettings?.username || 'Anonymous'}
                    </h2>
                    <p className="text-accent text-xs sm:text-sm font-mono truncate">
                      {wallet?.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: Balance */}
                <div className="text-right flex-shrink-0">
                  <p className="text-accent text-xs sm:text-sm font-mono uppercase tracking-wider mb-1">
                    Balance
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-text text-xl sm:text-2xl font-display font-bold">
                      ${(usdcBalance / 1_000_000).toFixed(2)}
                    </span>
                    <span className="text-accent text-sm sm:text-base font-mono">USDC</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-text text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight">
                Your Groups
              </h1>
              <p className="text-accent text-sm sm:text-base mt-1 font-mono">
                {isLoading ? 'Loading...' : groups.length === 0 ? 'Get started by creating or joining a group' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Link href="/groups/join" className="flex-1 sm:flex-none">
                <Button variant="secondary" className="w-full sm:w-auto text-sm">
                  <span className="material-symbols-outlined text-lg">group_add</span>
                  <span className="hidden sm:inline">Join</span>
                </Button>
              </Link>
              <Link href="/groups/create" className="flex-1 sm:flex-none">
                <Button className="w-full sm:w-auto text-sm">
                  <span className="material-symbols-outlined text-lg">add</span>
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="brutalist-spinner-instant mx-auto mb-4">
                  
                  
                  
                  
                </div>
                <p className="text-accent font-mono text-sm">Loading your groups...</p>
              </CardContent>
            </Card>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-20 h-20 bg-primary/20 border-2 border-text flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-text">groups</span>
                </div>
                <h2 className="text-text text-2xl font-display font-bold mb-3">No Groups Yet</h2>
                <p className="text-accent max-w-md mx-auto mb-8 font-mono">
                  Create a group for each trip, event, or shared activity. Each group has its own expense tracker and prediction market.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/groups/create">
                    <Button className="w-full sm:w-auto">
                      <span className="material-symbols-outlined">add_circle</span>
                      Create Group
                    </Button>
                  </Link>
                  <Link href="/groups/join">
                    <Button variant="secondary" className="w-full sm:w-auto">
                      <span className="material-symbols-outlined">group_add</span>
                      Join Group
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {groups.map((group) => (
                <Card key={group.id} hover onClick={() => handleGroupClick(group)}>
                  <CardContent className="p-0">
                    {/* Group Header */}
                    <div className="p-4 sm:p-5 border-b-2 border-text">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary border-2 border-text flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-text text-2xl sm:text-3xl">groups</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-text text-base sm:text-lg font-display font-bold truncate">{group.name}</h3>
                          <p className="text-accent text-xs sm:text-sm font-mono uppercase tracking-wider">
                            {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="p-4 sm:p-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent text-lg sm:text-xl">casino</span>
                        <span className="text-text font-mono font-bold text-sm sm:text-base">{group.betCount}</span>
                        <span className="text-accent text-xs sm:text-sm font-mono">bet{group.betCount !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="material-symbols-outlined text-accent text-lg sm:text-xl">chevron_right</span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Add New Group Card */}
              <Link href="/groups/create">
                <Card hover className="h-full border-dashed">
                  <CardContent className="p-4 h-full flex items-center justify-center min-h-[140px]">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-surface border-2 border-text border-dashed flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-accent text-2xl">add</span>
                      </div>
                      <p className="text-accent font-mono text-sm font-bold uppercase tracking-wider">New Group</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
    </>
  );
}
