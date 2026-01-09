<div align="center">
  <img src="public/logo.svg" alt="Friend-Fi Logo" width="200"/>
</div>

# Friend-Fi

Your mobile-first social finance hub - Manage money, track habits, and make predictions with friends using USDC on Movement Network.

## Features

### Private Predictions
- Create and wager on predictions within groups
- Proportional payouts
- Encrypted bet details for privacy
- Bet admin controlled settlement

### Expense Splitting
- Split bills and expenses within friend groups
- Track who owes what in real-time
- Settle up with instant USDC transfers
- Full transaction history

### Habit Tracking & Accountability
- Create personal goals and habits
- Stake USDC to stay accountable
- Friends can verify your progress
- Get your stake back when you succeed


### Core Benefits
- **Mobile-First**: Optimized for on-the-go use
- **Private & Secure**: On-chain encryption for sensitive data
- **No Gas Fees**: All transaction costs covered by Shinami Gas Station
- **USDC Only**: Stable currency for all interactions
- **Social by Default**: Everything happens within friend groups

## Tech Stack

- **Frontend**: Next.js 15 + React + TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: WebAuthn biometric authentication
- **Blockchain**: Movement Bardock Testnet
- **Smart Contracts**: Move language
- **Database**: Supabase (for off-chain indexing)
- **Mobile**: Progressive Web App (PWA) with biometric support
- **Gas Sponsorship**: Transaction fees covered by Shinami Gas Station

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd friend-fi
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. **Configure Supabase** (Optional, for off-chain indexing):
   - Create a project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Add them to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

5. **Configure Backend Signer** (For signature authentication):
   - Generate a keypair for backend signing:
   ```bash
   npm run generate-keypair
   ```
   - Add the private key to `.env.local`:
   ```
   BACKEND_SIGNER_PRIVATE_KEY=your_generated_private_key
   ```

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

## Mobile Installation

Friend-Fi is a Progressive Web App (PWA) and can be installed on mobile devices:

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)
1. Open the app in Chrome
2. Tap the three dots menu
3. Tap "Add to Home Screen"
4. Tap "Add"

Once installed, you can use biometric authentication (Face ID, Touch ID, fingerprint) for secure access.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Splash/landing page
│   ├── dashboard/         # Main dashboard hub
│   ├── groups/
│   │   ├── create/        # Create new group
│   │   ├── join/          # Join existing group
│   │   └── [id]/          # Group details & management
│   ├── expenses/          # Expense splitting
│   ├── accountability/    # Habit tracking
│   ├── bets/              # Private predictions
│   │   ├── create/        # Create new prediction
│   │   └── [id]/          # View/wager on prediction
│   ├── leaderboard/       # Group leaderboard
│   ├── transactions/      # Transaction history
│   └── settings/          # User settings
├── components/
│   ├── layout/            # Layout components (Sidebar, MobileNav)
│   ├── providers/         # React context providers
│   └── ui/                # Reusable UI components
└── lib/                   # Utilities and blockchain integration
    ├── contract.ts        # Smart contract interactions
    ├── move-wallet.ts     # Wallet management
    ├── biometric-wallet.ts # Mobile biometric auth
    └── supabase.ts        # Database client
```

## Smart Contracts

The app uses Move smart contracts deployed on Movement Bardock Testnet:

- **private_prediction_refactored.move** - Encrypted prediction markets
- **expense_splitting.move** - Bill splitting and settlement
- **habit_tracker.move** - Habit staking and verification
- **signature_auth.move** - Secure authentication system for off-chain groups
- **test_usdc.move** - Test USDC token for development

## Movement Network Configuration

The app is configured for Movement Bardock Testnet:

- **Chain ID**: 30732
- **RPC URL**: https://testnet.bardock.movementlabs.xyz
- **Explorer**: https://explorer.movementlabs.xyz

## User Flows

### Getting Started
1. **Login** - Sign in with biometric authentication (Face ID, Touch ID, or fingerprint)
2. **Create Wallet** - Your Move wallet is created and secured with biometrics
3. **Create/Join Group** - Set up a private group with ID + password
4. **Fund Wallet** - Get test USDC for the testnet
5. **Choose Your Feature** - Expenses, habits, or predictions

### Expense Splitting Flow
1. Create an expense (dinner, rent, trip, etc.)
2. Add group members as participants
3. System calculates splits automatically
4. Members pay their share directly
5. View balance and transaction history

### Habit Tracking Flow
1. Create a habit/goal with a deadline
2. Stake USDC as commitment
3. Work on your habit
4. Submit proof when complete
5. Friends verify your completion
6. Get your stake back (or lose it if you fail)

### Private Predictions Flow
1. Propose a prediction question
2. Group members bet USDC on Yes/No
3. Wait for the event to resolve
4. Admin declares the outcome
5. Winners collect proportional payouts

## Privacy & Security

- **End-to-end encryption** for sensitive group data using group passwords
- **On-chain privacy** ensures bet details and expenses remain confidential
- **Non-custodial** wallets - you always control your funds
- **Biometric authentication** for mobile security (optional)

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Deploy smart contracts
cd move_contracts
./deploy_all.sh

# Mint test USDC
./mint_test_usdc.sh <your_address> <amount>
```

## Testing

The app includes several test pages for development:

- `/demo-selector` - Choose which feature to demo
- `/demo-expenses` - Test expense splitting
- `/demo-habits` - Test habit tracking
- `/demo-predictions` - Test predictions
- `/debug` - Blockchain debugging tools

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For questions or issues:
- Open an issue on GitHub
- Check existing documentation in the repo
- Review the smart contract code in `move_contracts/sources/`

## License

MIT
