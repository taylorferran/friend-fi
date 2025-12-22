'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { signAndSubmitWithPrivy } from '@/lib/privy-move-wallet';
import { signAndSubmitTransaction as signDirectly } from '@/lib/move-wallet';
import { deriveAptosAddressFromPublicKey, padAddressToAptos } from '@/lib/address-utils';
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
        let foundPublicKey = '';
        if ((user as any).wallet) {
          const wallet = (user as any).wallet;
          walletId = wallet.walletId || wallet.id || '';
          address = wallet.address || '';
          // Try to get public key directly from wallet object
          foundPublicKey = (wallet as any).publicKey || (wallet as any).ed25519PublicKey || '';
        }
        
        // Try linkedAccounts
        if ((!walletId || !address) && user?.linkedAccounts) {
          const embeddedWallet = user.linkedAccounts.find(
            (account: any) => account.type === 'wallet' || account.walletClientType === 'privy'
          );
          if (embeddedWallet) {
            walletId = (embeddedWallet as any).walletId || (embeddedWallet as any).id || walletId;
            address = (embeddedWallet as any).address || address;
            // Try to get public key from linked account
            if (!foundPublicKey) {
              foundPublicKey = (embeddedWallet as any).publicKey || (embeddedWallet as any).ed25519PublicKey || '';
            }
          }
        }

        // Try wallet property directly on user
        if ((!walletId || !address) && (user as any).wallet) {
          const wallet = (user as any).wallet;
          walletId = wallet.walletId || wallet.id || walletId;
          address = wallet.address || address;
          // Try to get public key directly from wallet object
          if (!foundPublicKey) {
            foundPublicKey = (wallet as any).publicKey || (wallet as any).ed25519PublicKey || '';
          }
        }
        
        // If we found public key directly, use it (no need for API call)
        if (foundPublicKey && walletId && address) {
          console.log('[usePrivyMoveWallet] Found public key directly from user object');
          setWalletInfo({
            walletId,
            address,
            publicKey: foundPublicKey,
          });
          setLoading(false);
          return;
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
              const data = await response.json();
              const publicKey = data.publicKey || '';
              
              if (!publicKey) {
                console.warn('[usePrivyMoveWallet] Public key not returned from API for walletId:', walletId);
              } else {
                console.log('[usePrivyMoveWallet] Successfully retrieved public key for walletId:', walletId);
              }
              
              setWalletInfo({
                walletId,
                address,
                publicKey,
              });
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error('[usePrivyMoveWallet] Failed to fetch wallet info:', response.status, errorData);
              // If we can't get public key, still set wallet info but log the error
              setWalletInfo({
                walletId,
                address,
                publicKey: '',
              });
            }
          } catch (err) {
            console.error('[usePrivyMoveWallet] Error fetching wallet info:', err);
            // If API call fails, still set wallet info without public key
            setWalletInfo({
              walletId,
              address,
              publicKey: '',
            });
          }
        } else {
          console.warn('[usePrivyMoveWallet] No walletId found, cannot fetch public key');
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
  // Track if we've already determined the wallet source to prevent switching
  const walletSourceRef = useRef<'Privy' | 'Biometric' | 'None' | null>(null);
  
  // Get wallet address - from Privy if available, otherwise from localStorage
  useEffect(() => {
    async function determineWallet() {
      // Determine which wallet to use
      let newWallet: MoveWallet | null = null;
      let walletSource: 'Privy' | 'Biometric' | 'None' = 'None';
      
      // CRITICAL: If Privy wallet is available, ALWAYS use it - never fall back
      // This prevents loading multiple wallets
      if (privyWallet && privyAuthenticated) {
        // Derive the actual Aptos address from the Ed25519 public key
        // This is the address that will be used on-chain when signing transactions
        let aptosAddress: string;
        
        if (privyWallet.publicKey) {
          try {
            // Derive actual Aptos address from public key (SHA3-256)
            aptosAddress = deriveAptosAddressFromPublicKey(privyWallet.publicKey);
        console.log(
          `[useUnifiedMoveWallet] Using Privy wallet:`,
          `\n  Ethereum address (from Privy): ${privyWallet.address}`,
              `\n  Derived Aptos address (from public key): ${aptosAddress}`,
              `\n  This is the actual on-chain address used for profiles and transactions`
            );
          } catch (error) {
            // Fallback to padded address if derivation fails
            console.warn('[useUnifiedMoveWallet] Failed to derive Aptos address, using padded address:', error);
            aptosAddress = padAddressToAptos(privyWallet.address);
            console.log(
              `[useUnifiedMoveWallet] Using Privy wallet (fallback):`,
              `\n  Ethereum address (from Privy): ${privyWallet.address}`,
              `\n  Padded Aptos address (fallback): ${aptosAddress}`
            );
          }
        } else {
          // No public key available, use padded address as fallback
          aptosAddress = padAddressToAptos(privyWallet.address);
          console.warn(
            `[useUnifiedMoveWallet] No public key available, using padded address:`,
            `\n  Ethereum address (from Privy): ${privyWallet.address}`,
            `\n  Padded Aptos address: ${aptosAddress}`,
            `\n  WARNING: Profile may not be found if saved with derived address`
        );
        }
        
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
      } else if (isBiometricAuth && !privyAuthenticated) {
        // Only use biometric wallet if Privy is NOT authenticated
        // This prevents loading both wallets simultaneously
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
        // No wallet available - don't create one if Privy might be loading
        newWallet = null;
        walletSource = 'None';
      }
      
      // Prevent wallet switching: if we've already determined a source, stick with it
      // This prevents the wallet from switching between Privy and biometric during initialization
      if (walletSourceRef.current !== null && walletSourceRef.current !== walletSource && walletSourceRef.current !== 'None') {
        console.warn(
          `[useUnifiedMoveWallet] Preventing wallet switch from ${walletSourceRef.current} to ${walletSource}. ` +
          `Already using ${walletSourceRef.current} wallet.`
        );
        return; // Don't switch wallets
      }
      
      // Only update if the address actually changed
      const newAddress = newWallet?.address || null;
      if (newAddress !== lastWalletAddressRef.current) {
        if (newAddress) {
          console.log(`[useUnifiedMoveWallet] Using ${walletSource} wallet:`, newAddress);
          walletSourceRef.current = walletSource; // Lock in the wallet source
        } else {
          console.log(`[useUnifiedMoveWallet] No wallet available (${walletSource})`);
          // Only set to None if we're not waiting for Privy to load
          if (!privyAuthenticated && !isBiometricAuth) {
            walletSourceRef.current = 'None';
          }
        }
        lastWalletAddressRef.current = newAddress;
        setWallet(newWallet);
      }
    }
    
    determineWallet();
  }, [privyWallet, privyAuthenticated, isBiometricAuth]);

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
  ): Promise<{ hash: string; success: boolean; address?: string }> => {
    // Log transaction signing attempt
    console.log('[useUnifiedMoveWallet] signAndSubmitTransaction called:', {
      hasPrivyWallet: !!privyWallet,
      privyAuthenticated,
      hasPublicKey: !!privyWallet?.publicKey,
      walletId: privyWallet?.walletId,
      function: payload.function,
    });
    
    // Use Privy if available and user is authenticated via Privy
    if (privyWallet && privyAuthenticated && privyWallet.publicKey) {
      console.log('[useUnifiedMoveWallet] Using Privy to sign transaction:', {
        walletId: privyWallet.walletId,
        address: privyWallet.address,
        publicKeyLength: privyWallet.publicKey.length,
        function: payload.function,
      });
      return signAndSubmitWithPrivy(
        privyWallet.walletId,
        privyWallet.publicKey,
        privyWallet.address,
        payload
      );
    }
    
    // Log why we're not using Privy
    if (!privyWallet) {
      console.warn('[useUnifiedMoveWallet] No Privy wallet available, using direct signing');
    } else if (!privyAuthenticated) {
      console.warn('[useUnifiedMoveWallet] Not authenticated with Privy, using direct signing');
    } else if (!privyWallet.publicKey) {
      // CRITICAL: If Privy is authenticated but public key is missing, DO NOT fall back
      // Falling back would use a different wallet (localStorage) which is wrong!
      throw new Error(
        'Cannot sign transaction: Privy wallet public key is not available. ' +
        'This is required to derive the correct Aptos address and sign transactions. ' +
        'Please contact support or try refreshing the page. ' +
        `WalletId: ${privyWallet.walletId}`
      );
    }
    
    // Fallback to direct signing (ONLY for non-Privy users like biometric or demo mode)
    // This should NOT happen if Privy is authenticated
    if (privyAuthenticated) {
      throw new Error(
        'Unexpected error: Privy is authenticated but transaction signing failed. ' +
        'This should not happen. Please contact support.'
      );
    }
    
    console.log('[useUnifiedMoveWallet] Using direct signing (fallback - non-Privy user)');
    return signDirectly(payload);
  }, [privyWallet, privyAuthenticated]);

  return {
    wallet,
    signAndSubmitTransaction,
    isPrivyWallet: !!privyWallet,
    isBiometricWallet: isBiometricAuth,
  };
}


