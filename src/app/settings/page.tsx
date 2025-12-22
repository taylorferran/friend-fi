'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { getProfile } from '@/lib/contract';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { useBiometricWallet } from '@/hooks/useBiometricWallet';
import { useAuth } from '@/hooks/useAuth';
import { AVATAR_OPTIONS, getAvatarUrl } from '@/lib/avatars';
import { upsertProfile } from '@/lib/supabase-services';
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

export default function SettingsPage() {
  const router = useRouter();
  const { authenticated, ready, user, logout } = useAuth();
  const { wallet: moveWallet, balance, refreshBalance, setProfile } = useMoveWallet();
  const { isRegistered, register, remove, isRegistering } = useBiometricWallet();
  const { showToast } = useToast();
  
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [hasOnChainProfile, setHasOnChainProfile] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

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

    if (!moveWallet?.address) {
      showToast({ type: 'error', title: 'Wallet not connected' });
      return;
    }

    setSaving(true);
    
    try {
      // 🎉 NEW: Save to Supabase (off-chain, instant, no gas!)
      await upsertProfile(
        moveWallet.address,
        username,
        selectedAvatar.id
      );
      
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
        title: '✨ Profile saved to database!', 
        message: 'Instant, gasless, permanent storage'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      showToast({ type: 'error', title: 'Save failed', message });
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!moveWallet?.privateKeyHex) {
      showToast({ type: 'error', title: 'Wallet not found' });
      return;
    }

    if (!withdrawAddress.trim()) {
      showToast({ type: 'error', title: 'Enter recipient address' });
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast({ type: 'error', title: 'Invalid amount' });
      return;
    }

    setWithdrawing(true);

    try {
      showToast({ type: 'info', title: `Withdrawing $${amount}...` });
      
      // Movement Testnet USDC metadata address
      const USDC_METADATA_ADDR = "0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7";
      
      const config = new AptosConfig({
        network: Network.CUSTOM,
        fullnode: "https://testnet.movementnetwork.xyz/v1",
        indexer: "https://indexer.testnet.movementnetwork.xyz/v1/graphql",
      });
      const aptos = new Aptos(config);
      
      // Create account from our wallet
      const privateKey = new Ed25519PrivateKey(moveWallet.privateKeyHex);
      const senderAccount = Account.fromPrivateKey({ privateKey });
      
      // Convert amount to micro-units (6 decimals)
      const amountMicroUSDC = Math.floor(amount * 1_000_000);
      
      // Build transfer transaction
      const transaction = await aptos.transaction.build.simple({
        sender: senderAccount.accountAddress,
        data: {
          function: "0x1::primary_fungible_store::transfer",
          typeArguments: ["0x1::fungible_asset::Metadata"],
          functionArguments: [
            USDC_METADATA_ADDR,
            withdrawAddress,
            amountMicroUSDC.toString()
          ],
        },
      });

      // Sign and submit
      const pendingTxn = await aptos.signAndSubmitTransaction({
        signer: senderAccount,
        transaction,
      });

      // Wait for confirmation
      await aptos.waitForTransaction({
        transactionHash: pendingTxn.hash,
      });

      showToast({ 
        type: 'success', 
        title: `Withdrawn $${amount}!`,
        txHash: pendingTxn.hash
      });
      
      setWithdrawAddress('');
      setWithdrawAmount('');
      refreshBalance();
    } catch (error) {
      console.error('Withdrawal failed:', error);
      showToast({ 
        type: 'error', 
        title: 'Withdrawal failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setWithdrawing(false);
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

      <main className="flex-1 mobile-content p-4 sm:p-6 pt-8 pb-12 lg:p-8 lg:pt-12 lg:pb-16 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-text text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Settings</h1>
            <p className="text-accent font-mono text-sm sm:text-base">Customize your profile and preferences.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column - Profile */}
            <div className="space-y-6">
          {/* Profile Section */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-text text-lg sm:text-xl font-display font-bold">Profile</h2>
                {hasOnChainProfile && (
                  <span className="px-2 py-1 bg-green-600/20 border border-green-600 text-green-600 text-xs font-mono font-bold uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">cloud_done</span>
                    Off-Chain
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
                  <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 p-3 sm:p-4 border-2 border-text bg-background">
                    <img 
                      src={getAvatarUrl(selectedAvatar.seed, selectedAvatar.style)} 
                      alt="Your avatar"
                      className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-primary flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-text font-display font-bold text-base sm:text-lg truncate">{username || 'Anonymous'}</p>
                      <p className="text-accent text-xs sm:text-sm font-mono truncate">
                        {moveWallet?.address ? `${moveWallet.address.slice(0, 10)}...${moveWallet.address.slice(-8)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6 sm:mb-8">
                    <Input
                      label="Display Name"
                      placeholder="Enter your display name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      hint="💾 Saved to database - instant, gasless, permanent"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="text-text text-sm sm:text-base font-bold font-mono uppercase tracking-wider block mb-3 sm:mb-4">
                      Choose Avatar
                    </label>
                    <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
                      {AVATAR_OPTIONS.map((avatar) => (
                        <button
                          key={avatar.id}
                          onClick={() => setSelectedAvatar(avatar)}
                          className={`relative w-10 h-10 sm:w-12 sm:h-12 overflow-hidden transition-all duration-200 border-2 ${
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
                    <span className="material-symbols-outlined">cloud_upload</span>
                    Save Profile (Instant, No Gas)
                  </Button>
                </>
              )}
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

            {/* Right Column - Account */}
            <div className="space-y-6">
          {/* Withdraw Section */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-text text-lg sm:text-xl font-display font-bold mb-4 sm:mb-6">Withdraw USDC</h2>
              <p className="text-accent text-sm font-mono mb-4">
                Send USDC to any Movement wallet address
              </p>
              
              <div className="space-y-4">
                <Input
                  label="Recipient Address"
                  placeholder="0x..."
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  hint="Movement wallet address to send USDC to"
                />
                
                <Input
                  label="Amount (USDC)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  hint="Amount in USDC to withdraw"
                />
                
                <Button 
                  onClick={handleWithdraw}
                  loading={withdrawing}
                  disabled={!withdrawAddress || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  className="w-full"
                >
                  <span className="material-symbols-outlined">send</span>
                  Withdraw USDC
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Section */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-text text-lg sm:text-xl font-display font-bold mb-4 sm:mb-6">Account</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 border-text bg-background">
                  <div>
                    <p className="text-text font-mono font-bold">Email</p>
                    <p className="text-accent text-sm font-mono">
                    {moveWallet?.address ? `${moveWallet.address.slice(0, 10)}...${moveWallet.address.slice(-8)}` : 'Not connected'}
                  </p>
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
                      Balance
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
              </div>
            </CardContent>
          </Card>

          {/* Biometric Login Section - Mobile Only */}
          <Card className="sm:hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <span className="material-symbols-outlined text-text text-xl">fingerprint</span>
                <h2 className="text-text text-lg sm:text-xl font-display font-bold">Biometric Login</h2>
              </div>

              {isRegistered ? (
                <div className="space-y-4">
                  <div className="p-4 border-2 border-green-600 bg-green-600/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-green-600">check_circle</span>
                      <p className="text-text font-mono font-bold">Biometric login enabled</p>
                    </div>
                    <p className="text-accent text-xs font-mono">
                      You can now log in with Face ID/Touch ID on mobile
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={remove}
                    className="w-full"
                  >
                    <span className="material-symbols-outlined">delete</span>
                    Remove Biometric Login
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-accent text-sm font-mono">
                    Biometric login is the primary login method on mobile. Your wallet is secured with Face ID/Touch ID and stored in your device's secure enclave.
                  </p>
                  <p className="text-accent text-xs font-mono">
                    Note: Biometric login is automatically set up on first login. If you removed it, you can re-enable it here.
                  </p>
                  <Button
                    onClick={register}
                    disabled={isRegistering}
                    className="w-full"
                  >
                    {isRegistering ? (
                      <>
                        <div className="brutalist-spinner-instant">
                          <div className="brutalist-spinner-box-instant"></div>
                          <div className="brutalist-spinner-box-instant"></div>
                          <div className="brutalist-spinner-box-instant"></div>
                          <div className="brutalist-spinner-box-instant"></div>
                        </div>
                        Setting up...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">fingerprint</span>
                        Re-enable Biometric Login
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
