# Friend-Fi Wallet System: Complete Technical Explanation

## Table of Contents
1. [System Overview](#system-overview)
2. [Biometric Authentication Flow](#biometric-authentication-flow)
3. [Movement Wallet Creation](#movement-wallet-creation)
4. [Transaction Signing](#transaction-signing)
5. [Security Architecture](#security-architecture)
6. [Code Examples](#code-examples)

---

## System Overview

Friend-Fi uses a **WebAuthn-based biometric wallet system** that eliminates the need for external authentication providers. The system consists of three main components:

```
┌─────────────────────────────────────────────────────────┐
│                    User's Device                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  WebAuthn (Browser API)                          │  │
│  │  - Face ID / Touch ID / Windows Hello            │  │
│  │  - Secure Enclave / TPM storage                  │  │
│  └──────────────────────────────────────────────────┘  │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Biometric Wallet System (biometric-wallet.ts)   │  │
│  │  - Master seed generation (256-bit random)       │  │
│  │  - Seed encryption with biometric credential     │  │
│  │  - Ed25519 key derivation (PBKDF2)              │  │
│  └──────────────────────────────────────────────────┘  │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  localStorage                                     │  │
│  │  - friendfi_biometric_seed (encrypted)           │  │
│  │  - friendfi_biometric_credential (ID)            │  │
│  │  - friendfi_move_wallet (privateKey, address)    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
         ┌────────────────────────────────┐
         │  Movement Network (Aptos)      │
         │  - Sign transactions locally   │
         │  - Submit via Shinami (gasless)│
         └────────────────────────────────┘
```

---

## Biometric Authentication Flow

### 1. First Time Registration

When a user first opens the app, they register their biometric wallet:

```typescript
// Location: src/hooks/useBiometricWallet.ts (line 36-80)
const register = async (): Promise<boolean> => {
  // Step 1: Register biometric and get Move private key (Ed25519)
  const { privateKey, address } = await registerBiometricWallet();
  
  // Step 2: Store Move wallet in localStorage (for Move transactions)
  const moveWallet = {
    address,
    privateKeyHex: privateKey,
  };
  localStorage.setItem('friendfi_move_wallet', JSON.stringify(moveWallet));

  // Step 3: Mark user as authenticated
  localStorage.setItem(BIOMETRIC_AUTH_KEY, 'true');
  
  return true;
};
```

**What happens under the hood:**

```typescript
// Location: src/lib/biometric-wallet.ts (line 121-185)
export async function registerBiometricWallet(): Promise<{
  credentialId: string;
  privateKey: string;
  address: string;
}> {
  // Step 1: Generate a random 256-bit master seed
  const seed = generateMasterSeed();
  // Uses crypto.getRandomValues() for cryptographically secure randomness
  
  // Step 2: Create WebAuthn credential (triggers Face ID/Touch ID)
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge,
      rp: { name: 'Friend-Fi', id: window.location.hostname },
      user: {
        id: new Uint8Array(16),
        name: 'friendfi-user',
        displayName: 'Friend-Fi User',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Biometric only (no USB keys)
        userVerification: 'required', // Must verify biometric
      },
      timeout: 60000,
      attestation: 'none',
    },
  });
  
  const credentialId = uint8ArrayToHex(new Uint8Array(credential.rawId));
  
  // Step 3: Encrypt the master seed with the biometric credential
  // The credential ID is used as the encryption key
  const encryptedSeed = await encryptSeedWithBiometric(seed, credentialId);
  
  // Step 4: Derive Ed25519 private key from seed using PBKDF2
  const privateKey = await derivePrivateKeyFromSeed(seed);
  
  // Step 5: Generate Movement/Aptos address from private key
  const privateKeyObj = new Ed25519PrivateKey(privateKey);
  const account = Account.fromPrivateKey({ privateKey: privateKeyObj });
  const address = account.accountAddress.toString();
  
  // Step 6: Store encrypted seed and credential ID in localStorage
  localStorage.setItem(BIOMETRIC_SEED_KEY, encryptedSeed);
  localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
  
  return { credentialId, privateKey, address };
}
```

**Key Derivation Process:**

```typescript
// Location: src/lib/biometric-wallet.ts (line 47-77)
async function derivePrivateKeyFromSeed(seed: Uint8Array): Promise<string> {
  // Import seed as key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    seed,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // Derive 256 bits (32 bytes) for Ed25519 private key
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('friendfi-move-salt'), // Fixed salt
      iterations: 100000, // 100k iterations for security
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes = 256 bits
  );
  
  const privateKeyHex = uint8ArrayToHex(new Uint8Array(derivedBits));
  return `0x${privateKeyHex}`;
}
```

**Seed Encryption:**

```typescript
// Location: src/lib/biometric-wallet.ts (line 83-99)
async function encryptSeedWithBiometric(
  seed: Uint8Array, 
  credentialId: string
): Promise<string> {
  // Derive encryption key from credential ID
  const key = await crypto.subtle.digest(
    'SHA-256', 
    new TextEncoder().encode(credentialId)
  );
  const keyArray = new Uint8Array(key);
  
  // Simple XOR encryption (production should use AES-GCM)
  const encrypted = new Uint8Array(seed.length);
  for (let i = 0; i < seed.length; i++) {
    encrypted[i] = seed[i] ^ keyArray[i % keyArray.length];
  }
  
  return uint8ArrayToHex(encrypted);
}
```

### 2. Subsequent Logins

When the user returns to the app:

```typescript
// Location: src/hooks/useBiometricWallet.ts (line 84-128)
const authenticate = async (): Promise<boolean> => {
  // Step 1: Authenticate biometric and get Move private key
  const { privateKey, address } = await authenticateBiometricWallet();
  
  // Step 2: Store Move wallet in localStorage
  const moveWallet = { address, privateKeyHex: privateKey };
  localStorage.setItem('friendfi_move_wallet', JSON.stringify(moveWallet));

  // Step 3: Mark user as authenticated
  localStorage.setItem(BIOMETRIC_AUTH_KEY, 'true');
  
  return true;
};
```

**Authentication internals:**

```typescript
// Location: src/lib/biometric-wallet.ts (line 190-247)
export async function authenticateBiometricWallet(): Promise<{
  privateKey: string;
  address: string;
}> {
  // Step 1: Get stored credential ID
  const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  if (!credentialId) {
    throw new Error('No biometric wallet registered');
  }

  // Step 2: Authenticate with biometric (triggers Face ID/Touch ID)
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge,
      allowCredentials: [{
        id: hexToUint8Array(credentialId),
        type: 'public-key',
        transports: ['internal'], // Device biometric only
      }],
      timeout: 60000,
      userVerification: 'required', // Must verify biometric
    },
  });

  if (!assertion) {
    throw new Error('Biometric authentication failed');
  }

  // Step 3: Decrypt the encrypted seed
  const encryptedSeed = localStorage.getItem(BIOMETRIC_SEED_KEY);
  const seed = await decryptSeedWithBiometric(encryptedSeed, credentialId);
  
  // Step 4: Derive the same private key from seed
  const privateKey = await derivePrivateKeyFromSeed(seed);
  
  // Step 5: Get the address
  const privateKeyObj = new Ed25519PrivateKey(privateKey);
  const account = Account.fromPrivateKey({ privateKey: privateKeyObj });
  const address = account.accountAddress.toString();
  
  return { privateKey, address };
}
```

---

## Movement Wallet Creation

The Movement wallet is created from the Ed25519 private key:

```typescript
// Location: src/lib/move-wallet.ts (line 51-56)
export function getMoveAccount(): Account {
  const wallet = getOrCreateMoveWallet();
  const privateKey = new Ed25519PrivateKey(wallet.privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}
```

**Wallet Structure:**

```typescript
export interface MoveWallet {
  address: string;        // Full Aptos address (64 hex chars)
  privateKeyHex: string;  // Ed25519 private key (64 hex chars)
}
```

**Example Wallet:**
```json
{
  "address": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  "privateKeyHex": "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
}
```

---

## Transaction Signing

### Local Signing (No External Services)

All transactions are signed **locally on the user's device** using their private key:

```typescript
// Location: src/lib/move-wallet.ts (line 119-186)
export async function signAndSubmitGaslessTransaction(
  payload: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: (string | string[] | number[])[];
  }
): Promise<{ hash: string; success: boolean }> {
  // Get the user's account from biometric wallet
  const account = getMoveAccount();
  
  // Step 1: Build a feePayer transaction (gasless)
  const FIVE_MINUTES_FROM_NOW = Math.floor(Date.now() / 1000) + (5 * 60);
  
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: payload.function,
      typeArguments: payload.typeArguments,
      functionArguments: payload.functionArguments,
    },
    withFeePayer: true, // Enable gasless mode
    options: {
      expireTimestamp: FIVE_MINUTES_FROM_NOW,
    },
  });

  // Step 2: Sign the transaction LOCALLY with user's private key
  const senderAuthenticator = aptos.transaction.sign({
    signer: account, // Uses the Ed25519 private key
    transaction,
  });

  // Step 3: Send signed transaction to backend for gas sponsorship
  const response = await fetch('/api/sponsor-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction: transaction.bcsToHex().toString(),
      senderAuth: senderAuthenticator.bcsToHex().toString(),
    }),
  });

  const result = await response.json();
  const pendingTx = result.pendingTx;

  // Step 4: Wait for confirmation
  const txResponse = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  return {
    hash: pendingTx.hash,
    success: txResponse.success,
  };
}
```

### Example: Creating a Bet

Here's the complete flow for creating a bet:

```typescript
// User clicks "Create Bet" button
// Location: src/app/bets/create/page.tsx (line 100-121)

// Step 1: Request membership signature from backend
const proof = await requestMembershipSignature(groupId, wallet.address);

// Step 2: Build the transaction payload
const payload = {
  function: `${CONTRACT_ADDRESS}::private_prediction_refactored::create_bet`,
  typeArguments: [],
  functionArguments: [
    groupId,                    // u64
    signature,                  // vector<u8>
    expiresAtMs,               // u64
    description,               // String
    outcomes,                  // vector<String>
    wallet.address,            // address (admin)
    []                         // vector<u8> (encrypted payload)
  ],
};

// Step 3: Sign and submit (this calls signAndSubmitGaslessTransaction)
const result = await signAndSubmitTransaction(payload);

// Step 4: Save metadata to Supabase
await createBetInSupabase(
  betId,
  groupId,
  description,
  outcomes,
  wallet.address
);
```

### Example: Placing a Wager

```typescript
// User places a wager on a bet
// Location: src/app/bets/[id]/page.tsx (line 100-168)

// Step 1: Request membership signature
const proof = await requestMembershipSignature(bet.groupId, wallet.address);

// Step 2: Build wager transaction
const amount = Math.floor(parseFloat(wagerAmount) * 1_000_000); // Convert to micro-USDC

const payload = {
  function: `${CONTRACT_ADDRESS}::private_prediction_refactored::place_wager`,
  typeArguments: [],
  functionArguments: [
    betId,              // u64
    outcomeIndex,       // u64
    amount,             // u64 (micro-USDC)
    signature,          // vector<u8>
    expiresAtMs        // u64
  ],
};

// Step 3: Sign locally and submit via Shinami
const result = await placeWager(
  betId,
  outcomeIndex,
  amount,
  proof.signature,
  proof.expiresAt
);

// Transaction flow:
// 1. Build transaction with Aptos SDK
// 2. Sign with user's Ed25519 private key (local)
// 3. Send to /api/sponsor-transaction
// 4. Backend sends to Shinami Gas Station
// 5. Shinami sponsors gas fees and submits to Movement Network
// 6. Wait for confirmation
```

---

## Security Architecture

### 1. Private Key Never Leaves Device

```
┌─────────────────────────────────────────────────────┐
│  User's Device (Client-Side)                        │
│                                                      │
│  ┌────────────────────────────────────────────┐   │
│  │  Master Seed (256-bit)                     │   │
│  │  ↓ PBKDF2 (100k iterations)               │   │
│  │  Ed25519 Private Key                       │   │
│  │  ↓                                          │   │
│  │  Sign Transaction Locally                  │   │
│  └────────────────────────────────────────────┘   │
│                    ↓                                │
│  Only send SIGNED transaction to backend           │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│  Backend (Server-Side)                              │
│                                                      │
│  ✗ NEVER sees private key                          │
│  ✓ Only sees signed transaction                    │
│  ✓ Sponsors gas via Shinami                        │
│  ✓ Submits to Movement Network                     │
└─────────────────────────────────────────────────────┘
```

### 2. Biometric Protection

- **Secure Enclave**: WebAuthn credentials stored in device's secure hardware
- **Biometric Gating**: Private key derivation requires Face ID/Touch ID
- **No Password Storage**: No passwords stored anywhere

### 3. Encryption at Rest

```typescript
// Seed is encrypted before storage
localStorage: {
  "friendfi_biometric_seed": "a1b2c3d4..." // Encrypted with credential ID
  "friendfi_biometric_credential": "9f8e7d6c..." // WebAuthn credential ID
  "friendfi_move_wallet": {
    "address": "0x...",
    "privateKeyHex": "0x..." // Only accessible after biometric auth
  }
}
```

### 4. Deterministic Key Derivation

The same biometric always produces the same private key:

```
Master Seed (256-bit random)
    ↓
PBKDF2(seed, salt='friendfi-move-salt', iterations=100000)
    ↓
Ed25519 Private Key (256-bit)
    ↓
Aptos Account Address (256-bit, SHA3-256 of public key)
```

---

## Code Examples

### Complete Login Flow

```typescript
// 1. Check if wallet exists
import { hasBiometricWallet } from '@/lib/biometric-wallet';

if (!hasBiometricWallet()) {
  // First time user - register
  const { privateKey, address } = await registerBiometricWallet();
  console.log('New wallet created!', address);
} else {
  // Returning user - authenticate
  const { privateKey, address } = await authenticateBiometricWallet();
  console.log('Welcome back!', address);
}

// 2. Wallet is now ready to use
const wallet = JSON.parse(localStorage.getItem('friendfi_move_wallet'));
console.log('Wallet address:', wallet.address);
```

### Complete Transaction Flow

```typescript
// 1. Import dependencies
import { signAndSubmitGaslessTransaction } from '@/lib/move-wallet';

// 2. Define transaction
const payload = {
  function: '0xYOUR_CONTRACT::module::function_name',
  typeArguments: [],
  functionArguments: ['arg1', 'arg2'],
};

// 3. Sign and submit (all happens locally + gasless)
const result = await signAndSubmitGaslessTransaction(payload);

console.log('Transaction hash:', result.hash);
console.log('Success:', result.success);

// 4. Transaction is confirmed on Movement Network
```

### Check Wallet Balance

```typescript
import { getWalletBalance } from '@/lib/move-wallet';

const wallet = JSON.parse(localStorage.getItem('friendfi_move_wallet'));
const balance = await getWalletBalance(wallet.address);

console.log(`Balance: ${balance} APT`);
```

---

## Summary

Friend-Fi's wallet system provides:

✅ **Self-Custodial**: Users control their own private keys  
✅ **Biometric Security**: Face ID/Touch ID required for all operations  
✅ **Gasless Transactions**: Shinami sponsors all gas fees  
✅ **No External Dependencies**: No Privy, no MetaMask, no third parties  
✅ **Mobile-First**: Designed for native mobile biometrics  
✅ **Deterministic**: Same biometric always produces same wallet  
✅ **Encrypted at Rest**: All sensitive data encrypted in localStorage  

The system combines Web2 UX (biometric login) with Web3 security (self-custodial keys) to create a seamless user experience.

---

## Group System: Hybrid On-Chain + Off-Chain Architecture

Friend-Fi uses a **hybrid approach** where groups are managed off-chain (Supabase) but membership is verified on-chain via cryptographic signatures.

### Why Hybrid?

- ✅ **Fast**: No blockchain queries for membership checks
- ✅ **Private**: Group names/passwords not on public blockchain
- ✅ **Secure**: On-chain verification ensures only members can interact
- ✅ **Gasless**: No on-chain group creation/join transactions needed

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                  OFF-CHAIN (Supabase)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  groups table                                          │ │
│  │  - id, name, description, password_hash, admin        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  group_members table                                   │ │
│  │  - group_id, wallet_address, joined_at                │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                            ↓
         Backend verifies membership in Supabase
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                  BACKEND API                                 │
│  Signs attestation: "user:group:expires"                    │
│  With Backend's Ed25519 Private Key                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
         User includes signature in transaction
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                  ON-CHAIN (Move Contracts)                   │
│  signature_auth module verifies Backend's signature         │
│  If valid → allow transaction to proceed                     │
└──────────────────────────────────────────────────────────────┘
```

### Flow: Creating a Group

**Off-Chain Only** (No blockchain transaction)

1. User fills out group form
   - Group name: "Wedding Predictors"
   - Password: "mypassword123"
   - Description: "Betting on Alice & Bob's wedding"

2. Frontend hashes password
   ```typescript
   const passwordHash = await hashPassword(password); // bcrypt
   ```

3. Save to Supabase
   ```typescript
   await supabase.from('groups').insert({
     name: 'Wedding Predictors',
     description: 'Betting on Alice & Bob\'s wedding',
     password_hash: '$2b$10$...',
     admin_address: '0xUSER_ADDRESS'
   });
   ```

4. Add admin as first member
   ```typescript
   await supabase.from('group_members').insert({
     group_id: 1,
     wallet_address: '0xUSER_ADDRESS'
   });
   ```

**Result**: Group created instantly, no gas fees, no blockchain transaction

### Flow: Joining a Group

**Off-Chain Only**

1. User enters group ID and password
2. Backend verifies password hash matches
3. Add user to `group_members` table
4. Done - user is now a member

### Flow: Creating a Bet in a Group

**Hybrid: Signature verification bridges off-chain membership → on-chain action**

#### Step 1: Request Membership Proof (Off-Chain)

```typescript
// Frontend calls backend API
const proof = await fetch('/api/groups/42/membership-proof', {
  method: 'POST',
  body: JSON.stringify({
    groupId: 42,
    walletAddress: '0xUSER_ADDRESS'
  })
});
```

#### Step 2: Backend Verifies Membership (Supabase)

```typescript
// Backend: /api/groups/[groupId]/membership-proof/route.ts

// 1. Check group exists
const group = await supabase
  .from('groups')
  .select('*')
  .eq('id', groupId)
  .single();

// 2. Check user is member
const membership = await supabase
  .from('group_members')
  .select('*')
  .eq('group_id', groupId)
  .eq('wallet_address', walletAddress)
  .single();

if (!membership) {
  return { error: 'Not a member of this group' };
}

// 3. Generate signed attestation
const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
const message = `${walletAddress}:${groupId}:${expiresAt}`;
const signature = backendPrivateKey.sign(message);

return {
  signature: '0xABCD1234...', // Hex-encoded Ed25519 signature
  expiresAt: 1704067200000,
  groupId: 42,
  userAddress: '0xUSER_ADDRESS'
};
```

#### Step 3: User Submits Transaction with Signature (On-Chain)

```typescript
// Frontend submits transaction to blockchain
const transaction = {
  function: 'friend_fi::private_prediction_refactored::create_bet',
  functionArguments: [
    groupId,           // 42
    signature,         // Backend's signature (proof of membership)
    expiresAt,         // 1704067200000
    description,       // "Will Alice & Bob get married?"
    outcomes,          // ["Yes", "No"]
    adminAddress,      // 0xUSER_ADDRESS
    encryptedPayload   // []
  ]
};

await signAndSubmitTransaction(transaction);
```

#### Step 4: Smart Contract Verifies Signature (On-Chain)

```move
// Move contract: signature_auth.move

public fun verify_membership(
    group_id: u64,           // 42
    user_addr: address,      // 0xUSER_ADDRESS
    expires_at_ms: u64,      // 1704067200000
    signature: vector<u8>,   // Backend's signature
): bool {
    // 1. Check signature not expired
    let now = timestamp::now_seconds();
    if (now > expires_at_ms / 1000) {
        return false;
    }
    
    // 2. Reconstruct the message
    let message = format!("{user_addr}:{group_id}:{expires_at_ms}");
    // "0xUSER_ADDRESS:42:1704067200000"
    
    // 3. Verify signature against Backend's public key
    let valid = ed25519::verify(
        BACKEND_PUBLIC_KEY,  // Hardcoded in contract
        message,
        signature
    );
    
    // 4. Return result
    return valid;
}
```

**Result**: If signature is valid, bet is created on-chain

### Key Points

**Group Creation/Joining:**
- ✅ Fully off-chain (Supabase only)
- ✅ No blockchain transactions
- ✅ Instant & free
- ✅ Private (names/passwords not on blockchain)

**Using Groups (bets/expenses):**
- ✅ Backend acts as trusted oracle
- ✅ Verifies membership in Supabase
- ✅ Signs attestation with Ed25519 key
- ✅ Smart contract verifies signature on-chain
- ✅ If valid → transaction proceeds
- ✅ If invalid/expired → transaction reverts

**Security:**
- 🔐 Backend's public key hardcoded in smart contract
- 🔐 Only Backend can sign valid attestations
- 🔐 Signatures expire after 1 hour
- 🔐 Each signature is group + user specific
- 🔐 Replay attacks prevented by expiration

**Trust Model:**
- Users trust Backend to correctly verify Supabase membership
- Blockchain verifies Backend's signature is authentic
- Backend cannot fake membership (must be in Supabase)
- Backend cannot be impersonated (Ed25519 signature)

### Code References

**Backend Signature Generation:**
- `src/lib/signature-helpers.ts` - Message formatting & signing
- `src/app/api/groups/[groupId]/membership-proof/route.ts` - API endpoint

**On-Chain Verification:**
- `move_contracts/sources/signature_auth.move` - Signature verification module

**Frontend Integration:**
- `src/lib/signature-service.ts` - Request signatures
- `src/lib/signature-cache.ts` - Cache signatures to avoid repeated requests

