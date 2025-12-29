'use client';

import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  show: boolean;
  minimumDisplayTime?: number;
}

export function LoadingScreen({ show, minimumDisplayTime = 300 }: LoadingScreenProps) {
  const [visible, setVisible] = useState(show);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setFadeOut(false);
    } else {
      // When hiding, trigger fade out first
      setFadeOut(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, minimumDisplayTime);
      return () => clearTimeout(timer);
    }
  }, [show, minimumDisplayTime]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3 animate-pulse-slow">
          <div className="w-12 h-12 bg-primary border-2 border-text flex items-center justify-center">
            <span className="font-display text-2xl font-bold text-text">F</span>
          </div>
          <span className="font-display text-2xl font-bold text-text">Friend-Fi</span>
        </div>
        
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

// Minimal spinner for inline use
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-12 h-12 border-4',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin`} />
  );
}


