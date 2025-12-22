# Friend-Fi Technical Details

## Transaction History Feature

### Overview
The transaction history feature displays all on-chain transactions made by the user's biometric wallet, with direct links to the Movement testnet explorer.

### Architecture

#### 1. Navigation Integration
- **Desktop**: Added "Transactions" link to `Sidebar.tsx` with receipt icon
- **Mobile**: Added "Txns" link to `MobileNav.tsx` (refactored to dynamically render nav items)

#### 2. Indexer Integration (`src/lib/indexer.ts`)

**Function**: `getUserTransactions(accountAddress: string, limit: number = 50)`

**Simplified Query Strategy**:

Due to the Movement Network indexer's limited schema, we use a minimal two-step approach:

1. **Query `account_transactions`**: Get transaction versions for the user's address
   ```graphql
   account_transactions(
     where: { account_address: { _eq: $account } }
     order_by: { transaction_version: desc }
     limit: $limit
   )
   ```

2. **Query `user_transactions`**: Get entry function details for those versions
   ```graphql
   user_transactions(
     where: { version: { _in: $versions } }
   )
   ```

**Data Available**:
- Transaction version (unique identifier) ✅
- Entry function ID string (format: `0xaddress::module::function`) ✅

**Data NOT Available** (due to indexer limitations):
- Transaction hash (we use version-based placeholder)
- Actual timestamps (we use approximate timestamps)
- Success status (we assume success if indexed)
- Gas used (not available in indexer)

**Workaround**: We use the transaction version to link to the explorer, which has complete data.

**Return Type**: `AccountTransaction[]`
```typescript
interface AccountTransaction {
  version: number;
  success: boolean;
  vmStatus: string;
  hash: string;
  gasUsed: number;
  timestamp: string;
  entryFunctionIdStr: string | null;
  functionAddress?: string;
  functionModule?: string;
  functionName?: string;
}
```

#### 3. Transaction History Page (`src/app/transactions/page.tsx`)

**Features**:
- Displays up to 50 most recent transactions
- Auto-refreshes when wallet address changes
- Loading, error, and empty states
- Responsive design (mobile & desktop)

**Transaction Display**:
- ✅ **Function Description**: User-friendly names (e.g., "Create Bet", "Place Wager", "Transfer USDC")
- ✅ **Transaction Hash**: Truncated format (e.g., `0x12345678...abcdef`)
- ✅ **Module Name**: Shows the Move module (e.g., `private_prediction_refactored`, `groups`)
- ✅ **Status Indicator**: Green checkmark for success, red X for failure
- ✅ **Gas Used**: Displays gas consumption
- ✅ **Timestamp**: Relative time (e.g., "5m ago", "2h ago", "3d ago")
- ✅ **Explorer Link**: Clickable card opens Movement testnet explorer

**Function Name Mapping**:
```typescript
// Profile
set_profile → "Set Profile"

// Groups
create_group → "Create Group"
join_group → "Join Group"

// Predictions
create_bet → "Create Bet"
place_wager → "Place Wager"
add_to_wager → "Add to Wager"
resolve_bet → "Resolve Bet"
claim_payout → "Claim Payout"

// USDC
primary_fungible_store::transfer → "Transfer USDC"
```

### Movement Network Integration

**Indexer Endpoint**: `https://indexer.testnet.movementnetwork.xyz/v1/graphql`

**Explorer URL Pattern**: `https://explorer.movementnetwork.xyz/txn/{version}?network=testnet`

### User Experience

**Loading State**:
- Brutalist spinner animation
- "Loading transaction history..." message

**Empty State**:
- Receipt icon
- "No Transactions Yet" heading
- Helpful message for new users

**Error State**:
- Error icon
- Error message display
- Graceful failure handling

**Transaction Card**:
- Hover effect with subtle background change
- Clear visual hierarchy
- Icon indicating success/failure status
- Clickable to open explorer in new tab

## Smart Contract Integration

### Contract Address
```
0xf436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f
```

### Modules
1. **groups**: Group creation and membership management
2. **private_prediction_refactored**: Prediction market with wagers and payouts
3. **expense_splitting**: Expense tracking (coming soon)

### Key Functions

#### Groups Module
- `create_group(name: String)`: Creates a new group
- `join_group(group_id: u64)`: Joins an existing group
- `get_group_info(group_id: u64)`: Retrieves group details
- `get_group_members(group_id: u64)`: Gets all group members

#### Predictions Module
- `create_bet(group_id: u64, description: String, outcomes: vector<String>, admin: address)`: Creates a new bet
- `place_wager(bet_id: u64, outcome_index: u64, amount: u64)`: Places a wager on a bet
- `add_to_wager(bet_id: u64, amount: u64)`: Adds to an existing wager
- `resolve_bet(bet_id: u64, winning_outcome: u64)`: Resolves a bet (admin only)
- `claim_payout(bet_id: u64)`: Claims winnings after resolution

### USDC Integration

**USDC Metadata Address**:
```
0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7
```

**Transfer Function**:
```
0x1::primary_fungible_store::transfer
```

**Type Arguments**: `["0x1::fungible_asset::Metadata"]`

**Function Arguments**: `[metadata_address, recipient_address, amount_micro_usdc]`

**Decimals**: 6 (USDC uses 6 decimal places)

### Gasless Transactions (Shinami)

**Enabled**: Yes (via `GASLESS_ENABLED` flag in `move-wallet.ts`)

**Flow**:
1. Build feePayer transaction with 5-minute expiration
2. Sign transaction with user's account
3. Send to `/api/sponsor-transaction` endpoint
4. Backend sponsors via Shinami Gas Station API
5. Wait for transaction confirmation

**API Endpoint**: `/api/sponsor-transaction`

**Request Body**:
```json
{
  "transaction": "hex_encoded_transaction",
  "senderAuth": "hex_encoded_sender_authenticator"
}
```

**Response**:
```json
{
  "pendingTx": {
    "hash": "transaction_hash"
  }
}
```

## Wallet Management

### Biometric Wallet System (No Privy)

The app uses a **self-contained biometric wallet system** that does not require Privy or any external wallet providers. The system uses WebAuthn (Face ID/Touch ID) to protect a master seed, which is then used to deterministically derive Ed25519 private keys for the Movement network.

#### Overview

The biometric wallet system works by:
1. Generating a random 256-bit master seed
2. Encrypting the seed using WebAuthn credentials (stored in secure enclave)
3. Deriving Ed25519 private keys deterministically from the seed using PBKDF2
4. Storing encrypted seed in localStorage (protected by biometric authentication)

---

### 1. Wallet Creation (`registerBiometricWallet`)

#### Step 1: Generate Master Seed
```typescript
const seed = generateMasterSeed(); // 32 random bytes (256 bits)
```
- Uses `crypto.getRandomValues()` to create a cryptographically secure 32-byte seed
- This seed is the root of all key derivation

#### Step 2: Register WebAuthn Credential
- Creates a WebAuthn credential using `navigator.credentials.create()`:
  - **Platform authenticator**: Biometric only (Face ID/Touch ID)
  - **User verification**: Required
  - **Algorithm**: ES256 (Elliptic Curve)
  - Returns a credential with a unique `credentialId`

**WebAuthn Configuration**:
```typescript
{
  challenge: random32Bytes,
  rp: { name: 'Friend-Fi', id: window.location.hostname },
  user: { id: random16Bytes, name: 'friendfi-user' },
  authenticatorSelection: {
    authenticatorAttachment: 'platform', // Biometric only
    userVerification: 'required'
  }
}
```

#### Step 3: Encrypt Seed with Biometric
- Encrypts the seed using the `credentialId`:
  - Derives a key from `credentialId` using SHA-256
  - XOR-encrypts the seed (simplified encryption - production should use AES-GCM)
  - Stores encrypted seed in localStorage as `friendfi_biometric_seed`

**Encryption Process**:
```typescript
const key = SHA256(credentialId);
const encrypted = seed XOR key; // Simplified - use AES-GCM in production
```

#### Step 4: Derive Private Key from Seed
- Uses **PBKDF2** to derive a deterministic Ed25519 private key:
  - **Salt**: `'friendfi-move-salt'` (fixed for determinism)
  - **Iterations**: 100,000
  - **Hash**: SHA-256
  - **Output**: 32 bytes (256 bits) → Ed25519 private key

**Key Derivation**:
```typescript
const privateKey = PBKDF2(seed, salt='friendfi-move-salt', iterations=100000, hash='SHA-256')
```

#### Step 5: Create Account and Get Address
- Creates an Aptos `Account` from the private key using `Account.fromPrivateKey()`
- Extracts the wallet address from the account

#### Step 6: Store Credentials
- Stores in localStorage:
  - `friendfi_biometric_seed`: Encrypted seed (hex string)
  - `friendfi_biometric_credential`: Credential ID (hex string)
  - `friendfi_move_wallet`: `{ address, privateKeyHex }` (for quick access)
  - `friendfi_biometric_authenticated`: `'true'` (authentication state flag)

**Storage Keys**:
```typescript
const BIOMETRIC_SEED_KEY = 'friendfi_biometric_seed';
const BIOMETRIC_CREDENTIAL_KEY = 'friendfi_biometric_credential';
```

---

### 2. Accessing the Same Wallet Again (`authenticateBiometricWallet`)

#### Step 1: Retrieve Stored Credential ID
```typescript
const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
```

#### Step 2: Biometric Authentication
- Uses `navigator.credentials.get()` with:
  - The stored `credentialId`
  - A random challenge (32 bytes)
  - User verification required
- Triggers Face ID/Touch ID prompt on device

**Authentication Request**:
```typescript
{
  challenge: random32Bytes,
  allowCredentials: [{ id: credentialIdBytes, type: 'public-key' }],
  userVerification: 'required'
}
```

#### Step 3: Decrypt Seed
- Retrieves encrypted seed from localStorage
- Decrypts using the same `credentialId`-derived key (XOR operation)

#### Step 4: Re-derive Private Key
- Uses the **same PBKDF2 parameters** to derive the same private key from the decrypted seed
- Same seed + same parameters = same private key (deterministic)

#### Step 5: Recreate Account
- Creates the same `Account` from the private key
- Returns the same address and private key

#### Step 6: Update Auth State
- Sets `friendfi_biometric_authenticated` to `'true'`
- Updates Move wallet in localStorage for quick access

---

### 3. Sending Transactions

#### Transaction Flow

**A. Get Account from Stored Wallet**
```typescript
const wallet = JSON.parse(localStorage.getItem('friendfi_move_wallet'));
const privateKey = new Ed25519PrivateKey(wallet.privateKeyHex);
const account = Account.fromPrivateKey({ privateKey });
```

**B. Build Transaction**
- Uses Aptos SDK to build a transaction with:
  - Function call (e.g., `create_group`, `join_group`, `create_bet`)
  - Type arguments
  - Function arguments

**C. Sign Transaction**
- Signs with the account's private key
- Produces a `senderAuthenticator`

**D. Submit Transaction (Two Paths)**

##### Path 1: Gasless Transactions (Default)
- Enabled via `GASLESS_ENABLED = true` in `move-wallet.ts`
- Uses **Shinami Gas Station** for fee sponsorship:

1. **Build Fee-Payer Transaction**:
   ```typescript
   const transaction = await aptos.transaction.build.simple({
     sender: account.accountAddress,
     data: { function, typeArguments, functionArguments },
     withFeePayer: true,  // Enables gasless
     options: { expireTimestamp: FIVE_MINUTES_FROM_NOW }
   });
   ```

2. **Sign with User's Account**:
   ```typescript
   const senderAuthenticator = aptos.transaction.sign({
     signer: account,
     transaction
   });
   ```

3. **Send to Backend API** (`/api/sponsor-transaction`):
   - Converts transaction and authenticator to BCS hex
   - Backend calls Shinami Gas Station API:
     ```typescript
     method: 'gas_sponsorAndSubmitSignedTransaction'
     params: [transactionHex, senderAuthHex]
     ```
   - Shinami adds fee payer signature and submits to network

4. **Wait for Confirmation**:
   ```typescript
   await aptos.waitForTransaction({ transactionHash })
   ```

##### Path 2: Direct Transactions (If Gasless Disabled)
- User pays gas directly:
  ```typescript
  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction
  });
  ```

**Transaction Submission Flow**:
```
User Action → useMoveWallet → signAndSubmitTransaction 
→ Build Transaction → Sign with Private Key 
→ /api/sponsor-transaction → Shinami Gas Station → Movement Network
```

---

### Security Considerations

#### Current Implementation

1. **Seed Encryption**: Currently uses XOR-based encryption (simplified)
   - ⚠️ **Production Note**: Should use AES-GCM encryption for production
   - Current XOR encryption is vulnerable to known-plaintext attacks

2. **Storage**: Encrypted seed stored in localStorage
   - ⚠️ **Security Risk**: localStorage is accessible via browser DevTools
   - 🔒 **Production**: Consider more secure storage (IndexedDB with encryption, or server-side storage)

3. **Key Derivation**: PBKDF2 with fixed salt
   - ✅ **Deterministic**: Same seed always produces same key
   - ⚠️ **Production Note**: Consider HD wallet derivation (BIP32/BIP44) for multiple keys

4. **WebAuthn Security**: 
   - ✅ **Secure Enclave**: Credential private key never leaves device secure enclave
   - ✅ **Biometric Protection**: Seed can only be decrypted with biometric authentication
   - ✅ **No Key Exposure**: App never has access to WebAuthn credential private key

#### Key Files

- **`src/lib/biometric-wallet.ts`**: Core wallet creation/authentication logic
- **`src/hooks/useBiometricWallet.ts`**: React hook for biometric wallet operations
- **`src/lib/move-wallet.ts`**: Transaction signing and submission
- **`src/app/api/sponsor-transaction/route.ts`**: Gasless transaction backend (Shinami integration)

---

### Wallet State Management

**Authentication State**:
- `friendfi_biometric_authenticated`: `'true'` when user is authenticated
- Checked via `useBiometricWallet()` hook
- Dispatches `'auth-changed'` event for cross-component updates

**Wallet Storage**:
- `friendfi_move_wallet`: `{ address, privateKeyHex }` - Quick access wallet data
- `friendfi_biometric_seed`: Encrypted master seed (hex)
- `friendfi_biometric_credential`: WebAuthn credential ID (hex)

**React Hooks**:
- `useBiometricWallet()`: Manages registration, authentication, and removal
- `useMoveWallet()`: Provides wallet operations (create group, place bet, etc.)
- `useAuth()`: Checks authentication state (biometric vs other methods)

## Indexer Queries

### Token Balances
**Query**: `current_fungible_asset_balances`
- Filters by owner address and non-zero amounts
- Returns asset type, amount, and last transaction timestamp

### Events
**Query**: `events`
- Filters by event type (e.g., `WagerPlacedEvent`, `GroupCreatedEvent`)
- Can filter by data fields (e.g., `bet_id`, `group_id`)
- Returns transaction version, data, and metadata

### Transactions
**Query**: `account_transactions` + `user_transactions`
- `account_transactions`: Maps accounts to transaction versions
- `user_transactions`: Contains full transaction details
- Ordered by version (descending for most recent first)

### Event Types

**Groups Module**:
```
{contract_address}::groups::GroupCreatedEvent
{contract_address}::groups::MemberJoinedEvent
```

**Predictions Module**:
```
{contract_address}::private_prediction_refactored::BetCreatedEvent
{contract_address}::private_prediction_refactored::WagerPlacedEvent
{contract_address}::private_prediction_refactored::BetResolvedEvent
{contract_address}::private_prediction_refactored::PayoutPaidEvent
```

## Frontend Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: WebAuthn (Face ID/Touch ID)
- **Blockchain SDK**: Aptos TS SDK

### Key Libraries
- `@aptos-labs/ts-sdk`: Move blockchain interaction
- Web Crypto API: Key derivation and encryption
- WebAuthn API: Biometric authentication
- `next`: React framework with server components
- `tailwindcss`: Utility-first CSS

### State Management
- React hooks (`useState`, `useEffect`)
- Custom hooks (`useMoveWallet`, `useBiometricWallet`, `useAuth`, `useToast`)
- Session storage for user settings
- Local storage for biometric wallet data (encrypted seed, credential ID, wallet info)
- WebAuthn credentials stored in device secure enclave

### Design System
**Brutalist Theme**:
- Bold 2px borders everywhere
- High contrast colors
- Monospace fonts for data
- Display fonts for headings
- Box shadows for depth
- Sharp corners (no border radius)

**Color Palette**:
```css
--primary: #F5C301 (yellow)
--secondary: #E60023 (red)
--accent: #593D2C (brown)
--text: #000000 (black)
--background: #FFFFFF (white)
--surface: #F5F5F5 (light gray)
```

## Performance Optimizations

### Parallel Queries
- Group membership checks run in parallel
- Group details (name, members, bets) fetched concurrently
- All indexer queries use `Promise.all()` where possible

### Caching
- Session storage for user profile settings
- Immediate UI updates before blockchain confirmation
- Custom events for cross-component updates

### Loading States
- Skeleton screens during data fetching
- Instant page transitions
- Optimistic UI updates

## Security Considerations

### Private Key Storage

**Biometric Wallet System**:
- ✅ **Encrypted Storage**: Master seed encrypted with WebAuthn credential ID
- ✅ **Biometric Protection**: Seed can only be decrypted with Face ID/Touch ID
- ⚠️ **localStorage Risk**: Encrypted seed stored in localStorage (accessible via DevTools)
- ⚠️ **Private Key Access**: Private key derived and stored in localStorage for quick access
- 🔒 **Production Recommendations**:
  - Use AES-GCM encryption instead of XOR
  - Consider IndexedDB with additional encryption layer
  - Implement key derivation on-demand (don't store private key)
  - Use secure storage APIs where available

### Transaction Signing

**Biometric Wallets**:
- **Client-side signing**: Transactions signed directly in browser using private key
- **Direct signing**: Uses Aptos SDK `Account.sign()` method
- **Private key access**: Private key loaded from localStorage (derived from encrypted seed)
- **Gasless sponsorship**: Transaction submission via `/api/sponsor-transaction` (Shinami)
- **No server-side signing**: All signing happens client-side

### Input Validation
- USDC amounts validated (positive numbers only)
- Addresses validated before transactions
- Group IDs and bet IDs validated against blockchain state

## Testing Strategy

### Manual Testing Checklist
- [ ] Create profile and verify transaction appears
- [ ] Create group and check transaction history
- [ ] Join group and verify transaction
- [ ] Create bet and check history
- [ ] Place wager and verify transaction
- [ ] Transfer USDC and check history
- [ ] Click transaction to open explorer
- [ ] Test on mobile and desktop
- [ ] Test with no transactions (new wallet)
- [ ] Test error states (network issues)

### Debug Tools
- `/debug` page: GraphQL query testing
- Browser console: Transaction logs
- Movement Explorer: On-chain verification

## Future Enhancements

### Transaction History
- [ ] Parse USDC amounts from transaction events
- [ ] Add transaction filtering (by type, date, status)
- [ ] Add search functionality
- [ ] Export transaction history (CSV)
- [ ] Add transaction cost (USD equivalent)
- [ ] Show transaction confirmations in real-time
- [ ] Add pagination for large transaction lists

### General Features
- [ ] Real-time transaction notifications
- [ ] Transaction status tracking (pending, confirmed, failed)
- [ ] Retry failed transactions
- [ ] Batch transaction support
- [ ] Multi-signature transactions for group actions

## Deployment

### Environment Variables
```env
SHINAMI_GAS_STATION_API_KEY=your_shinami_key (server-side only, for gasless transactions)
```

### Build Commands
```bash
npm run build      # Production build
npm run start      # Production server
npm run dev        # Development server
npm run lint       # ESLint
```

### Hosting Recommendations
- **Vercel**: Optimized for Next.js (recommended)
- **Netlify**: Good alternative with edge functions
- **Railway/Render**: For full control over deployment

## Troubleshooting

### Common Issues

#### Transaction History Shows 0 Transactions

**Symptoms**:
- Transaction history page shows "0 transactions found"
- Console shows GraphQL errors

**Common GraphQL Errors**:
1. `"field 'success' not found in type: 'user_transactions'"` - Fixed by not querying unavailable fields
2. `"field 'transactions' not found in type: 'query_root'"` - Fixed by not using the `transactions` table
3. `"field 'block_metadata_transactions' not found..."` - Fixed by not querying timestamps from this table

**Root Cause**:
The Movement Network indexer has a **very limited schema** compared to standard Aptos indexers. Many expected tables and fields simply don't exist:
- ❌ No `transactions` table (main transaction details)
- ❌ No `block_metadata_transactions` table (timestamps)
- ❌ No `success`, `gas_used`, `timestamp` fields in `user_transactions`

**Solution**:
Use only the available tables:
1. `account_transactions` - to get transaction versions for an address ✅
2. `user_transactions` - to get entry function IDs ✅

**Current Implementation**:
- Shows transaction version instead of hash
- Uses approximate timestamps
- Links to explorer via version number
- Explorer has complete transaction data

**Code Location**: `getUserTransactions()` in `src/lib/indexer.ts`

#### Wallet Not Showing Transactions

**Possible Causes**:
1. Wallet has no transactions yet (new wallet)
2. Address format mismatch (Aptos addresses must be 64 hex chars)
3. Indexer lag (recent transactions may take a few seconds to appear)
4. Biometric wallet not authenticated (wallet data not accessible)

**Debugging**:
- Check console logs for the wallet address being queried
- Verify address format: should be 64 hex chars (excluding 0x prefix)
- Verify transactions exist on the Movement explorer
- Check for GraphQL errors in the console
- Ensure biometric wallet is authenticated (check `friendfi_biometric_authenticated` in localStorage)
- Verify wallet data exists in localStorage (`friendfi_move_wallet`)

#### Biometric Authentication Issues

**Symptoms**:
- "No biometric wallet registered" error
- "Biometric authentication failed" error
- Wallet not accessible after registration

**Common Causes**:
1. WebAuthn not supported (requires HTTPS or localhost)
2. Biometric not set up on device
3. Credential ID mismatch (stored credential doesn't match device)
4. localStorage cleared (encrypted seed lost)

**Solutions**:
- Ensure app is running on HTTPS or localhost
- Set up Face ID/Touch ID on device
- Re-register biometric wallet if credential ID is lost
- Check browser console for WebAuthn errors

### Development Tips

**Testing Transaction History**:
1. Make a transaction (e.g., set profile, create group)
2. Wait 5-10 seconds for indexer to process
3. Refresh the transaction history page
4. Check console logs for transaction count

**GraphQL Query Testing**:
Use the `/debug` page to test raw GraphQL queries against the indexer.

## Resources

### Documentation
- [Movement Network Docs](https://docs.movementnetwork.xyz/)
- [Aptos TS SDK](https://aptos.dev/sdks/ts-sdk/)
- [WebAuthn API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Next.js Docs](https://nextjs.org/docs)

### Explorers
- **Movement Testnet**: https://explorer.movementnetwork.xyz/?network=testnet
- **Indexer GraphQL**: https://indexer.testnet.movementnetwork.xyz/v1/graphql

### Support
- Movement Discord: https://discord.gg/movementnetwork

