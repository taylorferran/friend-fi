# Monetization & Gas Sponsorship Analysis

## Current Problem

**Risk**: We're sponsoring gas for transactions where we don't collect any revenue, opening us to abuse.

**Goal**: Only sponsor transactions where USDC moves AND we collect a platform fee.

---

## Current State Analysis

### Module 1: Private Predictions ✅ MOSTLY GOOD

#### Transactions & Fee Collection

| Transaction      | Gas Sponsor | USDC Moves? | Fee Collected? | Status |
|------------------|-------------|-------------|----------------|--------|
| `create_bet`     | ✅ Shinami  | ❌ No       | ❌ No          | ⚠️ RISK |
| `place_wager`    | ✅ Shinami  | ✅ Yes      | ✅ Yes (0.3%)  | ✅ GOOD |
| `resolve_bet`    | ✅ Shinami  | ✅ Yes (payout) | ❌ No      | ⚠️ RISK |
| `cancel_wager`   | ✅ Shinami  | ✅ Yes (refund) | ❌ No (fee returned) | ⚠️ RISK |

#### Fee Implementation Details

**Location**: `move_contracts/sources/private_prediction_refactored.move`

```move
const FEE_BPS: u64 = 30;  // 0.3% = 30 basis points
const BPS_DENOMINATOR: u64 = 10_000;

fun internal_deposit_from_user(user: &signer, raw_amount: u64): u64 {
    let fee = (raw_amount * FEE_BPS) / BPS_DENOMINATOR;
    let net = raw_amount - fee;
    
    // Fee goes to escrow, tracked in fee_accumulator
    app.fee_accumulator = app.fee_accumulator + fee;
    
    return net;
}
```

**When Called**: Only during `place_wager()` - USDC deposited from user to escrow

**Not Called During**:
- `create_bet()` - No USDC transfer
- `resolve_bet()` - Payouts from escrow (fee already taken)
- `cancel_wager()` - Refund includes the net amount (fee lost)

#### Problems

1. **`create_bet()` Abuse Vector**:
   - Free transaction, no USDC required
   - Attacker could create thousands of spam bets
   - We pay gas, get nothing in return
   - **Cost per tx**: ~$0.0001 (gas) × spam volume = potential loss

2. **`resolve_bet()` Abuse Vector**:
   - Admin resolves bet (free transaction)
   - We pay gas for payout distribution
   - No fee collected on resolution
   - Payouts are net of fees already taken, so we already have revenue
   - **Less critical** - requires bet to exist with wagers

3. **`cancel_wager()` Edge Case**:
   - User cancels wager, gets refund
   - We already took 0.3% fee on deposit
   - Fee is NOT refunded (stays in escrow)
   - **Actually okay** - we keep the fee even on cancellation

---

### Module 2: Habit Tracker ⚠️ PARTIALLY GOOD

#### Transactions & Fee Collection

| Transaction           | Gas Sponsor | USDC Moves? | Fee Collected? | Status |
|-----------------------|-------------|-------------|----------------|--------|
| `create_commitment`   | ✅ Shinami  | ✅ Yes      | ✅ Yes (0.3%)  | ✅ GOOD |
| `accept_commitment`   | ✅ Shinami  | ✅ Yes      | ✅ Yes (0.3%)  | ✅ GOOD |
| `delete_commitment`   | ✅ Shinami  | ✅ Yes (refund) | ❌ No (fee returned) | ⚠️ RISK |
| `check_in`            | ✅ Shinami  | ❌ No       | ❌ No          | ⚠️ RISK |
| `process_week`        | ✅ Shinami  | ✅ Yes (payout) | ❌ No      | ⚠️ RISK |

#### Fee Implementation Details

**Location**: `move_contracts/sources/habit_tracker.move`

```move
const RAKE_NUMERATOR: u64 = 3;     // 0.3%
const RAKE_DENOMINATOR: u64 = 1000;

// In create_commitment():
let fee = (required_deposit * RAKE_NUMERATOR) / RAKE_DENOMINATOR;
let gross_deposit = required_deposit + fee;  // User pays fee EXTRA

// In accept_commitment():
let fee = (required_deposit * RAKE_NUMERATOR) / RAKE_DENOMINATOR;
let gross_deposit = required_deposit + fee;  // User pays fee EXTRA
```

**When Called**: Both participants deposit USDC + 0.3% fee

**Example**:
- Commitment: 0.01 USDC/week for 4 weeks
- Each participant deposits: (0.01 × 4) / 2 = 0.02 USDC
- Fee per participant: 0.02 × 0.003 = 0.00006 USDC
- Total fees: 0.00012 USDC
- Gas cost per tx: ~$0.00012
- **Net profit**: ~$0 (breakeven)

#### Problems

1. **`check_in()` Abuse Vector**:
   - Free transaction, can spam check-ins
   - Limited by `MAX_CHECK_INS_PER_WEEK` (99) but still spammable
   - **Cost**: $0.0001 × check-ins per week × spam users

2. **`process_week()` Edge Case**:
   - Distributes weekly payouts
   - No fee on payout (fee already collected on deposit)
   - **Okay** - necessary for functionality

3. **`delete_commitment()` Edge Case**:
   - Refunds deposits to both participants
   - Fees are refunded too (reduces revenue)
   - Can only delete if not accepted yet
   - **Minor issue** - limited abuse potential

---

### Module 3: Expense Splitting ❌ MAJOR ISSUES

#### Transactions & Fee Collection

| Transaction              | Gas Sponsor | USDC Moves? | Fee Collected? | Status |
|--------------------------|-------------|-------------|----------------|--------|
| `create_expense_equal`   | ✅ Shinami  | ❌ No       | ❌ No          | ❌ CRITICAL |
| `create_expense_percentage` | ✅ Shinami | ❌ No    | ❌ No          | ❌ CRITICAL |
| `create_expense_exact`   | ✅ Shinami  | ❌ No       | ❌ No          | ❌ CRITICAL |
| `settle_debt`            | ✅ Shinami  | ✅ Yes      | ✅ Yes (0.3%)  | ✅ GOOD |

#### Fee Implementation Details

**Location**: `move_contracts/sources/expense_splitting.move`

```move
const RAKE_NUMERATOR: u64 = 3;     // 0.3%
const RAKE_DENOMINATOR: u64 = 1000;

// In settle_debt():
let fee = (amount * RAKE_NUMERATOR) / RAKE_DENOMINATOR;
let net_to_creditor = amount - fee;

// Fee tracked in escrow
app.fee_accumulator = app.fee_accumulator + fee;
```

**When Called**: Only during `settle_debt()` when USDC is transferred

**Not Called During**:
- `create_expense_*()` functions - Just record-keeping, no USDC transfer
- These are 100% off-chain capable!

#### Problems

1. **`create_expense_*()` CRITICAL ABUSE**:
   - Three different functions for expense creation
   - All free, all on-chain (unnecessary!)
   - Expense data is public anyway (no encryption)
   - **Could be 100% off-chain in Supabase**
   - Attacker could spam thousands of fake expenses
   - We pay gas for every single one

2. **Architecture Flaw**:
   - Expenses should be off-chain metadata (like groups)
   - Only debt settlements need to be on-chain (USDC transfer)
   - Current design wastes gas and opens attack vector

---

## Recommended Solutions

### Solution 1: Private Predictions - Add Mandatory Initial Wager ✅ BEST

**Implementation**:
```move
public entry fun create_bet_with_wager(
    account: &signer,
    group_id: u64,
    signature: vector<u8>,
    expires_at_ms: u64,
    description: String,
    outcomes: vector<String>,
    admin: address,
    initial_wager_outcome: u64,  // NEW: Which outcome to bet on
    initial_wager_amount: u64,   // NEW: Amount to wager (minimum 0.001 USDC?)
) acquires State, AppConfig {
    // Verify membership
    signature_auth::assert_membership(group_id, caller, expires_at_ms, signature);
    
    // Create bet (existing logic)
    let bet_id = create_bet_internal(...);
    
    // Force initial wager from creator
    place_wager_internal(account, bet_id, initial_wager_outcome, initial_wager_amount);
    
    // Now we collect 0.3% fee on initial wager!
}
```

**Benefits**:
- ✅ Every bet creation now moves USDC (0.3% fee)
- ✅ Minimum wager requirement prevents spam (e.g., 0.001 USDC)
- ✅ Better UX: Creator shows confidence by betting first
- ✅ Gas cost covered by fee revenue
- ✅ No separate transaction needed to place first wager

**Costs**:
- Minimum wager: 0.001 USDC (1,000 micro-USDC)
- Fee: 0.000003 USDC
- Gas cost: ~$0.0001
- Net profit: ~$0 (breakeven at minimum)
- At 0.01 USDC wager: 0.00003 fee vs $0.0001 gas = still loss
- At 0.1 USDC wager: 0.0003 fee vs $0.0001 gas = profit!

**Recommendation**: Require minimum 0.01 USDC wager to create bet

---

### Solution 2: Private Predictions - Add Resolution Fee ✅ OPTIONAL

**Implementation**:
```move
public entry fun resolve_bet(
    account: &signer,
    bet_id: u64,
    winning_outcome_index: u64,
) acquires State, AppConfig {
    // Existing validation...
    
    // NEW: Take resolution fee from total pool before payouts
    let resolution_fee_bps: u64 = 10;  // 0.1% of total pool
    let resolution_fee = (bet.total_pool * resolution_fee_bps) / BPS_DENOMINATOR;
    
    bet.total_pool = bet.total_pool - resolution_fee;
    app.fee_accumulator = app.fee_accumulator + resolution_fee;
    
    // Distribute remaining pool to winners...
}
```

**Benefits**:
- ✅ Additional 0.1% revenue on resolution
- ✅ Gas cost covered
- ✅ Fair: Taken from entire pool (all bettors pay proportionally)

**Concerns**:
- ⚠️ Reduces winner payouts slightly
- ⚠️ Adds complexity to payout calculations

**Total Fee Structure**:
- Deposit: 0.3% (on each wager)
- Resolution: 0.1% (on total pool)
- **Total**: ~0.4% effective rate

---

### Solution 3: Habit Tracker - Make Check-ins Off-Chain ✅ RECOMMENDED

**Current**: Check-ins are on-chain transactions (abusable)

**Proposed**: Move check-ins to Supabase

**Implementation**:

1. **Supabase Table**: `habit_check_ins`
   ```sql
   CREATE TABLE habit_check_ins (
       id SERIAL PRIMARY KEY,
       commitment_id INTEGER NOT NULL,
       wallet_address TEXT NOT NULL,
       week INTEGER NOT NULL,
       check_in_count INTEGER DEFAULT 1,
       notes TEXT,
       photo_url TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       UNIQUE(commitment_id, wallet_address, week)
   );
   ```

2. **Move Contract**: Remove `check_in()` function entirely

3. **Weekly Processing**: Query Supabase for check-in counts
   ```move
   public entry fun process_week_with_counts(
       account: &signer,
       commitment_id: u64,
       week: u64,
       participant_a_count: u64,  // From Supabase
       participant_b_count: u64,  // From Supabase
   ) {
       // Verify caller authority (backend signature)
       // Distribute payouts based on provided counts
   }
   ```

**Benefits**:
- ✅ Eliminates check-in gas costs (save ~$0.0001 per check-in)
- ✅ No abuse vector for spamming
- ✅ Faster check-ins (no blockchain wait)
- ✅ Can add photos, notes easily (off-chain)
- ✅ Weekly processing still on-chain (USDC transfer)

**Implementation Cost**: Medium (frontend + backend changes)

---

### Solution 4: Expense Splitting - Move Everything Off-Chain ✅ CRITICAL

**Current**: Expenses stored on-chain (100% abuse vector)

**Proposed**: Move ALL expense tracking to Supabase

**Architecture**:

1. **Supabase Tables**: Already exist!
   - `expenses`: description, amount, payer, splits
   - `expense_splits`: participant shares
   - These are already implemented (see `supabase-services.ts`)

2. **Move Contract**: Keep ONLY settlement function
   ```move
   // Remove: create_expense_equal, create_expense_percentage, create_expense_exact
   
   // Keep: settle_debt (USDC transfer + fee)
   public entry fun settle_debt(
       debtor: &signer,
       creditor: address,
       amount: u64,
   ) acquires AppConfig {
       // Transfer USDC with 0.3% fee
       // This is the ONLY function that needs to be on-chain
   }
   ```

3. **Debt Calculation**: Off-chain (frontend or backend)
   - Query all expenses from Supabase
   - Calculate who owes whom
   - Display balances in UI
   - On settlement: Just call `settle_debt()` with final amount

**Benefits**:
- ✅ Eliminates 3 abusable functions
- ✅ Saves gas on every expense creation
- ✅ Faster expense adding (no blockchain wait)
- ✅ More flexible (can edit/delete expenses off-chain)
- ✅ Only pay gas when USDC actually moves

**Implementation Cost**: Low (mostly done already)

---

## Cost-Benefit Analysis

### Current State (Before Changes)

| Module | Abusable Txs | Cost per Abuse | Potential Loss (1000 spam txs) |
|--------|--------------|----------------|--------------------------------|
| Predictions | `create_bet` | $0.0001 | $0.10 |
| Habits | `check_in` | $0.0001 | $0.10 |
| Expenses | `create_expense_*` (3 functions) | $0.0001 each | $0.30 |
| **Total** | **5 vectors** | - | **$0.50 per 1K spam** |

### After Solution 1 (Mandatory Wager)

| Module | Abusable Txs | Min Wager | Fee Collected | Net (vs gas) |
|--------|--------------|-----------|---------------|--------------|
| Predictions | `create_bet_with_wager` | 0.01 USDC | 0.00003 USDC | **-$0.00007** |
| Predictions | `create_bet_with_wager` | 0.1 USDC | 0.0003 USDC | **+$0.0002** |

**Recommendation**: Minimum wager of 0.05-0.1 USDC to be profitable

### After All Solutions

| Module | On-Chain Txs | All Require USDC? | Abuse Vectors |
|--------|--------------|-------------------|---------------|
| Predictions | `create_bet_with_wager`, `place_wager`, `resolve_bet` | ✅ Yes | 0 |
| Habits | `create_commitment`, `accept_commitment`, `process_week` | ✅ Yes | 0 |
| Expenses | `settle_debt` | ✅ Yes | 0 |
| **Total** | **7 functions** | **100%** | **0** |

---

## Implementation Priority

### Phase 1: Critical (Do Now) 🚨

1. **Remove encryption claims** from homepage
   - File: `src/app/page.tsx` (or wherever homepage content is)
   - Remove: "End-to-End Encrypted" messaging
   - Replace with: "Group-based privacy" or similar

2. **Move Expense Creation Off-Chain** (Expenses Module)
   - Already have Supabase tables
   - Remove on-chain `create_expense_*` functions
   - Keep only `settle_debt()` with 0.3% fee
   - **Impact**: Eliminates 3 major abuse vectors

### Phase 2: Important (Do Soon) ⚠️

3. **Add Mandatory Initial Wager** (Predictions Module)
   - Combine `create_bet` + `place_wager` into `create_bet_with_wager`
   - Require minimum 0.05-0.1 USDC wager
   - **Impact**: Covers gas cost, prevents spam

4. **Move Check-ins Off-Chain** (Habits Module)
   - Create `habit_check_ins` Supabase table
   - Remove on-chain `check_in()` function
   - Keep weekly processing on-chain
   - **Impact**: Saves gas, faster UX

### Phase 3: Optional (Nice to Have) ✨

5. **Add Resolution Fee** (Predictions Module)
   - 0.1% fee on total pool when resolving bet
   - Additional revenue stream
   - **Impact**: Better profitability, minor UX impact

---

## Code Changes Required

### 1. Predictions Module - Mandatory Wager

**File**: `move_contracts/sources/private_prediction_refactored.move`

**Changes**:
```move
// REMOVE old function
// public entry fun create_bet(...)

// ADD new combined function
public entry fun create_bet_with_wager(
    account: &signer,
    group_id: u64,
    signature: vector<u8>,
    expires_at_ms: u64,
    description: String,
    outcomes: vector<String>,
    admin: address,
    initial_outcome_index: u64,
    initial_wager_amount: u64,
) acquires State, AppConfig {
    let caller = signer::address_of(account);
    
    // Verify minimum wager (0.05 USDC = 50,000 micro-USDC)
    assert!(initial_wager_amount >= 50_000, E_INSUFFICIENT_AMOUNT);
    
    // Verify membership
    signature_auth::assert_membership(group_id, caller, expires_at_ms, signature);
    
    // Verify outcome index
    assert!(initial_outcome_index < vector::length(&outcomes), E_INVALID_OUTCOME_INDEX);
    
    // Create bet (existing logic)
    let state = borrow_state_mut();
    let bet_id = vector::length(&state.bets);
    
    // ... create bet struct and add to state ...
    
    // Place initial wager (internal helper, no signature check)
    place_wager_internal(
        account,
        bet_id,
        initial_outcome_index,
        initial_wager_amount,
        state  // Pass state to avoid re-borrow
    );
    
    emit BetCreatedEvent { bet_id, group_id, creator: caller, ... };
}

// Internal helper (no signature check, already verified in parent)
fun place_wager_internal(
    account: &signer,
    bet_id: u64,
    outcome_index: u64,
    amount: u64,
    state: &mut State,
) acquires AppConfig {
    // Deposit USDC and take fee
    let net_amount = internal_deposit_from_user(account, amount);
    
    // Update pools and wagers (existing logic)
    // ...
}
```

**Frontend Changes**: `src/hooks/useMoveWallet.ts`
```typescript
async createBet(
    groupId: number,
    description: string,
    outcomes: string[],
    signature: string,
    expiresAt: number,
    initialOutcomeIndex: number,  // NEW
    initialWagerAmount: number,   // NEW (in USDC)
) {
    const amountMicro = Math.floor(initialWagerAmount * 1_000_000);
    
    return signAndSubmitGaslessTransaction({
        function: `${CONTRACT_ADDRESS}::${PREDICTION_MODULE}::create_bet_with_wager`,
        typeArguments: [],
        functionArguments: [
            groupId,
            signature,
            expiresAt,
            description,
            outcomes,
            wallet.address,  // admin
            initialOutcomeIndex,
            amountMicro,
        ],
    });
}
```

### 2. Expenses Module - Off-Chain Creation

**File**: `move_contracts/sources/expense_splitting.move`

**Changes**:
```move
// REMOVE these functions entirely:
// - create_expense_equal
// - create_expense_percentage  
// - create_expense_exact

// KEEP ONLY:
// - settle_debt (with fee)
// - init
// - withdraw_fees

// Module becomes 90% smaller!
```

**Frontend**: Already using Supabase for expenses (no changes needed!)

### 3. Habits Module - Off-Chain Check-ins

**File**: `move_contracts/sources/habit_tracker.move`

**Changes**:
```move
// REMOVE check_in function

// MODIFY process_week to accept check-in counts
public entry fun process_week(
    caller: &signer,
    commitment_id: u64,
    week: u64,
    participant_a_check_ins: u64,  // NEW: From Supabase
    participant_b_check_ins: u64,  // NEW: From Supabase
    backend_signature: vector<u8>,  // NEW: Backend verifies Supabase data
    expires_at_ms: u64,
) acquires State, AppConfig {
    // Verify backend signature (trusted source for off-chain data)
    // ... existing payout logic using provided check-in counts ...
}
```

**Supabase**: Add `habit_check_ins` table (see Solution 3 above)

**Frontend**: Submit check-ins to Supabase instead of blockchain

---

## Revenue Projections (After Changes)

### Assumptions
- Average bet: 0.1 USDC per wager
- Average 3 wagers per bet
- 0.3% fee on all USDC movements
- 100 active users, 50 bets/month

### Monthly Revenue (Predictions Only)

| Action | Count | Avg USDC | Fee % | Revenue |
|--------|-------|----------|-------|---------|
| Create bet (with wager) | 50 | 0.1 | 0.3% | $0.015 |
| Additional wagers | 100 | 0.1 | 0.3% | $0.030 |
| **Total** | **150** | - | - | **$0.045** |

**Monthly Gas Costs**: 150 txs × $0.0001 = $0.015

**Net Profit**: $0.045 - $0.015 = **$0.030/month**

### Scale Targets

To cover costs and be profitable:
- **Breakeven**: ~50 USDC volume/month ($0.15 fees)
- **Sustainable**: ~500 USDC volume/month ($1.50 fees)
- **Profitable**: ~5,000 USDC volume/month ($15 fees)

At 0.3% fee rate, need high volume or higher minimums.

**Alternative**: Increase minimum wagers or add resolution fee (0.4% total)

---

## Testnet Down Contingency

Since Movement testnet is currently down:

### What We Can Do Now (No Testnet Needed)

1. ✅ **Remove encryption claims** - Pure frontend, edit text
2. ✅ **Plan Move contract changes** - Write code, review, test later
3. ✅ **Update frontend for new transaction types** - Write TypeScript, test locally
4. ✅ **Enhance Supabase schemas** - Add tables/columns for off-chain data
5. ✅ **Update documentation** - FULL_FLOW_DETAILS.md, README, etc.

### What We Need Testnet For

1. ❌ Deploy updated Move contracts
2. ❌ Test transactions end-to-end
3. ❌ Verify fee collection
4. ❌ Measure gas costs

### Recommendation

**Prepare everything now, deploy when testnet returns**:
1. Remove homepage claims (now)
2. Write all Move contract updates (now)
3. Update frontend code (now)
4. Test locally with mock data (now)
5. Deploy to testnet when available (later)
6. Run full integration tests (later)

---

## Summary & Recommendations

### Current Issues
- ❌ 5 abusable transaction types with no fee
- ❌ Potentially $0.50 loss per 1,000 spam transactions
- ❌ Expense creation on-chain (unnecessary)
- ❌ Check-ins on-chain (unnecessary)
- ❌ False encryption claims on homepage

### Quick Wins (Do Immediately)
1. Remove encryption claims from homepage
2. Move expense creation off-chain (Supabase)
3. Move check-ins off-chain (Supabase)

### Major Improvement (Do Soon)
4. Add mandatory initial wager for bet creation
   - Minimum: 0.05-0.1 USDC
   - Covers gas cost
   - Shows creator commitment

### Optional Enhancement
5. Add 0.1% resolution fee on bet settlement
   - Extra revenue stream
   - Small impact on winners

### Result
- ✅ 0 abusable transaction types
- ✅ 100% of on-chain transactions move USDC
- ✅ 100% of transactions collect platform fee
- ✅ Sustainable business model
- ✅ Better UX (faster off-chain operations)

**Implementation Order**: Priority 1 → Priority 2 → Priority 3
**Testnet Dependency**: Prepare now, deploy later when testnet returns

