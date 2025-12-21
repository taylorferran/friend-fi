'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/transactions', label: 'Txns', icon: 'receipt' },
  { href: '/leaderboard', label: 'Ranks', icon: 'leaderboard' },
  { href: '/settings', label: 'Profile', icon: 'person' },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showQuickActions, setShowQuickActions] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/groups') || pathname.startsWith('/bets');
    }
    return pathname.startsWith(href);
  };

  // Determine if we're in a group context for smart "new" button
  const isInGroup = pathname.startsWith('/groups/') && !pathname.includes('/create') && !pathname.includes('/join');
  const groupIdMatch = pathname.match(/\/groups\/(\d+)/);
  const currentGroupId = groupIdMatch ? groupIdMatch[1] : null;

  return (
    <>
      {/* Quick Actions Overlay */}
      {showQuickActions && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-text/50"
          onClick={() => setShowQuickActions(false)}
        >
          <div 
            className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col gap-2 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {isInGroup && currentGroupId ? (
              <>
                <Link
                  href={`/bets/create?groupId=${currentGroupId}&groupName=Group%20${currentGroupId}`}
                  onClick={() => setShowQuickActions(false)}
                  className="flex items-center gap-3 px-6 py-4 bg-primary border-2 border-text text-text font-mono font-bold uppercase tracking-wider shadow-[4px_4px_0_theme(colors.text)]"
                >
                  <span className="material-symbols-outlined">casino</span>
                  New Bet
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/groups/create"
                  onClick={() => setShowQuickActions(false)}
                  className="flex items-center gap-3 px-6 py-4 bg-primary border-2 border-text text-text font-mono font-bold uppercase tracking-wider shadow-[4px_4px_0_theme(colors.text)]"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  Create Group
                </Link>
                <Link
                  href="/groups/join"
                  onClick={() => setShowQuickActions(false)}
                  className="flex items-center gap-3 px-6 py-4 bg-surface border-2 border-text text-text font-mono font-bold uppercase tracking-wider shadow-[4px_4px_0_theme(colors.text)]"
                >
                  <span className="material-symbols-outlined">group_add</span>
                  Join Group
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t-2 border-text safe-area-pb">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-3 px-2 transition-all font-mono ${
                isActive(item.href) ? 'text-primary' : 'text-accent'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </Link>
          ))}

          {/* Center Create Button */}
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className={`flex flex-col items-center gap-1 py-3 px-2 -mt-6 transition-all font-mono ${
              showQuickActions 
                ? 'bg-secondary text-text border-2 border-text shadow-[2px_2px_0_theme(colors.text)]' 
                : 'bg-primary text-text border-2 border-text shadow-[2px_2px_0_theme(colors.text)]'
            }`}
          >
            <span className={`material-symbols-outlined text-2xl transition-transform ${showQuickActions ? 'rotate-45' : ''}`}>
              add
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
