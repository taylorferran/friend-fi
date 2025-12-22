import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/node';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!PRIVY_APP_SECRET) {
  console.warn('PRIVY_APP_SECRET not set - Privy rawSign will not work');
}

/**
 * API route to sign messages using Privy's rawSign
 * This uses Privy's Node.js SDK to sign with embedded wallets
 */
export async function POST(request: NextRequest) {
  if (!PRIVY_APP_SECRET) {
    return NextResponse.json(
      { error: 'Privy not configured' },
      { status: 500 }
    );
  }

  try {
    const { walletId, message } = await request.json();

    if (!walletId || !message) {
      return NextResponse.json(
        { error: 'walletId and message are required' },
        { status: 400 }
      );
    }

    // Initialize Privy client
    const privy = new PrivyClient({
      appId: PRIVY_APP_ID!,
      appSecret: PRIVY_APP_SECRET,
    });

    // Sign the message using Privy's rawSign
    const signatureResponse = await privy.wallets().rawSign(walletId, {
      params: { hash: message },
    });

    // Check if the response includes the public key
    let publicKey = '';
    if (typeof signatureResponse === 'object' && signatureResponse !== null) {
      publicKey = (signatureResponse as any).publicKey || (signatureResponse as any).ed25519PublicKey || '';
    }
    
    const signature = typeof signatureResponse === 'string' 
      ? signatureResponse 
      : (signatureResponse as any).signature || (signatureResponse as any).signatureHex || '';

    // Log the response structure for debugging
    if (!publicKey) {
      console.log('[privy-raw-sign] Signature response structure:', {
        type: typeof signatureResponse,
        isObject: typeof signatureResponse === 'object',
        keys: typeof signatureResponse === 'object' ? Object.keys(signatureResponse as any) : [],
        fullResponse: JSON.stringify(signatureResponse, null, 2),
      });
    }

    return NextResponse.json({ signature, publicKey });
  } catch (error) {
    console.error('Privy rawSign error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sign message' },
      { status: 500 }
    );
  }
}

