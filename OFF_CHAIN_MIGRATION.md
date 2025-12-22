# Off-Chain Migration Plan

## Overview
Moving non-financial transactions off-chain to Supabase ensures gas is only paid for transactions that move money. This creates a secure, cost-effective system where:
- **On-chain**: Only transactions that transfer USDC or require immutable verification
- **Off-chain (Supabase)**: All metadata, social features, and non-financial state

---

## ✅ DEFINITIVE LIST: What Can Move Off-Chain

### 1. **Profile Management** (Already Planned)
- **Function**: `set_profile(username, avatar_id)`
- **Current**: On-chain with global username uniqueness check
- **Off-chain**: Store in Supabase with wallet address as primary key
- **Benefits**: 
  - No gas for profile updates
  - Faster profile changes
  - Can add more profile fields (bio, social links, etc.)
- **On-chain requirement**: None (purely display data)

---

### 2. **Group Metadata** 
- **Function**: `create_group(name, password, description)`
- **Current**: Stores name, password hash, description, admin, members on-chain
- **Off-chain**: 
  - Store name, description, admin in Supabase
  - Store password hash in Supabase (encrypted)
  - Keep minimal on-chain membership registry for access control
- **Benefits**: 
  - No gas for group creation
  - Can add rich metadata (images, tags, settings)
  - Faster group creation
- **On-chain requirement**: Minimal membership list for access control (see Hybrid Approach below)

---

### 3. **Group Joining** (Partial)
- **Function**: `join_group(group_id, password)`
- **Current**: Adds member to on-chain vector, verifies password on-chain
- **Off-chain**: 
  - Verify password in Supabase
  - Add member to Supabase members table
  - Optionally: Single on-chain transaction to register membership for access control
- **Benefits**: 
  - No gas for joining (if fully off-chain)
  - Or minimal gas (if hybrid approach)
- **On-chain requirement**: May need minimal membership proof for other modules (see Hybrid Approach)

---

### 4. **Group Leaving**
- **Function**: `leave_group(group_id)`
- **Current**: Removes member from on-chain vector
- **Off-chain**: Remove from Supabase members table
- **Benefits**: No gas for leaving
- **On-chain requirement**: None (unless needed for access control)

---

### 5. **Expense Creation** (All Variants)
- **Functions**: 
  - `create_expense_equal(group_id, description, total_amount, participants)`
  - `create_expense_exact(group_id, description, total_amount, participants, amounts)`
  - `create_expense_percentage(group_id, description, total_amount, participants, percentages)`
- **Current**: Stores expense details and calculates debts on-chain
- **Off-chain**: 
  - Store expense metadata in Supabase
  - Calculate debts in Supabase
  - Keep debt balances on-chain for settlement verification
- **Benefits**: 
  - No gas for expense creation
  - Can add rich expense data (receipts, categories, tags)
  - Faster expense logging
- **On-chain requirement**: Debt balances must remain on-chain for `settle_debt_with_usdc` to work

---

### 6. **Off-Chain Debt Settlement** (Already Exists!)
- **Function**: `mark_debt_settled(creditor_signer, group_id, debtor, amount)`
- **Current**: Updates on-chain debt state when paid off-chain
- **Off-chain**: 
  - Mark as settled in Supabase
  - Keep on-chain debt state for verification
- **Benefits**: Already optimized - no USDC transfer, just state update
- **On-chain requirement**: Minimal - just update debt state

---

### 7. **Bet Creation**
- **Function**: `create_bet(group_id, description, outcomes, admin, encrypted_payload)`
- **Current**: Stores bet metadata on-chain
- **Off-chain**: 
  - Store bet metadata in Supabase
  - Keep bet ID and resolution state on-chain
- **Benefits**: 
  - No gas for bet creation
  - Can add rich bet data (images, discussion threads)
  - Faster bet creation
- **On-chain requirement**: Minimal - bet ID registry and resolution state for payouts

---

### 8. **Habit Check-Ins**
- **Function**: `check_in(group_id, commitment_local_id)`
- **Current**: Records check-in on-chain, tracks weekly counts
- **Off-chain**: 
  - Store check-ins in Supabase
  - Calculate weekly totals in Supabase
  - Keep commitment state on-chain for payout verification
- **Benefits**: 
  - No gas for check-ins
  - Can add rich check-in data (photos, notes, location)
  - Unlimited check-ins without gas costs
- **On-chain requirement**: Minimal - weekly totals for `process_week` payout calculation

---

## ❌ MUST STAY ON-CHAIN (Moves Money)

These transactions **must remain on-chain** because they transfer USDC:

1. **`settle_debt_with_usdc`** - Transfers USDC from debtor to creditor
2. **`place_wager`** - Deposits USDC into bet escrow
3. **`resolve_bet`** - Pays out USDC to winners
4. **`cancel_wager`** - Refunds USDC from escrow
5. **`create_commitment`** - Deposits USDC stake into escrow
6. **`accept_commitment`** - Deposits USDC stake into escrow
7. **`delete_commitment`** - Refunds USDC from escrow
8. **`process_week`** - Pays out USDC to weekly winners

---

## 🔄 Hybrid Approach: Minimal On-Chain State

For some features, we need a **hybrid approach** where:
- **Metadata** lives in Supabase (off-chain)
- **Minimal state** lives on-chain for access control and verification

### Example: Groups
- **Off-chain (Supabase)**: Name, description, admin, settings, rich metadata
- **On-chain (Minimal)**: Membership registry (just addresses) for access control
  - Other modules (`expense_splitting`, `habit_tracker`, `private_prediction`) need to verify membership
  - Solution: Keep a lightweight on-chain membership list, update it when joining/leaving

### Example: Expenses
- **Off-chain (Supabase)**: Description, participants, split details, receipts, categories
- **On-chain (Minimal)**: Debt balances (debtor → creditor → amount) for settlement verification
  - `settle_debt_with_usdc` needs to verify debt exists and amount
  - Solution: Keep debt balances on-chain, but expense metadata off-chain

### Example: Bets
- **Off-chain (Supabase)**: Description, outcomes, discussion, images
- **On-chain (Minimal)**: Bet ID, resolution state, pool amounts for payout calculation
  - `resolve_bet` needs pool amounts to calculate payouts
  - Solution: Keep pool state on-chain, but bet metadata off-chain

### Example: Habits
- **Off-chain (Supabase)**: Check-in records, photos, notes, commitment details
- **On-chain (Minimal)**: Commitment state, weekly totals for payout calculation
  - `process_week` needs check-in counts to determine winners
  - Solution: Keep weekly totals on-chain, but check-in details off-chain

---

## 📊 Migration Priority

### Phase 1: Quick Wins (No On-Chain Dependencies)
1. ✅ **Profile/Username** - Already planned, no dependencies
2. ✅ **Group Metadata** - Can move fully off-chain if we keep minimal membership list
3. ✅ **Group Leaving** - Simple removal, no dependencies

### Phase 2: Medium Complexity (Hybrid Approach)
4. ✅ **Expense Creation** - Move metadata off-chain, keep debt balances on-chain
5. ✅ **Bet Creation** - Move metadata off-chain, keep pool state on-chain
6. ✅ **Habit Check-Ins** - Move check-in details off-chain, keep weekly totals on-chain

### Phase 3: Complex (Requires Access Control)
7. ✅ **Group Joining** - Need to update minimal on-chain membership for access control

---

## 🏗️ Supabase Schema Design

### Tables Needed:

```sql
-- Profiles
profiles (
  wallet_address TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_id INTEGER NOT NULL,
  bio TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Groups
groups (
  id SERIAL PRIMARY KEY,
  on_chain_id INTEGER UNIQUE, -- Reference to on-chain group ID
  name TEXT NOT NULL,
  description TEXT,
  password_hash TEXT NOT NULL, -- Encrypted
  admin_address TEXT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Group Members (for off-chain metadata)
group_members (
  group_id INTEGER REFERENCES groups(id),
  wallet_address TEXT NOT NULL,
  joined_at TIMESTAMP,
  PRIMARY KEY (group_id, wallet_address)
)

-- Expenses
expenses (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id),
  description TEXT NOT NULL,
  total_amount BIGINT NOT NULL,
  payer_address TEXT NOT NULL,
  split_type TEXT NOT NULL, -- 'equal', 'exact', 'percentage'
  created_at TIMESTAMP,
  -- Split details stored in expense_splits table
)

-- Expense Splits
expense_splits (
  expense_id INTEGER REFERENCES expenses(id),
  participant_address TEXT NOT NULL,
  amount BIGINT NOT NULL,
  PRIMARY KEY (expense_id, participant_address)
)

-- Bets
bets (
  id SERIAL PRIMARY KEY,
  on_chain_bet_id INTEGER UNIQUE, -- Reference to on-chain bet ID
  group_id INTEGER REFERENCES groups(id),
  description TEXT NOT NULL,
  outcomes JSONB NOT NULL, -- Array of outcome strings
  admin_address TEXT NOT NULL,
  encrypted_payload BYTEA,
  created_at TIMESTAMP
)

-- Habit Commitments
commitments (
  id SERIAL PRIMARY KEY,
  on_chain_commitment_id INTEGER, -- Reference to on-chain commitment ID
  group_id INTEGER REFERENCES groups(id),
  participant_a TEXT NOT NULL,
  participant_b TEXT NOT NULL,
  commitment_name TEXT NOT NULL,
  weekly_payout BIGINT NOT NULL,
  weekly_check_ins_required INTEGER NOT NULL,
  duration_weeks INTEGER NOT NULL,
  start_time TIMESTAMP,
  created_at TIMESTAMP
)

-- Habit Check-Ins
check_ins (
  id SERIAL PRIMARY KEY,
  commitment_id INTEGER REFERENCES commitments(id),
  wallet_address TEXT NOT NULL,
  week INTEGER NOT NULL,
  check_in_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMP,
  UNIQUE(commitment_id, wallet_address, week)
)
```

---

## 🔐 Security Considerations

1. **Password Storage**: Store password hashes encrypted in Supabase, never plaintext
2. **Access Control**: Use Row Level Security (RLS) in Supabase to ensure users can only access their groups
3. **On-Chain Verification**: For critical operations (settlements, payouts), always verify state on-chain before executing
4. **Data Integrity**: Use on-chain state as source of truth for financial operations
5. **Wallet Signing**: Require wallet signatures for off-chain operations to prevent spoofing

---

## 💰 Gas Savings Estimate

Assuming average gas cost per transaction:
- **Profile updates**: ~$0.01 saved per update
- **Group creation**: ~$0.02 saved per creation
- **Expense creation**: ~$0.02 saved per expense
- **Bet creation**: ~$0.02 saved per bet
- **Check-ins**: ~$0.01 saved per check-in

**Total potential savings**: If a user creates 10 groups, 50 expenses, 20 bets, and does 100 check-ins, that's ~$3.50 in gas saved per user. With 1000 users, that's $3,500 in gas savings.

---

## ✅ Conclusion

Your hypothesis is **100% correct**: By moving every transaction that doesn't move money off-chain, you ensure:
1. ✅ Gas is only paid for transactions that transfer USDC
2. ✅ System remains secure (financial operations stay on-chain)
3. ✅ Better UX (faster, cheaper, richer features)
4. ✅ Scalability (unlimited metadata without gas costs)

The key is the **hybrid approach**: Keep minimal on-chain state for access control and verification, but move all metadata and social features to Supabase.

---

## 📋 Implementation Status

**Current State**: Pre-migration (backup branch: `pre-offchain-migration`)

**Next Steps**: See `MIGRATION_PLAN.md` for detailed step-by-step implementation guide.

**Key Implementation Notes**:
- Contracts need refactoring to separate metadata from financial state
- Frontend needs dual-query system (Supabase + on-chain fallback)
- Migration script needed for existing data
- RLS policies required for wallet-based authentication

**Estimated Timeline**: 2-3 weeks for complete migration

