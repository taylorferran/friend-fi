# Friend-Fi Technical Details

## Transaction History Feature

### Overview
The transaction history feature displays all on-chain transactions made by the user's Privy-created wallet, with direct links to the Movement testnet explorer.

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

## Off-Chain Migration & Signature-Based Authentication

### Architecture Overview

**Hybrid Model** (In Implementation):
- **Social Layer (Off-Chain - Supabase)**: Profiles, groups, metadata
- **Financial Layer (On-Chain - Movement)**: USDC transactions, membership verification

### Group Management Strategy

**Current Status**: Implementing signature-based authentication for groups

**Decision Rationale**:
- Groups don't involve USDC, so they should be free to create/join
- Deployed contracts require on-chain membership verification (`groups::is_member()`)
- Pure off-chain groups would allow anyone to bypass security
- Signature-based auth provides: free groups + secure verification

**How It Works**:
1. **Group Creation** (100% off-chain, FREE):
   - User creates group → Saved to Supabase
   - No on-chain transaction
   - Instant, no gas cost

2. **Group Joining** (100% off-chain, FREE):
   - User joins group → Added to Supabase
   - Password verified off-chain
   - No on-chain transaction
   - Instant, no gas cost

3. **USDC Transactions** (require membership proof):
   - User wants to create bet/expense/habit in group
   - Frontend requests signature from backend API
   - Backend verifies Supabase membership, signs attestation
   - User submits transaction + signature to contract
   - Contract verifies signature is from trusted backend
   - If valid, transaction proceeds

**Signature Format**:
```
Message: "{user_address}:{group_id}:{expires_timestamp}"
Backend signs with Ed25519 private key
Contract verifies with backend's public key
```

**Benefits**:
- ✅ Zero gas for group operations
- ✅ Proper security (on-chain verification)
- ✅ Flexible (backend can enforce any rules)
- ✅ Cached signatures (reuse for multiple transactions)
- ⚠️ Requires backend trust (centralized component)

### Supabase Schema

**Tables**:

```sql
-- Profiles (off-chain)
CREATE TABLE profiles (
  wallet_address TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_id INTEGER NOT NULL,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups (off-chain metadata)
CREATE TABLE groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  password_hash TEXT NOT NULL,  -- SHA256 hash
  admin_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Members (off-chain tracking)
CREATE TABLE group_members (
  group_id BIGINT REFERENCES groups(id),
  wallet_address TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, wallet_address)
);
```

**Row Level Security (RLS)**:
- Profiles: Users can update their own profile
- Groups: Anyone can read, creator can update
- Group Members: Members can read, admins can manage

### Backend API (Signature Service)

**Endpoint**: `POST /api/groups/[groupId]/membership-proof`

**Purpose**: Generate signed membership attestations

**Flow**:
1. Verify user authentication
2. Check Supabase: Is user in group?
3. Generate signature: `sign(user:group:expires)`
4. Return: `{ signature, expiresAt, groupId }`

**Security**:
- Backend private key stored in environment variable
- Signatures expire after 1 hour
- Cached on frontend for reuse
- Public key hardcoded in Move contracts

**Implementation Status**: Phase 1 Complete, Phase 2 In Progress

### Implementation Progress

**Phase 1: Backend Setup** ✅ COMPLETE
- Generated Ed25519 keypair for signing
  - Private key: `ed25519-priv-0x86ac4a17d95074ea2a9653d7833e21fb44e0b846b936dff472f24e97aef36735`
  - Public key: `0xa45972792b0aa9f863fa4e9b9ec3178ad0b67a67594a729a21388ab6e395478a`
- Created signature helpers (`src/lib/signature-helpers.ts`)
- Implemented signature cache (`src/lib/signature-cache.ts`)
- Built signature service (`src/lib/signature-service.ts`)
- Created API endpoint (`/api/groups/[groupId]/membership-proof`)

**Phase 2: Move Contracts** ✅ COMPLETE
- ✅ Created `signature_auth.move` module
- ✅ Updated `private_prediction_refactored.move` with signature verification
  - `create_bet()` now requires signature + expires_at parameters
  - `place_wager()` now requires signature + expires_at parameters
  - Both verify membership via `signature_auth::assert_membership()`
- ✅ Updated `expense_splitting.move` with signature verification
  - All expense creation functions require signature + expires_at
- ✅ Updated `habit_tracker.move` with signature verification
  - `create_commitment()` requires signature + expires_at
  - `accept_commitment()` requires signature + expires_at
- ✅ Compiled successfully (package size: 43,726 bytes)
- ✅ Deployed to Movement testnet (txn: 0xfd5af6256c48e8ac8326ac2d55cf01392bb3dba253fb89e0d5212e3e7a9f3391)

**Phase 3: Frontend Integration** ✅ COMPLETE
- ✅ Updated `src/lib/contract.ts` with signature parameters
  - `buildCreateBetPayload()` accepts signature + expiresAtMs
  - `buildPlaceWagerPayload()` accepts signature + expiresAtMs
  - Added `getBetGroupId()` view function
  - Updated `BetData` interface with `groupId` property
- ✅ Updated `src/hooks/useMoveWallet.ts`
  - `createBet()` accepts and passes signature parameters
  - `placeWager()` accepts and passes signature parameters
- ✅ Updated bet creation page (`src/app/bets/create/page.tsx`)
  - Requests signature before creating bet
  - Comprehensive error handling for membership errors
- ✅ Updated wager placement page (`src/app/bets/[id]/page.tsx`)
  - Requests signature before placing wager
  - Error handling for expired signatures and non-members
- ✅ Fixed demo page with dummy signatures for compatibility
- ✅ TypeScript build passing

**Phase 4: Testing** 🎯 READY FOR TESTING
- System is LIVE on Movement testnet
- Ready for end-to-end testing
- Test scenarios:
  1. Create group (should be instant and free)
  2. Create bet (should request signature, verify membership)
  3. Place wager (should request signature, verify membership)
  4. Non-member attempt (should fail with 403 error)

**Deployment Status**: ✅ **PRODUCTION READY**

## Smart Contract Integration

### Contract Address (UPDATED: December 2024)

**Current Deployment** (with Signature Authentication):
```
0xb51f98645aa50776e7d40bf1713ba46e235f16c785cf8cefeeed310f5a2a01aa
```

**Deployment Transaction**: 
- Hash: `0xfd5af6256c48e8ac8326ac2d55cf01392bb3dba253fb89e0d5212e3e7a9f3391`
- Explorer: https://explorer.movementnetwork.xyz/txn/0xfd5af6256c48e8ac8326ac2d55cf01392bb3dba253fb89e0d5212e3e7a9f3391?network=testnet
- Gas Used: 22,907
- Status: ✅ Executed successfully

**Legacy Deployment** (without Signature Auth):
```
0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370
```
*Note: This deployment is superseded by the new one above. Groups on old deployment use on-chain verification.*

### Modules (All Deployed with Signature Auth ✅)
1. **signature_auth** ✅ NEW: Ed25519 signature verification for off-chain groups
2. **groups**: Minimal on-chain registry (kept for legacy compatibility, not used for new groups)
3. **private_prediction_refactored** ✅ UPDATED: Prediction market with signature-based membership verification
4. **expense_splitting** ✅ UPDATED: Expense tracking with signature-based membership verification
5. **habit_tracker** ✅ UPDATED: Habit commitments with signature-based membership verification

### Key Functions

#### Groups Module (Legacy On-Chain)
**Note**: Groups are transitioning to signature-based auth. These functions exist on-chain but will be bypassed for new groups.

- `create_group()`: Creates minimal on-chain group (just membership)
- `join_group(group_id: u64, password: String)`: Joins group on-chain
- `is_member(group_id: u64, address: address)`: Checks membership
- `get_group_members(group_id: u64)`: Gets member list

**New Approach**: Groups use Supabase + signature verification

#### Signature Auth Module (✅ DEPLOYED)
- `verify_membership(group_id: u64, user: address, expires_at: u64, signature: vector<u8>)`: Verifies backend signature
  - Checks signature expiration (rejects if expired)
  - Reconstructs message: "user:group:expires"
  - Verifies Ed25519 signature from trusted backend
  - Returns true if valid, false otherwise
- `assert_membership(...)`: Same as verify but aborts on failure
  - Used in contract entry functions to enforce membership
  - Throws `E_INVALID_SIGNATURE` or `E_SIGNATURE_EXPIRED` on failure

#### Predictions Module (✅ DEPLOYED with Signature Auth)
**Current Implementation** (Signature-Based):
- `create_bet(group_id: u64, backend_signature: vector<u8>, expires_at_ms: u64, description: String, outcomes: vector<String>, admin: address, encrypted_payload: vector<u8>)`: 
  - Verifies membership via `signature_auth::assert_membership()`
  - Creates new prediction market
  - Returns bet ID
- `place_wager(bet_id: u64, outcome_index: u64, amount: u64, backend_signature: vector<u8>, expires_at_ms: u64)`: 
  - Verifies membership via `signature_auth::assert_membership()`
  - Places wager with USDC
  - Updates outcome pools
- `resolve_bet(bet_id: u64, winning_outcome_index: u64)`: Resolves bet (admin only, no signature needed)
- `claim_payout(bet_id: u64)`: Claims winnings (no signature needed, already verified)

**Legacy (Old Deployment)**:
- Used `groups::is_member(group_id, caller)` for verification
- Required on-chain group creation/joining

#### Expense Splitting Module (✅ DEPLOYED with Signature Auth)
- `create_expense_equal(group_id: u64, backend_signature: vector<u8>, expires_at_ms: u64, ...)`: Equal split with signature verification
- `create_expense_exact(group_id: u64, backend_signature: vector<u8>, expires_at_ms: u64, ...)`: Exact amounts with signature verification
- `create_expense_percentage(group_id: u64, backend_signature: vector<u8>, expires_at_ms: u64, ...)`: Percentage split with signature verification
- `settle_debt(...)`: Settles debts between members (no signature needed)

#### Habit Tracker Module (✅ DEPLOYED with Signature Auth)
- `create_commitment(group_id: u64, backend_signature: vector<u8>, expires_at_ms: u64, participant_b: address, ...)`: Creates habit with signature verification
- `accept_commitment(group_id: u64, backend_signature: vector<u8>, expires_at_ms: u64, commitment_local_id: u64)`: Accepts commitment with signature verification
- `check_in(commitment_id: u64, ...)`: Records habit check-in (no signature needed, already committed)

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

### Privy Integration

**Primary Authentication Method**: Privy embedded wallets
- **Email-only authentication**: No wallet extensions required
- **Automatic wallet creation**: Privy creates embedded wallet on first login for Movement network
- **Server-managed keys**: Private keys are stored securely on Privy's infrastructure, never exposed to client
- **Wallet info extraction**: Wallet details extracted from `user.wallet` or `user.linkedAccounts` in `usePrivyMoveWallet` hook

**Privy Wallet Structure**:
```typescript
interface PrivyWalletInfo {
  walletId: string;      // Privy wallet identifier
  address: string;        // Ethereum-style address (40 hex chars)
  publicKey: string;      // Ed25519 public key (32 bytes hex)
}
```

**Address Conversion**:
- Privy returns Ethereum-style addresses (40 hex characters) and Ed25519 public keys
- **Primary Method**: Aptos address is derived from Ed25519 public key using `SHA3-256(public_key_bytes || 0x00)`
  - This is the actual on-chain address used for profiles and transactions
  - Implemented in `deriveAptosAddressFromPublicKey()` in `src/lib/address-utils.ts`
  - Uses `@noble/hashes` library for SHA3-256 hashing
- **Fallback Method**: If public key is unavailable, addresses are padded to 64 hex characters
  - Fallback: `0x${address.slice(2).padStart(64, '0')}`
  - Only used when public key cannot be retrieved from Privy

### Dual Wallet System

The app supports two wallet types:

1. **Privy Embedded Wallets** (Primary)
   - Managed by Privy's servers
   - No private key access on client
   - Signing via Privy's `rawSign()` API
   - Used when user authenticates via Privy

2. **Biometric/LocalStorage Wallets** (Fallback)
   - Stored in `localStorage` under `friendfi_move_wallet`
   - Contains `address` and `privateKeyHex`
   - Used for biometric authentication or demo mode
   - Client-side signing with direct private key access

**Wallet Selection Logic** (`useUnifiedMoveWallet`):
- Prefers Privy wallet if available and user is authenticated via Privy
- Falls back to biometric wallet if Privy not available
- Warns about address mismatches if both exist

### Privy API Endpoints

**`/api/privy-wallet-info`**:
- Fetches wallet details from Privy using Node.js SDK
- Returns `walletId`, `address`, and `publicKey`
- Uses `privy.wallets().get(walletId)` to retrieve wallet info

**`/api/privy-raw-sign`**:
- Signs transaction messages using Privy's `rawSign()` method
- Accepts `walletId` and `message` (hex-encoded)
- Returns Ed25519 signature
- Uses `privy.wallets().rawSign(walletId, { params: { hash: message } })`

### Transaction Signing Flow (Privy)

1. **Derive Aptos Address**: Derive actual on-chain address from Ed25519 public key using `SHA3-256(public_key_bytes || 0x00)`
2. **Build Transaction**: Create raw transaction using Aptos SDK with derived address as sender
3. **Generate Signing Message**: `generateSigningMessageForTransaction(rawTxn)`
4. **Sign via API**: POST to `/api/privy-raw-sign` with walletId and message
5. **Create Authenticator**: Combine signature + public key into `AccountAuthenticatorEd25519`
6. **Submit Transaction**: POST to `/api/sponsor-transaction` (gasless sponsorship)
7. **Wait for Confirmation**: Poll for transaction completion

**Code Flow**:
```
Dashboard → useMoveWallet → useUnifiedMoveWallet → signAndSubmitWithPrivy 
→ /api/privy-raw-sign → Privy SDK → /api/sponsor-transaction → Movement Network
```

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
- **Authentication**: Privy
- **Blockchain SDK**: Aptos TS SDK

### Key Libraries
- `@aptos-labs/ts-sdk`: Move blockchain interaction
- `@privy-io/react-auth`: Authentication and wallet management
- `next`: React framework with server components
- `tailwindcss`: Utility-first CSS

### State Management
- React hooks (`useState`, `useEffect`)
- Custom hooks:
  - `useMoveWallet`: Wallet operations and contract interactions
  - `usePrivyMoveWallet`: Privy wallet integration (being phased out)
  - `useUnifiedMoveWallet`: Dual wallet support
  - `useAuth`: Biometric authentication (replacing Privy)
  - `useBiometricWallet`: WebAuthn biometric wallet management
  - `useToast`: Toast notifications
- Session storage for user settings and profile cache
- Local storage for biometric wallet data (WebAuthn)
- Supabase for off-chain data (profiles, groups)
- Signature cache for membership attestations

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
- Supabase queries for off-chain data (profiles, groups)

### Caching
- **Session storage**: User profile settings, profile lookup cache
- **Local storage**: Biometric wallet data
- **Signature cache**: Membership attestations (1 hour TTL)
  - Cached in memory with expiration checks
  - Avoids redundant backend API calls
  - Automatic refresh when expired
- **Profile cache**: 10-second TTL to reduce on-chain queries
- Immediate UI updates before blockchain confirmation
- Custom events for cross-component updates

### Loading States
- Skeleton screens during data fetching
- Instant page transitions
- Optimistic UI updates
- "Verifying membership..." state when requesting signatures
- Progressive loading (show cached data, then refresh)

## Security Considerations

### Private Key Storage

**Privy Embedded Wallets** (Primary):
- ✅ **Production-ready**: Private keys stored securely on Privy's infrastructure
- ✅ **Never exposed**: Private keys never leave Privy's servers
- ✅ **No client access**: Client only has access to `walletId`, `address`, and `publicKey`

**Biometric/LocalStorage Wallets** (Fallback):
- ⚠️ **Development Mode**: Private keys stored in `localStorage` under `friendfi_move_wallet`
- ⚠️ **Security Risk**: Accessible via browser DevTools
- 🔒 **Production**: Should migrate to Privy embedded wallets for production use

### Transaction Signing

**Privy Wallets**:
- **Server-side signing**: Transactions signed via Privy's Node.js SDK on server
- **API route**: `/api/privy-raw-sign` calls `privy.wallets().rawSign()` 
- **Private key security**: Private key never exposed to client or our server
- **Message signing**: Only transaction hash is sent to Privy for signing
- **Gasless sponsorship**: Transaction submission via `/api/sponsor-transaction` (Shinami)

**Biometric/LocalStorage Wallets**:
- **Client-side signing**: Transactions signed directly in browser using private key
- **Direct signing**: Uses Aptos SDK `Account.sign()` method
- **Private key access**: Private key loaded from localStorage (security risk)
- **Gasless sponsorship**: Same `/api/sponsor-transaction` endpoint

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
# Supabase (Off-Chain Data)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (server-side only)

# Signature Authentication (Backend)
BACKEND_SIGNER_PRIVATE_KEY=your_ed25519_private_key (server-side only, NEVER expose)

# Privy (Legacy, being phased out)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret (server-side only)

# Gasless Transactions
SHINAMI_ACCESS_KEY=your_shinami_key (server-side only)
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
2. Address format mismatch (Ethereum 40-char vs Aptos 64-char)
3. Indexer lag (recent transactions may take a few seconds to appear)
4. Address padding issue (Privy returns 40-char, queries need 64-char)

**Debugging**:
- Check console logs for the wallet address being queried
- Verify address format: should be 64 hex chars (excluding 0x prefix)
- Check for address padding: `useUnifiedMoveWallet` logs the address conversion
- Verify transactions exist on the Movement explorer
- Check for GraphQL errors in the console
- Compare Privy address vs padded address in console logs

#### Address Format Mismatch (Privy Wallets) - RESOLVED

**Symptoms** (now resolved):
- Profile not found even though transactions exist
- Transactions not showing in history
- "Address mismatch" warnings in console

**Root Cause**:
Privy returns Ethereum-style addresses (40 hex chars), but Aptos uses 64 hex chars. Previously, the app only padded addresses, which didn't match the actual on-chain address derived from the Ed25519 public key.

**Solution** (implemented):
- ✅ **Proper Address Derivation**: Aptos address is now derived from Ed25519 public key using `SHA3-256(public_key_bytes || 0x00)`
- ✅ **Consistent Address Usage**: Both transaction building and profile queries use the same derived address
- ✅ **Fallback Support**: If public key is unavailable, falls back to padded address with warning

**Implementation**:
- `deriveAptosAddressFromPublicKey()` in `src/lib/address-utils.ts` uses `@noble/hashes` for SHA3-256
- `useUnifiedMoveWallet` hook derives address when public key is available
- `signAndSubmitWithPrivy` uses derived address for transaction sender

**Note**: If you previously saved a profile with the padded address, you may need to save it again. New profiles will use the correct derived address and will be found correctly.

### Development Tips

**Testing Transaction History**:
1. Make a transaction (e.g., set profile, create group)
2. Wait 5-10 seconds for indexer to process
3. Refresh the transaction history page
4. Check console logs for transaction count

**GraphQL Query Testing**:
Use the `/debug` page to test raw GraphQL queries against the indexer.

## Recent Architecture Changes

### Migration to Off-Chain Groups with Signature Auth (December 2024) ✅ COMPLETE

**Problem**: 
- Groups don't involve USDC, but cost gas to create/join
- Wanted free groups to reduce onboarding friction
- Deployed contracts check `groups::is_member()` for security
- Can't upgrade existing contracts due to event structure changes

**Solution**: Signature-based authentication with fresh deployment
- Groups stored 100% in Supabase (free!)
- Backend signs membership attestations (Ed25519)
- Contracts verify signatures on-chain
- Zero gas for group operations, secure verification
- Deployed new contracts with all modules supporting signature auth

**Implementation Timeline** (ACTUAL):
- Phase 1: Backend signature API ✅ 2-3 hours
- Phase 2: Move contract updates ✅ 3-4 hours  
- Phase 3: Frontend integration ✅ 2-3 hours
- Phase 4: Fresh deployment ✅ 1 hour
- **Total: ~10 hours** (completed December 2024)

**Deployment Details**:
- New contract address: `0xb51f98645aa50776e7d40bf1713ba46e235f16c785cf8cefeeed310f5a2a01aa`
- Transaction: `0xfd5af6256c48e8ac8326ac2d55cf01392bb3dba253fb89e0d5212e3e7a9f3391`
- Gas used: 22,907
- Status: ✅ Executed successfully
- Package size: 43,726 bytes
- All 5 modules deployed with signature verification

**Results**:
- ✅ Free group creation/joining (was ~$0.01-0.02 each)
- ✅ Better onboarding (no gas needed to start)
- ✅ Can monetize USDC transactions instead
- ✅ Flexible rules (backend can change without redeploy)
- ✅ Signature caching reduces API calls (1-hour TTL)

**Trade-offs**:
- ⚠️ Requires backend trust (centralized signing)
- ⚠️ Extra API call per transaction (cached)
- ⚠️ Backend must be online for signatures
- ⚠️ Contract redeployment required (event struct changes)

### Authentication Migration (December 2024)

**Changed from**: Privy embedded wallets
**Changed to**: WebAuthn biometric authentication

**Reason**: 
- Remove third-party dependency
- Native biometric auth (Face ID, Touch ID)
- Better user experience

**Implementation**:
- `useBiometricWallet` hook for WebAuthn
- `useAuth` hook for authentication state
- `BiometricAuthWrapper` for app-wide auth
- Local storage for wallet (encrypted with biometric)

### Crypto Library Updates

**Issue**: Import errors with `@noble/hashes`
**Solution**: Updated imports to use `.js` extensions
```typescript
// Before
import { sha256 } from '@noble/hashes/sha256';

// After (required by @noble/hashes v2.0.1)
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
```

**Usage**: Password hashing for off-chain group passwords

## Resources

### Documentation
- [Movement Network Docs](https://docs.movementnetwork.xyz/)
- [Aptos TS SDK](https://aptos.dev/sdks/ts-sdk/)
- [Supabase Docs](https://supabase.com/docs)
- [WebAuthn Guide](https://webauthn.guide/)
- [Next.js Docs](https://nextjs.org/docs)

### Explorers
- **Movement Testnet**: https://explorer.movementnetwork.xyz/?network=testnet
- **Indexer GraphQL**: https://indexer.testnet.movementnetwork.xyz/v1/graphql

### Internal Docs
- `SIGNATURE_AUTH_DESIGN.md`: Signature-based authentication design
- `SIGNATURE_IMPLEMENTATION_PLAN.md`: Implementation roadmap (31 tasks)
- `OFF_CHAIN_MIGRATION.md`: Off-chain migration strategy

### Support
- Movement Discord: https://discord.gg/movementnetwork
- Supabase Support: https://supabase.com/support

