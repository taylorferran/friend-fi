/**
 * Privy Move Wallet Integration
 * Uses Privy's embedded wallets to sign Movement network transactions
 * This showcases Privy's embedded wallet capabilities for the hackathon
 */

import { Aptos, AptosConfig, Network, AccountAddress, AccountAuthenticatorEd25519, Ed25519PublicKey, Ed25519Signature, generateSigningMessageForTransaction } from '@aptos-labs/ts-sdk';
import { toHex } from 'viem';
import { deriveAptosAddressFromPublicKey, padAddressToAptos } from '@/lib/address-utils';

// Movement Testnet configuration
const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: 'https://testnet.movementnetwork.xyz/v1',
  indexer: 'https://indexer.testnet.movementnetwork.xyz/v1/graphql',
});

export const aptos = new Aptos(config);

/**
 * Sign and submit a transaction using Privy's embedded wallet
 * This uses Privy's rawSign API for Movement network (Ed25519)
 */
export async function signAndSubmitWithPrivy(
  walletId: string,
  publicKey: string, // 32-byte Ed25519 public key hex
  address: string,
  payload: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: (string | string[] | number[])[];
  }
): Promise<{ hash: string; success: boolean; address?: string }> {
  try {
    // 1) Determine the actual public key to use
    // First, try to get it from the wallet info API if not provided
    let actualPublicKey = publicKey;
    
    if (!actualPublicKey) {
      try {
        const walletInfoResponse = await fetch('/api/privy-wallet-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletId }),
        });
        
        if (walletInfoResponse.ok) {
          const walletInfo = await walletInfoResponse.json();
          actualPublicKey = walletInfo.publicKey || '';
          if (actualPublicKey) {
            console.log('[signAndSubmitWithPrivy] Retrieved public key from wallet info API');
          }
        }
      } catch (error) {
        console.warn('[signAndSubmitWithPrivy] Failed to fetch public key from wallet info API:', error);
      }
    }
    
    // 2) Derive the Aptos address from public key (this is the actual on-chain address)
    let normalizedAddress: string;
    if (actualPublicKey) {
      try {
        normalizedAddress = deriveAptosAddressFromPublicKey(actualPublicKey);
        console.log(`[signAndSubmitWithPrivy] Using derived Aptos address: ${normalizedAddress}`);
      } catch (error) {
        console.warn('[signAndSubmitWithPrivy] Failed to derive address from public key, using padded address:', error);
        normalizedAddress = padAddressToAptos(address);
      }
    } else {
      // No public key available - use padded address as fallback
      console.warn('[signAndSubmitWithPrivy] No public key available, using padded address. Transaction may fail if address mismatch.');
      normalizedAddress = padAddressToAptos(address);
    }
    
    const accountAddress = AccountAddress.from(normalizedAddress);
    
    // 3) Build the raw transaction
    const rawTxn = await aptos.transaction.build.simple({
      sender: accountAddress,
      data: {
        function: payload.function,
        typeArguments: payload.typeArguments,
        functionArguments: payload.functionArguments,
      },
      withFeePayer: true, // For gasless transactions
    });

    // 4) Generate signing message
    const message = generateSigningMessageForTransaction(rawTxn);
    const messageHex = toHex(message);
    
    // 5) Sign with Privy's rawSign via API route
    const signResponse = await fetch('/api/privy-raw-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId,
        message: messageHex,
      }),
    });

    if (!signResponse.ok) {
      const error = await signResponse.json();
      throw new Error(error.error || 'Failed to sign with Privy');
    }

    const { signature: signatureHex, publicKey: responsePublicKey } = await signResponse.json();
    
    // 6) Use public key from response if available and we didn't have one before
    if (responsePublicKey && !actualPublicKey) {
      actualPublicKey = responsePublicKey;
      console.log('[signAndSubmitWithPrivy] Using public key from rawSign response');
    }
    
    if (!actualPublicKey) {
      throw new Error('Public key is required but not available from Privy. Cannot create transaction authenticator. Please ensure the wallet has been properly initialized.');
    }
    
    // 7) Parse signature (remove 0x prefix if present)
    const signature = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
    
    // 8) Parse public key (remove 0x prefix if present)
    const pubKeyHex = actualPublicKey.startsWith('0x') ? actualPublicKey.slice(2) : actualPublicKey;
    
    // 9) Create authenticator
    const senderAuthenticator = new AccountAuthenticatorEd25519(
      new Ed25519PublicKey(pubKeyHex),
      new Ed25519Signature(signature)
    );

    // 10) Submit transaction (with gasless sponsorship)
    const response = await fetch('/api/sponsor-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: rawTxn.bcsToHex().toString(),
        senderAuth: senderAuthenticator.bcsToHex().toString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sponsor transaction');
    }

    const result = await response.json();
    const pendingTx = result.pendingTx;

    // 11) Wait for confirmation
    const executed = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    return {
      hash: pendingTx.hash,
      success: executed.success,
      address: normalizedAddress, // Return the actual address used for the transaction
    };
  } catch (error) {
    console.error('Privy transaction failed:', error);
    throw error;
  }
}

