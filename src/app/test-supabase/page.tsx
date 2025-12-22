'use client';

import { useEffect, useState } from 'react';
import { testSupabaseConnection } from '@/lib/supabase';
import { getProfileFromSupabase, upsertProfile } from '@/lib/supabase-services';
import { useMoveWallet } from '@/hooks/useMoveWallet';

export default function SupabaseTestPage() {
  const { wallet } = useMoveWallet();
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function test() {
      try {
        // Test 1: Connection
        const connected = await testSupabaseConnection();
        if (!connected) {
          setConnectionStatus('error');
          setError('Failed to connect to Supabase');
          return;
        }
        setConnectionStatus('success');

        // Test 2: Try to read profile
        if (wallet?.address) {
          const prof = await getProfileFromSupabase(wallet.address);
          setProfile(prof);
        }
      } catch (err) {
        setConnectionStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    test();
  }, [wallet?.address]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-display font-bold mb-8">Supabase Test</h1>

        <div className="space-y-4">
          {/* Connection Status */}
          <div className="border-2 border-text p-4">
            <h2 className="font-mono font-bold mb-2">Connection Status</h2>
            {connectionStatus === 'testing' && <p>Testing...</p>}
            {connectionStatus === 'success' && (
              <p className="text-green-600">✅ Connected to Supabase</p>
            )}
            {connectionStatus === 'error' && (
              <p className="text-red-600">❌ Connection failed: {error}</p>
            )}
          </div>

          {/* Wallet */}
          <div className="border-2 border-text p-4">
            <h2 className="font-mono font-bold mb-2">Wallet</h2>
            {wallet ? (
              <p className="text-xs font-mono break-all">{wallet.address}</p>
            ) : (
              <p>No wallet connected</p>
            )}
          </div>

          {/* Profile */}
          <div className="border-2 border-text p-4">
            <h2 className="font-mono font-bold mb-2">Profile (Supabase)</h2>
            {profile ? (
              <div className="space-y-2">
                <p>Username: {profile.username}</p>
                <p>Avatar ID: {profile.avatar_id}</p>
                <p>Created: {new Date(profile.created_at).toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-accent">No profile found in Supabase</p>
            )}
          </div>

          {/* Test Button */}
          <button
            onClick={async () => {
              if (!wallet) return;
              try {
                await upsertProfile(wallet.address, 'Test User', 0);
                const prof = await getProfileFromSupabase(wallet.address);
                setProfile(prof);
                alert('Profile created!');
              } catch (err) {
                alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
              }
            }}
            disabled={!wallet}
            className="border-2 border-primary bg-primary text-text px-4 py-2 font-mono font-bold uppercase disabled:opacity-50"
          >
            Test Profile Creation
          </button>
        </div>
      </div>
    </div>
  );
}

