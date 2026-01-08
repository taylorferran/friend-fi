/**
 * Movement Network Indexer Client
 * 
 * GraphQL endpoint: https://indexer.testnet.movementnetwork.xyz/v1/graphql
 * 
 * This module provides functions to query indexed blockchain data including:
 * - Token balances (USDC)
 * - Contract events (WagerPlacedEvent, PayoutPaidEvent, BetResolvedEvent)
 */

import { CONTRACT_ADDRESS, PREDICTION_MODULE, GROUPS_MODULE } from './contract';

const INDEXER_URL = 'https://indexer.testnet.movementnetwork.xyz/v1/graphql';

// Test USDC on Movement testnet (custom deployed)
// This matches the metadata address from our test_usdc module
const USDC_ASSET_TYPE = '0x9cdf923fb59947421487b61b19f9cacb172d971a755d6bb34f69474148c11ada';

// Note: The indexer queries events from different modules:
// - Prediction events (WagerPlacedEvent, BetResolvedEvent, etc.) come from PREDICTION_MODULE
// - Group events (GroupCreatedEvent, MemberJoinedEvent) come from GROUPS_MODULE

// Helper to execute GraphQL queries
async function executeQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(INDEXER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Indexer request failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(result.errors[0]?.message || 'GraphQL query failed');
  }

  return result.data;
}

// ==================== Token Balance Queries ====================

export interface TokenBalance {
  assetType: string;
  amount: string;
  lastTransactionTimestamp: string;
}

/**
 * Get all token balances for an address
 */
export async function getTokenBalances(ownerAddress: string): Promise<TokenBalance[]> {
  const query = `
    query GetUserTokenBalances($owner: String!) {
      current_fungible_asset_balances(
        where: {
          owner_address: {_eq: $owner},
          amount: {_gt: "0"}
        }
      ) {
        asset_type
        amount
        last_transaction_timestamp
      }
    }
  `;

  try {
    const data = await executeQuery<{
      current_fungible_asset_balances: Array<{
        asset_type: string;
        amount: string;
        last_transaction_timestamp: string;
      }>;
    }>(query, { owner: ownerAddress });

    return data.current_fungible_asset_balances.map(b => ({
      assetType: b.asset_type,
      amount: b.amount,
      lastTransactionTimestamp: b.last_transaction_timestamp,
    }));
  } catch (error) {
    console.error('Error fetching token balances:', error);
    return [];
  }
}

/**
 * Get USDC balance for an address
 * Returns the balance in smallest units (6 decimals)
 */
export async function getUSDCBalance(ownerAddress: string): Promise<number> {
  console.log(`[getUSDCBalance] Checking balance for address: ${ownerAddress}`);
  
  // FAST PATH: Query blockchain directly first (for immediate balance)
  // This bypasses the indexer which can be slow to update
  try {
    const { aptos } = await import('./contract');
    console.log(`[getUSDCBalance] Attempting direct query: test_usdc::balance_of`);
    const directBalance = await aptos.view({
      payload: {
        function: '0x0f436484bf8ea80c6116d728fd1904615ee59ec6606867e80d1fa2c241b3346f::test_usdc::balance_of' as `${string}::${string}::${string}`,
        typeArguments: [],
        functionArguments: [ownerAddress],
      },
    });
    
    console.log(`[getUSDCBalance] Direct query raw result:`, directBalance);
    
    if (directBalance && directBalance[0]) {
      const balance = Number(directBalance[0]);
      console.log(`[USDC Balance] Direct query: ${balance} micro-USDC (${balance / 1_000_000} USDC)`);
      return balance;
    } else {
      console.warn(`[getUSDCBalance] Direct query returned falsy result:`, directBalance);
    }
  } catch (directError) {
    console.error('[USDC Balance] Direct query failed, falling back to indexer:', directError);
  }

  // FALLBACK: Use indexer (slower but more reliable for older balances)
  // Get ALL balances for this user and find USDC.E
  const query = `
    query GetAllBalances($owner: String!) {
      current_fungible_asset_balances(
        where: {
          owner_address: {_eq: $owner},
          amount: {_gt: "0"}
        }
      ) {
        asset_type
        amount
      }
    }
  `;

  try {
    const data = await executeQuery<{
      current_fungible_asset_balances: Array<{ asset_type: string; amount: string }>;
    }>(query, { owner: ownerAddress });

    // Look for USDC.E - matches the known USDC address or contains "usdc"
    const usdcBalance = data.current_fungible_asset_balances.find(
      b => b.asset_type.includes(USDC_ASSET_TYPE) || 
           b.asset_type.toLowerCase().includes('usdc')
    );

    if (usdcBalance) {
      console.log(`[USDC Balance] Indexer query: ${usdcBalance.amount} micro-USDC`);
      return Number(usdcBalance.amount);
    }
    
    console.log('[USDC Balance] No USDC found in indexer');
    return 0;
  } catch (error) {
    console.error('Error fetching USDC balance:', error);
    return 0;
  }
}

// ==================== Contract Event Queries ====================

// Build the event type string for prediction events
function getPredictionEventType(eventName: string): string {
  return `${CONTRACT_ADDRESS}::${PREDICTION_MODULE}::${eventName}`;
}

// Build the event type string for group events
function getGroupEventType(eventName: string): string {
  return `${CONTRACT_ADDRESS}::${GROUPS_MODULE}::${eventName}`;
}

export interface WagerPlacedEvent {
  betId: number;
  bettor: string;
  outcomeIndex: number;
  amount: number;
  totalWager: number;
  transactionVersion: number;
  transactionTimestamp: string;
}

export interface PayoutPaidEvent {
  betId: number;
  bettor: string;
  payoutAmount: number;
  transactionVersion: number;
  transactionTimestamp: string;
}

export interface BetResolvedEvent {
  betId: number;
  resolver: string;
  winningOutcomeIndex: number;
  transactionVersion: number;
  transactionTimestamp: string;
}

/**
 * Get all wagers placed on a specific bet
 */
export async function getBetWagers(betId: number): Promise<WagerPlacedEvent[]> {
  // Query events table for WagerPlacedEvent
  const query = `
    query GetBetWagers($eventType: String!, $betId: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {bet_id: $betId}}
        },
        order_by: {transaction_version: asc}
      ) {
        transaction_version
        transaction_block_height
        data
        sequence_number
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        transaction_version: number;
        data: {
          bet_id: string;
          bettor: string;
          outcome_index: string;
          amount: string;
          total_wager: string;
        };
      }>;
    }>(query, { 
      eventType: getPredictionEventType('WagerPlacedEvent'),
      betId: betId.toString()
    });

    return data.events.map(e => ({
      betId: Number(e.data.bet_id),
      bettor: e.data.bettor,
      outcomeIndex: Number(e.data.outcome_index),
      amount: Number(e.data.amount),
      totalWager: Number(e.data.total_wager),
      transactionVersion: e.transaction_version,
      transactionTimestamp: '', // May need separate query
    }));
  } catch (error) {
    console.error('Error fetching bet wagers:', error);
    return [];
  }
}

/**
 * Get all payouts for a specific bet
 */
export async function getBetPayouts(betId: number): Promise<PayoutPaidEvent[]> {
  const query = `
    query GetBetPayouts($eventType: String!, $betId: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {bet_id: $betId}}
        },
        order_by: {transaction_version: asc}
      ) {
        transaction_version
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        transaction_version: number;
        data: {
          bet_id: string;
          bettor: string;
          payout_amount: string;
        };
      }>;
    }>(query, {
      eventType: getPredictionEventType('PayoutPaidEvent'),
      betId: betId.toString()
    });

    return data.events.map(e => ({
      betId: Number(e.data.bet_id),
      bettor: e.data.bettor,
      payoutAmount: Number(e.data.payout_amount),
      transactionVersion: e.transaction_version,
      transactionTimestamp: '',
    }));
  } catch (error) {
    console.error('Error fetching bet payouts:', error);
    return [];
  }
}

/**
 * Get resolution info for a bet
 */
export async function getBetResolutionEvent(betId: number): Promise<BetResolvedEvent | null> {
  const query = `
    query GetBetResolution($eventType: String!, $betId: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {bet_id: $betId}}
        },
        limit: 1
      ) {
        transaction_version
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        transaction_version: number;
        data: {
          bet_id: string;
          resolver: string;
          winning_outcome_index: string;
        };
      }>;
    }>(query, {
      eventType: getPredictionEventType('BetResolvedEvent'),
      betId: betId.toString()
    });

    if (data.events.length === 0) return null;

    const e = data.events[0];
    return {
      betId: Number(e.data.bet_id),
      resolver: e.data.resolver,
      winningOutcomeIndex: Number(e.data.winning_outcome_index),
      transactionVersion: e.transaction_version,
      transactionTimestamp: '',
    };
  } catch (error) {
    console.error('Error fetching bet resolution:', error);
    return null;
  }
}

// ==================== Combined Data Types ====================

export interface BettorInfo {
  address: string;
  outcomeIndex: number;
  amount: number;
  payout?: number; // Set after resolution if they won
  isWinner?: boolean;
}

/**
 * Get comprehensive betting info for a bet including all bettors and payouts
 */
export async function getCompleteBetInfo(betId: number): Promise<{
  wagers: BettorInfo[];
  resolved: boolean;
  winningOutcomeIndex?: number;
  resolver?: string;
}> {
  try {
    const [wagers, payouts, resolution] = await Promise.all([
      getBetWagers(betId),
      getBetPayouts(betId),
      getBetResolutionEvent(betId),
    ]);

    // Create a map of bettor -> latest wager info (in case they updated their bet)
    const bettorMap = new Map<string, BettorInfo>();
    
    for (const wager of wagers) {
      // Update or create entry - totalWager represents their cumulative wager
      bettorMap.set(wager.bettor, {
        address: wager.bettor,
        outcomeIndex: wager.outcomeIndex,
        amount: wager.totalWager, // Use total wager, not individual wager amount
      });
    }

    // If resolved, add payout info
    if (resolution) {
      const payoutMap = new Map<string, number>();
      for (const payout of payouts) {
        payoutMap.set(payout.bettor, payout.payoutAmount);
      }

      for (const [address, info] of bettorMap.entries()) {
        const payout = payoutMap.get(address);
        if (payout !== undefined) {
          info.payout = payout;
          info.isWinner = true;
        } else {
          info.isWinner = info.outcomeIndex === resolution.winningOutcomeIndex;
          info.payout = info.isWinner ? undefined : 0; // Losers get 0
        }
      }
    }

    return {
      wagers: Array.from(bettorMap.values()),
      resolved: resolution !== null,
      winningOutcomeIndex: resolution?.winningOutcomeIndex,
      resolver: resolution?.resolver,
    };
  } catch (error) {
    console.error('Error fetching complete bet info:', error);
    return { wagers: [], resolved: false };
  }
}

/**
 * Get all bets a user has participated in
 */
export async function getUserBets(userAddress: string): Promise<number[]> {
  const query = `
    query GetUserBets($eventType: String!, $bettor: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {bettor: $bettor}}
        },
        order_by: {transaction_version: desc}
      ) {
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        data: { bet_id: string };
      }>;
    }>(query, {
      eventType: getPredictionEventType('WagerPlacedEvent'),
      bettor: userAddress
    });

    // Get unique bet IDs
    const betIds = new Set<number>();
    for (const e of data.events) {
      betIds.add(Number(e.data.bet_id));
    }

    return Array.from(betIds);
  } catch (error) {
    console.error('Error fetching user bets:', error);
    return [];
  }
}

/**
 * Get user's total winnings across all bets
 */
export async function getUserTotalWinnings(userAddress: string): Promise<number> {
  const query = `
    query GetUserWinnings($eventType: String!, $bettor: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {bettor: $bettor}}
        }
      ) {
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        data: { payout_amount: string };
      }>;
    }>(query, {
      eventType: getPredictionEventType('PayoutPaidEvent'),
      bettor: userAddress
    });

    return data.events.reduce((sum, e) => sum + Number(e.data.payout_amount), 0);
  } catch (error) {
    console.error('Error fetching user winnings:', error);
    return 0;
  }
}

/**
 * Get all wagers for a specific user
 */
export async function getWagersForUser(userAddress: string): Promise<Array<{ betId: number; amount: number }>> {
  const query = `
    query GetUserWagers($eventType: String!, $bettor: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {bettor: $bettor}}
        }
      ) {
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        data: { bet_id: string; total_wager: string };
      }>;
    }>(query, {
      eventType: getPredictionEventType('WagerPlacedEvent'),
      bettor: userAddress
    });

    // Get the highest total_wager for each bet (final wager amount)
    const betWagers = new Map<number, number>();
    for (const e of data.events) {
      const betId = Number(e.data.bet_id);
      const totalWager = Number(e.data.total_wager);
      // Keep the highest total_wager for each bet
      if (!betWagers.has(betId) || totalWager > betWagers.get(betId)!) {
        betWagers.set(betId, totalWager);
      }
    }
    
    return Array.from(betWagers.entries()).map(([betId, amount]) => ({ betId, amount }));
  } catch (error) {
    console.error('Error fetching user wagers:', error);
    return [];
  }
}

/**
 * Get all payouts for a specific user
 */
export async function getPayoutsForUser(userAddress: string): Promise<Array<{ betId: number; amount: number }>> {
  const query = `
    query GetUserPayouts($eventType: String!, $bettor: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {bettor: $bettor}}
        }
      ) {
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        data: { bet_id: string; payout_amount: string };
      }>;
    }>(query, {
      eventType: getPredictionEventType('PayoutPaidEvent'),
      bettor: userAddress
    });

    return data.events.map(e => ({
      betId: Number(e.data.bet_id),
      amount: Number(e.data.payout_amount),
    }));
  } catch (error) {
    console.error('Error fetching user payouts:', error);
    return [];
  }
}

/**
 * Get user's total wagered across all bets
 */
export async function getUserTotalWagered(userAddress: string): Promise<number> {
  const query = `
    query GetUserWagers($eventType: String!, $bettor: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {bettor: $bettor}}
        }
      ) {
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        data: { bet_id: string; total_wager: string };
      }>;
    }>(query, {
      eventType: getPredictionEventType('WagerPlacedEvent'),
      bettor: userAddress
    });

    // Get the last (highest) total_wager for each bet
    const betWagers = new Map<string, number>();
    for (const e of data.events) {
      const betId = e.data.bet_id;
      const totalWager = Number(e.data.total_wager);
      // Keep the highest total_wager for each bet (latest cumulative amount)
      if (!betWagers.has(betId) || totalWager > betWagers.get(betId)!) {
        betWagers.set(betId, totalWager);
      }
    }
    
    // Sum all final wagers
    return Array.from(betWagers.values()).reduce((sum, w) => sum + w, 0);
  } catch (error) {
    console.error('Error fetching user wagered:', error);
    return 0;
  }
}

// ==================== Group & Bet Event Queries ====================

export interface GroupCreatedEvent {
  groupId: number;
  creator: string;
  name: string;
  transactionVersion: number;
}

export interface MemberJoinedEvent {
  groupId: number;
  member: string;
  transactionVersion: number;
}

export interface BetCreatedEvent {
  betId: number;
  groupId: number;
  creator: string;
  admin: string;
  description: string;
  transactionVersion: number;
}

export interface IndexedGroup {
  id: number;
  name: string;
  creator: string;
  memberCount: number;
  betCount: number;
}

export interface IndexedBet {
  id: number;
  groupId: number;
  description: string;
  admin: string;
  creator: string;
  resolved: boolean;
  totalPool: number;
}

/**
 * Get all groups created (for finding groups by ID)
 */
export async function getAllGroups(): Promise<GroupCreatedEvent[]> {
  const query = `
    query GetAllGroups($eventType: String!) {
      events(
        where: {
          type: {_eq: $eventType}
        },
        order_by: {transaction_version: asc}
      ) {
        transaction_version
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        transaction_version: number;
        data: {
          group_id: string;
          creator: string;
          name: string;
        };
      }>;
    }>(query, { eventType: getGroupEventType('GroupCreatedEvent') });

    return data.events.map(e => ({
      groupId: Number(e.data.group_id),
      creator: e.data.creator,
      name: e.data.name,
      transactionVersion: e.transaction_version,
    }));
  } catch (error) {
    console.error('Error fetching all groups:', error);
    return [];
  }
}

/**
 * Get all members who joined a specific group
 */
export async function getGroupMembersFromIndexer(groupId: number): Promise<string[]> {
  const query = `
    query GetGroupMembers($eventType: String!, $groupId: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {group_id: $groupId}}
        },
        order_by: {transaction_version: asc}
      ) {
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        data: { group_id: string; member: string };
      }>;
    }>(query, {
      eventType: getGroupEventType('MemberJoinedEvent'),
      groupId: groupId.toString()
    });

    // Get unique members
    const members = new Set<string>();
    for (const e of data.events) {
      members.add(e.data.member);
    }
    return Array.from(members);
  } catch (error) {
    console.error('Error fetching group members:', error);
    return [];
  }
}

/**
 * Get all groups a user is a member of
 */
export async function getUserGroups(userAddress: string): Promise<number[]> {
  const query = `
    query GetUserGroups($eventType: String!, $member: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {member: $member}}
        },
        order_by: {transaction_version: desc}
      ) {
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        data: { group_id: string };
      }>;
    }>(query, {
      eventType: getGroupEventType('MemberJoinedEvent'),
      member: userAddress
    });

    // Get unique group IDs
    const groupIds = new Set<number>();
    for (const e of data.events) {
      groupIds.add(Number(e.data.group_id));
    }
    return Array.from(groupIds);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return [];
  }
}

/**
 * Get all bets created in a specific group
 */
export async function getGroupBetsFromIndexer(groupId: number): Promise<BetCreatedEvent[]> {
  const query = `
    query GetGroupBets($eventType: String!, $groupId: String!) {
      events(
        where: {
          type: {_eq: $eventType},
          data: {_contains: {group_id: $groupId}}
        },
        order_by: {transaction_version: desc}
      ) {
        transaction_version
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        transaction_version: number;
        data: {
          bet_id: string;
          group_id: string;
          creator: string;
          admin: string;
          description: string;
        };
      }>;
    }>(query, {
      eventType: getPredictionEventType('BetCreatedEvent'),
      groupId: groupId.toString()
    });

    return data.events.map(e => ({
      betId: Number(e.data.bet_id),
      groupId: Number(e.data.group_id),
      creator: e.data.creator,
      admin: e.data.admin,
      description: e.data.description,
      transactionVersion: e.transaction_version,
    }));
  } catch (error) {
    console.error('Error fetching group bets:', error);
    return [];
  }
}

/**
 * Get all bets (for quick loading of all bet info)
 */
export async function getAllBets(): Promise<BetCreatedEvent[]> {
  const query = `
    query GetAllBets($eventType: String!) {
      events(
        where: {
          type: {_eq: $eventType}
        },
        order_by: {transaction_version: desc}
      ) {
        transaction_version
        data
      }
    }
  `;

  try {
    const data = await executeQuery<{
      events: Array<{
        transaction_version: number;
        data: {
          bet_id: string;
          group_id: string;
          creator: string;
          admin: string;
          description: string;
        };
      }>;
    }>(query, { eventType: getPredictionEventType('BetCreatedEvent') });

    return data.events.map(e => ({
      betId: Number(e.data.bet_id),
      groupId: Number(e.data.group_id),
      creator: e.data.creator,
      admin: e.data.admin,
      description: e.data.description,
      transactionVersion: e.transaction_version,
    }));
  } catch (error) {
    console.error('Error fetching all bets:', error);
    return [];
  }
}

/**
 * Get comprehensive group data with member and bet counts
 */
export async function getGroupsWithDetails(groupIds: number[]): Promise<IndexedGroup[]> {
  try {
    // Get all group creation events for names
    const allGroups = await getAllGroups();
    const groupMap = new Map<number, GroupCreatedEvent>();
    for (const g of allGroups) {
      groupMap.set(g.groupId, g);
    }

    // Get member counts and bet counts in parallel
    const results = await Promise.all(
      groupIds.map(async (groupId) => {
        const [members, bets] = await Promise.all([
          getGroupMembersFromIndexer(groupId),
          getGroupBetsFromIndexer(groupId),
        ]);

        const groupEvent = groupMap.get(groupId);
        return {
          id: groupId,
          name: groupEvent?.name || `Group #${groupId}`,
          creator: groupEvent?.creator || '',
          memberCount: members.length,
          betCount: bets.length,
        };
      })
    );

    return results;
  } catch (error) {
    console.error('Error fetching groups with details:', error);
    return [];
  }
}

/**
 * Get bet details including pool totals from wager events
 */
export async function getBetDetailsFromIndexer(betId: number): Promise<IndexedBet | null> {
  try {
    // Get bet creation event
    const query = `
      query GetBetCreation($eventType: String!, $betId: String!) {
        events(
          where: {
            type: {_eq: $eventType},
            data: {_contains: {bet_id: $betId}}
          },
          limit: 1
        ) {
          data
        }
      }
    `;

    const data = await executeQuery<{
      events: Array<{
        data: {
          bet_id: string;
          group_id: string;
          creator: string;
          admin: string;
          description: string;
        };
      }>;
    }>(query, {
      eventType: getPredictionEventType('BetCreatedEvent'),
      betId: betId.toString()
    });

    if (data.events.length === 0) return null;

    const betEvent = data.events[0];

    // Get resolution status and total pool from wagers
    const [resolution, wagers] = await Promise.all([
      getBetResolutionEvent(betId),
      getBetWagers(betId),
    ]);

    // Calculate total pool from wagers
    const bettorTotals = new Map<string, number>();
    for (const w of wagers) {
      bettorTotals.set(w.bettor, w.totalWager);
    }
    const totalPool = Array.from(bettorTotals.values()).reduce((sum, w) => sum + w, 0);

    return {
      id: betId,
      groupId: Number(betEvent.data.group_id),
      description: betEvent.data.description,
      admin: betEvent.data.admin,
      creator: betEvent.data.creator,
      resolved: resolution !== null,
      totalPool,
    };
  } catch (error) {
    console.error('Error fetching bet details:', error);
    return null;
  }
}

// ==================== Account Transaction Queries ====================

export interface AccountTransaction {
  version: number;
  success: boolean;
  vmStatus: string;
  hash: string;
  gasUsed: number;
  timestamp: string;
  entryFunctionIdStr: string | null;
  // Parsed function components
  functionAddress?: string;
  functionModule?: string;
  functionName?: string;
}

/**
 * Get transactions for a specific account with detailed information
 * Returns transactions ordered by most recent first
 */
export async function getUserTransactions(
  accountAddress: string,
  limit: number = 50
): Promise<AccountTransaction[]> {
  // Normalize address to Aptos format (64 hex chars) if needed
  const normalizedAddress = accountAddress.startsWith('0x') 
    ? `0x${accountAddress.slice(2).padStart(64, '0')}`
    : `0x${accountAddress.padStart(64, '0')}`;
  
  console.log(`Querying transactions: original=${accountAddress}, normalized=${normalizedAddress}`);
  
  // Simplified approach: Just use account_transactions and user_transactions
  // The Movement indexer has a limited schema compared to standard Aptos
  const query = `
    query GetAccountTransactionVersions($account: String!, $limit: Int!) {
      account_transactions(
        where: { account_address: { _eq: $account } }
        order_by: { transaction_version: desc }
        limit: $limit
      ) {
        transaction_version
      }
    }
  `;

  try {
    const versionsData = await executeQuery<{
      account_transactions: Array<{
        transaction_version: number;
      }>;
    }>(query, { account: normalizedAddress, limit });

    console.log(`Found ${versionsData.account_transactions.length} transaction versions for ${accountAddress}`);

    if (versionsData.account_transactions.length === 0) {
      return [];
    }

    const versions = versionsData.account_transactions.map(tx => tx.transaction_version);

    // Get user transaction details for these versions
    const userTxQuery = `
      query GetUserTransactionDetails($versions: [bigint!]!) {
        user_transactions(
          where: { version: { _in: $versions } }
        ) {
          version
          entry_function_id_str
        }
      }
    `;

    const userTxData = await executeQuery<{
      user_transactions: Array<{
        version: number;
        entry_function_id_str: string | null;
      }>;
    }>(userTxQuery, { versions });

    console.log(`Retrieved ${userTxData.user_transactions.length} user transaction details`);

    // Create a map for quick lookup
    const entryFunctionMap = new Map<number, string | null>();
    for (const utx of userTxData.user_transactions) {
      entryFunctionMap.set(utx.version, utx.entry_function_id_str);
    }

    // Build result from what we have
    // Note: We don't have hash or timestamp easily available, so we'll use version-based placeholders
    return versions.map((version, index) => {
      const entryFunctionIdStr = entryFunctionMap.get(version) || null;
      
      // Parse the entry function id string (format: "0xaddr::module::function")
      let functionAddress, functionModule, functionName;
      if (entryFunctionIdStr) {
        const parts = entryFunctionIdStr.split('::');
        if (parts.length === 3) {
          functionAddress = parts[0];
          functionModule = parts[1];
          functionName = parts[2];
        }
      }

      return {
        version,
        success: true, // Assume success if it's in the chain
        vmStatus: 'Executed',
        hash: `0x${version.toString(16)}`, // Use version as hash placeholder
        gasUsed: 0,
        timestamp: new Date(Date.now() - index * 60000).toISOString(), // Approximate timestamps
        entryFunctionIdStr,
        functionAddress,
        functionModule,
        functionName,
      };
    });
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    console.error('Error details:', error);
    throw error; // Re-throw to see the actual error
  }
}


