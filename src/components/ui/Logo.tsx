'use client';

import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

// Friends icon - two people together
export function FriendsIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Left person */}
      <circle cx="10" cy="8" r="5" fill="currentColor" />
      <path 
        d="M2 26C2 20.4772 6.47715 16 12 16H12C14.2091 16 16 17.7909 16 20V26C16 27.1046 15.1046 28 14 28H4C2.89543 28 2 27.1046 2 26Z" 
        fill="currentColor" 
        opacity="0.7"
      />
      {/* Right person */}
      <circle cx="22" cy="8" r="5" fill="currentColor" />
      <path 
        d="M16 26C16 20.4772 20.4772 16 26 16H26C28.2091 16 30 17.7909 30 20V26C30 27.1046 29.1046 28 28 28H18C16.8954 28 16 27.1046 16 26Z" 
        fill="currentColor" 
      />
    </svg>
  );
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
      <div className={`${sizeClasses[size]} text-[#7311d4]`}>
        <FriendsIcon className="w-full h-full" />
      </div>
      {showText && (
        <span className={`${textSizes[size]} font-bold text-white`}>Friend-Fi</span>
      )}
    </Link>
  );
}
