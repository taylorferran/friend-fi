'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to dashboard - bets are now viewed through groups
export default function BetsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="brutalist-spinner-instant">
        <div className="brutalist-spinner-box-instant"></div>
        <div className="brutalist-spinner-box-instant"></div>
        <div className="brutalist-spinner-box-instant"></div>
        <div className="brutalist-spinner-box-instant"></div>
      </div>
    </div>
  );
}
