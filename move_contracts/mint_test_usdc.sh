#!/bin/bash
# Mint Test USDC Helper Script
# Usage: ./mint_test_usdc.sh <address> <amount_in_usdc>

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <address> <amount_in_usdc>"
    echo "Example: $0 0x123... 1000"
    echo "This will mint 1000 test USDC to the address"
    exit 1
fi

ADDRESS=$1
AMOUNT_USDC=$2

# Convert to micro-USDC (6 decimals)
AMOUNT_MICRO=$(echo "$AMOUNT_USDC * 1000000" | bc)

echo "Minting $AMOUNT_USDC test USDC ($AMOUNT_MICRO micro-USDC) to $ADDRESS..."

movement move run \
  --function-id 0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::test_usdc::mint \
  --args address:$ADDRESS u64:$AMOUNT_MICRO \
  --assume-yes

echo "✅ Done! Minted $AMOUNT_USDC test USDC"

