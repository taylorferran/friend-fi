'use client';

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const WALLET_STORAGE_KEY = 'friendfi_move_wallet';

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

// Sign and submit a transaction
export async function signAndSubmitTransaction(
  payload: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: (string | string[])[];
  }
): Promise<{ hash: string; success: boolean }> {
  const account = getMoveAccount();
  
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

