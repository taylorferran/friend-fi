# Friend-Fi Integration Guide: Modular Architecture

## 🎉 What We Built

We've successfully refactored Friend-Fi into a **modular, composable architecture** where:

✅ **One group, multiple apps** - Create a group once, use it for predictions, expenses, and future features  
✅ **Shared profile system** - Set your username once, it works everywhere  
✅ **Clean separation** - Each module has a single responsibility  
✅ **Easy extensibility** - Add new apps that reuse the groups module  
✅ **Battle-tested** - Comprehensive unit and integration tests  

---

## 📦 Module Overview

### 1. **`groups.move`** - Foundation Module
**Purpose**: Shared group and profile management

**What it provides:**
- Password-protected groups
- Member join/leave functionality
- Global username registry
- Profile system (username + avatar)
- Access control helpers for other modules

**Key Functions:**
```move
// Create a group
groups::create_group(signer, name, password, description)

// Join a group
groups::join_group(signer, group_id, password)

// Check membership (used by other modules)
groups::is_member(group_id, address): bool

// Set profile
groups::set_profile(signer, username, avatar_id)
```

---

### 2. **`expense_splitting.move`** - SettleUp Clone
**Purpose**: Track and settle shared expenses

**Features:**
- ✅ Equal split, percentage split, custom amounts
- ✅ Automatic debt calculation and simplification
- ✅ On-chain USDC settlement
- ✅ Off-chain payment tracking
- ✅ Group-scoped expense tracking

**Key Functions:**
```move
// Create equal split expense
expense_splitting::create_expense_equal(
    signer, group_id, description, total_amount, participants
)

// Create custom split expense  
expense_splitting::create_expense_exact(
    signer, group_id, description, total_amount, participants, amounts
)

// Settle debt with USDC on-chain
expense_splitting::settle_debt_with_usdc(
    signer, group_id, creditor, amount
)

// Mark debt as settled (off-chain payment)
expense_splitting::mark_debt_settled(
    creditor_signer, group_id, debtor, amount
)

// View balances
expense_splitting::get_user_balance(group_id, address): (u64, bool)
expense_splitting::get_group_debts(group_id): (vector<address>, vector<address>, vector<u64>)
```

---

### 3. **`private_prediction_refactored.move`** - Prediction Markets
**Purpose**: Parimutuel betting system

**Features:**
- ✅ Create multi-outcome predictions within groups
- ✅ USDC wagers with 0.3% house rake
- ✅ Automatic payout calculation
- ✅ Bet resolution by designated admin
- ✅ Encrypted bet payloads (optional)

**Key Functions:**
```move
// Create a bet
private_prediction_refactored::create_bet(
    signer, group_id, description, outcomes, admin, encrypted_payload
)

// Place a wager
private_prediction_refactored::place_wager(
    signer, bet_id, outcome_index, amount
)

// Resolve bet (admin only)
private_prediction_refactored::resolve_bet(
    admin_signer, bet_id, winning_outcome_index
)

// View functions
private_prediction_refactored::get_group_bets(group_id): vector<u64>
private_prediction_refactored::get_bet_total_pool(bet_id): u64
```

---

## 🔄 How They Work Together

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    GROUPS MODULE                     │
│  • Membership Management                             │
│  • Profile/Username Registry                         │
│  • Access Control                                    │
└──────────────┬───────────────────┬───────────────────┘
               │                   │
               │                   │
    ┌──────────▼──────────┐   ┌───▼─────────────────┐
    │  EXPENSE SPLITTING   │   │  PREDICTION MARKETS │
    │  • Track expenses    │   │  • Create bets      │
    │  • Calculate debts   │   │  • Place wagers     │
    │  • Settle payments   │   │  • Resolve outcomes │
    └─────────────────────┘   └─────────────────────┘
```

### Data Flow Example

**Scenario**: Weekend ski trip with friends

```typescript
// 1. Alice creates ONE group for the trip
groups::create_group(
    alice,
    "Ski Trip 2025",
    "password",
    "Weekend with the crew"
)

// 2. Bob and Charlie join ONCE
groups::join_group(bob, 0, "password")
groups::join_group(charlie, 0, "password")

// 3. Use for PREDICTIONS
private_prediction_refactored::create_bet(
    alice,
    0,  // Same group_id!
    "Will it snow?",
    ["Yes", "No"],
    alice_address,
    []
)

// 4. Use for EXPENSES
expense_splitting::create_expense_equal(
    bob,
    0,  // Same group_id!
    "Cabin rental",
    600,
    [alice, bob, charlie]
)

// 5. Both modules check membership using groups::is_member()
// 6. Profiles work across both systems
```

---

## 🧪 Testing

### Test Coverage

We have **3 comprehensive test suites**:

#### 1. **`groups_tests.move`** (13 tests)
- Profile creation and uniqueness
- Group creation and joining
- Password verification
- Member management
- Multi-group scenarios

#### 2. **`expense_splitting_tests.move`** (15 tests)
- All split types (equal, percentage, exact)
- Debt calculation and simplification
- Settlement (full and partial)
- Multi-group isolation
- Complex real-world scenarios
- Access control

#### 3. **`integration_tests.move`** (8 tests) ⭐
- **Shared groups across apps**
- **Profiles shared across apps**
- **Multiple groups with different purposes**
- **Complex trip scenario** (predictions + expenses)
- **Access control** (non-members blocked)
- **Join once, use everywhere**

### Run Tests

```bash
cd move_contracts

# Run all tests
aptos move test

# Run specific suite
aptos move test --filter groups_tests
aptos move test --filter expense_splitting_tests
aptos move test --filter integration_tests
```

---

## 🚀 Deployment

### Prerequisites
1. Aptos CLI installed
2. Movement testnet configured
3. Profile set up with funded account

### Deploy Script

```bash
cd move_contracts

# Make script executable (if not already)
chmod +x deploy_all.sh

# Deploy to testnet
./deploy_all.sh testnet default

# Or deploy to devnet
./deploy_all.sh devnet myprofile
```

The script will:
1. ✅ Run all tests
2. ✅ Compile modules
3. ✅ Publish to network
4. ✅ Initialize all three modules
5. ✅ Display module address

### Manual Deployment

```bash
# 1. Compile
aptos move compile

# 2. Publish
aptos move publish --profile default

# 3. Initialize modules
MODULE_ADDR=<your_address>

aptos move run \
    --function-id ${MODULE_ADDR}::groups::init \
    --profile default

aptos move run \
    --function-id ${MODULE_ADDR}::expense_splitting::init \
    --profile default

aptos move run \
    --function-id ${MODULE_ADDR}::private_prediction_refactored::init \
    --profile default
```

---

## 💡 Usage Examples

### Example 1: Roommates Managing Expenses

```typescript
// 1. Create "Apartment" group
await signAndSubmit({
    function: `${MODULE_ADDR}::groups::create_group`,
    arguments: ["Apartment 4B", "password", "Monthly expenses"]
})

// 2. Roommates join
await signAndSubmit({
    function: `${MODULE_ADDR}::groups::join_group`,
    arguments: [0, "password"]
})

// 3. Track rent
await signAndSubmit({
    function: `${MODULE_ADDR}::expense_splitting::create_expense_equal`,
    arguments: [0, "Rent - January", 2000, [alice, bob, charlie]]
})

// 4. Track utilities (unequal split)
await signAndSubmit({
    function: `${MODULE_ADDR}::expense_splitting::create_expense_exact`,
    arguments: [0, "Utilities", 150, [alice, bob, charlie], [60, 50, 40]]
})

// 5. View who owes what
const [balance, isOwed] = await aptos.view({
    function: `${MODULE_ADDR}::expense_splitting::get_user_balance`,
    arguments: [0, aliceAddress]
})
```

### Example 2: Friend Group with Predictions and Expenses

```typescript
// 1. Create multi-purpose group
await signAndSubmit({
    function: `${MODULE_ADDR}::groups::create_group`,
    arguments: ["Weekend Crew", "pass", "Weekend activities"]
})

// 2. Make predictions
await signAndSubmit({
    function: `${MODULE_ADDR}::private_prediction_refactored::create_bet`,
    arguments: [
        0,  // group_id
        "Who wins the game?",
        ["Team A", "Team B"],
        adminAddress,
        []  // no encryption
    ]
})

// 3. Track expenses from same group
await signAndSubmit({
    function: `${MODULE_ADDR}::expense_splitting::create_expense_equal`,
    arguments: [0, "Dinner", 90, [alice, bob, charlie]]
})

// Everything shares the same group membership!
```

---

## 🎯 Key Benefits of Modular Architecture

### 1. **Code Reusability**
- Groups module used by 2+ apps (and counting)
- Shared profile system eliminates duplication
- Common access control logic

### 2. **Easier Maintenance**
- Bug fixes in groups module benefit all apps
- Clear separation of concerns
- Independent versioning possible

### 3. **Better UX**
- Join a group once, access multiple features
- Single username across all apps
- Consistent group management experience

### 4. **Extensibility**
- New apps can easily integrate with existing groups
- No need to rewrite membership logic
- Built-in access control

### 5. **Testing**
- Unit tests for each module
- Integration tests verify cross-module functionality
- Real-world scenario testing

---

## 🔮 Future Enhancements

### Short Term
- [ ] Frontend integration with all three modules
- [ ] Indexer for event tracking
- [ ] Mobile-responsive UI
- [ ] Group invitations via links

### Medium Term
- [ ] **New Apps Using Groups Module:**
  - Investment clubs (pool funds, track returns)
  - Event planning (RSVPs, expense splitting)
  - Gaming guilds (tournaments, prize pools)
  - Study groups (resource sharing)
- [ ] Group admin controls (kick members, transfer admin)
- [ ] Recurring expenses
- [ ] Expense categories and budgets

### Long Term
- [ ] Privacy features (zero-knowledge proofs)
- [ ] Cross-chain group membership (NFT-based)
- [ ] DAO governance for groups
- [ ] Integration with other DeFi protocols

---

## 📚 Additional Resources

### Documentation
- **`EXPENSE_MODULE_README.md`** - Detailed expense splitting guide
- **Test files** - Best source of usage examples
- **Inline code comments** - Comprehensive explanations

### Key Files
```
move_contracts/
├── sources/
│   ├── groups.move                           # Foundation module
│   ├── expense_splitting.move                # Expense tracking
│   ├── private_prediction_refactored.move    # Predictions (refactored)
│   └── private_prediction.move               # Original (deprecated)
├── tests/
│   ├── groups_tests.move                     # Unit tests
│   ├── expense_splitting_tests.move          # Unit tests
│   ├── integration_tests.move                # Integration tests ⭐
│   └── private_prediction_tests.move         # Original tests
├── deploy_all.sh                             # Deployment script
├── EXPENSE_MODULE_README.md                  # User guide
└── INTEGRATION_GUIDE.md                      # This file
```

---

## ❓ FAQ

### Q: Do I need to deploy all three modules?
**A:** Yes, but groups must be deployed first as the other modules depend on it.

### Q: Can I use the old private_prediction.move?
**A:** Yes, but it has duplicate group code. The refactored version is recommended.

### Q: How do I migrate from old to new prediction module?
**A:** Deploy the new module, then create groups using `groups::create_group()` and have users join. Old bets remain in the old module.

### Q: Can different groups use different apps?
**A:** Absolutely! Group 1 could be for predictions only, Group 2 for expenses only, Group 3 for both.

### Q: How secure is the password system?
**A:** Not secure for production - passwords are readable on-chain. Use NFT-based access or zero-knowledge proofs in production.

### Q: Can I add my own module that uses groups?
**A:** Yes! Just import `friend_fi::groups` and use `groups::is_member()` for access control.

---

## 🤝 Contributing

Ideas for new modules using the shared groups system:

1. **Poll/Voting System** - Create polls within groups
2. **Resource Sharing** - Lend/borrow items between group members
3. **Task Management** - Collaborative to-do lists
4. **Recipe Sharing** - Share meals and split grocery costs
5. **Carpool Coordination** - Organize rides, split gas costs

---

**Built with ❤️ for Movement Network**

Ready to deploy? Run `./deploy_all.sh testnet` and start building! 🚀

