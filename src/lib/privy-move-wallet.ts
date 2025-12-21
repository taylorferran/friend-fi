/**
 * Privy Move Wallet Integration
 * Uses Privy's embedded wallets to sign Movement network transactions
 * This showcases Privy's embedded wallet capabilities for the hackathon
 */

import { Aptos, AptosConfig, Network, AccountAddress, AccountAuthenticatorEd25519, Ed25519PublicKey, Ed25519Signature, generateSigningMessageForTransaction } from '@aptos-labs/ts-sdk';
import { toHex } from 'viem';

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
    functionArguments: (string | string[])[];
  }
): Promise<{ hash: string; success: boolean }> {
  try {
    // 1) Build the raw transaction
    // Pad address to Aptos format (64 hex chars) if needed
    const normalizedAddress = address.startsWith('0x') 
      ? `0x${address.slice(2).padStart(64, '0')}`
      : `0x${address.padStart(64, '0')}`;
    const accountAddress = AccountAddress.from(normalizedAddress);
    
    const rawTxn = await aptos.transaction.build.simple({
      sender: accountAddress,
      data: {
        function: payload.function,
        typeArguments: payload.typeArguments,
        functionArguments: payload.functionArguments,
      },
      withFeePayer: true, // For gasless transactions
    });

    // 2) Generate signing message
    const message = generateSigningMessageForTransaction(rawTxn);
    const messageHex = toHex(message);
    
    // 3) Sign with Privy's rawSign via API route
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

    const { signature: signatureHex } = await signResponse.json();
    
    // 4) Parse signature (remove 0x prefix if present)
    const signature = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
    
    // 5) Parse public key (remove 0x prefix if present)
    const pubKeyHex = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
    
    // 6) Create authenticator
    const senderAuthenticator = new AccountAuthenticatorEd25519(
      new Ed25519PublicKey(pubKeyHex),
      new Ed25519Signature(signature)
    );

    // 7) Submit transaction (with gasless sponsorship)
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

    // 8) Wait for confirmation
    const executed = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    return {
      hash: pendingTx.hash,
      success: executed.success,
    };
  } catch (error) {
    console.error('Privy transaction failed:', error);
    throw error;
  }
}

