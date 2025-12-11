# Friend-Fi Expense Splitting Modules

This document describes the new modular expense splitting system built for Movement network.

## 📋 Overview

We've created a decentralized expense splitting system similar to Splitwise/SettleUp, with the following key improvements:

1. **Modular Architecture**: Separate `groups` module that can be reused across all Friend-Fi apps
2. **On-Chain Settlement**: USDC integration for direct on-chain payments
3. **Flexible Split Types**: Equal, percentage, and custom amount splits
4. **Debt Simplification**: Automatic debt optimization (if A owes B $10 and B owes A $5, net is A owes B $5)
5. **Full Transparency**: All expenses and debts tracked on-chain

## 🏗️ Module Architecture

### 1. `groups.move` - Shared Group Management

**Purpose**: Reusable group functionality for all Friend-Fi applications

**Key Features**:
- Password-protected groups
- Member management (join/leave)
- Global username registry
- Profile system with avatars
- Event emissions for indexing

**Why Separate?**:
- ✅ Reusable across prediction markets, expense splitting, and future apps
- ✅ Single source of truth for group membership
- ✅ Simplified access control
- ✅ Better code organization

**Usage Example**:
```move
// Create a group
groups::create_group(
    &signer,
    utf8(b"Trip to Bali"),
    utf8(b"password123"),
    utf8(b"Summer vacation expenses")
);

// Join a group
groups::join_group(&signer, group_id, utf8(b"password123"));

// Check membership (used by other modules)
let is_member = groups::is_member(group_id, user_address);
```

### 2. `expense_splitting.move` - Expense Management

**Purpose**: Complete expense tracking and settlement system

**Key Features**:
- Multiple split types (equal, percentage, exact amounts)
- Automatic debt calculation and simplification
- On-chain USDC settlements
- Off-chain payment tracking
- Per-group expense isolation

**Split Types**:

1. **Equal Split**: Divide total equally among all participants
   ```move
   expense_splitting::create_expense_equal(
       &signer,
       group_id,
       utf8(b"Dinner"),
       300, // $300 total
       participants // Split equally
   );
   ```

2. **Exact Amounts**: Specify exact amount for each participant
   ```move
   expense_splitting::create_expense_exact(
       &signer,
       group_id,
       utf8(b"Rent"),
       1500,
       participants,
       amounts // [500, 500, 500]
   );
   ```

3. **Percentage Split**: Specify percentage for each participant
   ```move
   expense_splitting::create_expense_percentage(
       &signer,
       group_id,
       utf8(b"Utilities"),
       1000,
       participants,
       percentages // [4000, 3000, 3000] = 40%, 30%, 30%
   );
   ```

## 🔄 User Flow (Like SettleUp)

### 1. Create a Group/Event
```move
// Alice creates a group for her trip
groups::create_group(
    alice_signer,
    utf8(b"Bali Trip 2025"),
    utf8(b"secret_password"),
    utf8(b"Trip buddies vacation expenses")
);
```

### 2. Add Friends to Group
```move
// Bob joins the group
groups::join_group(bob_signer, 0, utf8(b"secret_password"));

// Charlie joins the group
groups::join_group(charlie_signer, 0, utf8(b"secret_password"));
```

### 3. Add Expenses
```move
// Alice paid for the hotel ($600 split 3 ways)
expense_splitting::create_expense_equal(
    alice_signer,
    0, // group_id
    utf8(b"Hotel - 3 nights"),
    600,
    vector[alice_addr, bob_addr, charlie_addr]
);

// Bob paid for dinner ($90, Alice gets extra wine)
expense_splitting::create_expense_exact(
    bob_signer,
    0,
    utf8(b"Dinner at beach restaurant"),
    90,
    vector[alice_addr, bob_addr, charlie_addr],
    vector[40, 30, 20] // Custom amounts
);
```

### 4. Track Debts
```move
// View who owes what
let (alice_balance, alice_is_owed) = expense_splitting::get_user_balance(0, alice_addr);
// Returns: (is_owed=true, amount=370) - Alice is owed $370

let bob_debt = expense_splitting::get_debt_amount(0, bob_addr, alice_addr);
// Returns: 170 - Bob owes Alice $170

// Get all group debts
let (debtors, creditors, amounts) = expense_splitting::get_group_debts(0);
```

### 5. Settle Up

**Option A: On-Chain USDC Payment**
```move
// Bob settles his debt with Alice using USDC
expense_splitting::settle_debt_with_usdc(
    bob_signer,
    0, // group_id
    alice_addr,
    170 // $170 in USDC
);
// USDC automatically transferred from Bob to Alice
```

**Option B: Off-Chain Payment (Cash/Venmo/etc)**
```move
// Bob pays Alice $170 in cash
// Alice marks it as settled in the app
expense_splitting::mark_debt_settled(
    alice_signer, // Creditor confirms
    0,
    bob_addr,
    170
);
```

**Option C: Partial Settlement**
```move
// Bob pays $100 now, rest later
expense_splitting::settle_debt_with_usdc(
    bob_signer,
    0,
    alice_addr,
    100
);
// Debt reduced from $170 to $70
```

## 🧪 Testing

We've included comprehensive test suites:

### Run Group Tests
```bash
cd move_contracts
aptos move test --filter groups_tests
```

**Test Coverage**:
- ✅ Profile creation and username uniqueness
- ✅ Group creation and joining
- ✅ Password verification
- ✅ Member management
- ✅ Multiple groups per user

### Run Expense Tests
```bash
aptos move test --filter expense_splitting_tests
```

**Test Coverage**:
- ✅ All split types (equal, exact, percentage)
- ✅ Debt calculation and simplification
- ✅ Settlement (full and partial)
- ✅ Multi-group isolation
- ✅ Complex real-world scenarios
- ✅ Error handling

### Run All Tests
```bash
aptos move test
```

## 🔐 Security Considerations

### Current Implementation (Hackathon/Demo)
- ⚠️ **Password Storage**: Passwords stored as plaintext bytes on-chain (readable by anyone)
- ⚠️ **No Encryption**: Group data is public on blockchain
- ✅ **USDC Escrow**: Secure escrow system for settlements

### Production Recommendations
1. **Password System**: 
   - Use zero-knowledge proofs for password verification
   - Or remove passwords and use NFT-based group access
2. **Privacy**: 
   - Encrypt expense descriptions client-side
   - Use commitments for debt amounts
3. **Access Control**:
   - Add admin roles for group management
   - Implement expulsion mechanism
4. **Gas Optimization**:
   - Batch expense creation
   - Off-chain debt calculation with on-chain verification

## 📊 Data Structures

### Group (in `groups.move`)
```move
struct Group {
    name: String,
    password_hash: vector<u8>,
    admin: address,
    members: vector<address>,
    description: String,
}
```

### Expense (in `expense_splitting.move`)
```move
struct Expense {
    group_id: u64,
    description: String,
    total_amount: u64,
    payer: address,
    split_type: u8, // 1=equal, 2=percentage, 3=exact
    splits: vector<Split>,
    created_at: u64,
}
```

### Debt (in `expense_splitting.move`)
```move
struct Debt {
    debtor: address,
    creditor: address,
    amount: u64,
}
```

## 🎯 Integration with Prediction Markets

The `groups` module is shared between:
- **Prediction Markets** (`private_prediction.move`)
- **Expense Splitting** (`expense_splitting.move`)

### Migration Path

**Option 1: Keep Existing Prediction Module As-Is**
- Prediction markets continue using their embedded group system
- New features use the shared `groups` module
- No breaking changes

**Option 2: Refactor Prediction Markets** (Recommended)
- Update `private_prediction.move` to use `groups::is_member()` for access control
- Remove duplicate group code from prediction module
- Cleaner codebase, single source of truth

### Future Applications Using Groups

With the modular design, you can easily add:
- 🎮 **Gaming Guilds**: Shared groups for gaming tournaments
- 💰 **Investment Clubs**: Pool funds and track contributions
- 🎉 **Event Planning**: RSVPs and expense tracking for events
- 📚 **Study Groups**: Resource sharing and collaboration

## 🚀 Deployment

### 1. Deploy to Movement Testnet
```bash
cd move_contracts
aptos move publish --named-addresses friend_fi=<YOUR_ADDRESS>
```

### 2. Initialize Modules
```typescript
// Initialize groups module
await signAndSubmitTransaction({
    data: {
        function: `${MODULE_ADDRESS}::groups::init`,
        typeArguments: [],
        functionArguments: [],
    },
});

// Initialize expense splitting module
await signAndSubmitTransaction({
    data: {
        function: `${MODULE_ADDRESS}::expense_splitting::init`,
        typeArguments: [],
        functionArguments: [],
    },
});
```

### 3. USDC Configuration

Update the USDC metadata address in `expense_splitting.move`:
```move
const USDC_METADATA_ADDR: address = @0x...; // Your USDC address
```

## 📱 Frontend Integration

### View Functions (No Gas)

```typescript
// Get group members
const members = await aptos.view({
    function: `${MODULE_ADDRESS}::groups::get_group_members`,
    arguments: [groupId],
});

// Get user balance in group
const [balance, isOwed] = await aptos.view({
    function: `${MODULE_ADDRESS}::expense_splitting::get_user_balance`,
    arguments: [groupId, userAddress],
});

// Get all debts in group
const [debtors, creditors, amounts] = await aptos.view({
    function: `${MODULE_ADDRESS}::expense_splitting::get_group_debts`,
    arguments: [groupId],
});
```

### Entry Functions (Require Signature)

```typescript
// Create expense
await signAndSubmitTransaction({
    data: {
        function: `${MODULE_ADDRESS}::expense_splitting::create_expense_equal`,
        functionArguments: [
            groupId,
            description,
            totalAmount,
            participants,
        ],
    },
});

// Settle debt with USDC
await signAndSubmitTransaction({
    data: {
        function: `${MODULE_ADDRESS}::expense_splitting::settle_debt_with_usdc`,
        functionArguments: [
            groupId,
            creditorAddress,
            amount,
        ],
    },
});
```

## 🎨 UI/UX Recommendations

### Dashboard View
- Show all groups user is part of
- Display net balance (owed/owing) per group
- Quick actions: Add expense, Settle debt

### Expense Detail View
- List all expenses with descriptions
- Show who paid and how it was split
- Visual debt graph showing relationships

### Settlement Flow
1. Select debt to settle
2. Choose payment method (USDC on-chain or off-chain)
3. For USDC: Connect wallet and approve transaction
4. For off-chain: Creditor confirms receipt
5. Update balances and show success

## 🔮 Future Enhancements

### V2 Features
- [ ] Recurring expenses (rent, utilities)
- [ ] Expense categories and budgeting
- [ ] Multi-currency support
- [ ] Expense attachments (receipts as IPFS links)
- [ ] Dispute resolution mechanism
- [ ] Integration with DeFi protocols for auto-settlement

### Advanced Features
- [ ] Group savings goals
- [ ] Automated splitting from receipts (OCR)
- [ ] Tax export functionality
- [ ] Integration with DEXs for currency conversion
- [ ] Staking rewards for groups with positive balances

## 📞 Support

For questions or issues:
1. Check the test files for usage examples
2. Review the inline code documentation
3. Open an issue in the repository

---

**Built with ❤️ for Movement Network Hackathon**

