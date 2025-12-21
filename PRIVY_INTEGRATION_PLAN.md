# Privy Integration Plan for Hackathon

## Current State
- ✅ Privy configured for Movement network
- ✅ Embedded wallets auto-created on email login
- ❌ Not using Privy wallets for transaction signing
- ❌ Not showcasing Privy's embedded wallet features

## Improvements Needed

### 1. Use Privy Embedded Wallets for Transaction Signing
**For Email Users:**
- Use Privy's `useWallets()` hook to get embedded wallet
- Use Privy's `rawSign()` API to sign Movement transactions
- Show smooth, keyless transaction signing

**For Biometric Users:**
- Option A: Import wallet to Privy after biometric auth (requires email auth first)
- Option B: Keep direct signing for biometric, but highlight Privy for email users
- Option C: Hybrid - use Privy when available, fallback to direct signing

### 2. Showcase Smooth Onboarding
- Highlight that Privy creates wallets automatically on email login
- Show no private keys exposed to users
- Display wallet address from Privy embedded wallet

### 3. Transaction Signing UX
- Use Privy's signing prompts (if available)
- Show clear transaction details before signing
- Hide key management complexity

### 4. Implementation Strategy

**Recommended Approach:**
1. **Email Users (Primary Privy Showcase):**
   - Use Privy embedded wallets exclusively
   - Sign all transactions with Privy's rawSign API
   - Show wallet address from Privy

2. **Biometric Users (Enhancement):**
   - Keep current direct signing approach
   - OR: Link biometric wallet to Privy after first email login
   - Highlight as "enhanced security" feature

3. **Unified Transaction Signing:**
   - Create `usePrivyMoveWallet()` hook
   - Automatically uses Privy if available
   - Falls back to direct signing for biometric users
   - All transaction code uses this unified interface

## Key Files to Update

1. `src/hooks/usePrivyMoveWallet.ts` - New hook for Privy wallet integration
2. `src/lib/move-wallet.ts` - Update to use Privy when available
3. `src/hooks/useMoveWallet.ts` - Use Privy wallet if authenticated via Privy
4. Dashboard/Settings - Show Privy wallet address prominently

## Hackathon Judging Criteria Alignment

✅ **Clear use of Privy's embedded wallets** - Use for all email user transactions
✅ **Smooth, intuitive onboarding** - Auto-create wallets on login
✅ **Clean UX that hides key-management** - No private keys exposed
✅ **Technical correctness** - Proper Movement network integration with Ed25519

