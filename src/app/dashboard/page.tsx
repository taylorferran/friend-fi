'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { useBiometricWallet } from '@/hooks/useBiometricWallet';
import { checkIfMemberInGroup, getGroupMembers, getGroupBets, getGroupsCount, getGroupName, getProfile } from '@/lib/contract';
import { ProfileSetupModal } from '@/components/ui/ProfileSetupModal';
import { useToast } from '@/components/ui/Toast';
import { getAvatarUrl, AVATAR_OPTIONS } from '@/lib/avatars';

interface GroupData {
  id: number;
  name: string;
  memberCount: number;
  betCount: number;
}

export default function DashboardPage() {
  const { authenticated, ready } = useAuth();
  const router = useRouter();
  const { wallet, loading: walletLoading, setProfile } = useMoveWallet();
  const { isRegistered, register, authenticate, isRegistering, isAuthenticating } = useBiometricWallet();
  const { showToast } = useToast();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  // Track the last checked address to avoid duplicate checks
  const lastCheckedAddressRef = useRef<string | null>(null);
  const checkingRef = useRef(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCheckedRef = useRef(false);
  
  // Check if user has a profile on-chain
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
          return; // Don't check on-chain if we have it in sessionStorage
        }
      } catch (e) {
        // Invalid JSON, continue to on-chain check
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
        
        // Use stored address if available, otherwise use wallet address
        let profile;
        if (storedActualAddress) {
          // Use the stored actual address (from when profile was created)
          console.log('[Dashboard] Using stored actual address from previous transaction:', storedActualAddress);
          profile = await getProfile(storedActualAddress);
        } else {
          // Regular profile lookup
          profile = await getProfile(wallet.address);
        }
        console.log('[Dashboard] Profile check completed:', profile);
        
        // CRITICAL: If profile exists with a name, immediately hide modal and NEVER show it again
        if (profile.exists && profile.name) {
          console.log('[Dashboard] Profile found! Hiding modal permanently for this session.');
          setShowProfileSetup(false);
          setProfileChecked(true);
          // Store in sessionStorage to prevent any future checks from showing the modal
          sessionStorage.setItem('friendfi_profile_exists', 'true');
          // Don't check again - we have the profile
          return;
        }
        
        // Only show modal if profile doesn't exist AND we haven't already confirmed it exists
        const profileExists = sessionStorage.getItem('friendfi_profile_exists') === 'true';
        if (!profileExists) {
          // No profile found, show setup modal
          setShowProfileSetup(true);
        } else {
          // We know profile exists from previous check, don't show modal
          setShowProfileSetup(false);
        }
        setProfileChecked(true);
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
      
      // Store the address used for the transaction
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
      
      // Dispatch event to trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: settings }));
      
      showToast({
        type: 'success',
        title: 'Profile created!',
        message: 'Welcome to Friend-Fi',
        txHash: result.hash,
      });
      
      setShowProfileSetup(false);
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

  // Handle login
  const handleLogin = async () => {
    if (isRegistered) {
      await authenticate();
    } else {
      await register();
    }
  };

  // Load user's groups - PARALLEL queries for speed
  useEffect(() => {
    async function loadGroups() {
      if (!wallet?.address) {
        return;
      }

      setGroupsLoading(true);
      try {
        const count = await getGroupsCount();
        
        if (count === 0) {
          setGroups([]);
          setGroupsLoading(false);
          return;
        }

        // Check ALL memberships in PARALLEL (huge speed improvement)
        const groupIds = Array.from({ length: count }, (_, i) => i);
        const membershipChecks = await Promise.all(
          groupIds.map(id => 
            checkIfMemberInGroup(id, wallet.address)
              .then(isMember => ({ id, isMember }))
              .catch(() => ({ id, isMember: false }))
          )
        );

        // Filter to groups user is a member of
        const userGroupIds = membershipChecks
          .filter(check => check.isMember)
          .map(check => check.id);

        if (userGroupIds.length === 0) {
          setGroups([]);
          setGroupsLoading(false);
          return;
        }

        // Get group name, members + bets for ALL user groups in PARALLEL - now with names!
        const groupDataPromises = userGroupIds.map(async (id) => {
          try {
            const [name, members, bets] = await Promise.all([
              getGroupName(id),
              getGroupMembers(id),
              getGroupBets(id),
            ]);
            return {
              id,
              name: name || `Group #${id}`,
              memberCount: members.length,
              betCount: bets.length,
            };
          } catch (error) {
            console.error(`Error loading group ${id}:`, error);
            return null;
          }
        });

        const groupDataResults = await Promise.all(groupDataPromises);
        const userGroups = groupDataResults.filter((g): g is GroupData => g !== null);

        setGroups(userGroups);
      } catch (error) {
        console.error('Error loading groups:', error);
      } finally {
        setGroupsLoading(false);
      }
    }

    if (wallet?.address) {
      loadGroups();
    }
  }, [wallet?.address]);

  const handleGroupClick = (group: GroupData) => {
    // Store group in session for bet creation
    sessionStorage.setItem('friendfi_current_group', JSON.stringify({
      id: group.id,
      name: group.name,
    }));
    router.push(`/groups/${group.id}`);
  };

  // Show login banner if not authenticated, but still show dashboard content

  // Determine if we're in a loading state
  const isLoading = walletLoading || groupsLoading;

  return (
    <>
      <ProfileSetupModal 
        isOpen={showProfileSetup}
        onComplete={handleProfileSetup}
        onSaving={savingProfile}
      />
      
      <div className="flex min-h-screen bg-background">
        <Sidebar />

        <main className="flex-1 mobile-content lg:p-0 lg:py-16">
        <div className="p-4 sm:p-6 pt-8 pb-12 lg:p-8 lg:pt-0 lg:pb-0">
          {/* Login Banner - shown when not authenticated */}
          {!authenticated && (
            <Card className="mb-6 border-2 border-primary">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 border-2 border-text flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl text-text">fingerprint</span>
                    </div>
                    <div>
                      <h3 className="text-text font-display font-bold text-lg">Sign In to Access Your Groups</h3>
                      <p className="text-accent text-sm font-mono">
                        {isRegistered 
                          ? 'Use biometric authentication to access your wallet and groups.'
                          : 'Create a secure biometric wallet to get started.'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={handleLogin}
                    disabled={isAuthenticating || isRegistering}
                    className="w-full sm:w-auto"
                  >
                    {isAuthenticating || isRegistering ? (
                      <>
                        <div className="brutalist-spinner-instant">
                          <div className="brutalist-spinner-box-instant" />
                          <div className="brutalist-spinner-box-instant" />
                          <div className="brutalist-spinner-box-instant" />
                          <div className="brutalist-spinner-box-instant" />
                        </div>
                        {isRegistering ? 'Setting up...' : 'Authenticating...'}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">fingerprint</span>
                        {isRegistered ? 'Sign In' : 'Create Wallet'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Loading State - only show if authenticated and loading */}
          {authenticated && isLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="brutalist-spinner-instant mx-auto mb-4">
                  <div className="brutalist-spinner-box-instant" />
                  <div className="brutalist-spinner-box-instant" />
                  <div className="brutalist-spinner-box-instant" />
                  <div className="brutalist-spinner-box-instant" />
                </div>
                <p className="text-accent font-mono text-sm">Loading your groups from the blockchain...</p>
              </CardContent>
            </Card>
          ) : !authenticated ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-20 h-20 bg-primary/20 border-2 border-text flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-text">groups</span>
                </div>
                <h2 className="text-text text-2xl font-display font-bold mb-3">Sign In to View Groups</h2>
                <p className="text-accent max-w-md mx-auto mb-8 font-mono">
                  Create or join groups to start wagering with friends. Sign in above to get started.
                </p>
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
                  Create a group for each trip, event, or shared activity. Each group has its own expense tracker and private prediction market.
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
