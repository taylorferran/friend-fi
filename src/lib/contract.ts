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

