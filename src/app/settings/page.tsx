'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { CONTRACT_ADDRESS } from '@/lib/contract';
import { useMoveWallet } from '@/hooks/useMoveWallet';

const AVATAR_OPTIONS = [
  { id: 1, seed: 'felix', style: 'adventurer' },
  { id: 2, seed: 'luna', style: 'adventurer' },
  { id: 3, seed: 'max', style: 'adventurer' },
  { id: 4, seed: 'bella', style: 'adventurer' },
  { id: 5, seed: 'charlie', style: 'adventurer' },
  { id: 6, seed: 'mia', style: 'adventurer' },
  { id: 7, seed: 'leo', style: 'adventurer' },
  { id: 8, seed: 'nova', style: 'adventurer' },
  { id: 9, seed: 'oscar', style: 'adventurer' },
  { id: 10, seed: 'ruby', style: 'adventurer' },
  { id: 11, seed: 'theo', style: 'adventurer' },
  { id: 12, seed: 'ivy', style: 'adventurer' },
  { id: 13, seed: 'milo', style: 'adventurer' },
  { id: 14, seed: 'daisy', style: 'adventurer' },
  { id: 15, seed: 'finn', style: 'adventurer' },
  { id: 16, seed: 'coco', style: 'adventurer' },
  { id: 17, seed: 'archie', style: 'adventurer' },
  { id: 18, seed: 'willow', style: 'adventurer' },
  { id: 19, seed: 'jack', style: 'adventurer' },
  { id: 20, seed: 'penny', style: 'adventurer' },
];

function getAvatarUrl(seed: string, style: string = 'adventurer') {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { authenticated, ready, user, logout } = usePrivy();
  const { wallet: moveWallet, balance, refreshBalance } = useMoveWallet();
  
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (moveWallet?.address) {
      await navigator.clipboard.writeText(moveWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    const savedSettings = sessionStorage.getItem('friendfi_user_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setUsername(settings.username || '');
      const avatar = AVATAR_OPTIONS.find(a => a.id === settings.avatarId);
      if (avatar) setSelectedAvatar(avatar);
    }
  }, []);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
    }
  }, [ready, authenticated, router]);

  const handleSave = async () => {
    setSaving(true);
    
    sessionStorage.setItem('friendfi_user_settings', JSON.stringify({
      username,
      avatarId: selectedAvatar.id,
      avatarUrl: getAvatarUrl(selectedAvatar.seed, selectedAvatar.style),
    }));

    await new Promise(resolve => setTimeout(resolve, 500));
    
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutalist-spinner">
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 lg:p-8 lg:pt-12 lg:pb-16 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Settings</h1>
            <p className="text-accent font-mono">Customize your profile and preferences.</p>
          </div>

          <Card className="mb-6">
            <CardContent>
              <h2 className="text-text text-xl font-display font-bold mb-6">Profile</h2>

              <div className="flex items-center gap-4 mb-8 p-4 border-2 border-text bg-background">
                <img 
                  src={getAvatarUrl(selectedAvatar.seed, selectedAvatar.style)} 
                  alt="Your avatar"
                  className="w-20 h-20 border-4 border-primary"
                />
                <div>
                  <p className="text-text font-display font-bold text-lg">{username || 'Anonymous'}</p>
                  <p className="text-accent text-sm font-mono">{user?.email?.address}</p>
                  {user?.wallet && (
                    <p className="text-accent/60 text-xs font-mono mt-1">
                      {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-8">
                <Input
                  label="Display Name"
                  placeholder="Enter your display name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  hint="This is how other group members will see you"
                />
              </div>

              <div>
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
            </CardContent>
          </Card>

          <Card className="mb-6">
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

          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleSave} 
              loading={saving}
              className="flex-1"
            >
              {saved ? (
                <>
                  <span className="material-symbols-outlined">check</span>
                  Saved!
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">save</span>
                  Save Changes
                </>
              )}
            </Button>
            
            <Button 
              variant="danger" 
              onClick={() => logout()}
            >
              <span className="material-symbols-outlined">logout</span>
              Sign Out
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
