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
    
    // Get public key - check multiple possible locations
    // For Movement network, we need the Ed25519 public key
    let publicKey = '';
    
    // Try different possible locations for the public key
    if ((wallet as any).publicKey) {
      publicKey = (wallet as any).publicKey;
    } else if ((wallet as any).ed25519PublicKey) {
      publicKey = (wallet as any).ed25519PublicKey;
    } else if ((wallet as any).chainType) {
      // Some wallets have chain-specific keys
      const chainType = (wallet as any).chainType;
      if (chainType.publicKey) {
        publicKey = chainType.publicKey;
      }
    } else if ((wallet as any).walletClientType === 'privy') {
      // Try to get from embedded wallet structure
      const embeddedWallet = wallet as any;
      if (embeddedWallet.publicKey) {
        publicKey = embeddedWallet.publicKey;
      }
    }
    
    // Note: Privy's wallets().export() API is not available or requires special permissions
    // It also fails with authorization errors, so we skip it for now
    // The public key must be obtained through other means (client-side SDK, rawSign response, etc.)
    
    // Log for debugging - log the entire wallet object structure
    if (!publicKey) {
      console.warn('[privy-wallet-info] No public key found in wallet object:', {
        walletId,
        address,
        walletKeys: Object.keys(wallet),
        walletType: (wallet as any).walletClientType,
        chainType: (wallet as any).chainType,
        hasExport: typeof (privy.wallets() as any).export === 'function',
      });
      // Only log full wallet structure in development to avoid cluttering logs
      if (process.env.NODE_ENV === 'development') {
        console.log('[privy-wallet-info] Full wallet object:', JSON.stringify(wallet, null, 2));
      }
    } else {
      console.log('[privy-wallet-info] Successfully retrieved public key for walletId:', walletId);
    }

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

