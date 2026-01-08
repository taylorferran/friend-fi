import { NextRequest, NextResponse } from 'next/server';

// Shinami Gas Station API endpoint for Movement Testnet
// us1_ prefix keys use the US East region endpoint
const SHINAMI_API_KEY = process.env.SHINAMI_GAS_STATION_API_KEY?.trim();
const SHINAMI_GAS_STATION_URL = 'https://api.us1.shinami.com/movement/gas/v1';

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
    console.log('Request payload:', JSON.stringify(rpcRequest, null, 2));
    
    // Retry logic for network errors
    let lastError: Error | null = null;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(SHINAMI_GAS_STATION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': SHINAMI_API_KEY,
          },
          body: JSON.stringify(rpcRequest),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        const responseText = await response.text();
        
        console.log('Shinami response status:', response.status);
        console.log('Shinami response:', responseText);

        if (!response.ok) {
          // Try to parse error details
          let errorDetails = responseText;
          try {
            const errorJson = JSON.parse(responseText);
            errorDetails = JSON.stringify(errorJson, null, 2);
            console.error('Shinami error details:', errorDetails);
          } catch {
            // Keep as-is if not JSON
          }
          throw new Error(`Shinami API returned ${response.status}: ${errorDetails}`);
        }

        if (!responseText) {
          throw new Error('Empty response from Shinami');
        }

        const result = JSON.parse(responseText);
        
        console.log('Shinami result:', JSON.stringify(result, null, 2));

        if (result.error) {
          console.error('Shinami error:', result.error);
          throw new Error(result.error.message || JSON.stringify(result.error));
        }

        // Shinami returns { result: { pendingTransaction: { hash, ... } } }
        const pendingTransaction = result.result?.pendingTransaction;
        
        if (!pendingTransaction?.hash) {
          console.error('Unexpected Shinami response structure:', result);
          throw new Error('Invalid response from Shinami - missing transaction hash');
        }

        console.log('Transaction successful! Hash:', pendingTransaction.hash);

        // Return the pending transaction with hash
        return NextResponse.json({ pendingTx: pendingTransaction });
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on non-network errors
        if (!lastError.message.includes('fetch failed') && 
            !lastError.message.includes('ECONNRESET') &&
            !lastError.message.includes('timeout')) {
          break;
        }
        
        // If this isn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500; // 500ms, 1000ms
          console.log(`Shinami connection failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    throw lastError;
  } catch (error) {
    console.error('Error sponsoring transaction:', error);
    
    const message = error instanceof Error ? error.message : 'Failed to sponsor transaction';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

