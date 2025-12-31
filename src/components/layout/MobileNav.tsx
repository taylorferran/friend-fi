'use client';

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

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/groups') || pathname.startsWith('/bets');
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t-2 border-text" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 flex-1 transition-all font-mono ${
                isActive(item.href) ? 'text-primary' : 'text-accent'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">{item.icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
