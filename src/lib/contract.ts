import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { getGroupFromSupabase, getProfileFromSupabase, getBetFromSupabase } from './supabase-services';
import { executeWithFallback } from './transaction-helper';

// Contract configuration - NEW MODULAR ARCHITECTURE (ALL 4 MODULES)
export const CONTRACT_ADDRESS = "0x92fc2d6ee1330193f039a0f87b221743ec77ac08e640a1470d4f45c566783448";

// Module names
export const GROUPS_MODULE = "groups";
export const PREDICTION_MODULE = "private_prediction_refactored";
export const EXPENSE_MODULE = "expense_splitting";
export const HABIT_MODULE = "habit_tracker";

// Movement Testnet configuration
const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: "https://testnet.movementnetwork.xyz/v1",
  indexer: "https://indexer.testnet.movementnetwork.xyz/v1/graphql",
});

export const aptos = new Aptos(config);

// Helper to build function ID for a specific module
export function getFunctionId(moduleName: string, functionName: string): `${string}::${string}::${string}` {
  return `${CONTRACT_ADDRESS}::${moduleName}::${functionName}`;
}

// ============================================================================
// GROUPS MODULE - View Functions
// ============================================================================

export async function getGroupsCount(): Promise<number> {
  try {
    // Groups are now 100% off-chain in Supabase
    const { supabase } = await import('./supabase');
    const { count, error } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error("Error getting groups count:", error);
    return 0;
  }
}

export async function getGroupName(groupId: number): Promise<string> {
  try {
    console.log('[getGroupName] 💾 Querying Supabase...');
    // Groups are now 100% off-chain in Supabase
    const { getGroupFromSupabase } = await import('./supabase-services');
    const group = await getGroupFromSupabase(groupId);
    console.log('[getGroupName] ✅ Supabase hit');
    return group?.name || `Group #${groupId}`;
  } catch (error) {
    console.error("[getGroupName] Error:", error);
    return `Group #${groupId}`;
  }
}

export async function getGroupDescription(groupId: number): Promise<string> {
  try {
    // Groups are now 100% off-chain in Supabase
    const { getGroupFromSupabase } = await import('./supabase-services');
    const group = await getGroupFromSupabase(groupId);
    return group?.description || "";
  } catch (error) {
    console.error("Error getting group description:", error);
    return "";
  }
}

export async function getGroupMembers(groupId: number): Promise<string[]> {
  try {
    console.log('[getGroupMembers] 💾 Querying Supabase for group:', groupId);
    // Groups are now 100% off-chain in Supabase
    const { getGroupMembersFromSupabase } = await import('./supabase-services');
    const members = await getGroupMembersFromSupabase(groupId);
    console.log('[getGroupMembers] ✅ Got members:', members.length);
    return members.map(m => m.wallet_address);
  } catch (error) {
    console.error("[getGroupMembers] ❌ Error getting group members:", error);
    return [];
  }
}

export async function checkIfMemberInGroup(groupId: number, memberAddress: string): Promise<boolean> {
  try {
    // Groups are now 100% off-chain in Supabase
    const { getGroupMembersFromSupabase } = await import('./supabase-services');
    const members = await getGroupMembersFromSupabase(groupId);
    
    // Normalize both addresses for comparison (remove 0x, lowercase)
    const normalizedMember = memberAddress.toLowerCase().replace('0x', '');
    
    return members.some(m => {
      const normalizedCheck = m.wallet_address.toLowerCase().replace('0x', '');
      return normalizedCheck === normalizedMember;
    });
  } catch (error) {
    console.error("Error checking membership:", error);
    return false;
  }
}

// Cache and mutex for profile lookups to prevent duplicate concurrent calls
const profileCache = new Map<string, { name: string; avatarId: number; exists: boolean; timestamp: number }>();
const profileMutex = new Map<string, Promise<{ name: string; avatarId: number; exists: boolean }>>();
const CACHE_TTL = 10000; // 10 seconds cache

// Normalize address consistently
function normalizeAddressForProfile(address: string): string {
  if (!address) return address;
  return address.startsWith('0x') 
    ? `0x${address.slice(2).padStart(64, '0')}`
    : `0x${address.padStart(64, '0')}`;
}

/**
 * Try to get profile with multiple address formats
 * This is a fallback when we don't have the public key to derive the exact address
 */
export async function getProfileWithFallback(
  ethereumAddress: string,
  publicKey?: string
): Promise<{ name: string; avatarId: number; exists: boolean }> {
  // If we have public key, derive the actual address
  if (publicKey) {
    try {
      const { deriveAptosAddressFromPublicKey } = await import('@/lib/address-utils');
      const derivedAddress = deriveAptosAddressFromPublicKey(publicKey);
      const profile = await getProfile(derivedAddress);
      if (profile.exists) {
        return profile;
      }
    } catch (error) {
      console.warn('[getProfileWithFallback] Failed to derive address, trying padded address:', error);
    }
  }
  
  // Fallback to padded address
  const paddedAddress = normalizeAddressForProfile(ethereumAddress);
  return getProfile(paddedAddress);
}

export async function getProfile(address: string): Promise<{ name: string; avatarId: number; exists: boolean }> {
  if (!address) {
    console.warn("[getProfile] Called with empty address");
    return { name: "", avatarId: 0, exists: false };
  }

  // Normalize address for cache/mutex key
  const normalizedAddress = normalizeAddressForProfile(address);
  
  // Check cache first (before mutex check)
  const cached = profileCache.get(normalizedAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[getProfile] Cache hit for ${normalizedAddress.substring(0, 20)}...`);
    return { name: cached.name, avatarId: cached.avatarId, exists: cached.exists };
  }
  
  // Check if there's already a pending request for this address
  const pendingRequest = profileMutex.get(normalizedAddress);
  if (pendingRequest) {
    console.log(`[getProfile] Reusing pending request for ${normalizedAddress.substring(0, 20)}...`);
    // Await the pending request - it will return the same result for all concurrent callers
    const result = await pendingRequest;
    // After awaiting, check cache again in case it was set while we were waiting
    const freshCache = profileCache.get(normalizedAddress);
    if (freshCache && Date.now() - freshCache.timestamp < CACHE_TTL) {
      console.log(`[getProfile] Using fresh cache after pending request for ${normalizedAddress.substring(0, 20)}...`);
      return { name: freshCache.name, avatarId: freshCache.avatarId, exists: freshCache.exists };
    }
    return result;
  }

  // Create new request
  const requestPromise = (async () => {
    let profile: { name: string; avatarId: number; exists: boolean };
    
    try {
      console.log(`[getProfile] NEW request from Supabase: original=${address}, normalized=${normalizedAddress.substring(0, 20)}...`);
      
      // ✅ Fetch from Supabase (off-chain)
      const supabaseProfile = await getProfileFromSupabase(normalizedAddress);
      
      if (supabaseProfile) {
        profile = {
          name: supabaseProfile.name || "",
          avatarId: supabaseProfile.avatar_id || 0,
          exists: true,
        };
      } else {
        profile = { name: "", avatarId: 0, exists: false };
      }
      
    } catch (error) {
      // Log the error but don't throw - return empty profile
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[getProfile] Supabase ERROR for ${normalizedAddress.substring(0, 20)}...:`, errorMessage);
      
      profile = { name: "", avatarId: 0, exists: false };
    }
    
    // Cache the result IMMEDIATELY (synchronously) so concurrent requests can use it
    // This must happen before removing from mutex
    const cacheEntry = {
      ...profile,
      timestamp: Date.now(),
    };
    profileCache.set(normalizedAddress, cacheEntry);
    
    // Remove from mutex AFTER caching (so cache is available for concurrent requests)
    profileMutex.delete(normalizedAddress);
    
    return profile;
  })();
  
  // Store in mutex BEFORE returning
  profileMutex.set(normalizedAddress, requestPromise);
  
  return requestPromise;
}

// ============================================================================
// GROUPS MODULE - Transaction Builders
// ============================================================================
// Note: Groups are now 100% off-chain (Supabase)
// No on-chain group transactions needed - see supabase-services.ts

// ============================================================================
// PREDICTION MODULE - View Functions
// ============================================================================

export async function getBetsCount(): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_bets_count"),
        typeArguments: [],
        functionArguments: [],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting bets count:", error);
    return 0;
  }
}

export async function getGroupBets(groupId: number): Promise<number[]> {
  try {
    console.log('[getGroupBets] Fetching bets for group:', groupId);
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_group_bets"),
        typeArguments: [],
        functionArguments: [groupId.toString()],
      },
    });
    console.log('[getGroupBets] ✅ Got bets:', result[0]);
    return (result[0] as string[]).map(Number);
  } catch (error: any) {
    // If error is MISSING_DATA, it means no bets have been created yet for this group
    if (error?.message?.includes('MISSING_DATA')) {
      console.log('[getGroupBets] No bets initialized yet for group:', groupId);
      return [];
    }
    console.error("[getGroupBets] Error getting group bets:", error);
    return [];
  }
}

export async function getBetDescription(betId: number): Promise<string> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_bet_description"),
        typeArguments: [],
        functionArguments: [betId.toString()],
      },
    });
    return result[0] as string;
  } catch (error) {
    console.error("Error getting bet description:", error);
    return "";
  }
}

export async function getBetGroupId(betId: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_bet_group_id"),
        typeArguments: [],
        functionArguments: [betId.toString()],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting bet group_id:", error);
    return 0;
  }
}

export async function getBetAdmin(betId: number): Promise<string> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_bet_admin"),
        typeArguments: [],
        functionArguments: [betId.toString()],
      },
    });
    return result[0] as string;
  } catch (error) {
    console.error("Error getting bet admin:", error);
    return "";
  }
}

export async function getBetOutcomesLength(betId: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_bet_outcomes_length"),
        typeArguments: [],
        functionArguments: [betId.toString()],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting bet outcomes length:", error);
    return 0;
  }
}

export async function getBetOutcome(betId: number, outcomeIndex: number): Promise<string> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_bet_outcome"),
        typeArguments: [],
        functionArguments: [betId.toString(), outcomeIndex.toString()],
      },
    });
    return result[0] as string;
  } catch (error) {
    console.error("Error getting bet outcome:", error);
    return "";
  }
}

export async function getBetOutcomePool(betId: number, outcomeIndex: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_bet_outcome_pool"),
        typeArguments: [],
        functionArguments: [betId.toString(), outcomeIndex.toString()],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting bet outcome pool:", error);
    return 0;
  }
}

export async function getBetTotalPool(betId: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_bet_total_pool"),
        typeArguments: [],
        functionArguments: [betId.toString()],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting bet total pool:", error);
    return 0;
  }
}

export async function isBetResolved(betId: number): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "is_bet_resolved"),
        typeArguments: [],
        functionArguments: [betId.toString()],
      },
    });
    return result[0] as boolean;
  } catch (error) {
    console.error("Error checking if bet resolved:", error);
    return false;
  }
}

export async function getWinningOutcome(betId: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_winning_outcome"),
        typeArguments: [],
        functionArguments: [betId.toString()],
      },
    });
    return Number(result[0]);
  } catch (error: any) {
    // If error contains "ABORTED" with sub_status 20, it means bet hasn't been resolved yet
    // This is EXPECTED for unresolved bets - don't log as error
    if (error?.message?.includes('ABORTED') || error?.message?.includes('sub_status: Some(20)')) {
      return -1; // Return -1 to indicate no winner yet
    }
    // Only log unexpected errors
    console.error("Error getting winning outcome:", error);
    return -1; // Default to no winner
  }
}

export async function getUserWager(betId: number, userAddress: string): Promise<number> {
  try {
    // Pad address to Aptos format (64 hex chars) if needed
    const normalizedAddress = userAddress.startsWith('0x') 
      ? `0x${userAddress.slice(2).padStart(64, '0')}`
      : `0x${userAddress.padStart(64, '0')}`;
    
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_user_wager"),
        typeArguments: [],
        functionArguments: [betId.toString(), normalizedAddress],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting user wager:", error);
    return 0;
  }
}

export async function getUserWagerOutcome(betId: number, userAddress: string): Promise<{ outcomeIndex: number; hasWager: boolean }> {
  try {
    // Pad address to Aptos format (64 hex chars) if needed
    const normalizedAddress = userAddress.startsWith('0x') 
      ? `0x${userAddress.slice(2).padStart(64, '0')}`
      : `0x${userAddress.padStart(64, '0')}`;
    
    const result = await aptos.view({
      payload: {
        function: getFunctionId(PREDICTION_MODULE, "get_user_wager_outcome"),
        typeArguments: [],
        functionArguments: [betId.toString(), normalizedAddress],
      },
    });
    return {
      outcomeIndex: Number(result[0]),
      hasWager: result[1] as boolean,
    };
  } catch (error) {
    console.error("Error getting user wager outcome:", error);
    return { outcomeIndex: 0, hasWager: false };
  }
}

// ============================================================================
// PREDICTION MODULE - Transaction Builders
// ============================================================================

export function buildCreateBetPayload(
  groupId: number,
  signature: string,
  expiresAtMs: number,
  description: string,
  outcomes: string[],
  adminAddress: string,
  encryptedPayload: number[] = []
) {
  // Pad address to Aptos format (64 hex chars) if needed
  const normalizedAddress = adminAddress.startsWith('0x') 
    ? `0x${adminAddress.slice(2).padStart(64, '0')}`
    : `0x${adminAddress.padStart(64, '0')}`;
  
  // Convert hex signature to byte array (Ed25519 signatures are 64 bytes)
  const signatureBytes = Uint8Array.from(
    Buffer.from(signature.startsWith('0x') ? signature.slice(2) : signature, 'hex')
  );

  return {
    function: getFunctionId(PREDICTION_MODULE, "create_bet"),
    typeArguments: [],
    functionArguments: [
      groupId.toString(),           // 1. group_id
      Array.from(signatureBytes),   // 2. signature (vector<u8>)
      expiresAtMs.toString(),       // 3. expires_at_ms
      description,                  // 4. description (String)
      outcomes,                     // 5. outcomes (vector<String>)
      normalizedAddress,            // 6. admin address
      encryptedPayload,             // 7. encrypted_payload (vector<u8>)
    ],
  };
}

export function buildCreateBetWithWagerPayload(
  groupId: number,
  signature: string,
  expiresAtMs: number,
  description: string,
  outcomes: string[],
  adminAddress: string,
  encryptedPayload: number[] = [],
  initialOutcomeIndex: number,
  initialWagerAmount: number  // in micro-USDC
) {
  // Pad address to Aptos format (64 hex chars) if needed
  const normalizedAddress = adminAddress.startsWith('0x') 
    ? `0x${adminAddress.slice(2).padStart(64, '0')}`
    : `0x${adminAddress.padStart(64, '0')}`;
  
  // Convert hex signature to byte array (Ed25519 signatures are 64 bytes)
  const signatureBytes = Uint8Array.from(
    Buffer.from(signature.startsWith('0x') ? signature.slice(2) : signature, 'hex')
  );

  return {
    function: getFunctionId(PREDICTION_MODULE, "create_bet_with_wager"),
    typeArguments: [],
    functionArguments: [
      groupId.toString(),              // 1. group_id
      Array.from(signatureBytes),      // 2. signature (vector<u8>)
      expiresAtMs.toString(),          // 3. expires_at_ms
      description,                     // 4. description (String)
      outcomes,                        // 5. outcomes (vector<String>)
      normalizedAddress,               // 6. admin address
      encryptedPayload,                // 7. encrypted_payload (vector<u8>)
      initialOutcomeIndex.toString(),  // 8. initial_outcome_index
      initialWagerAmount.toString(),   // 9. initial_wager_amount (u64)
    ],
  };
}
    Buffer.from(signature.replace(/^0x/, ''), 'hex')
  );
  
  return {
    function: getFunctionId(PREDICTION_MODULE, "create_bet"),
    typeArguments: [],
    functionArguments: [
      groupId.toString(),
      Array.from(signatureBytes), // Must be byte array
      expiresAtMs.toString(),
      description,
      outcomes,
      normalizedAddress,
      encryptedPayload.map(n => n.toString())
    ],
  };
}

export function buildPlaceWagerPayload(
  betId: number,
  outcomeIndex: number,
  amount: number,
  signature: string,
  expiresAtMs: number
) {
  // Convert hex signature to byte array (Ed25519 signatures are 64 bytes)
  const signatureBytes = Uint8Array.from(
    Buffer.from(signature.replace(/^0x/, ''), 'hex')
  );
  
  return {
    function: getFunctionId(PREDICTION_MODULE, "place_wager"),
    typeArguments: [],
    functionArguments: [
      betId.toString(),
      outcomeIndex.toString(),
      amount.toString(),
      Array.from(signatureBytes), // Must be byte array
      expiresAtMs.toString()
    ],
  };
}

export function buildResolveBetPayload(
  betId: number,
  winningOutcomeIndex: number
) {
  return {
    function: getFunctionId(PREDICTION_MODULE, "resolve_bet"),
    typeArguments: [],
    functionArguments: [betId.toString(), winningOutcomeIndex.toString()],
  };
}

export function buildCancelWagerPayload(betId: number) {
  return {
    function: getFunctionId(PREDICTION_MODULE, "cancel_wager"),
    typeArguments: [],
    functionArguments: [betId.toString()],
  };
}

// ============================================================================
// EXPENSE MODULE - View Functions
// ============================================================================

export async function getUserBalance(groupId: number, userAddress: string): Promise<{ balance: number; isOwed: boolean }> {
  try {
    // Pad address to Aptos format (64 hex chars) if needed
    const normalizedAddress = userAddress.startsWith('0x') 
      ? `0x${userAddress.slice(2).padStart(64, '0')}`
      : `0x${userAddress.padStart(64, '0')}`;
    
    const result = await aptos.view({
      payload: {
        function: getFunctionId(EXPENSE_MODULE, "get_user_balance"),
        typeArguments: [],
        functionArguments: [groupId.toString(), normalizedAddress],
      },
    });
    return {
      balance: Number(result[0]),
      isOwed: result[1] as boolean,
    };
  } catch (error) {
    console.error("Error getting user balance:", error);
    return { balance: 0, isOwed: false };
  }
}

export async function getGroupDebts(groupId: number): Promise<{ debtors: string[]; creditors: string[]; amounts: number[] }> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(EXPENSE_MODULE, "get_group_debts"),
        typeArguments: [],
        functionArguments: [groupId.toString()],
      },
    });
    return {
      debtors: result[0] as string[],
      creditors: result[1] as string[],
      amounts: (result[2] as string[]).map(Number),
    };
  } catch (error) {
    console.error("Error getting group debts:", error);
    return { debtors: [], creditors: [], amounts: [] };
  }
}

export async function getGroupExpensesCount(groupId: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(EXPENSE_MODULE, "get_group_expenses_count"),
        typeArguments: [],
        functionArguments: [groupId.toString()],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting group expenses count:", error);
    return 0;
  }
}

// ============================================================================
// EXPENSE MODULE - Transaction Builders
// ============================================================================

export function buildCreateExpenseEqualPayload(
  groupId: number,
  description: string,
  totalAmount: number,
  participants: string[],
  signature: string,
  expiresAtMs: number
) {
  // Convert hex signature to byte array
  const signatureBytes = Uint8Array.from(
    Buffer.from(signature.replace(/^0x/, ''), 'hex')
  );
  
  return {
    function: getFunctionId(EXPENSE_MODULE, "create_expense_equal"),
    typeArguments: [],
    functionArguments: [
      groupId.toString(),           // 1. group_id
      Array.from(signatureBytes),   // 2. backend_signature
      expiresAtMs.toString(),       // 3. expires_at_ms
      description,                  // 4. description
      totalAmount.toString(),       // 5. total_amount
      participants,                 // 6. participants
    ],
  };
}

export function buildCreateExpenseExactPayload(
  groupId: number,
  description: string,
  totalAmount: number,
  participants: string[],
  amounts: number[]
) {
  return {
    function: getFunctionId(EXPENSE_MODULE, "create_expense_exact"),
    typeArguments: [],
    functionArguments: [
      groupId.toString(),
      description,
      totalAmount.toString(),
      participants,
      amounts.map(a => a.toString())
    ],
  };
}

export function buildSettleDebtPayload(
  groupId: number,
  creditor: string,
  amount: number
) {
  return {
    function: getFunctionId(EXPENSE_MODULE, "settle_debt_with_usdc"),
    typeArguments: [],
    functionArguments: [groupId.toString(), creditor, amount.toString()],
  };
}

export function buildMarkDebtSettledPayload(
  groupId: number,
  debtor: string,
  amount: number
) {
  return {
    function: getFunctionId(EXPENSE_MODULE, "mark_debt_settled"),
    typeArguments: [],
    functionArguments: [groupId.toString(), debtor, amount.toString()],
  };
}

// ============================================================================
// HABIT TRACKER MODULE - View Functions
// ============================================================================

export async function getGroupCommitmentsCount(groupId: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(HABIT_MODULE, "get_group_commitments_count"),
        typeArguments: [],
        functionArguments: [groupId.toString()],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting group commitments count:", error);
    return 0;
  }
}

export async function getCommitmentDetails(groupId: number, commitmentLocalId: number): Promise<{
  participantA: string;
  participantB: string;
  weeklyPayout: number;
  weeklyCheckInsRequired: number;
  accepted: boolean;
  valid: boolean;
  commitmentName: string;
  startTime: number;
  durationWeeks: number;
} | null> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(HABIT_MODULE, "get_commitment_details"),
        typeArguments: [],
        functionArguments: [groupId.toString(), commitmentLocalId.toString()],
      },
    });
    return {
      participantA: result[0] as string,
      participantB: result[1] as string,
      weeklyPayout: Number(result[2]),
      weeklyCheckInsRequired: Number(result[3]),
      accepted: result[4] as boolean,
      valid: result[5] as boolean,
      commitmentName: result[6] as string,
      startTime: Number(result[7]),
      durationWeeks: Number(result[8]),
    };
  } catch (error) {
    console.error("Error getting commitment details:", error);
    return null;
  }
}

export async function getWeeklyCheckIns(groupId: number, commitmentLocalId: number, week: number, participant: string): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(HABIT_MODULE, "get_weekly_check_ins"),
        typeArguments: [],
        functionArguments: [groupId.toString(), commitmentLocalId.toString(), week.toString(), participant],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting weekly check-ins:", error);
    return 0;
  }
}

export async function getCurrentWeek(groupId: number, commitmentLocalId: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(HABIT_MODULE, "get_current_week"),
        typeArguments: [],
        functionArguments: [groupId.toString(), commitmentLocalId.toString()],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting current week:", error);
    return 0;
  }
}

export async function getUserCommitments(groupId: number, userAddress: string): Promise<number[]> {
  try {
    // Pad address to Aptos format (64 hex chars) if needed
    const normalizedAddress = userAddress.startsWith('0x') 
      ? `0x${userAddress.slice(2).padStart(64, '0')}`
      : `0x${userAddress.padStart(64, '0')}`;
    
    const result = await aptos.view({
      payload: {
        function: getFunctionId(HABIT_MODULE, "get_user_commitments"),
        typeArguments: [],
        functionArguments: [groupId.toString(), normalizedAddress],
      },
    });
    return (result[0] as string[]).map(Number);
  } catch (error) {
    console.error("Error getting user commitments:", error);
    return [];
  }
}

export async function isWeekProcessed(groupId: number, commitmentLocalId: number, week: number): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId(HABIT_MODULE, "is_week_processed"),
        typeArguments: [],
        functionArguments: [groupId.toString(), commitmentLocalId.toString(), week.toString()],
      },
    });
    return result[0] as boolean;
  } catch (error) {
    console.error("Error checking if week processed:", error);
    return false;
  }
}

// ============================================================================
// HABIT TRACKER MODULE - Transaction Builders
// ============================================================================

export function buildCreateCommitmentPayload(
  groupId: number,
  signature: string,
  expiresAtMs: number,
  participantB: string,
  weeklyPayout: number,
  weeklyCheckInsRequired: number,
  durationWeeks: number,
  commitmentName: string
) {
  // Pad address to Aptos format (64 hex chars) if needed
  const normalizedAddress = participantB.startsWith('0x') 
    ? `0x${participantB.slice(2).padStart(64, '0')}`
    : `0x${participantB.padStart(64, '0')}`;
  
  // Convert hex signature to byte array
  const signatureBytes = Uint8Array.from(
    Buffer.from(signature.replace(/^0x/, ''), 'hex')
  );
  
  return {
    function: getFunctionId(HABIT_MODULE, "create_commitment"),
    typeArguments: [],
    functionArguments: [
      groupId.toString(),
      Array.from(signatureBytes),
      expiresAtMs.toString(),
      normalizedAddress,
      weeklyPayout.toString(),
      weeklyCheckInsRequired.toString(),
      durationWeeks.toString(),
      commitmentName
    ],
  };
}

export function buildAcceptCommitmentPayload(
  groupId: number,
  signature: string,
  expiresAtMs: number,
  commitmentLocalId: number
) {
  // Convert hex signature to byte array
  const signatureBytes = Uint8Array.from(
    Buffer.from(signature.replace(/^0x/, ''), 'hex')
  );
  
  return {
    function: getFunctionId(HABIT_MODULE, "accept_commitment"),
    typeArguments: [],
    functionArguments: [
      groupId.toString(),
      Array.from(signatureBytes),
      expiresAtMs.toString(),
      commitmentLocalId.toString()
    ],
  };
}

export function buildCheckInPayload(groupId: number, commitmentLocalId: number) {
  return {
    function: getFunctionId(HABIT_MODULE, "check_in"),
    typeArguments: [],
    functionArguments: [groupId.toString(), commitmentLocalId.toString()],
  };
}

export function buildProcessWeekPayload(groupId: number, commitmentLocalId: number, week: number) {
  return {
    function: getFunctionId(HABIT_MODULE, "process_week"),
    typeArguments: [],
    functionArguments: [groupId.toString(), commitmentLocalId.toString(), week.toString()],
  };
}

export function buildDeleteCommitmentPayload(groupId: number, commitmentLocalId: number) {
  return {
    function: getFunctionId(HABIT_MODULE, "delete_commitment"),
    typeArguments: [],
    functionArguments: [groupId.toString(), commitmentLocalId.toString()],
  };
}

// ============================================================================
// HELPER TYPES AND FUNCTIONS
// ============================================================================

export interface BetData {
  id: number;
  groupId: number;
  description: string;
  admin: string;
  outcomes: { label: string; pool: number }[];
  totalPool: number;
  resolved: boolean;
  winningOutcomeIndex: number;
}

export async function getBetData(betId: number): Promise<BetData | null> {
  try {
    const [description, admin, groupId, outcomesLength, totalPool, resolved, winningOutcomeIndex] = await Promise.all([
      getBetDescription(betId),
      getBetAdmin(betId),
      getBetGroupId(betId),
      getBetOutcomesLength(betId),
      getBetTotalPool(betId),
      isBetResolved(betId),
      getWinningOutcome(betId),
    ]);

    // Fetch ALL outcomes in PARALLEL
    const outcomeIndices = Array.from({ length: outcomesLength }, (_, i) => i);
    const outcomeResults = await Promise.all(
      outcomeIndices.map(async (i) => {
        const [label, pool] = await Promise.all([
          getBetOutcome(betId, i),
          getBetOutcomePool(betId, i),
        ]);
        return { label, pool };
      })
    );

    return {
      id: betId,
      groupId,
      description,
      admin,
      outcomes: outcomeResults,
      totalPool,
      resolved,
      winningOutcomeIndex,
    };
  } catch (error) {
    console.error("Error getting bet data:", error);
    return null;
  }
}

export interface WagerInfo {
  address: string;
  amount: number;
  outcomeIndex: number;
  profile?: {
    name: string;
    avatarId: number;
  };
}

export async function getUserWagerWithProfile(betId: number, userAddress: string): Promise<WagerInfo | null> {
  try {
    const [wagerAmount, wagerOutcome, profile] = await Promise.all([
      getUserWager(betId, userAddress),
      getUserWagerOutcome(betId, userAddress),
      getProfile(userAddress),
    ]);
    
    if (wagerAmount === 0 || !wagerOutcome.hasWager) return null;
    
    return {
      address: userAddress,
      amount: wagerAmount,
      outcomeIndex: wagerOutcome.outcomeIndex,
      profile: profile.exists ? { name: profile.name, avatarId: profile.avatarId } : undefined,
    };
  } catch (error) {
    console.error("Error getting user wager with profile:", error);
    return null;
  }
}

export async function getProfiles(addresses: string[]): Promise<Map<string, { name: string; avatarId: number }>> {
  const profiles = new Map<string, { name: string; avatarId: number }>();
  
  await Promise.all(
    addresses.map(async (address) => {
      try {
        const profile = await getProfile(address);
        if (profile.exists) {
          // Store with original address (not normalized) for lookup
          profiles.set(address, { name: profile.name, avatarId: profile.avatarId });
        }
      } catch (error) {
        console.error(`Error getting profile for ${address}:`, error);
      }
    })
  );
  
  return profiles;
}

export interface GroupData {
  id: number;
  name: string;
  members: string[];
  betIds: number[];
}

export async function getGroupData(groupId: number): Promise<GroupData | null> {
  try {
    const [name, members, betIds] = await Promise.all([
      getGroupName(groupId),
      getGroupMembers(groupId),
      getGroupBets(groupId),
    ]);

    return {
      id: groupId,
      name,
      members,
      betIds,
    };
  } catch (error) {
    console.error("Error getting group data:", error);
    return null;
  }
}

// ============================================================================
// HABIT TRACKER MODULE - Helper Types and Functions
// ============================================================================

export interface CommitmentData {
  id: number;
  participantA: string;
  participantB: string;
  weeklyPayout: number;
  weeklyCheckInsRequired: number;
  accepted: boolean;
  valid: boolean;
  commitmentName: string;
  startTime: number;
  durationWeeks: number;
  currentWeek: number;
  participantACheckIns?: number;
  participantBCheckIns?: number;
  weekProcessed?: boolean;
}

export async function getCommitmentData(groupId: number, commitmentLocalId: number): Promise<CommitmentData | null> {
  try {
    const details = await getCommitmentDetails(groupId, commitmentLocalId);
    if (!details) return null;

    const currentWeek = await getCurrentWeek(groupId, commitmentLocalId);

    // Fetch current week check-ins if commitment is accepted
    let participantACheckIns: number | undefined;
    let participantBCheckIns: number | undefined;
    let weekProcessed: boolean | undefined;

    if (details.accepted && currentWeek < details.durationWeeks) {
      [participantACheckIns, participantBCheckIns, weekProcessed] = await Promise.all([
        getWeeklyCheckIns(groupId, commitmentLocalId, currentWeek, details.participantA),
        getWeeklyCheckIns(groupId, commitmentLocalId, currentWeek, details.participantB),
        isWeekProcessed(groupId, commitmentLocalId, currentWeek),
      ]);
    }

    return {
      id: commitmentLocalId,
      ...details,
      currentWeek,
      participantACheckIns,
      participantBCheckIns,
      weekProcessed,
    };
  } catch (error) {
    console.error("Error getting commitment data:", error);
    return null;
  }
}
