# Why We Need the Public Key for Privy Signing

## Two Critical Reasons

### 1. **Creating the Transaction Authenticator** (Primary Reason)

The Aptos/Movement network requires a **transaction authenticator** to prove you authorized the transaction. This authenticator contains:

- **Public Key**: Proves which key pair was used to sign
- **Signature**: Proves you have the private key

```typescript
// From src/lib/privy-move-wallet.ts line 126-129
const senderAuthenticator = new AccountAuthenticatorEd25519(
  new Ed25519PublicKey(pubKeyHex),  // ← NEEDS PUBLIC KEY
  new Ed25519Signature(signature)   // ← We get this from Privy
);
```

**Why both are needed:**
- The signature alone proves you have the private key
- The public key tells the network **which** key pair was used
- The network verifies: `verify(signature, message, publicKey) === true`

**Without the public key:**
- ❌ Cannot create `AccountAuthenticatorEd25519`
- ❌ Cannot submit the transaction
- ❌ The network doesn't know which key to verify against

### 2. **Deriving the Correct Aptos Address** (Secondary Reason)

Privy gives us an **Ethereum-style address** (40 hex chars), but Aptos uses a **different address format** (64 hex chars) derived from the Ed25519 public key.

```typescript
// From src/lib/privy-move-wallet.ts line 60-68
if (actualPublicKey) {
  try {
    // Derive actual Aptos address from public key
    normalizedAddress = deriveAptosAddressFromPublicKey(actualPublicKey);
    // Formula: SHA3-256(public_key_bytes || 0x00)
  } catch (error) {
    // Fallback to padded address (but this might be wrong!)
    normalizedAddress = padAddressToAptos(address);
  }
}
```

**Why this matters:**
- The **derived address** is the actual on-chain address used by your wallet
- The **padded address** is just a guess (padding Ethereum address to 64 chars)
- If we use the wrong address, the transaction might:
  - Fail (address doesn't exist)
  - Succeed but save data to wrong address (profile won't be found later)

## The Transaction Flow

```
1. Build Transaction
   └─> Needs: Sender address (derived from public key)
   
2. Generate Signing Message
   └─> Hash of transaction data
   
3. Sign with Privy
   └─> Privy signs with their private key
   └─> Returns: Signature ✅
   └─> Returns: Public Key ❌ (NOT included)
   
4. Create Authenticator
   └─> Needs: Public Key + Signature
   └─> ❌ CAN'T DO THIS without public key!
   
5. Submit Transaction
   └─> Needs: Transaction + Authenticator
   └─> ❌ CAN'T DO THIS without authenticator!
```

## What Privy Gives Us

### ✅ What We Get:
- **Signature**: The cryptographic proof that Privy signed the message
- **Wallet ID**: Identifier for the wallet
- **Ethereum Address**: `0x03cC687fd93f88DaDdc3C8e2Ea8C3958d7B646d1` (40 hex chars)

### ❌ What We DON'T Get:
- **Ed25519 Public Key**: The 32-byte public key needed for:
  1. Creating the authenticator
  2. Deriving the correct Aptos address

## Why This Is a Problem

The Aptos SDK's `AccountAuthenticatorEd25519` constructor **requires** both:
```typescript
new AccountAuthenticatorEd25519(
  publicKey: Ed25519PublicKey,  // ← Required parameter
  signature: Ed25519Signature   // ← Required parameter
)
```

We can't create this object without the public key, and we can't submit the transaction without the authenticator.

## Comparison: Direct Signing (Why It Works)

When using direct signing (localStorage wallet), we have **both** the private key and public key:

```typescript
// From src/lib/move-wallet.ts
const account = Account.fromPrivateKey({ privateKey });
// Account object contains:
// - privateKey (for signing)
// - publicKey (for authenticator) ✅
// - address (derived from public key) ✅

const senderAuthenticator = aptos.transaction.sign({
  signer: account,  // ← Has both private and public key
  transaction,
});
```

The SDK automatically extracts the public key from the account and creates the authenticator.

## The Solution

We need to get the Ed25519 public key from Privy. Options:

1. **Privy API exposes it** (ideal) - Check if there's a different endpoint
2. **Client-side SDK has it** - Check `user.wallet` or similar in React SDK
3. **Extract from signature** (complex) - Use Ed25519 signature verification to recover public key
4. **Store after first transaction** - If we can get it once, cache it

## Code Reference

- **Where we need it**: `src/lib/privy-move-wallet.ts` line 126
- **What we're creating**: `AccountAuthenticatorEd25519`
- **What Privy gives**: Signature only (via `/api/privy-raw-sign`)
- **What's missing**: Ed25519 public key (32 bytes hex)

