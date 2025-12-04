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
  { href: '/bets', label: 'Bets', icon: 'casino' },
  { href: '/bets/create', label: 'New', icon: 'add_circle' },
  { href: '/leaderboard', label: 'Rank', icon: 'leaderboard' },
  { href: '/settings', label: 'Profile', icon: 'person' },
];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/bets/create') return pathname === href;
    return pathname.startsWith(href) && href !== '/bets/create';
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t-2 border-text safe-area-pb">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const isCreate = item.href === '/bets/create';
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-3 px-3 transition-all font-mono ${
                isCreate 
                  ? 'bg-primary text-text -mt-4 border-2 border-text shadow-[2px_2px_0_theme(colors.text)]' 
                  : active 
                    ? 'text-primary' 
                    : 'text-accent'
              }`}
            >
              <span className={`material-symbols-outlined ${isCreate ? 'text-2xl' : 'text-xl'}`}>
                {item.icon}
              </span>
              {!isCreate && (
                <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
