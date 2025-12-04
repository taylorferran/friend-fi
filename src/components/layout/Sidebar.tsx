'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Logo } from '@/components/ui/Logo';
import { MobileNav } from './MobileNav';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
  { href: '/groups/crypto-degens', label: 'Group', icon: 'groups' },
  { href: '/bets', label: 'My Bets', icon: 'confirmation_number' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
];

const bottomNavItems: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

function getAvatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = usePrivy();
  const [userSettings, setUserSettings] = useState<{ username?: string; avatarUrl?: string } | null>(null);

  // Load user settings
  useEffect(() => {
    const saved = sessionStorage.getItem('friendfi_user_settings');
    if (saved) {
      setUserSettings(JSON.parse(saved));
    }
  }, []);

  const isActive = (href: string) => pathname.startsWith(href);

  const displayName = userSettings?.username || user?.email?.address?.split('@')[0] || 'Anonymous';
  const avatarUrl = userSettings?.avatarUrl || getAvatarUrl('default');

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-surface border-r-2 border-text h-screen sticky top-0">
        <div className="flex h-full flex-col justify-between">
          <div className="flex flex-col">
            {/* Logo */}
            <div className="px-4 py-4 border-b-2 border-text">
              <Logo size="md" />
            </div>

            {/* User Info */}
            {user && (
              <Link href="/settings" className="flex gap-3 px-4 py-4 border-b-2 border-text group hover:bg-primary/20 transition-colors">
                <img 
                  src={avatarUrl}
                  alt="Your avatar"
                  className="w-10 h-10 border-2 border-text group-hover:border-primary transition-colors"
                />
                <div className="flex flex-col overflow-hidden">
                  <h2 className="text-text text-sm font-bold font-mono truncate group-hover:text-accent transition-colors">
                    {displayName}
                  </h2>
                  <p className="text-accent text-xs font-mono truncate">
                    {user.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : 'No wallet'}
                  </p>
                </div>
              </Link>
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
            
            {user && (
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

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b-2 border-text px-4 py-3 safe-area-pt">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          {user && (
            <Link href="/settings">
              <img 
                src={avatarUrl}
                alt="Your avatar"
                className="w-8 h-8 border-2 border-text"
              />
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </>
  );
}
