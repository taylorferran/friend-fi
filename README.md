# Friend-Fi 🎲

Private Predictions - Create and wager privately within friend groups using USDC on Movement Network.

## Features

- **Private & Secure**: On-chain encryption for group data using group passwords
- **Simple & Social**: Easily create wagers and invite friends
- **No Gas Fees**: All transaction costs covered via Shinami
- **USDC Only**: Stable currency for all bets
- **Twitch-style Payouts**: Fair distribution based on pool proportions

## Tech Stack

- **Frontend**: Next.js 15 + React + TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Privy (email-only login)
- **Blockchain**: Movement Network Testnet
- **Gas Sponsorship**: Shinami

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

4. **Configure Privy** (Required):
   - Go to [dashboard.privy.io](https://dashboard.privy.io)
   - Create a new app or use an existing one
   - Copy your **App ID**
   - Add it to `.env.local`:
   ```
   NEXT_PUBLIC_PRIVY_APP_ID=your_app_id_here
   ```
   - In the Privy dashboard, add your domain to allowed origins (localhost:3000 for development)

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Splash/landing page
│   ├── login/             # Login page
│   ├── dashboard/         # Main dashboard
│   ├── groups/
│   │   ├── create/        # Create new group
│   │   └── join/          # Join existing group
│   ├── bets/
│   │   ├── page.tsx       # My bets list
│   │   ├── create/        # Create new bet
│   │   └── [id]/          # View/wager on bet
│   └── leaderboard/       # Group leaderboard
├── components/
│   ├── layout/            # Layout components (Sidebar)
│   ├── providers/         # React context providers (Privy)
│   └── ui/                # Reusable UI components
└── lib/                   # Utilities and config
    └── privy-config.ts    # Privy & Movement Network config
```

## Movement Network Configuration

The app is configured for Movement Network Testnet:

- **Chain ID**: 30732
- **RPC URL**: https://mevm.testnet.imola.movementlabs.xyz
- **Explorer**: https://explorer.testnet.imola.movementlabs.xyz

## User Flow

1. **Login** - Sign in with email via Privy (creates Move wallet automatically)
2. **Create/Join Group** - Set up a private group with ID + password
3. **Create Bets** - Propose predictions for the group
4. **Place Wagers** - Bet USDC on Yes/No outcomes
5. **Admin Settles** - Designated resolver declares the outcome
6. **Collect Winnings** - Twitch-style proportional payouts

## Encryption

All group data is encrypted using the group password before being stored on-chain:
- Bet questions and details
- Wager information
- Member activity

This ensures complete privacy even though data is on a public blockchain.

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## TODO

- [ ] Implement Move smart contract for bets
- [ ] Integrate Shinami for gas sponsorship
- [ ] Add on-chain encryption/decryption
- [ ] Implement USDC transfers within app
- [ ] Add real-time updates via WebSocket
- [ ] Mobile responsive improvements

## License

MIT
