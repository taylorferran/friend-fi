# Fallback Signing Explanation

## Current Situation

When Privy's Ed25519 public key is not available, the transaction signing falls back to a **completely different wallet** stored in `localStorage`. This is a critical issue because:

1. **You authenticated with Privy** - You expect transactions to use your Privy wallet
2. **But the fallback uses a different wallet** - A local storage wallet with a different private key and address
3. **Your profile was saved with a different address** - The transaction succeeded, but it's using the wrong wallet!

## How the Fallback Works

### Flow Diagram

```
User tries to save profile
  ↓
useUnifiedMoveWallet.signAndSubmitTransaction()
  ↓
Checks: Does Privy wallet have public key?
  ├─ YES → Use Privy signing (signAndSubmitWithPrivy)
  └─ NO  → Fallback to direct signing (signDirectly)
            ↓
            getMoveAccount()
            ↓
            getOrCreateMoveWallet()
            ↓
            Checks localStorage for 'friendfi_move_wallet'
            ├─ EXISTS → Use that wallet (different from Privy!)
            └─ NOT EXISTS → Create NEW wallet, store in localStorage
            ↓
            Sign transaction with this wallet's private key
            ↓
            Transaction succeeds, but with WRONG address!
```

### The Fallback Code Path

1. **Entry Point**: `useUnifiedMoveWallet.ts` line 360
   ```typescript
   return signDirectly(payload);
   ```

2. **Direct Signing Function**: `src/lib/move-wallet.ts` line 75
   ```typescript
   export async function signAndSubmitTransaction(payload) {
     const account = getMoveAccount(); // ← Gets LOCAL STORAGE wallet!
     // ... signs with this account's private key
   }
   ```

3. **Get Account Function**: `src/lib/move-wallet.ts` line 52
   ```typescript
   export function getMoveAccount(): Account {
     const wallet = getOrCreateMoveWallet(); // ← Gets or creates localStorage wallet
     const privateKey = new Ed25519PrivateKey(wallet.privateKeyHex);
     return Account.fromPrivateKey({ privateKey });
   }
   ```

4. **Wallet Source**: `src/lib/move-wallet.ts` line 26
   ```typescript
   export function getOrCreateMoveWallet(): MoveWallet {
     const stored = localStorage.getItem('friendfi_move_wallet'); // ← Different wallet!
     if (stored) {
       return JSON.parse(stored); // Use existing localStorage wallet
     }
     // OR create a brand new wallet
     const account = Account.generate();
     // ... store in localStorage
   }
   ```

## What Key is Being Used?

The fallback uses:
- **Source**: `localStorage.getItem('friendfi_move_wallet')`
- **Type**: Ed25519 private key (stored as hex string)
- **Address**: Derived from this private key (completely different from Privy wallet)
- **Storage**: Browser's localStorage (not secure, not Privy-managed)

## The Problem

### Address Mismatch

1. **Privy Wallet Address**: `0x03cC687fd93f88DaDdc3C8e2Ea8C3958d7B646d1` (Ethereum format)
   - Should derive to Aptos address: `0x285d26bc5650c418c46c2bd80a9b6f9dc51fa6d33bbfeb6967ea5b0114943188` (if we had the public key)

2. **Fallback Wallet Address**: Different address entirely (from localStorage)
   - Example: `0x1234...` (whatever is in localStorage)

3. **Result**: 
   - Profile saved with fallback wallet address
   - When you query with Privy wallet address → Profile not found!
   - This is why you see the profile setup modal again

### Transaction Success But Wrong Wallet

The transaction succeeded (Hash: `0xc7aac4fb71b45ead65bbf6723d3e2230ae7b9a58cf63655110c3e48c4a10e91c`) because:
- ✅ The fallback wallet has a valid Ed25519 private key
- ✅ The transaction was signed correctly
- ✅ Shinami Gas Station sponsored it
- ❌ **BUT** it was signed with the wrong wallet (localStorage wallet, not Privy wallet)

## Why This Happens

Privy's API doesn't expose the Ed25519 public key for Ethereum/Movement network wallets:
- `wallets().get(walletId)` returns: `{ id, address, chain_type: "ethereum", ... }` - **NO public key**
- `wallets().export(walletId)` fails with authorization error
- `rawSign()` response doesn't include public key

Without the public key, we can't:
1. Derive the correct Aptos address
2. Create the transaction authenticator (needs public key + signature)

## Solution

We need to either:

### Option 1: Get Public Key from Privy (Preferred)
- Contact Privy support about getting Ed25519 public key for Movement network
- Check if there's a different API endpoint
- Check if the public key is available in the client-side Privy SDK

### Option 2: Extract Public Key from Signature (Complex)
- Sign a test message with Privy
- Extract public key from signature + message (requires Ed25519 signature verification)
- Store it for future use

### Option 3: Prevent Fallback (Current Workaround)
- Don't allow fallback when Privy is authenticated
- Show error: "Public key not available from Privy. Cannot sign transaction."
- Force user to contact support or use a different authentication method

## Current Code Location

The fallback decision is made in:
- `src/hooks/usePrivyMoveWallet.ts` line 334-360
- Falls back to: `src/lib/move-wallet.ts` line 75 (`signAndSubmitTransaction`)

## Immediate Fix Needed

We should **prevent the fallback** when Privy is authenticated but public key is missing. Instead, throw a clear error explaining the issue.

