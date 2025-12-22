'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/ui/Logo';
import { MobileNav } from './MobileNav';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getUSDCBalance } from '@/lib/indexer';
import { getProfile } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  { href: '/transactions', label: 'Transactions', icon: 'receipt' },
];

const bottomNavItems: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { wallet: moveWallet } = useMoveWallet();
  const [userSettings, setUserSettings] = useState<{ username?: string; avatarUrl?: string } | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Load USDC balance from indexer
  const loadUSDCBalance = useCallback(async () => {
    if (!moveWallet?.address) return;
    
    setLoadingBalance(true);
    try {
      const balance = await getUSDCBalance(moveWallet.address);
      setUsdcBalance(balance);
    } catch (error) {
      console.error('Error loading USDC balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  }, [moveWallet?.address]);

  // Load user settings from blockchain and session storage
  const loadSettings = useCallback(async () => {
    if (!moveWallet?.address) return;
    
    // First, check session storage for immediate display
    const saved = sessionStorage.getItem('friendfi_user_settings');
    if (saved) {
      setUserSettings(JSON.parse(saved));
    }
    
    // Then load from blockchain and update if it exists
    try {
      const profile = await getProfile(moveWallet.address);
      if (profile.exists) {
        const avatar = getAvatarById(profile.avatarId);
        const url = avatar ? getAvatarUrl(avatar.seed, avatar.style) : `https://api.dicebear.com/7.x/adventurer/svg?seed=default&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
        
        const settings = {
          username: profile.name,
          avatarId: profile.avatarId,
          avatarUrl: url,
        };
        
        // Update session storage
        sessionStorage.setItem('friendfi_user_settings', JSON.stringify(settings));
        setUserSettings(settings);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [moveWallet?.address]);

  useEffect(() => {
    loadSettings();
    loadUSDCBalance();

    // Listen for profile updates
    const handleProfileUpdate = (e: CustomEvent) => {
      setUserSettings(e.detail);
    };

    window.addEventListener('profile-updated', handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate as EventListener);
    };
  }, [loadSettings, loadUSDCBalance]);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/groups') || pathname.startsWith('/bets');
    }
    return pathname.startsWith(href);
  };

  const displayName = userSettings?.username || 'Anonymous';
  const fallbackAvatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=default&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
  const avatarUrl = userSettings?.avatarUrl || fallbackAvatarUrl;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col bg-surface border-r-2 border-text h-screen sticky top-0">
        <div className="flex h-full flex-col justify-between">
          <div className="flex flex-col">
            {/* Logo */}
            <div className="px-4 py-4 border-b-2 border-text">
              <Logo size="md" />
            </div>

            {/* User Info */}
            {moveWallet && (
              <div className="border-b-2 border-text">
                <Link href="/settings" className="flex gap-3 px-4 py-4 group hover:bg-primary/20 transition-colors">
                  <img 
                    src={avatarUrl}
                    alt="Your avatar"
                    className="w-12 h-12 border-2 border-text group-hover:border-primary transition-colors"
                  />
                  <div className="flex flex-col overflow-hidden flex-1">
                    <h2 className="text-text text-sm font-bold font-mono truncate group-hover:text-accent transition-colors">
                      {displayName}
                    </h2>
                    <p className="text-accent text-xs font-mono">
                      ${loadingBalance ? '...' : (usdcBalance / 1_000_000).toFixed(2)}
                    </p>
                  </div>
                </Link>
              </div>
            )}

            {/* Main Navigation */}
            <nav className="flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 border-b-2 border-text transition-all font-mono uppercase text-sm tracking-wider
                    ${isActive(item.href) 
                      ? 'bg-primary text-text' 
                      : 'text-text hover:bg-primary/20'
                    }
                  `}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <p className="font-bold">{item.label}</p>
                </Link>
              ))}
            </nav>
          </div>

          {/* Bottom Navigation */}
          <div className="flex flex-col border-t-2 border-text">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 border-b-2 border-text transition-all font-mono uppercase text-sm tracking-wider
                  ${isActive(item.href) 
                    ? 'bg-primary text-text' 
                    : 'text-text hover:bg-primary/20'
                  }
                `}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <p className="font-bold">{item.label}</p>
              </Link>
            ))}
            
            {moveWallet && (
              <button
                onClick={() => logout()}
                className="flex items-center gap-3 px-4 py-3 text-secondary hover:bg-secondary/20 transition-colors font-mono uppercase text-sm tracking-wider"
              >
                <span className="material-symbols-outlined">logout</span>
                <p className="font-bold">Sign Out</p>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </>
  );
}
