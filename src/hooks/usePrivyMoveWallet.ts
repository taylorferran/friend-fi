'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { signAndSubmitWithPrivy } from '@/lib/privy-move-wallet';
import { signAndSubmitTransaction as signDirectly } from '@/lib/move-wallet';
import { deriveAptosAddressFromPublicKey } from '@/lib/address-utils';
import type { MoveWallet } from '@/lib/move-wallet';

const BIOMETRIC_AUTH_KEY = 'friendfi_biometric_authenticated';

interface PrivyWalletInfo {
  walletId: string;
  address: string;
  publicKey: string;
}

/**
 * Hook to get Privy embedded wallet for Movement network
 * Returns wallet info if available, null otherwise
 */
export function usePrivyMoveWallet(): PrivyWalletInfo | null {
  const { user, authenticated, ready } = usePrivy();
  const [walletInfo, setWalletInfo] = useState<PrivyWalletInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated || !user) {
      setWalletInfo(null);
      return;
    }

    async function fetchWalletInfo() {
      setLoading(true);
      try {
        // Get embedded wallet from Privy user
        // Privy creates embedded wallets on login for Movement network
        // Check multiple possible locations for wallet info
        let walletId = '';
        let address = '';

        // Try user.wallet first (most common)
        if ((user as any).wallet) {
          const wallet = (user as any).wallet;
          walletId = wallet.walletId || wallet.id || '';
          address = wallet.address || '';
        }
        
        // Try linkedAccounts
        if ((!walletId || !address) && user?.linkedAccounts) {
          const embeddedWallet = user.linkedAccounts.find(
            (account: any) => account.type === 'wallet' || account.walletClientType === 'privy'
          );
          if (embeddedWallet) {
            walletId = (embeddedWallet as any).walletId || (embeddedWallet as any).id || walletId;
            address = (embeddedWallet as any).address || address;
          }
        }

        // Try wallet property directly on user
        if ((!walletId || !address) && (user as any).wallet) {
          const wallet = (user as any).wallet;
          walletId = wallet.walletId || wallet.id || walletId;
          address = wallet.address || address;
        }

        if (!address) {
          setWalletInfo(null);
          setLoading(false);
          return;
        }

        // If we have walletId, fetch public key from Privy API
        if (walletId) {
          try {
            const response = await fetch('/api/privy-wallet-info', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletId }),
            });

            if (response.ok) {
              const { publicKey } = await response.json();
              setWalletInfo({
                walletId,
                address,
                publicKey: publicKey || '',
              });
            } else {
              // If we can't get public key, still set wallet info
              setWalletInfo({
                walletId,
                address,
                publicKey: '',
              });
            }
          } catch (err) {
            // If API call fails, still set wallet info without public key
            setWalletInfo({
              walletId,
              address,
              publicKey: '',
            });
          }
        } else {
          // No walletId but we have address - might be able to derive or fetch later
          setWalletInfo({
            walletId: '',
            address,
            publicKey: '',
          });
        }
      } catch (error) {
        console.error('Error fetching Privy wallet info:', error);
        setWalletInfo(null);
      } finally {
        setLoading(false);
      }
    }

    fetchWalletInfo();
  }, [user, authenticated, ready]);

  return walletInfo;
}

/**
 * Unified transaction signing hook
 * Uses Privy if available, falls back to direct signing
 */
export function useUnifiedMoveWallet() {
  const privyWallet = usePrivyMoveWallet();
  const { authenticated: privyAuthenticated } = usePrivy();
  const [isBiometricAuth, setIsBiometricAuth] = useState(false);
  const [wallet, setWallet] = useState<MoveWallet | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsBiometricAuth(localStorage.getItem(BIOMETRIC_AUTH_KEY) === 'true');
    }
  }, []);

  // Track the last wallet address to avoid unnecessary updates
  const lastWalletAddressRef = useRef<string | null>(null);
  
  // Get wallet address - from Privy if available, otherwise from localStorage
  useEffect(() => {
    async function determineWallet() {
      // Determine which wallet to use
      let newWallet: MoveWallet | null = null;
      let walletSource = '';
      
      if (privyWallet) {
        // For Privy wallets, we need to use the address that matches what was used in transactions
        // When we build transactions, we pad the Ethereum address, so the signer address should match
        // However, the actual Aptos address derived from the public key might be different
        // For now, we'll use the padded Ethereum address, but ideally we'd derive from public key
        let aptosAddress = privyWallet.address.startsWith('0x') 
          ? `0x${privyWallet.address.slice(2).padStart(64, '0')}`
          : `0x${privyWallet.address.padStart(64, '0')}`;
        
        // TODO: Derive actual Aptos address from Ed25519 public key
        // For now, we use the padded Ethereum address
        // The issue is that the profile might have been saved with the actual Aptos address
        // derived from the public key, not the padded address
        // This is a known limitation - we need SHA3-256 to properly derive the address
        console.log(
          `[useUnifiedMoveWallet] Using Privy wallet:`,
          `\n  Ethereum address (from Privy): ${privyWallet.address}`,
          `\n  Padded Aptos address (for queries): ${aptosAddress}`,
          `\n  NOTE: If profile was saved with different address format, it may not be found`
        );
        
        // Check for conflict: if user has biometric wallet, warn about address mismatch
        if (isBiometricAuth) {
          const stored = localStorage.getItem('friendfi_move_wallet');
          if (stored) {
            try {
              const biometricWallet = JSON.parse(stored);
              const biometricNormalized = biometricWallet.address.startsWith('0x') 
                ? `0x${biometricWallet.address.slice(2).padStart(64, '0')}`
                : `0x${biometricWallet.address.padStart(64, '0')}`;
              const privyNormalized = aptosAddress.startsWith('0x') 
                ? `0x${aptosAddress.slice(2).padStart(64, '0')}`
                : `0x${aptosAddress.padStart(64, '0')}`;
              
              if (privyNormalized !== biometricNormalized) {
                console.warn(
                  '[useUnifiedMoveWallet] WARNING: Address mismatch detected!',
                  '\n  Privy Aptos address:', privyNormalized,
                  '\n  Biometric address:', biometricNormalized,
                  '\n  Using Privy address. Profile/transactions saved with biometric address may not be visible.'
                );
              }
            } catch (e) {
              console.error('[useUnifiedMoveWallet] Failed to check for address conflict:', e);
            }
          }
        }
        
        newWallet = {
          address: aptosAddress, // Use the derived Aptos address if available, otherwise padded
          privateKeyHex: '', // Not needed for Privy wallets
        };
        walletSource = 'Privy';
      } else if (isBiometricAuth) {
        // For biometric, get from localStorage
        const stored = localStorage.getItem('friendfi_move_wallet');
        if (stored) {
          try {
            newWallet = JSON.parse(stored);
            walletSource = 'Biometric';
          } catch {
            console.error('[useUnifiedMoveWallet] Failed to parse biometric wallet from localStorage');
            newWallet = null;
          }
        } else {
          console.warn('[useUnifiedMoveWallet] Biometric auth set but no wallet in localStorage');
          newWallet = null;
        }
      } else {
        newWallet = null;
        walletSource = 'None';
      }
      
      // Only update if the address actually changed
      const newAddress = newWallet?.address || null;
      if (newAddress !== lastWalletAddressRef.current) {
        if (newAddress) {
          console.log(`[useUnifiedMoveWallet] Using ${walletSource} wallet:`, newAddress);
        } else {
          console.log(`[useUnifiedMoveWallet] No wallet available (${walletSource})`);
        }
        lastWalletAddressRef.current = newAddress;
        setWallet(newWallet);
      }
    }
    
    determineWallet();
  }, [privyWallet, isBiometricAuth]);

  /**
   * Sign and submit transaction
   * Uses Privy if available, falls back to direct signing
   */
  const signAndSubmitTransaction = useCallback(async (
    payload: {
      function: `${string}::${string}::${string}`;
      typeArguments: string[];
      functionArguments: (string | string[])[];
    }
  ): Promise<{ hash: string; success: boolean }> => {
    // Use Privy if available and user is authenticated via Privy
    if (privyWallet && privyAuthenticated && privyWallet.publicKey) {
      return signAndSubmitWithPrivy(
        privyWallet.walletId,
        privyWallet.publicKey,
        privyWallet.address,
        payload
      );
    }
    
    // Fallback to direct signing (for biometric users or if Privy not available)
    return signDirectly(payload);
  }, [privyWallet, privyAuthenticated]);

  return {
    wallet,
    signAndSubmitTransaction,
    isPrivyWallet: !!privyWallet,
    isBiometricWallet: isBiometricAuth,
  };
}


