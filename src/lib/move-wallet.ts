'use client';

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey, AccountAddress } from "@aptos-labs/ts-sdk";

const WALLET_STORAGE_KEY = 'friendfi_move_wallet';

// Contract address for test USDC minting
const CONTRACT_ADDRESS = "0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f";

// Enable/disable gasless transactions
// ENABLED: Shinami tries first, falls back to direct (user pays gas) if it fails
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
    functionArguments: (string | string[] | number[])[];
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
    functionArguments: (string | string[] | number[])[];
  }
): Promise<{ hash: string; success: boolean }> {
  const account = getMoveAccount();
  
  try {
    // Step 1: Build transaction WITHOUT feePayer (Shinami will add it)
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: payload.function,
        typeArguments: payload.typeArguments,
        functionArguments: payload.functionArguments,
      },
    });

    // Step 2: Sign the transaction with our account
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
    
    // TEMPORARY FALLBACK: If Shinami fails, use direct transaction (user pays gas)
    // TODO: Remove this fallback once Shinami is stable after testnet rollback
    console.warn('⚠️ Falling back to direct transaction (user pays gas)');
    
    // Wait 2 seconds before fallback to avoid spamming
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Only try direct transaction ONCE (no retry loop)
    return signAndSubmitTransactionDirect(payload);
  }
}

// Direct transaction (non-gasless) - user pays gas
async function signAndSubmitTransactionDirect(
  payload: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: (string | string[] | number[])[];
  }
): Promise<{ hash: string; success: boolean }> {
  const account = getMoveAccount();
  
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
}

// Movement Testnet Test USDC metadata address (custom deployed)
const USDC_METADATA_ADDR = "0x9cdf923fb59947421487b61b19f9cacb172d971a755d6bb34f69474148c11ada";

// Transfer USDC from current user to another address (uses gasless if enabled)
export async function transferUSDC(
  toAddress: string,
  amountUSDC: number
): Promise<{ hash: string; success: boolean }> {
  // Convert USDC amount to micro-units (6 decimals)
  const amountMicroUSDC = Math.floor(amountUSDC * 1_000_000);
  
  const payload = {
    function: "0x1::primary_fungible_store::transfer" as const,
    typeArguments: ["0x1::fungible_asset::Metadata"],
    functionArguments: [
      USDC_METADATA_ADDR,
      toAddress.startsWith('0x') 
        ? `0x${toAddress.slice(2).padStart(64, '0')}`
        : `0x${toAddress.padStart(64, '0')}`,
      amountMicroUSDC.toString()
    ],
  };

  return signAndSubmitTransaction(payload);
}

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
  
  // Normalize recipient address
  const normalizedRecipient = toAddress.startsWith('0x') 
    ? `0x${toAddress.slice(2).padStart(64, '0')}`
    : `0x${toAddress.padStart(64, '0')}`;
  
  try {
    // Step 1: Ensure recipient has a primary store for test USDC
    // This is necessary for new accounts that have never received USDC
    try {
      const ensureStoreTransaction = await aptos.transaction.build.simple({
        sender: faucetAccount.accountAddress,
        data: {
          function: "0x1::primary_fungible_store::ensure_primary_store_exists",
          typeArguments: ["0x1::fungible_asset::Metadata"],
          functionArguments: [
            AccountAddress.from(normalizedRecipient),  // owner
            USDC_METADATA_ADDR,  // metadata
          ],
        },
      });

      const ensureStoreTxn = await aptos.signAndSubmitTransaction({
        signer: faucetAccount,
        transaction: ensureStoreTransaction,
      });

      // Wait for store creation to complete
      await aptos.waitForTransaction({
        transactionHash: ensureStoreTxn.hash,
      });
      
      console.log('Primary store ensured for recipient');
    } catch (storeError) {
      // Ignore if store already exists
      console.log('Primary store creation skipped (may already exist):', storeError);
    }

    // Step 2: Transfer USDC to the target address
    const transaction = await aptos.transaction.build.simple({
      sender: faucetAccount.accountAddress,
      data: {
        function: "0x1::primary_fungible_store::transfer",
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [
          USDC_METADATA_ADDR,  // metadata address
          AccountAddress.from(normalizedRecipient),  // recipient
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

