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
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=7311d4,E42575,10B981&backgroundType=gradientLinear`;
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
      <aside className="hidden lg:flex w-64 flex-col bg-[#191022]/30 p-4 backdrop-blur-sm border-r border-white/5 h-screen sticky top-0">
        <div className="flex h-full flex-col justify-between">
          <div className="flex flex-col gap-8">
            {/* Logo */}
            <div className="px-2">
              <Logo size="md" />
            </div>

            {/* User Info */}
            {user && (
              <Link href="/settings" className="flex gap-3 px-2 group">
                <img 
                  src={avatarUrl}
                  alt="Your avatar"
                  className="w-10 h-10 rounded-full ring-2 ring-white/10 group-hover:ring-[#7311d4]/50 transition-all"
                />
                <div className="flex flex-col overflow-hidden">
                  <h2 className="text-white text-sm font-medium truncate group-hover:text-[#7311d4] transition-colors">
                    {displayName}
                  </h2>
                  <p className="text-neutral-400 text-xs truncate">
                    {user.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : 'No wallet'}
                  </p>
                </div>
              </Link>
            )}

            {/* Main Navigation */}
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                    ${isActive(item.href) 
                      ? 'bg-[#7311d4]/20 text-white' 
                      : 'text-neutral-400 hover:bg-[#7311d4]/10 hover:text-white'
                    }
                  `}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <p className="text-sm font-medium">{item.label}</p>
                </Link>
              ))}
            </nav>
          </div>

          {/* Bottom Navigation */}
          <div className="flex flex-col gap-2">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                  ${isActive(item.href) 
                    ? 'bg-[#7311d4]/20 text-white' 
                    : 'text-neutral-400 hover:bg-[#7311d4]/10 hover:text-white'
                  }
                `}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <p className="text-sm font-medium">{item.label}</p>
              </Link>
            ))}
            
            {user && (
              <button
                onClick={() => logout()}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <span className="material-symbols-outlined">logout</span>
                <p className="text-sm font-medium">Sign Out</p>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#0a0510]/95 backdrop-blur-lg border-b border-white/10 px-4 py-3 safe-area-pt">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          {user && (
            <Link href="/settings">
              <img 
                src={avatarUrl}
                alt="Your avatar"
                className="w-8 h-8 rounded-full ring-2 ring-white/10"
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
