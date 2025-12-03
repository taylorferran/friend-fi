# Friend-Fi Private Prediction Market - Move Contract

A complete prediction market smart contract with USDC escrow, parimutuel betting, and social features.

## Deployment Details

| Field | Value |
|-------|-------|
| **Network** | Movement Testnet |
| **RPC URL** | `https://testnet.movementnetwork.xyz` |
| **Module Address** | `0xf7443a305c55ed501e0fcaa97c8bcc9e2e06664a88f6bae43f5170995ed6c9cf` |
| **Module Name** | `private_prediction_market` |
| **USDC Metadata Address** | `0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7` |
| **Explorer** | [View on Explorer](https://explorer.movementnetwork.xyz/account/0xf7443a305c55ed501e0fcaa97c8bcc9e2e06664a88f6bae43f5170995ed6c9cf?network=testnet) |

---

## Features

### 1. USDC Escrow System
- Uses Aptos `fungible_asset` framework with a secondary store (best practice)
- All wagers held in a contract-controlled escrow object
- **0.3% fee (rake)** taken on every wager deposited
- Admin can withdraw accumulated fees
- Winners receive immediate USDC payouts when bets are resolved

### 2. Prediction Market Core
- **Groups**: Password-protected betting groups for friends
- **Bets**: Multi-outcome predictions within groups
- **Wagers**: Users bet on outcomes; amounts tracked net-of-fees
- **Parimutuel payouts**: Winners split the total pool proportionally

### 3. Username/Profile Registry
- Each address can set a profile with unique username and avatar
- Global username uniqueness enforced
- Username → address resolution for easy lookups

### 4. Event System (for indexers)
All events are emitted with the `#[event]` attribute for indexer compatibility:
- `ProfileUpdatedEvent`
- `GroupCreatedEvent`
- `GroupJoinedEvent`
- `BetCreatedEvent`
- `WagerPlacedEvent`
- `BetResolvedEvent`
- `PayoutPaidEvent`

---

## Contract Functions

### Initialization

#### `init`
Initialize the entire application. **Must be called once by the admin.**
```move
public entry fun init(admin: &signer)
```
Sets up:
- Escrow object with secondary USDC store
- AppConfig with fee tracking
- Global State with empty groups/bets/profiles

---

### Profile Functions

#### `set_profile` (Entry)
Set or update your profile (username and avatar).
```move
public entry fun set_profile(account: &signer, name: String, avatar_id: u64)
```
- Usernames must be globally unique
- Emits `ProfileUpdatedEvent`

#### `get_profile` (View)
Get profile for an address.
```move
public fun get_profile(addr: address): (String, u64, bool)
```
Returns: `(name, avatar_id, exists)`

#### `resolve_username` (View)
Resolve a username to an address.
```move
public fun resolve_username(name: String): (address, bool)
```
Returns: `(address, found)`

---

### Group Functions

#### `create_group` (Entry)
Create a new betting group. Creator is automatically added as first member.
```move
public entry fun create_group(account: &signer, name: String, password: String)
```
- Emits `GroupCreatedEvent`

#### `join_group` (Entry)
Join an existing group with the correct password.
```move
public entry fun join_group(account: &signer, group_id: u64, password: String)
```
- Emits `GroupJoinedEvent`
- Errors: `E_INVALID_PASSWORD`, `E_ALREADY_MEMBER`

#### `get_group_members` (View)
```move
public fun get_group_members(group_id: u64): vector<address>
```

#### `get_group_bets` (View)
```move
public fun get_group_bets(group_id: u64): vector<u64>
```

#### `check_if_member_in_group` (View)
```move
public fun check_if_member_in_group(group_id: u64, member: address): bool
```

---

### Bet Functions

#### `create_bet` (Entry)
Create a new bet within a group.
```move
public entry fun create_bet(
    account: &signer,
    group_id: u64,
    description: String,
    outcomes: vector<String>,
    admin: address
)
```
- Caller must be a group member
- Must have at least 2 outcomes
- Admin is who can resolve the bet
- Emits `BetCreatedEvent`

#### `place_wager` (Entry)
Place a wager on a specific outcome.
```move
public entry fun place_wager(
    account: &signer,
    bet_id: u64,
    outcome_index: u64,
    amount: u64
)
```
- **Pulls USDC from user's wallet** into escrow
- **0.3% fee** is deducted
- Net amount credited to outcome pool
- Emits `WagerPlacedEvent`

#### `resolve_bet` (Entry)
Resolve a bet by declaring the winning outcome and paying winners.
```move
public entry fun resolve_bet(
    account: &signer,
    bet_id: u64,
    winning_outcome_index: u64
)
```
- Only bet admin can call
- Calculates parimutuel payouts
- **Immediately pays USDC** to winners from escrow
- Emits `BetResolvedEvent` and `PayoutPaidEvent` for each winner

**Payout Formula:**
```
payout = (user_wager / winning_pool) * total_pool
```

---

### Bet View Functions

| Function | Parameters | Returns |
|----------|------------|---------|
| `get_bet_admin(bet_id)` | bet_id: u64 | address |
| `get_bet_outcomes_length(bet_id)` | bet_id: u64 | u64 |
| `get_bet_outcome(bet_id, outcome_index)` | bet_id: u64, outcome_index: u64 | String |
| `get_bet_outcome_pool(bet_id, outcome_index)` | bet_id: u64, outcome_index: u64 | u64 |
| `get_bet_total_pool(bet_id)` | bet_id: u64 | u64 |
| `is_bet_resolved(bet_id)` | bet_id: u64 | bool |
| `get_winning_outcome(bet_id)` | bet_id: u64 | u64 |
| `get_user_wager(bet_id, user)` | bet_id: u64, user: address | u64 |
| `get_groups_count()` | - | u64 |
| `get_bets_count()` | - | u64 |

---

### Admin Functions

#### `withdraw_fees` (Entry)
Withdraw accumulated fees from escrow to admin's wallet.
```move
public entry fun withdraw_fees(admin: &signer, amount: u64)
```
- Only module deployer can call
- Amount must be <= `fee_accumulator`

---

### Escrow View Functions

#### `escrow_balance` (View)
Get total USDC balance in escrow (includes both pools and fees).
```move
public fun escrow_balance(): u64
```

#### `total_fees_accumulated` (View)
Get total accumulated fees (available for admin withdrawal).
```move
public fun total_fees_accumulated(): u64
```

---

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 1 | `E_ALREADY_INITIALIZED` | init() can only be called once |
| 2 | `E_NOT_ADMIN` | Caller is not the admin |
| 3 | `E_INSUFFICIENT_AMOUNT` | Amount must be > 0 or exceeds balance |
| 4 | `E_ESCROW_NOT_INITIALIZED` | Escrow not initialized; call init() first |
| 10 | `E_BAD_GROUP_ID` | Invalid group ID |
| 11 | `E_BAD_BET_ID` | Invalid bet ID |
| 12 | `E_INVALID_PASSWORD` | Wrong group password |
| 13 | `E_ALREADY_MEMBER` | Already a group member |
| 14 | `E_NOT_MEMBER` | Not a group member |
| 15 | `E_NEED_AT_LEAST_TWO_OUTCOMES` | Bets need 2+ outcomes |
| 16 | `E_INVALID_OUTCOME_INDEX` | Invalid outcome index |
| 17 | `E_ZERO_WAGER` | Wager amount must be > 0 |
| 18 | `E_BET_ALREADY_RESOLVED` | Bet already resolved |
| 19 | `E_NOT_BET_ADMIN` | Not the bet admin |
| 20 | `E_USERNAME_TAKEN` | Username already taken |

---

## Frontend Integration

### Contract Address
```typescript
const MODULE_ADDRESS = "0xf7443a305c55ed501e0fcaa97c8bcc9e2e06664a88f6bae43f5170995ed6c9cf";
const MODULE_NAME = "private_prediction_market";
const USDC_ADDRESS = "0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7";
```

### Example: View Function Call
```typescript
const result = await aptosClient.view({
  payload: {
    function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_group_members`,
    typeArguments: [],
    functionArguments: [groupId],
  },
});
```

### Example: Entry Function Call
```typescript
const transaction = await aptosClient.transaction.build.simple({
  sender: account.accountAddress,
  data: {
    function: `${MODULE_ADDRESS}::${MODULE_NAME}::create_group`,
    typeArguments: [],
    functionArguments: ["My Group", "secret123"],
  },
});
```

---

## Fee Structure

- **Platform Fee:** 0.3% (30 basis points) of each wager
- Fee is deducted when USDC is deposited into escrow
- Fees accumulate in `fee_accumulator`
- Admin can withdraw fees via `withdraw_fees()`

---

## Local Development

```bash
# Navigate to move_contracts directory
cd move_contracts

# Compile the contract
movement move compile

# Run tests (if any)
movement move test

# Publish to testnet
movement move publish
```

---

## Security Notes

⚠️ **Password Hashing**: The current password implementation uses raw bytes (`bytes(password)`) which is NOT cryptographically secure. Anyone can read on-chain storage and see passwords. This is acceptable for a hackathon demo but should use proper hashing for production.
