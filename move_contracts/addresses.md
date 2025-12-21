# Friend-Fi Module Addresses

**Deployment Date**: December 21, 2024  
**Network**: Movement Testnet  

---

## Production Deployment (ALL 4 MODULES - Dec 21, 2024)

**Deployer Account**: `0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370`  
**Deployment TX**: `0x2bfbf1060572f2d15aad29fee8d5983f31191529cf0dceb19773671a6abe1b1e`  
**Status**: ✅ **LIVE** - All 4 modules deployed and initialized  
**CLI Used**: `movement` v7.4.0 (required for Movement testnet compatibility)

All four modules share the same contract address:

```
0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370
```

**Deployment Details**:
- ✅ **groups** - Init TX: [0xd6ef9dc9873e7ca761b174df92c8385d90f823117d89b47ccad9884ee0b597c2](https://explorer.movementnetwork.xyz/txn/0xd6ef9dc9873e7ca761b174df92c8385d90f823117d89b47ccad9884ee0b597c2?network=custom)
- ✅ **expense_splitting** - Init TX: [0x16ae3f7f1fdfc4da109acb3a281ce1ff1463a8011ecac369265523cc9cc823a1](https://explorer.movementnetwork.xyz/txn/0x16ae3f7f1fdfc4da109acb3a281ce1ff1463a8011ecac369265523cc9cc823a1?network=custom)
- ✅ **private_prediction_refactored** - Init TX: [0x8f592a69dcb16ac2fce6d0c4588f595fec9447c8689731e74ca635adcc37685d](https://explorer.movementnetwork.xyz/txn/0x8f592a69dcb16ac2fce6d0c4588f595fec9447c8689731e74ca635adcc37685d?network=custom)
- ✅ **habit_tracker** 🎯 - Init TX: [0x35445e0074ce53f189845a20b50458f525ac68c86a5496d2471a171056d13c8c](https://explorer.movementnetwork.xyz/txn/0x35445e0074ce53f189845a20b50458f525ac68c86a5496d2471a171056d13c8c?network=custom)

**Package Stats**:
- Total Size: 42.6 KB
- Gas Used: 22,009
- All 116 tests passing

---

## Previous Deployment (3 Modules - Deprecated)

**Deployer Account**: `0xf436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f`  
**Status**: ⚠️ **Superseded** - Use new address above
**Note**: This deployment had groups, expense_splitting, and predictions only (no habit tracker)

---

## Module Addresses

#### 1. **Groups Module** (`groups`)
- **Full ID**: `0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370::groups`
- **Purpose**: Shared group and profile management for all apps
- **Key Functions**:
  - `create_group(signer, name, password, description)`
  - `join_group(signer, group_id, password)`
  - `set_profile(signer, username, avatar_id)`
  - `is_member(group_id, address): bool`

#### 2. **Expense Splitting Module** (`expense_splitting`)
- **Full ID**: `0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370::expense_splitting`
- **Purpose**: Track and settle shared expenses (SettleUp clone)
- **Key Functions**:
  - `create_expense_equal(signer, group_id, description, total_amount, participants)`
  - `create_expense_exact(signer, group_id, description, total_amount, participants, amounts)`
  - `settle_debt_with_usdc(signer, group_id, creditor, amount)`
  - `mark_debt_settled(creditor_signer, group_id, debtor, amount)`
  - `get_user_balance(group_id, address): (u64, bool)`
  - `get_group_debts(group_id): (vector<address>, vector<address>, vector<u64>)`

#### 3. **Private Prediction Refactored Module** (`private_prediction_refactored`)
- **Full ID**: `0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370::private_prediction_refactored`
- **Purpose**: Parimutuel betting system with USDC escrow
- **Key Functions**:
  - `create_bet(signer, group_id, description, outcomes, admin, encrypted_payload)`
  - `place_wager(signer, bet_id, outcome_index, amount)`
  - `resolve_bet(admin_signer, bet_id, winning_outcome_index)`
  - `get_group_bets(group_id): vector<u64>`
  - `get_bet_total_pool(bet_id): u64`

#### 4. **Habit Tracker Module** (`habit_tracker`) 🎯
- **Full ID**: `0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370::habit_tracker`
- **Purpose**: Two-person accountability system for habit formation (Amigo)
- **Status**: ✅ **DEPLOYED & INITIALIZED**
- **Key Functions**:
  - `create_commitment(signer, group_id, participant_b, weekly_payout, weekly_check_ins_required, duration_weeks, commitment_name)`
  - `accept_commitment(signer, group_id, commitment_local_id)`
  - `check_in(signer, group_id, commitment_local_id)`
  - `process_week(signer, group_id, commitment_local_id, week)`
  - `get_commitment_details(group_id, commitment_local_id): (address, address, u64, u64, bool, bool, String, u64, u64)`
  - `get_weekly_check_ins(group_id, commitment_local_id, week, participant): u64`
  - `get_user_commitments(group_id, user): vector<u64>`
- **Documentation**: See [HABIT_TRACKER.md](./HABIT_TRACKER.md) for complete guide

---

## Deployment Transactions

### Module Publication
- **Transaction**: [0x1c12b79ffda979aca871faa8af41c06398899266114c5b65225155906659b16e](https://explorer.movementnetwork.xyz/txn/0x1c12b79ffda979aca871faa8af41c06398899266114c5b65225155906659b16e?network=testnet)
- **Gas Used**: 15,457
- **Status**: ✅ Success
- **Package Size**: 48,694 bytes

### Module Initializations

#### Groups Module Init
- **Transaction**: [0xf71583ec9ca45b9a88ee8e069946095e2d77aa21726f560b47a1dd81b57d17dc](https://explorer.movementnetwork.xyz/txn/0xf71583ec9ca45b9a88ee8e069946095e2d77aa21726f560b47a1dd81b57d17dc?network=testnet)
- **Gas Used**: 502
- **Status**: ✅ Success

#### Expense Splitting Module Init
- **Transaction**: [0xd5ea3d1cd611ea4196f310d5cbb84651870b39ecf69711d86d94b8c8942ce5f3](https://explorer.movementnetwork.xyz/txn/0xd5ea3d1cd611ea4196f310d5cbb84651870b39ecf69711d86d94b8c8942ce5f3?network=testnet)
- **Gas Used**: 1,613
- **Status**: ✅ Success

#### Private Prediction Refactored Module Init
- **Transaction**: [0x91d3c1e291d0cb2cbe1164a52804ff17feb9f72c3831c79d9e1f9f1b937825e6](https://explorer.movementnetwork.xyz/txn/0x91d3c1e291d0cb2cbe1164a52804ff17feb9f72c3831c79d9e1f9f1b937825e6?network=testnet)
- **Gas Used**: 1,631
- **Status**: ✅ Success

---

## Test Results

All **116 tests** passed successfully:
- ✅ 13 tests in `groups_tests.move`
- ✅ 15 tests in `expense_splitting_tests.move`
- ✅ 8 tests in `integration_tests.move`
- ✅ 49 tests in `private_prediction_tests.move`
- ✅ 33 tests in `habit_tracker_tests.move`

---

## Frontend Integration

### Update Contract Address

In your frontend code (`src/lib/contract.ts`), update the contract address:

```typescript
export const CONTRACT_ADDRESS = '0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370';

// Module names
export const GROUPS_MODULE = 'groups';
export const EXPENSE_MODULE = 'expense_splitting';
export const PREDICTION_MODULE = 'private_prediction_refactored';
export const HABIT_MODULE = 'habit_tracker';
```

### Example Usage

```typescript
// Create a group
const payload = {
  function: `${CONTRACT_ADDRESS}::groups::create_group`,
  arguments: ['Group Name', 'password', 'Description']
};

// Join a group
const payload = {
  function: `${CONTRACT_ADDRESS}::groups::join_group`,
  arguments: [0, 'password']
};

// Create a prediction bet
const payload = {
  function: `${CONTRACT_ADDRESS}::private_prediction_refactored::create_bet`,
  arguments: [0, 'Will it rain?', ['Yes', 'No'], adminAddress, []]
};

// Create an expense
const payload = {
  function: `${CONTRACT_ADDRESS}::expense_splitting::create_expense_equal`,
  arguments: [0, 'Dinner', 10000000, [addr1, addr2, addr3]]
};

// Create a habit commitment
const payload = {
  function: `${CONTRACT_ADDRESS}::habit_tracker::create_commitment`,
  arguments: [0, friendAddress, 10000000, 3, 4, 'Gym Challenge']
};
```

---

## USDC Configuration

The modules use the Movement testnet USDC metadata address:

```
0xcc1c4401a57511354e019c7b89c4c73a87e8df94cdd6bf21c44e5e6d7766fcd1
```

This is already configured in the modules as `USDC_METADATA_ADDR`.

---

## Architecture Benefits

✅ **One group, multiple apps** - Create a group once, use it for predictions, expenses, habits, and future features  
✅ **Shared profile system** - Set your username once, it works everywhere  
✅ **Clean separation** - Each module has a single responsibility  
✅ **Easy extensibility** - Add new apps that reuse the groups module  
✅ **Battle-tested** - Comprehensive unit and integration tests
✅ **Four complete apps** - Expenses, Predictions, Habits, and more coming

---

## Next Steps

1. ✅ All 4 modules deployed and initialized on new address
2. 🔄 **Update frontend CONTRACT_ADDRESS** to `0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370`
3. 🔄 Test all 4 applications with the new contract
4. 🔄 Update USDC faucet logic if needed
5. 🔄 Add habit tracker UI to frontend

For detailed module documentation:
- **Habit Tracker**: See [HABIT_TRACKER.md](./HABIT_TRACKER.md)
- **General Integration**: See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) (if exists)

---

## Important Notes

### CLI Tool Compatibility
- ✅ **Use `movement` CLI** (v7.4.0+) for Movement testnet deployments
- ❌ **Do NOT use `aptos` CLI** - generates incompatible bytecode (`CODE_DESERIALIZATION_ERROR`)

### Private Key Security  
- The faucet private key has been removed from source code
- Now uses environment variable: `NEXT_PUBLIC_FAUCET_PRIVATE_KEY`
- See `.env.example` for setup

