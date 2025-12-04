import { NextRequest, NextResponse } from 'next/server';

// Shinami Gas Station API endpoint for Movement Testnet
// Format: https://api.shinami.com/movement/gas/v1/{api_key}
const SHINAMI_API_KEY = process.env.SHINAMI_GAS_STATION_API_KEY;
const SHINAMI_GAS_STATION_URL = `https://api.shinami.com/movement/gas/v1/${SHINAMI_API_KEY}`;

export async function POST(request: NextRequest) {
  try {
    if (!SHINAMI_API_KEY) {
      console.error('SHINAMI_GAS_STATION_API_KEY is not set');
      return NextResponse.json(
        { error: 'Gas station not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { transaction, senderAuth } = body;

    if (!transaction || !senderAuth) {
      return NextResponse.json(
        { error: 'Missing transaction or senderAuth' },
        { status: 400 }
      );
    }

    // Call Shinami Gas Station API directly using JSON-RPC
    const rpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'gas_sponsorAndSubmitSignedTransaction',
      params: [transaction, senderAuth],
    };

    console.log('Calling Shinami Gas Station...');
    console.log('Request body:', JSON.stringify(rpcRequest, null, 2));
    
    const response = await fetch(SHINAMI_GAS_STATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcRequest),
    });

    console.log('Shinami response status:', response.status);
    
    const responseText = await response.text();
    console.log('Shinami response body:', responseText);

    if (!response.ok) {
      throw new Error(`Shinami API returned ${response.status}: ${responseText}`);
    }

    if (!responseText) {
      throw new Error('Empty response from Shinami');
    }

    const result = JSON.parse(responseText);

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    // Return the PendingTransactionResponse
    return NextResponse.json({ pendingTx: result.result });
  } catch (error) {
    console.error('Error sponsoring transaction:', error);
    
    const message = error instanceof Error ? error.message : 'Failed to sponsor transaction';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

