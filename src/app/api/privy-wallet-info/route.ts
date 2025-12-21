import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/node';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!PRIVY_APP_SECRET) {
  console.warn('PRIVY_APP_SECRET not set - Privy wallet info will not work');
}

/**
 * API route to get wallet information from Privy
 * Returns walletId, address, and public key for Movement network
 */
export async function POST(request: NextRequest) {
  if (!PRIVY_APP_SECRET) {
    return NextResponse.json(
      { error: 'Privy not configured' },
      { status: 500 }
    );
  }

  try {
    const { walletId } = await request.json();

    if (!walletId) {
      return NextResponse.json(
        { error: 'walletId is required' },
        { status: 400 }
      );
    }

    // Initialize Privy client
    const privy = new PrivyClient({
      appId: PRIVY_APP_ID!,
      appSecret: PRIVY_APP_SECRET,
    });

    // Get wallet details from Privy
    const wallet = await privy.wallets().get(walletId);

    // Extract address and public key
    // For Movement network, the wallet should have Ed25519 keys
    const address = wallet.address;
    
    // Get public key - this might be in wallet.chainType or wallet.publicKey
    // For Movement network, we need the Ed25519 public key
    const publicKey = (wallet as any).publicKey || (wallet as any).ed25519PublicKey || '';

    return NextResponse.json({
      walletId,
      address,
      publicKey,
    });
  } catch (error) {
    console.error('Privy wallet info error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get wallet info' },
      { status: 500 }
    );
  }
}

