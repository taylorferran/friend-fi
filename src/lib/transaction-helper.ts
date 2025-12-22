/**
 * Transaction Helper for Hybrid On-Chain + Off-Chain Operations
 * 
 * Pattern: On-chain first (source of truth), then Supabase (metadata)
 * If Supabase fails, log error but don't fail the operation
 */

export interface HybridTransactionResult<T> {
  onChainResult: T;
  supabaseSuccess: boolean;
  supabaseError?: Error;
}

/**
 * Execute a hybrid transaction (on-chain + Supabase)
 * 
 * @param onChainFn - Function that executes on-chain transaction
 * @param supabaseFn - Function that writes metadata to Supabase
 * @param operationName - Name of the operation (for logging)
 * @returns On-chain result (throws if on-chain fails)
 */
export async function executeHybridTransaction<T>(
  onChainFn: () => Promise<T>,
  supabaseFn: (result: T) => Promise<void>,
  operationName: string
): Promise<T> {
  try {
    // Step 1: On-chain transaction (critical - must succeed)
    console.log(`[${operationName}] 🔗 Executing on-chain transaction...`);
    const onChainResult = await onChainFn();
    console.log(`[${operationName}] ✅ On-chain transaction successful`);
    
    // Step 2: Supabase write (best effort - log if fails)
    try {
      console.log(`[${operationName}] 💾 Writing metadata to Supabase...`);
      await supabaseFn(onChainResult);
      console.log(`[${operationName}] ✅ Supabase write successful`);
    } catch (supabaseError) {
      // Don't fail the operation if Supabase fails
      // Data can be recovered from on-chain events later
      console.error(`[${operationName}] ⚠️ Supabase write failed (non-critical):`, supabaseError);
      
      // In production: Send to error tracking service (Sentry, etc.)
      // For now, just log it
    }
    
    return onChainResult;
  } catch (onChainError) {
    // On-chain failure is critical - propagate error
    console.error(`[${operationName}] ❌ On-chain transaction failed:`, onChainError);
    throw onChainError;
  }
}

/**
 * Execute a Supabase-first operation (for non-financial operations)
 * Falls back to on-chain if Supabase is unavailable
 * 
 * @param supabaseFn - Function that queries Supabase
 * @param onChainFallbackFn - Function that queries on-chain (fallback)
 * @param operationName - Name of the operation (for logging)
 * @returns Data from Supabase or on-chain fallback
 */
export async function executeWithFallback<T>(
  supabaseFn: () => Promise<T | null>,
  onChainFallbackFn: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    console.log(`[${operationName}] 💾 Querying Supabase...`);
    const supabaseResult = await supabaseFn();
    
    if (supabaseResult !== null) {
      console.log(`[${operationName}] ✅ Supabase hit`);
      return supabaseResult;
    }
    
    console.log(`[${operationName}] ⚠️ No data in Supabase, falling back to on-chain...`);
  } catch (supabaseError) {
    console.warn(`[${operationName}] ⚠️ Supabase query failed, falling back to on-chain:`, supabaseError);
  }
  
  // Fallback to on-chain
  console.log(`[${operationName}] 🔗 Querying on-chain...`);
  const onChainResult = await onChainFallbackFn();
  console.log(`[${operationName}] ✅ On-chain fallback successful`);
  
  return onChainResult;
}

/**
 * Retry a function with exponential backoff
 * Useful for Supabase operations that might be temporarily unavailable
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

