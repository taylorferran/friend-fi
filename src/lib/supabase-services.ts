import { supabase } from './supabase';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Profile {
  wallet_address: string;
  username: string;
  name?: string; // Alias for username (for compatibility)
  avatar_id: number;
  bio?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  password_hash: string;
  admin_address: string;
  created_at?: string;
  updated_at?: string;
}

export interface GroupWithMembers extends Group {
  group_members: GroupMember[];
}

export interface GroupMember {
  group_id: number;
  wallet_address: string;
  joined_at?: string;
}

export interface Expense {
  id: number;
  group_id: number;
  description: string;
  total_amount: string; // bigint stored as string
  payer_address: string;
  split_type: 'equal' | 'exact' | 'percentage';
  created_at?: string;
}

export interface ExpenseSplit {
  expense_id: number;
  participant_address: string;
  amount: string; // bigint stored as string
}

export interface Bet {
  id: number;
  on_chain_bet_id: number;
  group_id: number;
  description: string;
  outcomes: string[]; // JSONB
  admin_address: string;
  encrypted_payload?: Uint8Array;
  created_at?: string;
}

export interface Commitment {
  id: number;
  on_chain_commitment_id?: number;
  group_id: number;
  participant_a: string;
  participant_b: string;
  commitment_name: string;
  weekly_payout: string; // bigint stored as string
  weekly_check_ins_required: number;
  duration_weeks: number;
  start_time?: string;
  created_at?: string;
}

export interface CheckIn {
  id: number;
  commitment_id: number;
  wallet_address: string;
  week: number;
  check_in_count: number;
  notes?: string;
  photo_url?: string;
  created_at?: string;
}

// ============================================================================
// PROFILES
// ============================================================================

export async function getProfileFromSupabase(walletAddress: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - profile doesn't exist
        return null;
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching profile from Supabase:', error);
    return null;
  }
}

export async function upsertProfile(
  walletAddress: string,
  username: string,
  avatarId: number,
  bio?: string
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      wallet_address: walletAddress,
      username,
      avatar_id: avatarId,
      bio,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getProfilesByAddresses(addresses: string[]): Promise<Map<string, Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('wallet_address', addresses);
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return new Map();
  }
  
  const profileMap = new Map<string, Profile>();
  data?.forEach(profile => {
    profileMap.set(profile.wallet_address, profile);
  });
  
  return profileMap;
}

// ============================================================================
// GROUPS
// ============================================================================

export async function getGroupFromSupabase(groupId: number): Promise<GroupWithMembers | null> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*, group_members(*)')
      .eq('id', groupId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching group from Supabase:', error);
    return null;
  }
}

export async function getGroupMembersFromSupabase(groupId: number): Promise<Array<{ wallet_address: string }>> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('wallet_address')
      .eq('group_id', groupId);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching group members from Supabase:', error);
    return [];
  }
}

export async function getAllGroupsForUser(walletAddress: string): Promise<GroupWithMembers[]> {
  try {
    // Get all groups where user is a member
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('wallet_address', walletAddress);
    
    if (memberError) throw memberError;
    if (!memberData || memberData.length === 0) return [];
    
    const groupIds = memberData.map(m => m.group_id);
    
    // Fetch full group data
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('*, group_members(*)')
      .in('id', groupIds);
    
    if (groupsError) throw groupsError;
    
    return groups || [];
  } catch (error) {
    console.error('Error fetching user groups from Supabase:', error);
    return [];
  }
}

export async function createGroupInSupabase(
  name: string,
  description: string,
  passwordHash: string,
  adminAddress: string
): Promise<Group> {
  // First, create the group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      description,
      password_hash: passwordHash,
      admin_address: adminAddress,
    })
    .select()
    .single();
  
  if (groupError) throw groupError;
  
  // Then, add the admin as the first member
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      wallet_address: adminAddress,
    });
  
  if (memberError) {
    console.error('Error adding admin as member:', memberError);
    // Don't fail the group creation if member add fails
  }
  
  return group;
}

export async function addGroupMember(groupId: number, walletAddress: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      wallet_address: walletAddress,
    });
  
  if (error) throw error;
}

export async function removeGroupMember(groupId: number, walletAddress: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('wallet_address', walletAddress);
  
  if (error) throw error;
}

export async function verifyGroupPassword(groupId: number, passwordHash: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('password_hash')
      .eq('id', groupId)
      .single();
    
    if (error || !data) return false;
    
    return data.password_hash === passwordHash;
  } catch (error) {
    console.error('Error verifying group password:', error);
    return false;
  }
}

// ============================================================================
// EXPENSES
// ============================================================================

export async function createExpenseInSupabase(
  groupId: number,
  description: string,
  totalAmount: bigint,
  payerAddress: string,
  splitType: 'equal' | 'exact' | 'percentage',
  splits: Array<{ participantAddress: string; amount: bigint }>
): Promise<Expense> {
  // Insert expense
  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: groupId,
      description,
      total_amount: totalAmount.toString(),
      payer_address: payerAddress,
      split_type: splitType,
    })
    .select()
    .single();
  
  if (expenseError) throw expenseError;
  
  // Insert splits
  if (splits.length > 0) {
    const splitsData = splits.map(split => ({
      expense_id: expense.id,
      participant_address: split.participantAddress,
      amount: split.amount.toString(),
    }));
    
    const { error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splitsData);
    
    if (splitsError) {
      console.error('Error inserting expense splits:', splitsError);
      // Don't fail expense creation if splits fail
    }
  }
  
  return expense;
}

export async function getExpensesForGroup(groupId: number): Promise<Expense[]> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return [];
  }
}

// ============================================================================
// BETS
// ============================================================================

export async function createBetInSupabase(
  onChainBetId: number,
  groupId: number,
  description: string,
  outcomes: string[],
  adminAddress: string,
  encryptedPayload?: Uint8Array
): Promise<Bet> {
  const { data, error } = await supabase
    .from('bets')
    .insert({
      on_chain_bet_id: onChainBetId,
      group_id: groupId,
      description,
      outcomes,
      admin_address: adminAddress,
      encrypted_payload: encryptedPayload,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getBetFromSupabase(onChainBetId: number): Promise<Bet | null> {
  try {
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .eq('on_chain_bet_id', onChainBetId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching bet from Supabase:', error);
    return null;
  }
}

export async function getBetsForGroup(groupId: number): Promise<Bet[]> {
  try {
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching bets for group:', error);
    return [];
  }
}

// ============================================================================
// COMMITMENTS & CHECK-INS
// ============================================================================

export async function createCommitmentInSupabase(
  onChainCommitmentId: number,
  groupId: number,
  participantA: string,
  participantB: string,
  commitmentName: string,
  weeklyPayout: bigint,
  weeklyCheckInsRequired: number,
  durationWeeks: number,
  startTime?: Date
): Promise<Commitment> {
  const { data, error } = await supabase
    .from('commitments')
    .insert({
      on_chain_commitment_id: onChainCommitmentId,
      group_id: groupId,
      participant_a: participantA,
      participant_b: participantB,
      commitment_name: commitmentName,
      weekly_payout: weeklyPayout.toString(),
      weekly_check_ins_required: weeklyCheckInsRequired,
      duration_weeks: durationWeeks,
      start_time: startTime?.toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createCheckInInSupabase(
  commitmentId: number,
  walletAddress: string,
  week: number,
  notes?: string,
  photoUrl?: string
): Promise<CheckIn> {
  // Upsert to handle multiple check-ins in same week
  const { data, error } = await supabase
    .from('check_ins')
    .upsert({
      commitment_id: commitmentId,
      wallet_address: walletAddress,
      week,
      check_in_count: 1, // Will be incremented if already exists
      notes,
      photo_url: photoUrl,
    }, {
      onConflict: 'commitment_id,wallet_address,week',
      ignoreDuplicates: false,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getCheckInsForCommitment(
  commitmentId: number,
  week?: number
): Promise<CheckIn[]> {
  try {
    let query = supabase
      .from('check_ins')
      .select('*')
      .eq('commitment_id', commitmentId);
    
    if (week !== undefined) {
      query = query.eq('week', week);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    return [];
  }
}

