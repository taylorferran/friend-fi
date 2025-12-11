#!/bin/bash

# ============================================================================
# Friend-Fi Modular Deployment Script
# ============================================================================
# 
# This script deploys the complete Friend-Fi system with:
# 1. Shared groups module (for all apps)
# 2. Expense splitting module
# 3. Refactored prediction market module
#
# All modules share the groups module for member management!
# ============================================================================

set -e  # Exit on error

echo "========================================="
echo "Friend-Fi Modular Deployment"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo "${YELLOW}Error: aptos CLI not found. Please install it first.${NC}"
    echo "Visit: https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli"
    exit 1
fi

# Configuration
NETWORK=${1:-testnet}  # Default to testnet if not specified
PROFILE=${2:-default}  # Default to 'default' profile if not specified

echo "${BLUE}Network: $NETWORK${NC}"
echo "${BLUE}Profile: $PROFILE${NC}"
echo ""

# ============================================================================
# Step 1: Compile and Test
# ============================================================================

echo "${YELLOW}Step 1: Running tests...${NC}"
aptos move test --skip-fetch-latest-git-deps

if [ $? -eq 0 ]; then
    echo "${GREEN}✓ All tests passed!${NC}"
else
    echo "${YELLOW}⚠ Some tests failed. Continue anyway? (y/n)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# ============================================================================
# Step 2: Compile Modules
# ============================================================================

echo "${YELLOW}Step 2: Compiling modules...${NC}"
aptos move compile --skip-fetch-latest-git-deps

if [ $? -eq 0 ]; then
    echo "${GREEN}✓ Compilation successful!${NC}"
else
    echo "${YELLOW}✗ Compilation failed.${NC}"
    exit 1
fi
echo ""

# ============================================================================
# Step 3: Publish Modules
# ============================================================================

echo "${YELLOW}Step 3: Publishing modules to $NETWORK...${NC}"
echo "${BLUE}This will publish:${NC}"
echo "  1. groups.move (shared across all apps)"
echo "  2. expense_splitting.move"
echo "  3. private_prediction_refactored.move"
echo ""
echo "${YELLOW}Continue with deployment? (y/n)${NC}"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Publish the modules
aptos move publish \
    --profile $PROFILE \
    --skip-fetch-latest-git-deps \
    --assume-yes

if [ $? -eq 0 ]; then
    echo ""
    echo "${GREEN}✓ Modules published successfully!${NC}"
else
    echo "${YELLOW}✗ Publication failed.${NC}"
    exit 1
fi
echo ""

# ============================================================================
# Step 4: Get Module Address
# ============================================================================

echo "${YELLOW}Step 4: Getting module address...${NC}"
MODULE_ADDRESS=$(aptos config show-profiles --profile $PROFILE | grep "account" | awk '{print $2}')

echo "${GREEN}Module Address: $MODULE_ADDRESS${NC}"
echo ""

# ============================================================================
# Step 5: Initialize Modules
# ============================================================================

echo "${YELLOW}Step 5: Initializing modules...${NC}"
echo "${BLUE}This will call init() on all three modules.${NC}"
echo "${YELLOW}Continue? (y/n)${NC}"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Initialization skipped. You can initialize manually later."
    exit 0
fi

# Initialize groups module
echo "  Initializing groups module..."
aptos move run \
    --function-id ${MODULE_ADDRESS}::groups::init \
    --profile $PROFILE \
    --assume-yes

if [ $? -eq 0 ]; then
    echo "${GREEN}  ✓ Groups module initialized${NC}"
else
    echo "${YELLOW}  ⚠ Groups initialization failed (might already be initialized)${NC}"
fi

# Initialize expense_splitting module
echo "  Initializing expense_splitting module..."
aptos move run \
    --function-id ${MODULE_ADDRESS}::expense_splitting::init \
    --profile $PROFILE \
    --assume-yes

if [ $? -eq 0 ]; then
    echo "${GREEN}  ✓ Expense splitting module initialized${NC}"
else
    echo "${YELLOW}  ⚠ Expense splitting initialization failed (might already be initialized)${NC}"
fi

# Initialize private_prediction_refactored module
echo "  Initializing prediction market module..."
aptos move run \
    --function-id ${MODULE_ADDRESS}::private_prediction_refactored::init \
    --profile $PROFILE \
    --assume-yes

if [ $? -eq 0 ]; then
    echo "${GREEN}  ✓ Prediction market module initialized${NC}"
else
    echo "${YELLOW}  ⚠ Prediction market initialization failed (might already be initialized)${NC}"
fi

echo ""

# ============================================================================
# Deployment Complete
# ============================================================================

echo "========================================="
echo "${GREEN}Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "Module Address: ${GREEN}${MODULE_ADDRESS}${NC}"
echo ""
echo "${BLUE}Next Steps:${NC}"
echo "1. Update your frontend with the module address"
echo "2. Update USDC_METADATA_ADDR in both modules if needed"
echo "3. Create your first group:"
echo "   ${GREEN}groups::create_group(...)${NC}"
echo ""
echo "${BLUE}Key Features:${NC}"
echo "✓ Shared groups across all apps"
echo "✓ Join once, use everywhere"
echo "✓ Expense splitting with multiple split types"
echo "✓ Prediction markets with USDC escrow"
echo "✓ Comprehensive event system for indexing"
echo ""
echo "${BLUE}Documentation:${NC}"
echo "- See EXPENSE_MODULE_README.md for details"
echo "- Check tests/ folder for usage examples"
echo ""
echo "Happy building! 🚀"

