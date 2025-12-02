'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

// Avatar options - DiceBear avatars with different seeds
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
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=7311d4,E42575,10B981&backgroundType=gradientLinear`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { authenticated, ready, user, logout } = usePrivy();
  
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load saved settings
  useEffect(() => {
    const savedSettings = sessionStorage.getItem('friendfi_user_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setUsername(settings.username || '');
      const avatar = AVATAR_OPTIONS.find(a => a.id === settings.avatarId);
      if (avatar) setSelectedAvatar(avatar);
    }
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
    }
  }, [ready, authenticated, router]);

  const handleSave = async () => {
    setSaving(true);
    
    // Save to session storage (would be on-chain in production)
    sessionStorage.setItem('friendfi_user_settings', JSON.stringify({
      username,
      avatarId: selectedAvatar.id,
      avatarUrl: getAvatarUrl(selectedAvatar.seed, selectedAvatar.style),
    }));

    // Simulate save delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7311d4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-white text-3xl lg:text-4xl font-black tracking-tight mb-2">Settings</h1>
            <p className="text-white/60">Customize your profile and preferences.</p>
          </div>

          {/* Profile Section */}
          <Card className="mb-6">
            <CardContent>
              <h2 className="text-white text-xl font-bold mb-6">Profile</h2>

              {/* Current Avatar Preview */}
              <div className="flex items-center gap-4 mb-8 p-4 rounded-xl bg-white/5">
                <img 
                  src={getAvatarUrl(selectedAvatar.seed, selectedAvatar.style)} 
                  alt="Your avatar"
                  className="w-20 h-20 rounded-full ring-4 ring-[#7311d4]/30"
                />
                <div>
                  <p className="text-white font-bold text-lg">{username || 'Anonymous'}</p>
                  <p className="text-white/50 text-sm">{user?.email?.address}</p>
                  {user?.wallet && (
                    <p className="text-white/30 text-xs font-mono mt-1">
                      {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
                    </p>
                  )}
                </div>
              </div>

              {/* Username */}
              <div className="mb-8">
                <Input
                  label="Display Name"
                  placeholder="Enter your display name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  hint="This is how other group members will see you"
                />
              </div>

              {/* Avatar Selection */}
              <div>
                <label className="text-white text-base font-medium block mb-4">
                  Choose Avatar
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`relative w-12 h-12 rounded-full overflow-hidden transition-all duration-200 ${
                        selectedAvatar.id === avatar.id
                          ? 'ring-3 ring-[#7311d4] scale-110'
                          : 'ring-2 ring-white/10 hover:ring-white/30 hover:scale-105'
                      }`}
                    >
                      <img 
                        src={getAvatarUrl(avatar.seed, avatar.style)} 
                        alt={`Avatar ${avatar.id}`}
                        className="w-full h-full object-cover"
                      />
                      {selectedAvatar.id === avatar.id && (
                        <div className="absolute inset-0 bg-[#7311d4]/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-sm">check</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Section */}
          <Card className="mb-6">
            <CardContent>
              <h2 className="text-white text-xl font-bold mb-6">Account</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                  <div>
                    <p className="text-white font-medium">Email</p>
                    <p className="text-white/50 text-sm">{user?.email?.address || 'Not connected'}</p>
                  </div>
                  <span className="material-symbols-outlined text-[#10B981]">verified</span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                  <div>
                    <p className="text-white font-medium">Wallet</p>
                    <p className="text-white/50 text-sm font-mono">
                      {user?.wallet?.address 
                        ? `${user.wallet.address.slice(0, 10)}...${user.wallet.address.slice(-8)}`
                        : 'Not connected'
                      }
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#7311d4]">account_balance_wallet</span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                  <div>
                    <p className="text-white font-medium">Network</p>
                    <p className="text-white/50 text-sm">Movement Testnet</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
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
              variant="ghost" 
              onClick={() => logout()}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

