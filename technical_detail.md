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

### Privy Integration
- **Email-only authentication**: No wallet extensions required
- **Automatic wallet creation**: Move wallet generated on first login
- **Local storage**: Wallet keypair stored in `localStorage` under `friendfi_move_wallet`

### Wallet Structure
```typescript
interface MoveWallet {
  address: string;           // Account address (0x...)
  privateKeyHex: string;     // Ed25519 private key
}
```

### Account Creation
```typescript
const account = Account.generate();
const wallet = {
  address: account.accountAddress.toString(),
  privateKeyHex: account.privateKey.toString(),
};
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
- Custom hooks (`useMoveWallet`, `useToast`)
- Session storage for user settings
- Local storage for wallet data

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
⚠️ **Development Mode**: Private keys stored in localStorage
🔒 **Production**: Should use secure key management (e.g., Privy embedded wallets)

### Transaction Signing
- All transactions signed client-side
- Private key never sent to server
- Gasless sponsorship via Shinami (server-side)

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
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
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
2. Address format mismatch
3. Indexer lag (recent transactions may take a few seconds to appear)

**Debugging**:
- Check console logs for the wallet address being queried
- Verify transactions exist on the Movement explorer
- Check for GraphQL errors in the console

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
- [Privy Docs](https://docs.privy.io/)
- [Next.js Docs](https://nextjs.org/docs)

### Explorers
- **Movement Testnet**: https://explorer.movementnetwork.xyz/?network=testnet
- **Indexer GraphQL**: https://indexer.testnet.movementnetwork.xyz/v1/graphql

### Support
- Movement Discord: https://discord.gg/movementnetwork
- Privy Support: support@privy.io

