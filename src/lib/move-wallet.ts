'use client';

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey, AccountAddress } from "@aptos-labs/ts-sdk";

const WALLET_STORAGE_KEY = 'friendfi_move_wallet';

// Enable/disable gasless transactions
export const GASLESS_ENABLED = true;

// Movement Testnet configuration
const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: "https://testnet.movementnetwork.xyz/v1",
  indexer: "https://indexer.testnet.movementnetwork.xyz/v1/graphql",
});

export const aptos = new Aptos(config);

export interface MoveWallet {
  address: string;
  privateKeyHex: string;
}

// Get or create a Move wallet for the current user
// For demo purposes, this creates a wallet stored in localStorage
export function getOrCreateMoveWallet(): MoveWallet {
  if (typeof window === 'undefined') {
    throw new Error('Cannot access wallet on server side');
  }

  const stored = localStorage.getItem(WALLET_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // If parsing fails, create new wallet
    }
  }

  // Generate a new wallet
  const account = Account.generate();
  const wallet: MoveWallet = {
    address: account.accountAddress.toString(),
    privateKeyHex: account.privateKey.toString(),
  };

  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
  return wallet;
}

// Get Account from stored wallet
export function getMoveAccount(): Account {
  const wallet = getOrCreateMoveWallet();
  const privateKey = new Ed25519PrivateKey(wallet.privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

// Check wallet balance
export async function getWalletBalance(address: string): Promise<number> {
  try {
    const resources = await aptos.getAccountResources({ accountAddress: address });
    const coinResource = resources.find(
      (r) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
    );
    if (coinResource) {
      return Number((coinResource.data as { coin: { value: string } }).coin.value) / 1e8;
    }
    return 0;
  } catch {
    return 0;
  }
}

// Sign and submit a transaction (with optional gasless support)
export async function signAndSubmitTransaction(
  payload: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: (string | string[])[];
  }
): Promise<{ hash: string; success: boolean }> {
  const account = getMoveAccount();
  
  // Use gasless if enabled
  if (GASLESS_ENABLED) {
    return signAndSubmitGaslessTransaction(payload);
  }
  
  try {
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: payload.function,
        typeArguments: payload.typeArguments,
        functionArguments: payload.functionArguments,
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    const response = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return {
      hash: pendingTxn.hash,
      success: response.success,
    };
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

// Sign and submit a gasless transaction via Shinami Gas Station
export async function signAndSubmitGaslessTransaction(
  payload: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: (string | string[])[];
  }
): Promise<{ hash: string; success: boolean }> {
  const account = getMoveAccount();
  
  try {
    // Step 1: Build a feePayer SimpleTransaction
    // Set a 5 minute expiration since we're making an API call
    const FIVE_MINUTES_FROM_NOW = Math.floor(Date.now() / 1000) + (5 * 60);
    
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: payload.function,
        typeArguments: payload.typeArguments,
        functionArguments: payload.functionArguments,
      },
      withFeePayer: true,
      options: {
        expireTimestamp: FIVE_MINUTES_FROM_NOW,
      },
    });

    // Step 2: Sign the transaction with our account
    // The feePayer is set to 0x0 at this point, Shinami will fill it in
    const senderAuthenticator = aptos.transaction.sign({
      signer: account,
      transaction,
    });

    // Step 3: Send to our backend API to sponsor and submit via Shinami
    const response = await fetch('/api/sponsor-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: transaction.bcsToHex().toString(),
        senderAuth: senderAuthenticator.bcsToHex().toString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sponsor transaction');
    }

    const result = await response.json();
    const pendingTx = result.pendingTx;

    // Step 4: Wait for the transaction to be confirmed
    const txResponse = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    return {
      hash: pendingTx.hash,
      success: txResponse.success,
    };
  } catch (error) {
    console.error('Gasless transaction failed:', error);
    throw error;
  }
}

// Movement Testnet USDC metadata address
const USDC_METADATA_ADDR = "0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7";

// Transfer USDC from a faucet account to a target address (pays its own gas)
export async function transferUSDCFromFaucet(
  faucetPrivateKeyHex: string,
  toAddress: string,
  amountUSDC: number
): Promise<{ hash: string; success: boolean }> {
  // Ensure private key has 0x prefix for AIP-80 compliance
  const formattedPrivateKey = faucetPrivateKeyHex.startsWith('0x') 
    ? faucetPrivateKeyHex 
    : `0x${faucetPrivateKeyHex}`;
    
  // Create account from faucet private key
  const privateKey = new Ed25519PrivateKey(formattedPrivateKey);
  const faucetAccount = Account.fromPrivateKey({ privateKey });
  
  // Convert USDC amount to micro-units (6 decimals)
  const amountMicroUSDC = Math.floor(amountUSDC * 1_000_000);
  
  try {
    // Transfer USDC to the target address
    const transaction = await aptos.transaction.build.simple({
      sender: faucetAccount.accountAddress,
      data: {
        function: "0x1::primary_fungible_store::transfer",
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [
          USDC_METADATA_ADDR,  // metadata address
          AccountAddress.from(toAddress),  // recipient (wrapped in AccountAddress)
          amountMicroUSDC.toString()  // amount in micro-USDC
        ],
      },
    });

    // Sign and submit (faucet pays its own gas)
    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: faucetAccount,
      transaction,
    });

    // Wait for confirmation
    const response = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return {
      hash: pendingTxn.hash,
      success: response.success,
    };
  } catch (error) {
    console.error('USDC transfer failed:', error);
    throw error;
  }
}

