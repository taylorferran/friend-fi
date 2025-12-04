'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to dashboard - groups are now shown there
export default function GroupsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="brutalist-spinner">
        <div className="brutalist-spinner-box"></div>
        <div className="brutalist-spinner-box"></div>
        <div className="brutalist-spinner-box"></div>
        <div className="brutalist-spinner-box"></div>
      </div>
    </div>
  );
}
