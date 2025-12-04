import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// Contract configuration
export const CONTRACT_ADDRESS = "0x9eca6c1a4ff54edb2b6bacfbaa8b070a44d288fff5334942410aad332cc1f7bf";
export const MODULE_NAME = "private_prediction_market";

// Movement Testnet configuration
const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: "https://testnet.movementnetwork.xyz/v1",
  indexer: "https://indexer.testnet.movementnetwork.xyz/v1/graphql",
});

export const aptos = new Aptos(config);

// Helper to build function ID
export function getFunctionId(functionName: string): `${string}::${string}::${string}` {
  return `${CONTRACT_ADDRESS}::${MODULE_NAME}::${functionName}`;
}

// View function helpers
export async function getGroupsCount(): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId("get_groups_count"),
        typeArguments: [],
        functionArguments: [],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting groups count:", error);
    return 0;
  }
}

export async function getBetsCount(): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId("get_bets_count"),
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

export async function checkIfMemberInGroup(groupId: number, memberAddress: string): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId("check_if_member_in_group"),
        typeArguments: [],
        functionArguments: [groupId.toString(), memberAddress],
      },
    });
    return result[0] as boolean;
  } catch (error) {
    console.error("Error checking membership:", error);
    return false;
  }
}

export async function getGroupMembers(groupId: number): Promise<string[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId("get_group_members"),
        typeArguments: [],
        functionArguments: [groupId.toString()],
      },
    });
    return result[0] as string[];
  } catch (error) {
    console.error("Error getting group members:", error);
    return [];
  }
}

export async function getGroupBets(groupId: number): Promise<number[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId("get_group_bets"),
        typeArguments: [],
        functionArguments: [groupId.toString()],
      },
    });
    return (result[0] as string[]).map(Number);
  } catch (error) {
    console.error("Error getting group bets:", error);
    return [];
  }
}

export async function getProfile(address: string): Promise<{ name: string; avatarId: number; exists: boolean }> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId("get_profile"),
        typeArguments: [],
        functionArguments: [address],
      },
    });
    return {
      name: result[0] as string,
      avatarId: Number(result[1]),
      exists: result[2] as boolean,
    };
  } catch (error) {
    console.error("Error getting profile:", error);
    return { name: "", avatarId: 0, exists: false };
  }
}

// Transaction payload builders for use with Privy
export function buildCreateGroupPayload(name: string, password: string) {
  return {
    function: getFunctionId("create_group"),
    typeArguments: [],
    functionArguments: [name, password],
  };
}

export function buildJoinGroupPayload(groupId: number, password: string) {
  return {
    function: getFunctionId("join_group"),
    typeArguments: [],
    functionArguments: [groupId.toString(), password],
  };
}

export function buildSetProfilePayload(name: string, avatarId: number) {
  return {
    function: getFunctionId("set_profile"),
    typeArguments: [],
    functionArguments: [name, avatarId.toString()],
  };
}

export function buildCreateBetPayload(
  groupId: number,
  description: string,
  outcomes: string[],
  adminAddress: string
) {
  return {
    function: getFunctionId("create_bet"),
    typeArguments: [],
    functionArguments: [groupId.toString(), description, outcomes, adminAddress],
  };
}

export function buildPlaceWagerPayload(
  betId: number,
  outcomeIndex: number,
  amount: number
) {
  return {
    function: getFunctionId("place_wager"),
    typeArguments: [],
    functionArguments: [betId.toString(), outcomeIndex.toString(), amount.toString()],
  };
}

export function buildResolveBetPayload(
  betId: number,
  winningOutcomeIndex: number
) {
  return {
    function: getFunctionId("resolve_bet"),
    typeArguments: [],
    functionArguments: [betId.toString(), winningOutcomeIndex.toString()],
  };
}

// Bet view functions
export async function getBetAdmin(betId: number): Promise<string> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId("get_bet_admin"),
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
        function: getFunctionId("get_bet_outcomes_length"),
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
        function: getFunctionId("get_bet_outcome"),
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
        function: getFunctionId("get_bet_outcome_pool"),
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
        function: getFunctionId("get_bet_total_pool"),
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
        function: getFunctionId("is_bet_resolved"),
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
        function: getFunctionId("get_winning_outcome"),
        typeArguments: [],
        functionArguments: [betId.toString()],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting winning outcome:", error);
    return 0;
  }
}

export async function getUserWager(betId: number, userAddress: string): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: getFunctionId("get_user_wager"),
        typeArguments: [],
        functionArguments: [betId.toString(), userAddress],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error("Error getting user wager:", error);
    return 0;
  }
}

// Helper to get full bet data
export interface BetData {
  id: number;
  admin: string;
  outcomes: { label: string; pool: number }[];
  totalPool: number;
  resolved: boolean;
  winningOutcomeIndex: number;
}

export async function getBetData(betId: number): Promise<BetData | null> {
  try {
    const [admin, outcomesLength, totalPool, resolved, winningOutcomeIndex] = await Promise.all([
      getBetAdmin(betId),
      getBetOutcomesLength(betId),
      getBetTotalPool(betId),
      isBetResolved(betId),
      getWinningOutcome(betId),
    ]);

    // Fetch ALL outcomes in PARALLEL (not sequentially!)
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

// Get wager info for a specific user
export interface WagerInfo {
  address: string;
  amount: number;
  outcomeIndex: number;
  profile?: {
    name: string;
    avatarId: number;
  };
}

// Note: The contract doesn't expose a direct way to get all wagers for a bet
// We'll need to track this through events or add a view function to the contract
// For now, we can get individual user wagers if we know their addresses

export async function getUserWagerWithProfile(betId: number, userAddress: string): Promise<WagerInfo | null> {
  try {
    const [wagerAmount, profile] = await Promise.all([
      getUserWager(betId, userAddress),
      getProfile(userAddress),
    ]);
    
    if (wagerAmount === 0) return null;
    
    return {
      address: userAddress,
      amount: wagerAmount,
      outcomeIndex: 0, // We can't get this from the current contract view functions
      profile: profile.exists ? { name: profile.name, avatarId: profile.avatarId } : undefined,
    };
  } catch (error) {
    console.error("Error getting user wager with profile:", error);
    return null;
  }
}

// Get profiles for multiple addresses
export async function getProfiles(addresses: string[]): Promise<Map<string, { name: string; avatarId: number }>> {
  const profiles = new Map<string, { name: string; avatarId: number }>();
  
  await Promise.all(
    addresses.map(async (address) => {
      try {
        const profile = await getProfile(address);
        if (profile.exists) {
          profiles.set(address, { name: profile.name, avatarId: profile.avatarId });
        }
      } catch (error) {
        console.error(`Error getting profile for ${address}:`, error);
      }
    })
  );
  
  return profiles;
}

