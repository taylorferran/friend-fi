# Friend-Fi Module Addresses

**Deployment Date**: December 21, 2024  
**Network**: Movement Testnet  

---

## Production Deployment (WITH FEE MONETIZATION)

**Deployer Account**: `0xf436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f`  
**Deployment TX**: `0x3cce12bbf55cef6a8dfef2a68698dd79bda9c5357c4b70d252eceb5de476facc`  
**Status**: ✅ **LIVE** with fee monetization (backward-compatible upgrade)

All three modules share the same contract address:

```
0xf436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f
```

**Recent Upgrade (Dec 21, 2024)**:
- ✅ Added 0.3% fee on all USDC settlements in `expense_splitting` module
- ✅ Fee accumulates in escrow for gas/service costs
- ✅ Backward-compatible (no breaking changes)
- ✅ Added `FeeCollectedEvent` for tracking
- ✅ Added `get_escrow_balance()` view function
- ✅ All existing data preserved

---

## Demo Deployment (Deprecated)

**Deployer Account**: `0x19ec1ba789dfcc76f7f67c143614825079280e2f7c27a34af822d7e4a8e111f0`  
**Status**: ⚠️ Not used - switched to upgrading production contract instead

---

## USDC Faucet for Demos

**Address**: `0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370`  
**Purpose**: Funds demo wallets with small USDC amounts  
**Note**: Private key stored securely in demo page constant

---

## Module Addresses

#### 1. **Groups Module** (`groups`)
- **Full ID**: `0xf436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::groups`
- **Purpose**: Shared group and profile management for all apps
- **Key Functions**:
  - `create_group(signer, name, password, description)`
  - `join_group(signer, group_id, password)`
  - `set_profile(signer, username, avatar_id)`
  - `is_member(group_id, address): bool`

#### 2. **Expense Splitting Module** (`expense_splitting`)
- **Full ID**: `0xf436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::expense_splitting`
- **Purpose**: Track and settle shared expenses (SettleUp clone)
- **Key Functions**:
  - `create_expense_equal(signer, group_id, description, total_amount, participants)`
  - `create_expense_exact(signer, group_id, description, total_amount, participants, amounts)`
  - `settle_debt_with_usdc(signer, group_id, creditor, amount)`
  - `mark_debt_settled(creditor_signer, group_id, debtor, amount)`
  - `get_user_balance(group_id, address): (u64, bool)`
  - `get_group_debts(group_id): (vector<address>, vector<address>, vector<u64>)`

#### 3. **Private Prediction Refactored Module** (`private_prediction_refactored`)
- **Full ID**: `0xf436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::private_prediction_refactored`
- **Purpose**: Parimutuel betting system with USDC escrow
- **Key Functions**:
  - `create_bet(signer, group_id, description, outcomes, admin, encrypted_payload)`
  - `place_wager(signer, bet_id, outcome_index, amount)`
  - `resolve_bet(admin_signer, bet_id, winning_outcome_index)`
  - `get_group_bets(group_id): vector<u64>`
  - `get_bet_total_pool(bet_id): u64`

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

All **85 tests** passed successfully:
- ✅ 13 tests in `groups_tests.move`
- ✅ 15 tests in `expense_splitting_tests.move`
- ✅ 8 tests in `integration_tests.move`
- ✅ 49 tests in `private_prediction_tests.move`

---

## Frontend Integration

### Update Contract Address

In your frontend code (`src/lib/contract.ts`), update the contract address:

```typescript
export const CONTRACT_ADDRESS = '0xf436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f';

// Module names
export const GROUPS_MODULE = 'groups';
export const EXPENSE_MODULE = 'expense_splitting';
export const PREDICTION_MODULE = 'private_prediction_refactored';
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

✅ **One group, multiple apps** - Create a group once, use it for predictions, expenses, and future features  
✅ **Shared profile system** - Set your username once, it works everywhere  
✅ **Clean separation** - Each module has a single responsibility  
✅ **Easy extensibility** - Add new apps that reuse the groups module  
✅ **Battle-tested** - Comprehensive unit and integration tests

---

## Next Steps

1. ✅ Modules deployed and initialized
2. 🔄 Update frontend contract addresses
3. 🔄 Integrate groups module into UI
4. 🔄 Integrate expense splitting into UI
5. 🔄 Update prediction market to use refactored module
6. 🔄 Update demo page to use all three modules

For detailed integration instructions, see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

