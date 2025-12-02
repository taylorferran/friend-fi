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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0510]/95 backdrop-blur-lg border-t border-white/10 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const isCreate = item.href === '/bets/create';
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${
                isCreate 
                  ? 'bg-[#7311d4] text-white -mt-4 shadow-lg shadow-[#7311d4]/30' 
                  : active 
                    ? 'text-[#7311d4]' 
                    : 'text-white/50'
              }`}
            >
              <span className={`material-symbols-outlined ${isCreate ? 'text-2xl' : 'text-xl'}`}>
                {item.icon}
              </span>
              {!isCreate && (
                <span className="text-[10px] font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

