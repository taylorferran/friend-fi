import { supabase } from './supabase';
import { getGroupFromSupabase, createGroupInSupabase, addGroupMember, verifyGroupPassword } from './supabase-services';
import { hashPassword } from './crypto';

/**
 * Get complete group data by merging on-chain and off-chain sources
 * - Membership list: On-chain (source of truth)
 * - Metadata (name, description): Supabase first, fallback to on-chain
 */
export async function getGroupWithMetadata(groupId: number): Promise<{
  id: number;
  name: string;
  description: string;
  admin: string;
  members: string[];
  memberCount: number;
  hasSupabaseData: boolean;
}> {
  try {
    // Groups are now 100% off-chain in Supabase
    const supabaseGroup = await getGroupFromSupabase(groupId);
    
    if (!supabaseGroup) {
      throw new Error('Group not found');
    }
    
    return {
      id: supabaseGroup.id,
      name: supabaseGroup.name || `Group #${groupId}`,
      description: supabaseGroup.description || '',
      admin: supabaseGroup.admin_address,
      members: supabaseGroup.group_members.map((m: any) => m.wallet_address),
      memberCount: supabaseGroup.group_members.length,
      hasSupabaseData: true,
    };
  } catch (error) {
    console.error(`Error getting group with metadata for ${groupId}:`, error);
    throw error;
  }
}

