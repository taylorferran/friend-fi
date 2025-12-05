#!/bin/bash

# Friend-Fi Contract Deployment Script
# This script will guide you through deploying the updated contract

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Friend-Fi Contract Deployment v2.0                     ║"
echo "║         Updated with: Single-outcome, Cancel, Encryption       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo -e "${RED}Error: Aptos CLI is not installed${NC}"
    echo "Install it from: https://aptos.dev/tools/aptos-cli/"
    exit 1
fi

echo -e "${GREEN}✓${NC} Aptos CLI found"
echo ""

# Compile first
echo "📦 Compiling contract..."
aptos move compile --named-addresses friend_fi=default

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Compilation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Compilation successful"
echo ""

# Ask for confirmation
echo -e "${YELLOW}⚠ Important Notes:${NC}"
echo "  • This is a BREAKING change (new encrypted_payload field)"
echo "  • You cannot upgrade an existing contract"
echo "  • You must deploy to a new address"
echo "  • Remember to update CONTRACT_ADDRESS in src/lib/contract.ts"
echo ""

read -p "Do you want to proceed with deployment? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Publish
echo "🚀 Publishing contract..."
aptos move publish --named-addresses friend_fi=default

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Contract deployed successfully!"
echo ""

# Get the account address
ACCOUNT_ADDRESS=$(aptos config show-profiles --profile default 2>/dev/null | grep "account" | awk '{print $2}')

echo "📝 Your contract address: ${ACCOUNT_ADDRESS}"
echo ""

# Ask to initialize
read -p "Do you want to initialize the contract now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Initializing contract (setting up escrow and state)..."
    aptos move run --function-id default::private_prediction_market::init
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Contract initialized successfully!"
    else
        echo -e "${RED}✗ Initialization failed${NC}"
        echo "You can initialize later with:"
        echo "  aptos move run --function-id default::private_prediction_market::init"
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Deployment Complete!                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Update CONTRACT_ADDRESS in your frontend:"
echo "   File: src/lib/contract.ts"
echo "   New address: ${ACCOUNT_ADDRESS}"
echo ""
echo "2. Test the new view functions:"
echo "   - getGroupName()"
echo "   - getBetDescription()"
echo "   - getUserWagerOutcome()"
echo ""
echo "3. Test new features:"
echo "   - Users can only bet on one outcome"
echo "   - Users can cancel wagers"
echo "   - Bets can have encrypted payloads"
echo ""
echo "4. Verify with test transactions:"
echo "   - Create a group"
echo "   - Create a bet"
echo "   - Place a wager"
echo "   - Try to bet on different outcome (should fail)"
echo "   - Cancel the wager"
echo ""
echo "Happy betting! 🎲"

