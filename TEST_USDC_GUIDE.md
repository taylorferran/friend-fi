# Test USDC Deployment Guide

## Overview
We've deployed a custom test USDC token with unlimited minting capability for demos and testing on Movement testnet.

---

## Test USDC Details

### Contract Information
- **Module**: `friend_fi::test_usdc`
- **Contract Address**: `0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f`
- **Metadata Address**: `0x9cdf923fb59947421487b61b19f9cacb172d971a755d6bb34f69474148c11ada`

### Token Properties
- **Name**: Test USDC
- **Symbol**: tUSDC
- **Decimals**: 6 (same as real USDC)
- **Max Supply**: Unlimited
- **Icon**: https://cryptologos.cc/logos/usd-coin-usdc-logo.png

### Key Features
✅ **Unlimited Minting** - Admin can mint as much as needed
✅ **Same as Real USDC** - 6 decimals, same interface
✅ **Compatible with All Contracts** - Works exactly like real USDC
✅ **Fast Testing** - No faucet wait times
✅ **Demo Ready** - Create realistic demos with millions of USDC

---

## Current Balances

### Faucet Account
- **Address**: `0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370`
- **Balance**: 10,000,000 tUSDC
- **MOVE Balance**: 1 MOVE (for gas to transfer)
- **Purpose**: Distribution to users for testing

**Note**: The faucet account was funded with both MOVE (for gas) and test USDC.

### Deployment Account
- **Address**: `0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f`
- **Balance**: 1,000,000 tUSDC
- **Purpose**: Contract testing and admin operations

---

## Minting Test USDC

### Method 1: Using the Helper Script (Easiest)
```bash
cd move_contracts
./mint_test_usdc.sh <address> <amount>

# Example: Mint 5000 test USDC
./mint_test_usdc.sh 0x123... 5000
```

### Method 2: Using Movement CLI
```bash
cd move_contracts

# Mint to an address (amount in micro-USDC, multiply by 1,000,000)
movement move run \
  --function-id 0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::test_usdc::mint \
  --args address:<TARGET_ADDRESS> u64:<AMOUNT_MICRO_USDC> \
  --assume-yes

# Example: Mint 1000 USDC (1000 * 1,000,000 = 1,000,000,000 micro-USDC)
movement move run \
  --function-id 0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::test_usdc::mint \
  --args address:0x123... u64:1000000000 \
  --assume-yes
```

---

## Checking Balances

### View Function (via CLI)
```bash
movement move view \
  --function-id 0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::test_usdc::balance_of \
  --args address:<ADDRESS>
```

### View Function (via Frontend)
The frontend will automatically use the new test USDC metadata address:
```typescript
// Already updated in src/lib/move-wallet.ts
const USDC_METADATA_ADDR = "0x9cdf923fb59947421487b61b19f9cacb172d971a755d6bb34f69474148c11ada";
```

---

## Using Test USDC in Your Contracts

Test USDC works **exactly the same** as real USDC in all your contracts:

### Prediction Markets
```move
// Wagers automatically use test USDC
place_wager(bet_id, outcome_index, amount_micro_usdc, signature, expires_at);
```

### Expense Splitting
```move
// Settlements automatically use test USDC
settle_debt_with_usdc(group_id, creditor, amount_micro_usdc);
```

### Habit Tracker
```move
// Commitments stake test USDC
create_commitment(group_id, signature, expires_at, participant_b, weekly_payout, ...);
```

No code changes needed! The contracts use the fungible asset framework, which works with any compatible token.

---

## Common Amounts Reference

| USDC Amount | Micro-USDC | Use Case |
|-------------|------------|----------|
| 0.05 | 50,000 | Minimum bet wager |
| 1 | 1,000,000 | Small test transaction |
| 10 | 10,000,000 | Medium test amount |
| 100 | 100,000,000 | Large test amount |
| 1,000 | 1,000,000,000 | Demo with big numbers |
| 10,000 | 10,000,000,000 | Whale demo |
| 1,000,000 | 1,000,000,000,000 | Maximum for realistic demos |

---

## Demo Scenarios

### Scenario 1: Prediction Market with Big Wagers
```bash
# Mint 50,000 USDC to each of 3 users
./mint_test_usdc.sh 0xuser1... 50000
./mint_test_usdc.sh 0xuser2... 50000
./mint_test_usdc.sh 0xuser3... 50000

# Now they can create and bet on predictions with large amounts
```

### Scenario 2: Expense Splitting in a Group
```bash
# Mint 1,000 USDC to group admin
./mint_test_usdc.sh 0xadmin... 1000

# Create expenses and settle debts to show real money flow
```

### Scenario 3: Habit Accountability with Stakes
```bash
# Mint 100 USDC to each partner
./mint_test_usdc.sh 0xpartner1... 100
./mint_test_usdc.sh 0xpartner2... 100

# They can stake meaningful amounts on habits
```

---

## Administrative Functions

### Burn Test USDC (Admin Only)
```bash
movement move run \
  --function-id 0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::test_usdc::burn \
  --args address:<FROM_ADDRESS> u64:<AMOUNT_MICRO_USDC> \
  --assume-yes
```

### Force Transfer (Admin Only)
```bash
movement move run \
  --function-id 0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::test_usdc::force_transfer \
  --args address:<FROM_ADDRESS> address:<TO_ADDRESS> u64:<AMOUNT_MICRO_USDC> \
  --assume-yes
```

---

## Faucet Integration

If you want to automate USDC distribution to users, you can use the faucet account:

```typescript
// In your backend (using the faucet private key)
import { transferUSDCFromFaucet } from '@/lib/move-wallet';

const FAUCET_PRIVATE_KEY = "ed25519-priv-0xb62aff094a9ab76359c9b7ed7c3e7595831b476f71b8bc6d07e10cf1e19836e0";

// Transfer from faucet to user
await transferUSDCFromFaucet(
  FAUCET_PRIVATE_KEY,
  userAddress,
  100 // 100 USDC (default faucet amount)
);
```

---

## Frontend Updates

The following files have been updated to use test USDC:

1. ✅ **src/lib/move-wallet.ts** - Updated `USDC_METADATA_ADDR`
2. ✅ All USDC transfers will now use test USDC
3. ✅ All contract interactions will use test USDC

No other changes needed!

---

## Advantages Over Real USDC Faucets

| Feature | Real USDC Faucet | Test USDC |
|---------|------------------|-----------|
| Availability | Limited, can run out | Unlimited ✅ |
| Wait Time | Often has cooldowns | Instant ✅ |
| Amount Limits | Usually 10-100 USDC | Mint millions ✅ |
| Control | External dependency | You control it ✅ |
| Demos | Limited by faucet | Realistic large amounts ✅ |
| Per Request | 1-10 USDC | 100 USDC default ✅ |

---

## Security Notes

⚠️ **TESTNET ONLY**: This test USDC has no value and should **NEVER** be used on mainnet.

✅ **Admin Controls**: Only the deployer (`friend_fi` address) can mint, burn, or force transfer.

✅ **Standard Transfers**: Regular users can transfer test USDC normally using `primary_fungible_store::transfer`.

---

## Troubleshooting

### Issue: "Account not found" when using faucet
**Solution**: The faucet account needs MOVE tokens for gas. Fund it with:
```bash
movement account fund-with-faucet --account 0x60b19358beede1dfe759f33b94d36ceedff4d855874442f7f1b2b80268e41370
```

### Issue: "Function not found"
**Solution**: Make sure you're using the correct contract address:
```
0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f
```

### Issue: "Insufficient funds"
**Solution**: Mint more test USDC:
```bash
./mint_test_usdc.sh <your-address> 1000
```

### Issue: Balance shows 0 in frontend
**Solution**: 
1. Clear browser cache
2. Verify metadata address in `src/lib/move-wallet.ts` is:
   ```
   0x9cdf923fb59947421487b61b19f9cacb172d971a755d6bb34f69474148c11ada
   ```

---

## Next Steps

1. ✅ Test USDC deployed and minted
2. ✅ Faucet loaded with 10M test USDC
3. ✅ Frontend updated to use test USDC
4. ⏩ **Start testing all features!**

You can now:
- Create bets with real-looking wagers
- Split expenses and settle debts
- Create habit commitments with stakes
- Demo to investors with impressive numbers
- Test edge cases with extreme amounts

---

**Last Updated**: January 5, 2026

