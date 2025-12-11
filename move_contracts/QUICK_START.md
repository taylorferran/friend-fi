# Friend-Fi Quick Start Guide

Get up and running with Friend-Fi in 5 minutes! ⚡

---

## 🚀 Deploy in 3 Steps

```bash
# 1. Navigate to contracts folder
cd move_contracts

# 2. Deploy everything
./deploy_all.sh testnet default

# 3. Done! 🎉
```

That's it! All three modules are deployed and initialized.

---

## 📱 Basic Usage

### Step 1: Create a Group

```typescript
// Alice creates a group for her trip
await signAndSubmitTransaction({
    function: `${MODULE_ADDR}::groups::create_group`,
    arguments: [
        "Bali Trip 2025",           // name
        "password123",              // password
        "Summer vacation expenses"  // description
    ]
})
```

### Step 2: Friends Join

```typescript
// Bob joins the group
await signAndSubmitTransaction({
    function: `${MODULE_ADDR}::groups::join_group`,
    arguments: [
        0,              // group_id
        "password123"   // password
    ]
})
```

### Step 3: Use for Expenses

```typescript
// Alice pays for hotel, split equally
await signAndSubmitTransaction({
    function: `${MODULE_ADDR}::expense_splitting::create_expense_equal`,
    arguments: [
        0,                              // group_id
        "Hotel - 3 nights",             // description
        600,                            // total amount (in USDC units)
        [aliceAddr, bobAddr, charlieAddr]  // participants
    ]
})
```

### Step 4: Use for Predictions

```typescript
// Create a bet in the SAME group
await signAndSubmitTransaction({
    function: `${MODULE_ADDR}::private_prediction_refactored::create_bet`,
    arguments: [
        0,                          // group_id (same!)
        "Will it rain?",            // description
        ["Yes", "No"],              // outcomes
        aliceAddr,                  // bet admin
        []                          // no encryption
    ]
})
```

### Step 5: Check Balances

```typescript
// Who owes what?
const [balance, isOwed] = await aptos.view({
    function: `${MODULE_ADDR}::expense_splitting::get_user_balance`,
    arguments: [0, aliceAddress]
})

console.log(isOwed 
    ? `You are owed $${balance}` 
    : `You owe $${balance}`
)
```

---

## 🎯 Common Operations

### Create Different Split Types

```typescript
// Equal split
expense_splitting::create_expense_equal(
    signer, group_id, description, total, participants
)

// Custom amounts
expense_splitting::create_expense_exact(
    signer, group_id, description, total, participants, [100, 200, 300]
)

// Percentage split (basis points: 10000 = 100%)
expense_splitting::create_expense_percentage(
    signer, group_id, description, total, participants, [4000, 3000, 3000]
)
```

### Settle Debts

```typescript
// Pay with USDC on-chain
expense_splitting::settle_debt_with_usdc(
    debtor_signer, group_id, creditor_address, amount
)

// Mark as settled (cash/venmo/etc)
expense_splitting::mark_debt_settled(
    creditor_signer, group_id, debtor_address, amount
)
```

### Make Predictions

```typescript
// Place a wager
private_prediction_refactored::place_wager(
    signer, bet_id, outcome_index, amount_in_usdc
)

// Resolve bet (admin only)
private_prediction_refactored::resolve_bet(
    admin_signer, bet_id, winning_outcome_index
)
```

---

## 📖 Module Functions Reference

### Groups Module

| Function | Description | Arguments |
|----------|-------------|-----------|
| `create_group` | Create a new group | name, password, description |
| `join_group` | Join existing group | group_id, password |
| `leave_group` | Leave a group | group_id |
| `set_profile` | Set username/avatar | username, avatar_id |
| `get_profile` | View user profile | address |
| `is_member` | Check membership | group_id, address |

### Expense Splitting Module

| Function | Description | Arguments |
|----------|-------------|-----------|
| `create_expense_equal` | Equal split | group_id, description, amount, participants |
| `create_expense_exact` | Custom amounts | group_id, description, amount, participants, amounts |
| `create_expense_percentage` | Percentage split | group_id, description, amount, participants, percentages |
| `settle_debt_with_usdc` | Pay on-chain | group_id, creditor, amount |
| `mark_debt_settled` | Mark as paid | group_id, debtor, amount |
| `get_user_balance` | View balance | group_id, address |
| `get_group_debts` | View all debts | group_id |

### Prediction Markets Module

| Function | Description | Arguments |
|----------|-------------|-----------|
| `create_bet` | Create prediction | group_id, description, outcomes, admin, encrypted |
| `place_wager` | Bet on outcome | bet_id, outcome_index, amount |
| `cancel_wager` | Cancel bet | bet_id |
| `resolve_bet` | Declare winner | bet_id, winning_outcome_index |
| `get_group_bets` | View group bets | group_id |
| `get_bet_total_pool` | View bet pool | bet_id |

---

## 🧪 Testing

```bash
# Run all tests
aptos move test

# Run specific test suite
aptos move test --filter groups_tests
aptos move test --filter expense_splitting_tests
aptos move test --filter integration_tests

# Run single test
aptos move test --filter test_shared_group_predictions_and_expenses
```

---

## 🐛 Troubleshooting

### "Module not found"
- Make sure you deployed all three modules
- Check MODULE_ADDR is correct

### "Not a member" error
- User must join group first with `join_group()`
- Verify group_id is correct

### "Insufficient amount" error  
- Check USDC balance
- Ensure amount > 0

### "Already initialized" error
- Modules already deployed and initialized
- This is normal on redeployment

### Tests failing
- Run `aptos move clean`
- Run `aptos move test` again

---

## 📚 Documentation

- **SUMMARY.md** - What we built overview
- **INTEGRATION_GUIDE.md** - Architecture deep dive
- **EXPENSE_MODULE_README.md** - Complete expense features
- **BEFORE_AND_AFTER.md** - Refactor impact analysis
- **Test files** - Usage examples

---

## 🎨 Example Frontend Integration

```typescript
// Initialize
const MODULE_ADDRESS = "0x..."; // Your deployed address

// Helper functions
async function createGroup(name: string, password: string, description: string) {
    return await signAndSubmitTransaction({
        function: `${MODULE_ADDRESS}::groups::create_group`,
        arguments: [name, password, description]
    });
}

async function joinGroup(groupId: number, password: string) {
    return await signAndSubmitTransaction({
        function: `${MODULE_ADDRESS}::groups::join_group`,
        arguments: [groupId, password]
    });
}

async function addExpense(groupId: number, description: string, amount: number, participants: string[]) {
    return await signAndSubmitTransaction({
        function: `${MODULE_ADDRESS}::expense_splitting::create_expense_equal`,
        arguments: [groupId, description, amount, participants]
    });
}

async function getBalance(groupId: number, userAddress: string) {
    const [balance, isOwed] = await aptos.view({
        function: `${MODULE_ADDRESS}::expense_splitting::get_user_balance`,
        arguments: [groupId, userAddress]
    });
    return { balance, isOwed };
}

// Use in your app
const App = () => {
    const handleCreateGroup = async () => {
        await createGroup("My Group", "pass123", "Group expenses");
        console.log("Group created!");
    };
    
    const handleAddExpense = async () => {
        await addExpense(0, "Dinner", 90, [alice, bob, charlie]);
        console.log("Expense added!");
    };
    
    return (
        <div>
            <button onClick={handleCreateGroup}>Create Group</button>
            <button onClick={handleAddExpense}>Add Expense</button>
        </div>
    );
};
```

---

## 🔑 Key Concepts

### Group ID
- Groups are identified by index (0, 1, 2, ...)
- First group created is ID 0
- Increments with each new group

### Membership
- Must be group member to create expenses/bets
- Join once, use for all features
- Can be member of multiple groups

### USDC Units
- Amounts are in smallest USDC units
- 1 USDC = 1,000,000 units (6 decimals)
- Example: 100 USDC = 100,000,000 units

### Percentages
- Expressed in basis points
- 10000 = 100%
- 5000 = 50%
- 3333 = 33.33%

---

## ⚡ Pro Tips

1. **Set Profile First** - Makes it easier to track who's who
2. **Use Same Group** - One group for predictions + expenses saves time
3. **Test Small** - Try with small amounts first
4. **Check Balances Often** - Keep track before settling
5. **Document Expenses** - Use descriptive names

---

## 🎯 Next Steps

1. ✅ Deploy contracts
2. ✅ Create your first group
3. ✅ Add friends
4. ✅ Track expenses
5. ✅ Make predictions
6. 🚀 **Build your frontend!**

---

## 📞 Need Help?

- Check test files for examples
- Read INTEGRATION_GUIDE.md for architecture
- Review inline code comments
- Check error codes in source files

---

**Ready to build? Let's go! 🚀**

```bash
cd move_contracts && ./deploy_all.sh testnet
```

