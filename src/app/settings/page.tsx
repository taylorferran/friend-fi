'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { CONTRACT_ADDRESS, getProfile } from '@/lib/contract';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { AVATAR_OPTIONS, getAvatarUrl } from '@/lib/avatars';

export default function SettingsPage() {
  const router = useRouter();
  const { authenticated, ready, user, logout } = usePrivy();
  const { wallet: moveWallet, balance, refreshBalance, setProfile } = useMoveWallet();
  const { showToast } = useToast();
  
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [hasOnChainProfile, setHasOnChainProfile] = useState(false);

  const copyAddress = async () => {
    if (moveWallet?.address) {
      await navigator.clipboard.writeText(moveWallet.address);
      setCopied(true);
      showToast({ type: 'info', title: 'Address copied!' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Load on-chain profile
  useEffect(() => {
    async function loadProfile() {
      if (!moveWallet?.address) return;
      
      try {
        const profile = await getProfile(moveWallet.address);
        if (profile.exists) {
          setUsername(profile.name);
          const avatar = AVATAR_OPTIONS.find(a => a.id === profile.avatarId);
          if (avatar) setSelectedAvatar(avatar);
          setHasOnChainProfile(true);
        } else {
          // Fall back to session storage
          const savedSettings = sessionStorage.getItem('friendfi_user_settings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            setUsername(settings.username || '');
            const avatar = AVATAR_OPTIONS.find(a => a.id === settings.avatarId);
            if (avatar) setSelectedAvatar(avatar);
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [moveWallet?.address]);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
    }
  }, [ready, authenticated, router]);

  const handleSave = async () => {
    if (!username.trim()) {
      showToast({ type: 'error', title: 'Username required', message: 'Please enter a display name' });
      return;
    }

    setSaving(true);
    
    try {
      // Save to blockchain
      const result = await setProfile(username, selectedAvatar.id);
      
      // Also save to session storage for immediate UI updates
      const settings = {
        username,
        avatarId: selectedAvatar.id,
        avatarUrl: getAvatarUrl(selectedAvatar.seed, selectedAvatar.style),
      };
      sessionStorage.setItem('friendfi_user_settings', JSON.stringify(settings));

      // Dispatch event to trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: settings }));

      setHasOnChainProfile(true);
      showToast({ 
        type: 'success', 
        title: 'Profile saved on-chain!', 
        txHash: result.hash 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      showToast({ type: 'error', title: 'Transaction failed', message });
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutalist-spinner-instant">
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 pt-8 pb-12 lg:p-8 lg:pt-12 lg:pb-16 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Settings</h1>
            <p className="text-accent font-mono">Customize your profile and preferences.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column - Profile */}
            <div>
          {/* Profile Section */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-text text-xl font-display font-bold">Profile</h2>
                {hasOnChainProfile && (
                  <span className="px-2 py-1 bg-green-600/20 border border-green-600 text-green-600 text-xs font-mono font-bold uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    On-chain
                  </span>
                )}
              </div>

              {loadingProfile ? (
                <div className="flex items-center justify-center py-8">
                  <div className="brutalist-spinner-instant">
                    <div className="brutalist-spinner-box-instant"></div>
                    <div className="brutalist-spinner-box-instant"></div>
                    <div className="brutalist-spinner-box-instant"></div>
                    <div className="brutalist-spinner-box-instant"></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-8 p-4 border-2 border-text bg-background">
                    <img 
                      src={getAvatarUrl(selectedAvatar.seed, selectedAvatar.style)} 
                      alt="Your avatar"
                      className="w-20 h-20 border-4 border-primary"
                    />
                    <div>
                      <p className="text-text font-display font-bold text-lg">{username || 'Anonymous'}</p>
                      <p className="text-accent text-sm font-mono">{user?.email?.address}</p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <Input
                      label="Display Name"
                      placeholder="Enter your display name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      hint="This will be stored on-chain and visible to other users"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="text-text text-base font-bold font-mono uppercase tracking-wider block mb-4">
                      Choose Avatar
                    </label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                      {AVATAR_OPTIONS.map((avatar) => (
                        <button
                          key={avatar.id}
                          onClick={() => setSelectedAvatar(avatar)}
                          className={`relative w-12 h-12 overflow-hidden transition-all duration-200 border-2 ${
                            selectedAvatar.id === avatar.id
                              ? 'border-primary scale-110 shadow-[2px_2px_0_theme(colors.primary)]'
                              : 'border-text hover:border-primary hover:scale-105'
                          }`}
                        >
                          <img 
                            src={getAvatarUrl(avatar.seed, avatar.style)} 
                            alt={`Avatar ${avatar.id}`}
                            className="w-full h-full object-cover"
                          />
                          {selectedAvatar.id === avatar.id && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <span className="material-symbols-outlined text-text text-sm">check</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save Button - Right after profile editing */}
                  <Button 
                    onClick={handleSave} 
                    loading={saving}
                    className="w-full"
                    disabled={loadingProfile}
                  >
                    <span className="material-symbols-outlined">save</span>
                    Save to Blockchain
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
            </div>

            {/* Right Column - Account */}
            <div className="space-y-6">
          {/* Account Section */}
          <Card>
            <CardContent>
              <h2 className="text-text text-xl font-display font-bold mb-6">Account</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 border-text bg-background">
                  <div>
                    <p className="text-text font-mono font-bold">Email</p>
                    <p className="text-accent text-sm font-mono">{user?.email?.address || 'Not connected'}</p>
                  </div>
                  <span className="material-symbols-outlined text-green-600">verified</span>
                </div>

                {/* Move Wallet Address - Copyable */}
                <div className="p-4 border-2 border-primary bg-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-text font-mono font-bold">Move Wallet</p>
                      <span className="text-[10px] font-mono font-bold uppercase bg-primary text-text px-2 py-0.5">
                        For Transactions
                      </span>
                    </div>
                    <button
                      onClick={copyAddress}
                      className="flex items-center gap-1 text-primary hover:text-text transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {copied ? 'check' : 'content_copy'}
                      </span>
                      <span className="text-xs font-mono font-bold uppercase">
                        {copied ? 'Copied!' : 'Copy'}
                      </span>
                    </button>
                  </div>
                  <p className="text-accent text-xs font-mono break-all select-all bg-surface p-2 border border-text/20">
                    {moveWallet?.address || 'Loading...'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-accent/60 text-xs font-mono">
                      Send MOVE tokens to this address for gas fees
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-text font-mono font-bold text-sm">{balance.toFixed(4)} MOVE</span>
                      <button onClick={refreshBalance} className="text-primary hover:text-text">
                        <span className="material-symbols-outlined text-sm">refresh</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border-2 border-text bg-background">
                  <div>
                    <p className="text-text font-mono font-bold">Network</p>
                    <p className="text-accent text-sm font-mono">Movement Testnet</p>
                  </div>
                  <span className="w-3 h-3 bg-green-500 animate-pulse" />
                </div>

                <div className="flex items-center justify-between p-4 border-2 border-text bg-background">
                  <div>
                    <p className="text-text font-mono font-bold">Contract</p>
                    <p className="text-accent text-[10px] font-mono break-all">
                      {CONTRACT_ADDRESS}
                    </p>
                  </div>
                  <a 
                    href={`https://explorer.movementnetwork.xyz/account/${CONTRACT_ADDRESS}?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-text transition-colors"
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sign Out Button */}
          <Button 
            variant="danger" 
            onClick={() => logout()}
            className="w-full"
          >
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
