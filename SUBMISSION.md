# Friend-Fi - Movement Hackathon Submission

Category: Best Consumer App Built on Movement

---

## 1. Project Description

Friend-Fi is a mobile-first social DeFi platform that makes blockchain useful for everyday interactions with your friends. I've built three production-ready applications that people actually want to use daily: Private Predictions, Splitting Expenses, and an Accountability Tracker.

The Problem: You're crypto-native. Your friends aren't. Getting them on-chain is nearly impossible with seed phrases, gas fees, on-ramping, wallet apps, and token swaps. They give up before they even start. You can't bring your social circle on-chain because the onboarding is broken.

Our Solution: Friend-Fi is the gateway drug. One crypto-native person creates a group, the others join with just a password, and suddenly everyone's transacting on Movement with Face ID. No friction, no confusion, no barriers. You become the bridge that brings your entire friend group on-chain.

- Zero learning curve: WebAuthn biometric login (Face ID/Touch ID), no seed phrases, no wallet downloads
- Zero gas fees: All transaction costs sponsored via Shinami Gas Station
- Zero crypto friction: Everything happens in USDC stablecoins with real dollar values
- Zero trust issues: Private friend groups with password protection, only interact with people you know
- Profitable monetization: Movement's sub-penny gas costs let us sponsor transactions AND take a small platform fee while still being free to users.

I've proven that Movement's speed and low costs enable what Web3 has promised but never delivered: consumer apps that feel like Web2 and run on crypto.

Get an idea of how each app functions here: https://www.friend-fi.com/demo-selector  

---

## 2. Technical Submission Details

What I Built

At first I wanted to just create the private predictions app, but through the use of embedded wallets on an app like this, it's very easy to and user-friendly to interact with multiple apps within the same program, which lead me to build an ecosystem of apps. An ecosystem that can easily be extended and improved upon.

Three Consumer Apps:
- Private Predictions: Bet with friends on anything, USDC pools, winner-takes-all payouts
- Split Expenses: Shared ledger with rolling balances, settle instantly with USDC
- Accountability Tracker: Stake money on habits, get paid if you hit your goals

Tech Stack:
- Frontend: Next.js 15, TypeScript, Tailwind CSS, Progressive Web App (mobile)
- Smart Contracts: Move language (5 modules deployed)
  > private_prediction_refactored - Private wagers with USDC escrow
  > expense_splitting - Shared ledger with debt tracking
  > habit_tracker - Two-person accountability with stakes
  > signature_auth - Ed25519 signature verification for off-chain groups
  > test_usdc - Testnet USDC faucet for user onboarding
- Database: Supabase (PostgreSQL) for off-chain data (groups, profiles)
- Auth: Custom WebAuthn biometric wallet (Face ID/Touch ID)
- Blockchain: Movement Testnet via Aptos SDK
- Gas Sponsorship: Shinami Gas Station (100% of transactions sponsored)
- Indexing: Movement GraphQL indexer for transaction history

Deployed Contract: 0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f

How It Works (predictions betting example)

User Onboarding (10 seconds):
1. User taps "Launch App"
2. Face ID prompt appears, WebAuthn creates credential
3. Ed25519 keypair generated, encrypted with biometric-derived key
4. Seed stored in localStorage (biometric-protected)
5. Move wallet address derived, user logged in

Creating a Group (Instant, Free):
1. User fills group form (name, password)
2. Password hashed with SHA-256
3. Group saved to Supabase (PostgreSQL)
4. User added to group_members table
5. Group ID provided to give to friends to join
6. No blockchain transaction, zero gas cost

Making a Bet (3 seconds):
1. User selects group, fills bet form
2. Frontend calls backend API for membership proof
3. Backend queries Supabase, signs attestation with Ed25519 private key
4. User signs transaction with biometric wallet
5. Transaction sent to Shinami Gas Station
6. Shinami sponsors gas, submits to Movement Network
7. Transaction confirms in 1-2 seconds
8. Event indexed, bet appears in UI

Resolving a Bet (3 seconds)
1. Admin selects bet
2. Admin chooses whichever option has won
3. USDC automatically paid out to winners

Technical Details:
- Groups: 100% off-chain (Supabase) for instant creation
- Financial transactions: On-chain with USDC escrow
- Membership verification: Backend signature system (Ed25519)
  > Backend has its own signing key (not user keys), contracts have the public key
  > Contracts verify signatures on-chain before allowing transactions
  > Signatures expire after 1 hour (cached to reduce API calls)
- USDC: Movement testnet USDC
- Gas: Shinami sponsors all transactions (~$0.001-0.003 per tx)
- PWA (Progressive Web App): Installable on mobile home screen, works like a native app, supports offline mode, no app store approval needed. Users can "Add to Home Screen" on iOS/Android for full-screen experience with biometric auth.

Monetization Model (applicable to mainnet with tweaks to fee %):
- All gas fees paid by Friend-Fi via Shinami sponsorship, no way to abuse this
- Platform takes 1-2% fee on transaction volume
- Fees more than cover gas costs (99%+ profit margins)
- Example: $100 bet = $1-2 revenue, $0.002 gas cost, $0.998-1.998 net profit

Mainnet Plan:
1. Keep it gasless for users - we continue sponsoring via Shinami
2. Determine and implement dynamic  fee % to be comfortably in profit per txn
3. Security audit
4. Launch in app stores - currently just a PWA.

Production Readiness:
- Deployed on Movement Testnet
- All modules initialized and operational
- Progressive Web App (installable on mobile)
- Gasless transactions via Shinami (100% sponsored)
- Biometric authentication (WebAuthn)
- USDC integration (Movement testnet USDC)
- Transaction history (Movement indexer integration)
- Off-chain profiles and groups (Supabase)
- Signature-based membership verification
- Mobile-responsive design (iOS and Android tested)
- Error handling and loading states
- Toast notifications for user feedback
- Explorer links for transaction transparency

---

## 3. Presentation Slides Structure

Title: Friend-Fi - The Gateway Drug to Crypto

Slide Count: 10-12 slides (10-minute presentation)

Fonts: Libre Baskerville (headings), Space Mono (body)
Colors: #F5C301 (yellow), #E60023 (red), #211408 (black text), #FFFFFF (white)

---

SLIDE 1: TITLE

Friend-Fi
The gateway drug to crypto

Built on Movement Network

[QR code to friend-fi.com/demo-selector]

---

SLIDE 2: THE PROBLEM

You Can't Bring Your Friends On-Chain

The onboarding barrier kills crypto adoption:

• You're crypto-native. Your friends aren't.
• Seed phrases? Forget it.
• Gas fees? They don't understand.
• On-ramping USDC? Too complicated.
• Wallet apps? Another thing to download.
• Token swaps? Lost them already.

Result: Your social circle stays off-chain.
The promise of Web3 dies at the login screen.

---

SLIDE 3: OUR SOLUTION

Friend-Fi: One Crypto Friend Brings Everyone

WHAT I BUILT:
• Mobile-first Progressive Web App
• 3 complete applications (Predictions, Expenses, Habits)
• 5 Move smart contracts on Movement testnet
• WebAuthn biometric wallet (Face ID creates wallet in 2 seconds)
• 100% gas sponsored via Shinami
• Off-chain groups (Supabase) + on-chain transactions (USDC)

HOW IT SOLVES THE PROBLEM:
1. YOU create a group (you handle the blockchain)
2. THEY join with just a password (no crypto knowledge needed)
3. EVERYONE transacts with Face ID (feels like Venmo)
4. YOU become the bridge that brings your circle on-chain

THE RESULT:
Your friends are using crypto without realizing it.
Movement's sub-penny gas costs = we sponsor everything + take small fee.
99% profit margins. Only possible on Movement.

---

SLIDE 4: THREE APPS, ONE ECOSYSTEM

What Can You Do With Friend-Fi?

PRIVATE PREDICTIONS
Bet with friends on anything
"Will Alice and Bob actually get married?"
Winner-takes-all USDC payouts

SPLIT EXPENSES  
Shared expense ledger, instant settlement
No spreadsheets. No Venmo back-and-forth.
Just on-chain accounting.

ACCOUNTABILITY TRACKER
Stake money on habits
Hit the gym 3x/week or lose your $20
Money on the line = real accountability

Easy to extend: Built as an ecosystem, not a single app

---

SLIDE 5: USER FLOW (30 SECONDS)

From Zero to Transacting On-Chain

STEP 1: Tap Face ID
Wallet created in 2 seconds
No seed phrases, no downloads

STEP 2: Create Group  
Name it, set password, get group ID
No blockchain transaction, instant, free

STEP 3: Friends Join
Share group ID, they enter password
That's it. They're on-chain.

STEP 4: Create Bet
"Will we win this hackathon?" Yes/No
Resolves in 2 seconds, USDC escrowed

STEP 5: Get Paid
Admin picks winner, automatic payout
Full transparency on Movement explorer

TOTAL COST TO USER: $0

---

SLIDE 6: TECHNICAL ARCHITECTURE

Built for Scale on Movement

FRONTEND
Next.js 15 PWA (mobile-first)
Progressive Web App
Installable on iOS/Android home screen

AUTHENTICATION  
Custom WebAuthn biometric wallet
Face ID/Touch ID, no third-party dependency

OFF-CHAIN LAYER
Supabase (PostgreSQL)
Groups, profiles, instant creation
Zero gas cost for social features

ON-CHAIN LAYER
5 Move contracts deployed
- private_prediction_refactored (betting)
- expense_splitting (shared ledger)
- habit_tracker (accountability)
- signature_auth (membership verification)
- test_usdc (onboarding faucet)

GAS SPONSORSHIP
Shinami Gas Station
100% of transactions sponsored
Users never pay, never see blockchain

HYBRID DESIGN = WEB2 SPEED + WEB3 SECURITY

---

SLIDE 7: WHY MOVEMENT?

Friend-Fi Only Works on Movement

GAS COSTS
Movement: $0.001 per transaction
Ethereum L1: $5-50 per transaction  
Even Optimism: $0.10-0.50 per transaction

We can sponsor gas AND take a fee.
Impossible on any other chain.

TRANSACTION SPEED
1-2 second finality
Real-time social interactions
No one waits 15 seconds to split dinner

MOVE LANGUAGE
Formal verification
Resource-oriented programming
Bug-free financial logic
Confidence in parimutuel payouts and debt settlement

APTOS SDK COMPATIBILITY  
Mature TypeScript tooling from day one
No custom RPC client needed
Faster development, production-ready faster

THE MATH:
Ethereum would cost us $50/bet.
Movement costs $0.001/bet.
That's why consumer crypto hasn't worked yet.

---

SLIDE 8: PRODUCTION READY

This Isn't a Demo. It's Live.

✓ 5 Move contracts deployed on Movement testnet
✓ Contract address: 0x0f4364...1b3346f
✓ Progressive Web App (installable on mobile)
✓ Custom biometric wallet (Face ID/Touch ID)
✓ Gasless transactions (100% via Shinami)
✓ Off-chain indexing (Supabase + Movement GraphQL)
✓ Signature-based membership verification
✓ Three complete apps with working demos
✓ Transaction history with Movement explorer links

TRY IT NOW:
[Large QR code to friend-fi.com/demo-selector]

Open on your phone. Test all three apps.
No wallet needed. No gas fees. Just Face ID.

---

SLIDE 9: REVENUE MODEL

Profitable From Day One

THE BUSINESS MODEL:
1. We sponsor all gas via Shinami
2. Users transact for free (never see blockchain)
3. We take 1-2% fee on transaction volume
4. Gas costs ~$0.002, fee revenue ~$1-2
5. Net profit: $0.998-1.998 per $100 transaction

99%+ profit margins

mainnet roadmap:
• deploy contracts to Movement mainnet
• complete security audit (Move Prover + external audit)
• fine-tune revenue model (determine optimal fee percentage)
• launch in iOS App Store
• launch in Android Play Store
• expand ecosystem with new apps

revenue at scale:
10K users × 2 transactions/week × $0.50 avg fee
= $520K annual revenue
With 99% margins.

---

SLIDE 10: DEMO TIME

Try It Live Right Now

[LARGE QR CODE centered]

friend-fi.com/demo-selector

WHAT TO TEST:
• Create a prediction bet with fake friends
• Split an expense three ways
• Set up a habit tracker commitment
• See 2-second transaction confirmations
• Experience Face ID wallet creation
• Feel how gasless transactions work

"No wallet needed. No gas fees. Just Face ID."

Takes 30 seconds. Works on your phone.

---

SLIDE 11: vision & roadmap

this is just the start

mainnet launch checklist:
• deploy contracts to Movement mainnet
• complete security audit (Move Prover + external)
• fine-tune revenue model (optimal fee percentage)
• launch in iOS App Store
• launch in Android Play Store

future expansion:
• add 2-3 more apps to ecosystem
• fantasy sports betting
• peer-to-peer micro-loans
• group savings goals
• 10,000 daily active users
• $500K+ annual revenue
• B2B2C partnerships (brands, communities)

long-term vision:
• the super app for money between friends
• white-label licensing for enterprises
• multi-chain expansion (Movement first)

end goal: replace Venmo, Splitwise, and betting apps with one on-chain platform.

---

SLIDE 12: CALL TO ACTION

Try Friend-Fi Now

[EXTRA LARGE QR CODE]

friend-fi.com/demo-selector

FOLLOW THE PROJECT:
GitHub: [link]
Twitter: [link]

CONTACT:
[Your email]
[Your Twitter]

Built on Movement Network.
Made for everyone.

The gateway drug to crypto starts here.

---

Design Implementation Notes:

BRUTALIST AESTHETIC
• 2px solid black borders on all elements
• Hard drop shadows (4px offset)
• No rounded corners, all sharp edges
• High contrast (yellow #F5C301, red #E60023, black #211408)
• Libre Baskerville for headings (bold, serif)
• Space Mono for body text (monospace)

VISUAL HIERARCHY
• Title slides: 72pt heading
• Body slides: 48pt heading, 24pt body
• Bullet points: 20pt with 1.5 line height
• QR codes: Minimum 200x200px (larger on demo slides)

SCREENSHOTS
• Actual app UI (not mockups)
• Show Face ID prompt (proves biometric auth)
• Show transaction confirmations (proves it's real)
• Show Movement explorer links (proves on-chain)
• Mobile phone frames for context

ICONS
• Use Material Symbols Outlined (matches app)
• casino (predictions), receipt_long (expenses), fitness_center (habits)
• groups (social), local_gas_station (gas sponsorship), speed (performance)

ANIMATIONS (if presenting digitally)
• Slide transitions: Instant cut (no fade, very brutalist)
• Text: Stagger appearance by line (0.1s delay each)
• QR codes: Slight pulse animation to draw attention
• Screenshots: Slide in from left/right

KEEP SLIDES MINIMAL
• Maximum 5 bullet points per slide
• Each bullet: Maximum 10 words
• Let judges read the docs for details
• Focus on demo, not explanation

---

## 4. Demo Video Structure (3 Minutes)

Format: Screen recording with voiceover (mobile phone screen capture)

Equipment: iPhone 15 Pro with Face ID

Script & Timing:

---

INTRO (0:00 - 0:20)
Visual: Landing page (friend-fi.com)  
Voiceover:

"This is Friend-Fi, the gateway drug to crypto. I've built three apps on Movement Network that let you bet, split expenses, and track habits with your friends. All gasless, all instant, all using USDC. The key? One crypto-native person brings their whole friend group on-chain. Let me show you how."

Action: Tap "Launch App" button

---

USER ONBOARDING (0:20 - 0:40)
Visual: Biometric login screen, Face ID prompt, Dashboard  
Voiceover:

"No wallet downloads. No seed phrases. Just Face ID. In two seconds, I've created a Move wallet and I'm ready to go. My address is right here, and I can see my USDC balance. This is what makes Friend-Fi the gateway, your non-crypto friends can do this."

Action: 
- Tap Face ID prompt
- Show wallet address in header
- Show USDC balance

---

CREATE GROUP (0:40 - 1:00)
Visual: Dashboard, Groups page, Create Group form  
Voiceover:

"First, I create a friend group. I give it a name, set a password, and boom, done. No blockchain transaction, no gas fee. It's instant because group data lives off-chain in Supabase, but membership is verified on-chain for security. Now I share the group ID with my friends and they join with the password."

Action:
- Navigate to "Groups"
- Tap "Create Group"
- Fill in: name, password
- Tap "Create Group", success toast appears
- Show group ID to share

---

APP 1: PRIVATE PREDICTIONS (1:00 - 1:40)
Visual: Group detail page, Private Predictions tab  
Voiceover:

"Now let's create a prediction bet. I'll ask: 'Will we win the hackathon?' with Yes and No outcomes. The app requests a signed membership proof from our backend, then submits the transaction. Shinami sponsors the gas, so I pay nothing."

Action:
- Tap on group
- Navigate to "Private Predictions" tab
- Tap "Create Bet"
- Fill in: "Will we win the hackathon?", outcomes: "Yes", "No"
- Tap "Create Bet"
- Show "Verifying membership..." then "Creating bet..." states
- Transaction confirms in 2 seconds
- Show bet appears in list

Voiceover (continued):

"Transaction confirmed in two seconds. Now let's place a wager. I'll bet 5 USDC on Yes. Same flow, signature proof, sponsored gas, instant confirmation. My wager is now locked in the contract. When the bet resolves, the admin picks the winning outcome and USDC automatically pays out to winners."

Action:
- Tap on newly created bet
- Show bet details (0 USDC pool, outcomes)
- Tap "Place Wager"
- Select "Yes" outcome, enter 5 USDC
- Tap "Place Wager", Confirm
- Show success toast + updated pool (5 USDC)

---

APP 2: SPLIT EXPENSES (1:40 - 2:05)
Visual: Group page, Expense Splitting tab  
Voiceover:

"Second app: split expenses. I'll create a dinner bill for 30 USDC split equally among three friends. The contract calculates everyone owes 10 USDC. If my friend sends me 10 USDC, the debt automatically clears. No spreadsheets, no Venmo back-and-forth, just on-chain accounting."

Action:
- Navigate to "Expense Splitting" tab
- Tap "Create Expense"
- Fill in: "Hackathon dinner", 30 USDC, Equal split, 3 participants
- Tap "Create Expense"
- Show expense appears
- Show debts: "Alice owes you 10 USDC", "Bob owes you 10 USDC"

---

APP 3: ACCOUNTABILITY TRACKER (2:05 - 2:35)
Visual: Group page, Habit Tracker tab  
Voiceover:

"Third app: accountability tracker. I'll create a commitment with a friend, hit the gym 3 times per week for 4 weeks, 10 USDC stake. We both stake money. If we both hit our check-ins, we get our money back. If one of us fails, the other gets the full pool. Money on the line equals real accountability."

Action:
- Navigate to "Habit Tracker" tab
- Tap "Create Commitment"
- Fill in: Partner, "Gym 3x per week", 4 weeks, 3 check-ins/week, 10 USDC
- Tap "Create Commitment"
- Show commitment appears as "Pending" (waiting for friend to accept)

---

ECOSYSTEM & MONETIZATION (2:35 - 2:50)
Visual: Dashboard showing all three apps  
Voiceover:

"Three apps, one ecosystem, all gasless. Here's the magic: Movement's sub-penny gas costs let me sponsor all transactions via Shinami and still take a small platform fee. I pay $0.002 in gas, take $1-2 in fees per transaction. 99% profit margins. This business model only works on Movement."

Action:
- Pan across dashboard showing:
  - Groups created
  - Active bets
  - Pending expenses
  - Active commitments

---

CLOSING (2:50 - 3:00)
Visual: Landing page with demo link  
Voiceover:

"Friend-Fi: the gateway drug to crypto. One crypto-native friend brings everyone on-chain. Try it yourself at friend-fi.com/demo-selector. Built on Movement Network."

Action:
- Show demo selector page
- End screen: "Friend-Fi" logo + URL

---

Video Production Notes

Technical Requirements:
- Resolution: 1080p (1920x1080)
- Frame rate: 30fps
- Format: MP4 (H.264 codec)
- Audio: Clear voiceover, no background music
- Captions: Optional but helpful for accessibility

Recording Setup:
- iPhone screen recording (Settings, Control Center, Screen Recording)
- Voiceover recorded separately with good mic
- Edited in Final Cut Pro or iMovie (sync voiceover to screen recording)
- Add text overlays for emphasis ("Zero gas fees!", "2-second confirmation")

Critical Elements to Show:
1. Face ID prompt (proves biometric auth works)
2. Transaction confirmation toasts (proves real transactions)
3. Movement explorer link (proves on-chain)
4. USDC balance updates (proves real value transfer)
5. "Verifying membership..." state (proves signature auth)
6. Sub-3-second transaction times (proves Movement speed)
7. Group ID sharing flow (proves gateway model)
8. Ecosystem view (proves extensibility)

Upload Destinations:
- YouTube (unlisted or public)
- Twitter/X (3-minute version)
- Loom (for judges to easily scrub through)
- Embed on submission site

---

## Summary

Friend-Fi is a production-ready consumer application that proves Movement Network enables the Web 2.5 experience Web3 has promised for years. I've built three useful apps, deployed five Move contracts, integrated gasless transactions, and created a biometric wallet system that works like Face ID on your bank app.

I hit every judging criteria:
1. User Onboarding: Face ID login, no seed phrases, 2-second wallet creation, one crypto friend brings the whole group
2. Revenue Model: Sponsor gas + take 1-2% platform fee = 99% margins (only possible on Movement)
3. Deployed on Movement: All contracts live on testnet, working demo at friend-fi.com
4. Working Demo: Three complete apps with clear user flow, try at friend-fi.com/demo-selector

Movement's low gas costs ($0.001/tx) and fast finality (1-2 seconds) are the only reason Friend-Fi works. On Ethereum, this would cost $5-50 per transaction. Movement makes micro-transactions economical, which unlocks real consumer adoption.

Friend-Fi is the gateway drug to crypto. Ready for mainnet.

Live App: https://www.friend-fi.com/demo-selector  
Deployed Contract: 0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f

Built on Movement Network

