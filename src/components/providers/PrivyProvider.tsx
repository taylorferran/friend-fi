'use client';

import dynamic from 'next/dynamic';
import { privyConfig } from '@/lib/privy-config';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Loading component shown while Privy loads
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#7311d4] border-t-transparent rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// Setup instructions when no App ID
function SetupInstructions() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4 bg-white/5 border border-white/10 rounded-xl p-8">
        <div className="text-4xl">🔑</div>
        <h2 className="text-xl font-bold text-white">Privy App ID Required</h2>
        <div className="text-left text-sm text-white/70 space-y-2">
          <span className="block">To configure Privy authentication:</span>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Go to <a href="https://dashboard.privy.io" className="text-[#7311d4] hover:underline" target="_blank" rel="noreferrer">dashboard.privy.io</a></li>
            <li>Create or select an app</li>
            <li>Copy your App ID</li>
            <li>Create <code className="bg-white/10 px-1 rounded">.env.local</code> in project root</li>
            <li>Add: <code className="bg-white/10 px-1 rounded text-xs">NEXT_PUBLIC_PRIVY_APP_ID=your_id</code></li>
            <li>Restart the dev server</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// Dynamically import PrivyProvider with SSR disabled to avoid hydration issues
const PrivyProviderNoSSR = dynamic(
  () => import('@privy-io/react-auth').then((mod) => {
    const { PrivyProvider } = mod;
    
    // Return a component that wraps PrivyProvider
    return function PrivyWrapper({ children }: { children: React.ReactNode }) {
      if (!PRIVY_APP_ID) {
        return <SetupInstructions />;
      }
      
      return (
        <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
          {children}
        </PrivyProvider>
      );
    };
  }),
  {
    ssr: false,
    loading: () => <LoadingFallback />,
  }
);

export function PrivyProviderWrapper({ children }: { children: React.ReactNode }) {
  // If no App ID, show setup instructions immediately (no need to load Privy)
  if (!PRIVY_APP_ID) {
    return <SetupInstructions />;
  }
  
  return <PrivyProviderNoSSR>{children}</PrivyProviderNoSSR>;
}
